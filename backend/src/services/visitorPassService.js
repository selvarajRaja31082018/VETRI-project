'use strict';

const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { sendMail, isConfigured } = require('../utils/mailer');
const { writeAudit } = require('../utils/audit');
const visitorRequestRepository = require('../repositories/visitorRequestRepository');
const { STATUS } = require('../utils/constants');

/**
 * Visitor pass: the printable/emailable record of one visit.
 *
 * A pass belongs to a VISIT, not to a person - a returning visitor has one
 * pass per visit, each with its own token, date and queue status. Everything
 * here is derived from the existing registration data; nothing is invented and
 * no new registration state is written.
 */

/** Queue wording the gate and the visitor both understand. */
const QUEUE_LABELS = {
  [STATUS.REGISTERED]: 'Registered',
  [STATUS.PENDING_APPROVAL]: 'Waiting - sent to PA queue',
  [STATUS.APPROVED]: 'Approved',
  [STATUS.ASSIGNED]: 'Assigned to a representative',
  [STATUS.WAITING]: 'Waiting to be called',
  [STATUS.MEETING]: 'In meeting',
  [STATUS.RESOLVED]: 'Resolved',
  [STATUS.CHECKED_OUT]: 'Checked out',
  [STATUS.REJECTED]: 'Not approved',
  [STATUS.CANCELLED]: 'Cancelled',
};

async function loadRequest(id) {
  const request = await visitorRequestRepository.findById(id);
  if (!request) throw ApiError.notFound('Visit request not found');
  return request;
}

/** The URL a scanned QR code opens - an id only, never personal detail. */
function verifyUrl(requestId) {
  return `${env.publicAppUrl}/verify/${requestId}`;
}

/**
 * Full pass payload for the operator's screen, print view and email.
 * Mirrors exactly what was registered - no placeholder values.
 */
function toPassDto(row) {
  return {
    requestId: row.id,
    visitorId: row.visitor_id,
    visitorCode: row.visitor_code,
    tokenNumber: row.request_code,
    fullName: row.visitor_name,
    mobileNumber: row.visitor_mobile,
    email: row.visitor_email || null,
    photoUrl: row.photo_url || null,
    address: row.visitor_address || null,
    district: row.district || null,
    constituency: row.constituency || null,
    visitorType: row.visitor_type || null,
    reason: row.reason || null,
    personToMeet: row.person_to_meet || null,
    purpose: row.purpose,
    priority: row.priority,
    numberOfPersons: row.group_size,
    representativeName: row.representative_name || null,
    departmentName: row.department_name || null,
    registeredAt: row.requested_at,
    status: row.status,
    queueStatus: QUEUE_LABELS[row.status] || row.status,
    verifyUrl: verifyUrl(row.id),
    officeName: 'VETRI',
    officeSubtitle: "People's Service Office",
  };
}

/**
 * Verification payload for a scanned pass. Deliberately narrower than the full
 * pass: enough for a staff member to confirm the person in front of them is
 * the person on the pass, and nothing more. No address, no grievance text.
 */
function toVerifyDto(row) {
  return {
    requestId: row.id,
    tokenNumber: row.request_code,
    visitorCode: row.visitor_code,
    fullName: row.visitor_name,
    photoUrl: row.photo_url || null,
    visitorType: row.visitor_type || null,
    district: row.district || null,
    personToMeet: row.person_to_meet || null,
    numberOfPersons: row.group_size,
    registeredAt: row.requested_at,
    status: row.status,
    queueStatus: QUEUE_LABELS[row.status] || row.status,
    isRestricted: Boolean(row.is_restricted),
  };
}

async function getPass(id) {
  return toPassDto(await loadRequest(id));
}

async function verifyPass(id) {
  return toVerifyDto(await loadRequest(id));
}

/* ------------------------------------------------------------------- email */

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function row(label, value) {
  if (!value) return '';
  return `<tr>
      <td style="padding:6px 0;color:#6d6058;font-size:12px;width:40%;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:#221a1c;font-size:13px;font-weight:600;">${escapeHtml(value)}</td>
    </tr>`;
}

/**
 * Plain, table-based HTML - mail clients ignore most modern CSS, so the pass
 * email is built the way email actually renders rather than reusing the web
 * component. The photo is referenced by its existing public URL.
 */
