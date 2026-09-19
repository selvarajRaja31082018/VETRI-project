# Multi-Device Photo Capture

Desktop webcam, USB/external camera and phone cameras all feed one capture
workflow. A desktop operator opens a **capture session**, shows a QR code, and
any number of phones join that session and send photos back in real time.

The existing desktop webcam flow is unchanged: `CameraCapture` still posts to
`POST /uploads/photo` when no session is active, so the feature degrades to
exactly the old behaviour if anything in the new pipeline is unavailable.

---

## 1. Architecture

```
┌────────────────────────┐                       ┌────────────────────────┐
│  Desktop (operator)    │                       │  Phone (scanned QR)    │
│  RegisterVisitorPage   │                       │  MobileCapturePage     │
│  ├ CameraCapture ──────┼──① POST /capture/images                        │
│  └ MobileCameraConnect │                       │  └ CameraCapture logic │
│      └ QR code         │                       │        │               │
└──────────┬─────────────┘                       └────────┼───────────────┘
           │                                              │
           │ ③ SSE  GET /capture/sessions/:id/events      │ ② POST
           │    (device.joined / image.captured / …)      │  /capture/devices/me/images
           ▼                                              ▼
      ┌───────────────────────────────────────────────────────────┐
      │ Express API                                               │
      │  captureRoutes → captureController → captureService       │
      │        │                  │                               │
      │        │                  ├─ imageHash (sha256 + signature)│
      │        │                  ├─ imageUpload (write to disk)   │
      │        │                  └─ captureRepository (MySQL)     │
      │        └─ realtime/sessionBus  (EventEmitter → SSE)        │
      └───────────────────────────────────────────────────────────┘
```

Both capture paths converge on one service function,
`captureService.submitCapture()`. Validation, duplicate detection, storage,
device provenance and the real-time broadcast are therefore identical no matter
which camera took the photo — only the credential proving *who* is uploading
differs.

---

## 2. Why SSE, and not WebSocket or WebRTC

| Option | Verdict |
|---|---|
| **SSE (chosen)** | Traffic is one-directional — the server pushes device and image events to the desktop. Phones only ever POST, which plain HTTP already does well. SSE needs no new dependency, survives proxies, and `EventSource` reconnects automatically. |
| WebSocket | Would add a dependency and a second connection lifecycle to manage for a channel nothing sends *up*. Worth switching to only if desktop→phone commands (remote shutter, "retake that one") are added later. |
| WebRTC | Solves live *video streaming* peer-to-peer. This feature transfers finished stills, so WebRTC's signalling, STUN/TURN and NAT traversal would be pure cost. Reach for it only if the desktop must preview the phone's live viewfinder. |

**Scaling note.** `realtime/sessionBus.js` is an in-process `EventEmitter`, so a
session's desktop subscriber and its phones must be served by the same Node
process. To run multiple instances, swap `publish`/`subscribe` for Redis pub/sub
on a `capture:<sessionId>` channel — nothing outside that one module changes.

---

## 3. Database changes

Appended to `backend/db/schema.sql` (all `CREATE TABLE IF NOT EXISTS`; run
`npm run db:migrate`, no `--fresh` needed).

**`capture_sessions`** — `session_id` (public UUID), `created_by`, `purpose`,
`status` (ACTIVE/CLOSED/EXPIRED), `max_devices`, `duplicate_scope`,
`expires_at`, `closed_at`.

**`capture_devices`** — `device_id` (public UUID), `capture_session_id`,
`device_type`, `camera_type`, `device_label`, `user_agent`, `ip_address`,
`status` (CONNECTED/DISCONNECTED), `joined_at`, `last_seen_at`,
`disconnected_at`.

**`captured_images`** — every field the brief requires, plus the hashes:

| Requirement | Column |
|---|---|
| Session ID | `session_id` (+ FK `capture_session_id`) |
| Device ID | `device_id` (+ FK `capture_device_id`) |
| Device Type | `device_type` |
| Camera Type | `camera_type` |
| Capture Date/Time | `captured_at` |
| Image ID | `image_id` (UUID) |
| Image/File Path | `file_path` (relative) + `file_url` (public) |
| Image Hash | `content_hash` (SHA-256) |
| Perceptual Hash | `perceptual_hash` (dHash) |

plus `image_signature` (32×32 greyscale, the near-identical comparison),
`mime_type`, `file_size`, `width`, `height`, `captured_by`, `status`, and a
`UNIQUE (session_id, content_hash)` constraint for race protection.

`captured_images.session_id`/`device_id` are denormalised next to the FKs so the
photo's provenance survives a session or device row being removed.

---

## 4. Backend API

Base: `/api/v1/capture`. Three credential types, deliberately non-interchangeable
(each is a JWT with a `scope` claim the normal `authenticate` middleware rejects):

