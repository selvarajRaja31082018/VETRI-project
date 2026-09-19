'use strict';

const ROLES = {
  GATE: 'G',
  OFFICE: 'P',
  REPRESENTATIVE: 'R',
  ADMIN: 'A',
};

const STATUS = {
  REGISTERED: 'REGISTERED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ASSIGNED: 'ASSIGNED',
  WAITING: 'WAITING',
  MEETING: 'MEETING',
  RESOLVED: 'RESOLVED',
  CHECKED_OUT: 'CHECKED_OUT',
  CANCELLED: 'CANCELLED',
};

/** Allowed status transitions. The backend is the only authority on these. */
const STATUS_TRANSITIONS = {
  [STATUS.REGISTERED]: [STATUS.PENDING_APPROVAL, STATUS.CANCELLED],
  // ASSIGNED is reachable directly from PENDING_APPROVAL because the PA's
  // "Approve" action can optionally assign a representative in the same step.
  [STATUS.PENDING_APPROVAL]: [STATUS.APPROVED, STATUS.ASSIGNED, STATUS.REJECTED, STATUS.CANCELLED],
  [STATUS.APPROVED]: [STATUS.ASSIGNED, STATUS.WAITING, STATUS.CANCELLED],
  [STATUS.ASSIGNED]: [STATUS.WAITING, STATUS.MEETING, STATUS.CANCELLED],
  [STATUS.WAITING]: [STATUS.MEETING, STATUS.CANCELLED],
  [STATUS.MEETING]: [STATUS.RESOLVED, STATUS.CANCELLED],
  [STATUS.RESOLVED]: [STATUS.CHECKED_OUT],
  [STATUS.REJECTED]: [STATUS.CHECKED_OUT],
  [STATUS.CHECKED_OUT]: [],
  [STATUS.CANCELLED]: [],
};

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const VISITOR_TYPES = [
  'General Public',
  'Entity Employee',
  'Party Cadre',
  'Govt Staff',
  'Personal',
];

const MEETING_STATUS = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const PERMISSIONS = {
  VISITOR_CREATE: 'visitor.create',
  VISITOR_VIEW: 'visitor.view',
  VISITOR_UPDATE: 'visitor.update',
  REQUEST_VIEW: 'request.view',
  REQUEST_APPROVE: 'request.approve',
  REQUEST_REJECT: 'request.reject',
  REQUEST_ASSIGN: 'request.assign',
  REQUEST_RESOLVE: 'request.resolve',
  MEETING_START: 'meeting.start',
  MEETING_COMPLETE: 'meeting.complete',
  CHECKIN_MANAGE: 'checkin.manage',
  REPORT_VIEW: 'report.view',
  USER_MANAGE: 'user.manage',
  AUDIT_VIEW: 'audit.view',
  SETTINGS_MANAGE: 'settings.manage',
  MASTER_DATA_MANAGE: 'masterdata.manage',
  RESTRICTION_MANAGE: 'restriction.manage',
};

/** Permission matrix from the design document (section 4). */
const ROLE_PERMISSIONS = {
  [ROLES.GATE]: [
    PERMISSIONS.VISITOR_CREATE,
    PERMISSIONS.VISITOR_VIEW,
    PERMISSIONS.VISITOR_UPDATE,
    PERMISSIONS.REQUEST_VIEW,
    PERMISSIONS.CHECKIN_MANAGE,
    PERMISSIONS.REPORT_VIEW,
  ],
  [ROLES.OFFICE]: [
    PERMISSIONS.VISITOR_CREATE,
    PERMISSIONS.VISITOR_VIEW,
    PERMISSIONS.VISITOR_UPDATE,
    PERMISSIONS.REQUEST_VIEW,
    PERMISSIONS.REQUEST_APPROVE,
    PERMISSIONS.REQUEST_REJECT,
    PERMISSIONS.REQUEST_ASSIGN,
    PERMISSIONS.CHECKIN_MANAGE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.RESTRICTION_MANAGE,
  ],
  [ROLES.REPRESENTATIVE]: [
    PERMISSIONS.VISITOR_VIEW,
    PERMISSIONS.REQUEST_VIEW,
    PERMISSIONS.REQUEST_RESOLVE,
    PERMISSIONS.MEETING_START,
    PERMISSIONS.MEETING_COMPLETE,
    PERMISSIONS.REPORT_VIEW,
  ],
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
};

/**
 * Multi-device capture. Device and camera types are recorded against every
 * stored photo so an image can always be traced back to the hardware that
 * produced it.
 */
const DEVICE_TYPES = ['DESKTOP', 'MOBILE', 'TABLET', 'EXTERNAL', 'UNKNOWN'];
const CAMERA_TYPES = ['BUILTIN_WEBCAM', 'MOBILE_FRONT', 'MOBILE_REAR', 'USB_EXTERNAL', 'UNKNOWN'];

const CAPTURE_SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  EXPIRED: 'EXPIRED',
};

const CAPTURE_DEVICE_STATUS = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
};

/** Scopes carried by the short-lived tokens minted for a capture session. */
const CAPTURE_TOKEN_SCOPES = {
  /** Encoded in the QR code; lets an unauthenticated device join the session. */
  JOIN: 'capture:join',
  /** Issued to a device after it joins; authorises uploads for that device. */
  DEVICE: 'capture:device',
  /** Issued to the desktop; authorises the SSE stream (EventSource has no headers). */
  STREAM: 'capture:stream',
};

const CAPTURE_DEFAULTS = {
  /** How long a session accepts new captures. */
  sessionTtlMinutes: 30,
  /** How long the QR code stays scannable. Shorter than the session on purpose. */
  joinTtlMinutes: 10,
  maxDevices: 5,
  /**
   * Maximum Hamming distance (out of 64 dHash bits) at which two photos are
   * treated as the same shot. 0 = byte-identical only; ~10 starts producing
   * false positives on genuinely different faces.
   */
  duplicateHammingThreshold: 6,
  /** Devices that stop sending heartbeats for this long are marked disconnected. */
  heartbeatTimeoutSeconds: 45,
};

module.exports = {
  ROLES,
  STATUS,
  STATUS_TRANSITIONS,
  PRIORITIES,
  VISITOR_TYPES,
  MEETING_STATUS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  DEVICE_TYPES,
  CAMERA_TYPES,
  CAPTURE_SESSION_STATUS,
  CAPTURE_DEVICE_STATUS,
  CAPTURE_TOKEN_SCOPES,
  CAPTURE_DEFAULTS,
};