function buildEmail(pass) {
  const visitDate = new Date(pass.registeredAt);
  const dateText = visitDate.toLocaleDateString('en-GB');
  const timeText = visitDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const html = `<div style="font-family:Segoe UI,system-ui,sans-serif;background:#f6f4f1;padding:24px;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border:1px solid #e7e0d8;border-radius:14px;overflow:hidden;">
    <div style="background:#7a1024;color:#fff;padding:16px 20px;">
      <div style="font-size:16px;font-weight:700;letter-spacing:.04em;">${escapeHtml(pass.officeName)}</div>
      <div style="font-size:12px;opacity:.8;">${escapeHtml(pass.officeSubtitle)}</div>
    </div>
    <div style="padding:20px;">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6d6058;margin-bottom:12px;">Visitor Pass</div>
      ${
        pass.photoUrl
          ? `<img src="${escapeHtml(pass.photoUrl)}" alt="" width="96" height="96"
               style="width:96px;height:96px;object-fit:cover;border-radius:10px;border:1px solid #e7e0d8;margin-bottom:12px;" />`
          : ''
      }
      <div style="font-size:18px;font-weight:700;color:#221a1c;">${escapeHtml(pass.fullName)}</div>
      <div style="font-size:20px;font-weight:800;color:#7a1024;letter-spacing:.06em;margin:6px 0 14px;">${escapeHtml(pass.tokenNumber)}</div>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e7e0d8;">
        ${row('Visitor ID', pass.visitorCode)}
        ${row('Mobile', pass.mobileNumber)}
        ${row('District', pass.district)}
        ${row('Constituency', pass.constituency)}
        ${row('Visitor type', pass.visitorType)}
        ${row('Person to meet', pass.personToMeet)}
        ${row('Reason for visit', pass.reason)}
        ${row('Persons', pass.numberOfPersons)}
        ${row('Visit date', dateText)}
        ${row('Registration time', timeText)}
        ${row('Status', pass.queueStatus)}
      </table>
      <div style="margin-top:16px;padding:12px;background:#faf8f6;border:1px solid #e7e0d8;border-radius:10px;">
        <div style="font-size:12px;color:#6d6058;">Verify this pass at</div>
        <a href="${escapeHtml(pass.verifyUrl)}" style="font-size:12px;color:#7a1024;word-break:break-all;">${escapeHtml(pass.verifyUrl)}</a>
      </div>
      <p style="margin-top:16px;font-size:11px;color:#8c8079;line-height:1.5;">
        Please carry this pass and a photo ID. This pass is valid for the visit shown above only.
      </p>
    </div>
  </div>
</div>`;

  const text = [
    `${pass.officeName} - ${pass.officeSubtitle}`,
    'VISITOR PASS',
    '',
    `Name: ${pass.fullName}`,
    `Token: ${pass.tokenNumber}`,
    `Visitor ID: ${pass.visitorCode}`,
    pass.district ? `District: ${pass.district}` : null,
    pass.visitorType ? `Visitor type: ${pass.visitorType}` : null,
    pass.personToMeet ? `Person to meet: ${pass.personToMeet}` : null,
    `Visit date: ${dateText} ${timeText}`,
    `Status: ${pass.queueStatus}`,
    '',
    `Verify: ${pass.verifyUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text, subject: `Your VETRI visitor pass - ${pass.tokenNumber}` };
}

/**
 * Email the pass for a visit. The address is supplied by the operator (or
 * pre-filled from the visitor record); it is never taken from an unvalidated
 * source, and the send is audited.
 */
async function emailPass(id, email, context) {
  if (!isConfigured()) {
    throw ApiError.unprocessable(
      'Email is not configured on this server. Ask an administrator to set the SMTP environment variables.',
    );
  }

  const pass = await getPass(id);
  const { html, text, subject } = buildEmail(pass);

  await sendMail({ to: email, subject, html, text });

  await writeAudit(null, context, {
    action: 'VISITOR_PASS_EMAILED',
    entityType: 'visitor_request',
    entityId: pass.requestId,
    // The recipient is recorded; the pass body is not duplicated into the log.
    newValue: { tokenNumber: pass.tokenNumber, sentTo: email },
  });

  return { tokenNumber: pass.tokenNumber, sentTo: email };
}

module.exports = { getPass, verifyPass, emailPass, isEmailConfigured: isConfigured };