- **user session** — the signed-in operator
- **join token** — short-lived (10 min), encoded in the QR, scope `capture:join`
- **device token** — issued on join, lives as long as the session, scope `capture:device`
- **stream token** — for SSE, scope `capture:stream`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/sessions` | user | Open a session → `sessionId`, `joinUrl` (QR), `streamToken` |
| GET | `/sessions/:id` | user | Full snapshot: session + devices + images |
| POST | `/sessions/:id/refresh-qr` | user | New join token without discarding captured photos |
| DELETE | `/sessions/:id` | user | Close the session |
| GET | `/sessions/:id/events?token=` | stream | **SSE** event stream |
| POST | `/images` | user | Desktop / USB capture |
| POST | `/sessions/:id/devices` | join token | A scanned phone joins |
| GET | `/devices/me` | device | What this device may know |
| POST | `/devices/me/heartbeat` | device | Liveness + camera type update |
| POST | `/devices/me/images` | device | Mobile capture |
| DELETE | `/devices/me` | device | Leave the session |

`POST /uploads/photo` is untouched and still works.

### SSE events

`stream.ready`, `device.joined`, `device.left`, `device.state`,
`image.captured`, `image.duplicate`, `session.closed`, plus a `: ping` comment
every 25 s to stop proxies closing an idle connection.

### Security properties

- The join endpoint is the only unauthenticated surface; it is rate-limited
  (20 / 10 min per IP) and requires a valid, short-lived, session-bound token.
- A device token only ever acts on the one session it joined.
- A session may only be read, closed or captured into by its creating operator
  (or an admin) — verified by test.
- Uploads are rate-limited (30 / min) and capped at 5 MB.
- Sessions expire on read as well as by sweep, so a lapsed session is never
  usable even before the sweep runs.

---

## 5. Duplicate detection

**All of it runs on the backend**, on the decoded pixels of the uploaded image.
Nothing the client sends influences the verdict.

### Why the first attempt was wrong

The original implementation compared a 64-bit dHash computed *in the browser*
and rejected anything within 6 bits. Measured on representative frames (same
subject, same background):

| Case | dHash distance |
|---|---|
| duplicate — re-encoded / resized | 0 – 5 |
| **new photo, same person, exposure drift** | **3** |
| **new photo, same person, moved 4px** | **6** |

The two ranges **overlap**, so no dHash threshold can separate them. A dHash
only describes coarse structure, and every photo taken at the same desk shares
that structure. This is why a valid re-capture of the same person was being
rejected.

### What it does now

| Layer | Measure | Catches |
|---|---|---|
| 1 | SHA-256 of decoded bytes | the identical file submitted again |
| 2 | RMSE of a 32×32 greyscale signature | the same shot re-encoded, resized or re-saved |

A photo is a duplicate only when the signature RMSE is **≤ 2.0** grey levels.
Calibrated:

| Case | RMSE | Verdict |
|---|---|---|
| re-encoded q40 – q85, resized, PNG | 0.08 – 1.40 | duplicate |
| same person, moved 2px | 3.26 | **saved** |
| same person, exposure drift | 6.10 | **saved** |
| same person, moved 8px | 10.03 | **saved** |

The dHash is still computed and stored (a cheap, indexable fingerprint) but
**decides nothing**.

### What it deliberately is not

This is image comparison, not face recognition. **Same person ≠ duplicate
photo.** The comparison never looks at visitor, member, name, mobile, device or
session — only at pixels.

### Response

A duplicate returns **HTTP 409**, writes **no file**, creates **no database
row**, and emits **no "photo received"** event:

```json
{
  "success": false,
  "duplicate": true,
  "code": "DUPLICATE_PHOTO",
  "message": "This photo has already been captured. Please capture a new photo.",
  "meta": { "reason": "EXACT | NEAR_IDENTICAL", "distance": 0.41, "originalImageId": "…" },
  "error": { "code": "DUPLICATE_PHOTO", "message": "…", "details": [ … ] }
}
```

The nested `error` object is kept alongside the flat fields so every existing
client and interceptor keeps working unchanged.

### Race protection

Three layers, so two devices posting the same image at the same instant cannot
both be saved:

1. `SELECT … FOR UPDATE` on the session row serialises captures within a
   session, making "check then insert" atomic.
2. The whole check-and-insert runs in one transaction — a rejected photo rolls
   back with nothing written.
3. `UNIQUE (session_id, content_hash)` is the final backstop; whoever loses the
   race is reported as the duplicate it is, not a 500.

Verified: four simultaneous identical uploads → exactly one saved, three 409s.

## 6. Frontend changes

**New**

| File | Role |
|---|---|
| `pages/capture/MobileCapturePage.tsx` | Public page a scanned phone lands on |
| `components/MobileCameraConnect.tsx` | "Connect Mobile Camera" modal: QR, device list, incoming photos |
| `hooks/useCaptureSession.ts` | Opens a session, holds the SSE subscription and state |
| `services/captureService.ts` | API client; separate axios instance for device-token calls |
| `utils/imageHash.ts` | Browser dHash |
| `utils/deviceInfo.ts` | Device/camera classification, camera enumeration |
| `utils/cameraErrors.ts` | Shared `getUserMedia` error messages |

**Changed**

- `components/CameraCapture.tsx` — one new **optional** prop, `sessionId`. Without
  it the component behaves exactly as before. Additions: a camera selector that
  only appears when more than one video input is attached (so USB/external
  cameras work with no UI change on single-camera machines), USB-disconnect
  detection via `track.onended` + `devicechange`, and a `duplicate` state.
- `pages/gate/RegisterVisitorPage.tsx` — wires in the session and the connect panel.
- `App.tsx` — public route `/capture/:sessionId`.
- `vite.config.ts` — `server.host: true` so a phone on the LAN can reach the dev server.

**Status UI.** Desktop shows Connected / Connecting / Reconnecting /
Disconnected / Connection failed, a per-device connected dot, a duplicate
banner in the panel *and* an error toast (so a rejection is visible even with
the panel closed). Mobile shows Connecting / Connected / Capturing / Sending /
Duplicate / Photo sent / Disconnected / Error.

**Duplicate handling.** `isDuplicatePhotoError()` in `services/api.ts` is the
single place that recognises the rejection; `CameraCapture` and
`MobileCapturePage` branch on it explicitly. A duplicate clears the preview,
is never counted as sent, and never enters "Photos received" — the server
stored nothing, so no `image.captured` event is emitted for it. The phone shows
a dedicated **❌ Duplicate Photo** banner.

**Error handling.** Permission denial, no camera found, camera busy, camera
disconnected, insecure context, network failure and duplicates each get their
own actionable message. A phone that loses signal is reaped server-side by
heartbeat timeout (45 s) — more reliable than an unload handler, which mobile
browsers routinely skip.

---

## 7. Deployment requirements

1. **HTTPS is mandatory on the phone.** `getUserMedia` only runs in a secure
   context. `localhost` counts; a bare LAN IP does **not**. Use a tunnel
   (ngrok/cloudflared) or a local TLS cert for development.
2. **`PUBLIC_APP_URL`** (new, backend `.env`) — the origin baked into the QR
   code. Must be an origin the phone can actually reach; defaults to
   `FRONTEND_URL`. It is automatically added to the CORS allow-list.
3. **Run the migration**: `cd backend && npm run db:migrate`.
4. For more than one API instance, replace `sessionBus` with Redis pub/sub
   (see §2).
5. Photos are on local disk under `backend/uploads`. For multi-instance or
   containerised deployments move to object storage — `imageUpload.js`
   (`writeImageBuffer` / `deleteStoredImage`) is the only place to change.

---

## 8. Operator flow

1. Open **Register a Visitor**. The desktop webcam works as it always has.
2. Click **📱 Connect Mobile Camera** — a session opens and a QR code appears.
3. Scan with any phone. It opens the capture page and joins; the desktop shows
   it as **Connected**. Up to 5 devices (configurable) can join the same session.
4. The phone captures; the photo appears on the desktop within the same second.
5. Click **Use this photo** to attach it to the visitor being registered.
6. A repeat shot is rejected on the phone with the duplicate message and never
   stored.

---

## 9. Verification

Two suites were run against a live server and MySQL — **65 assertions, all
passing**, with the test data removed afterwards.

**Duplicate behaviour (22)** — the scenarios from the brief, using synthetic
frames that share subject and background:

| Test | Result |
|---|---|
| 1 — capture Photo A | saved, all 9 metadata fields present |
| 2 — submit Photo A again | 409, exact response shape |
| 2b — re-encoded copy of Photo A | 409 |
| 3 — same person moved / re-posed / exposure drift / both | **all 4 saved** |
| 4, 5 — two devices each capture | both saved, both reached the desktop over SSE |
| 6 — four simultaneous identical uploads | exactly 1 saved, 3 rejected |
| 7 — malformed image | 400 |
| 8 — invalid device token | 401 |
| — duplicates created no rows, no files, no received-photo entries | confirmed |
| — desktop capture obeys the same rules; `/uploads/photo` still works | confirmed |

Also verified: a client sending a *spoofed* perceptual hash cannot change the
verdict, and every stored row has its file on disk and a 1024-byte signature.

**Capture pipeline regression (43)** — session/QR issuance, SSE delivery, two
devices in one session, mobile/tablet/desktop-USB captures, cross-scope token
rejection, cross-operator isolation, legacy endpoint, and captures refused
after a session closes.

Tests 7 and 8 are client-side behaviours (camera permission denial, phone
disconnect); the server contracts they depend on are asserted above, and the
UI paths are `describeCameraError()` and the heartbeat-timeout reaping.
