'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const repo = require('../repositories/visitorRequestRepository');
const masterData = require('../repositories/masterDataRepository');
const meetingRepository = require('../repositories/meetingRepository');
const notificationService = require('./notificationService');
const { writeAudit } = require('../utils/audit');
const { getPagination } = require('../utils/pagination');
const { STATUS, STATUS_TRANSITIONS, ROLES, MEETING_STATUS } = require('../utils/constants');

/** Reject any transition the status model does not allow. */
function assertTransition(from, to) {
  const allowed = STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw ApiError.unprocessable(`Cannot move a request from ${from} to ${to}`);
  }
}

/**
 * Representatives may only see requests assigned to them; every other role sees
 * what its permissions allow. Enforced here, never in the frontend.
 */
function scopeForUser(user, filters) {
  if (user.roleCode === ROLES.REPRESENTATIVE) {
    if (!user.representativeId) {
      throw ApiError.forbidden('This account is not linked to a representative profile');
    }
    return { ...filters, representativeId: user.representativeId };
  }
  return filters;
}

async function list(query, user) {
  const { page, limit, offset } = getPagination(query);
  const filters = scopeForUser(user, {
    search: query.search,
    status: query.status,
    priority: query.priority,
    representativeId: query.representativeId,
    departmentId: query.departmentId,
    visitorId: query.visitorId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    today: query.today,
  });
  const { rows, total } = await repo.search(filters, { limit, offset });
  return { rows, total, page, limit };
}

async function getById(id, user) {
  const request = await repo.findById(id);
  if (!request) throw ApiError.notFound('Visitor request not found');
  if (
    user.roleCode === ROLES.REPRESENTATIVE &&
    request.representative_id !== user.representativeId
  ) {
    throw ApiError.forbidden('This request is not assigned to you');
  }
  const [history, members] = await Promise.all([
    repo.statusHistory(id),
    repo.groupMembers(id),
  ]);
  return { ...request, statusHistory: history, groupMembers: members };
}

/**
 * Single choke point for status changes: locks the row, validates the
 * transition, records history and writes the audit entry.
 */
async function transition(id, { to, remarks, updates = {}, guard }, context, auditAction) {
  return db.transaction(async (tx) => {
    const current = await repo.findByIdForUpdate(tx, id);
    if (!current) throw ApiError.notFound('Visitor request not found');
    if (guard) guard(current);

    assertTransition(current.status, to);

    await repo.update(tx, id, { status: to, ...updates });
    await repo.addStatusHistory(tx, {
      requestId: id,
      oldStatus: current.status,
      newStatus: to,
      changedBy: context.userId,
      remarks,
    });
    await writeAudit(tx, context, {
      action: auditAction,
      entityType: 'visitor_request',
      entityId: id,
      oldValue: { status: current.status, priority: current.priority, representative_id: current.representative_id },
      newValue: { status: to, ...updates },
    });

    return { ...current, status: to, ...updates };
  });
}

async function approve(id, { remarks, representativeId }, context) {
  if (representativeId) {
    const rep = await masterData.findRepresentativeById(representativeId);
    if (!rep || !rep.is_active) throw ApiError.badRequest('Representative not found or inactive');
  }

  const result = await transition(
    id,
    {
      to: representativeId ? STATUS.ASSIGNED : STATUS.APPROVED,
      remarks: remarks || 'Approved by office staff',
      updates: {
        approvedAt: new Date(),
        ...(representativeId ? { representativeId } : {}),
      },
    },
    context,
    'REQUEST_APPROVED',
  );

  if (representativeId) {
    await notificationService.notifyRepresentative(representativeId, {
      title: 'New visitor assigned',
      message: `Request ${result.request_code} is waiting in your meeting queue.`,
    });
  }
  return getById(id, { roleCode: ROLES.ADMIN });
}

async function reject(id, { reason }, context) {
  await transition(
    id,
    {
      to: STATUS.REJECTED,
      remarks: reason,
      updates: { rejectionReason: reason },
    },
    context,
    'REQUEST_REJECTED',
  );
  return getById(id, { roleCode: ROLES.ADMIN });
}

async function assign(id, { representativeId, remarks }, context) {
  const rep = await masterData.findRepresentativeById(representativeId);
  if (!rep || !rep.is_active) throw ApiError.badRequest('Representative not found or inactive');

  await transition(
    id,
    {
      to: STATUS.ASSIGNED,
      remarks: remarks || `Assigned to ${rep.name}`,
      updates: { representativeId },
    },
    context,
    'REPRESENTATIVE_ASSIGNED',
  );

  await notificationService.notifyRepresentative(representativeId, {
    title: 'New visitor assigned',
    message: 'A visitor request has been assigned to you.',
  });
  return getById(id, { roleCode: ROLES.ADMIN });
}

/** PA "Queue" / "Keep waiting" action: move an approved visitor to the waiting room. */
async function queue(id, { remarks }, context) {
  await transition(
    id,
    { to: STATUS.WAITING, remarks: remarks || 'Moved to waiting room' },
    context,
    'REQUEST_QUEUED',
  );
  return getById(id, { roleCode: ROLES.ADMIN });
}

async function resolve(id, { resolution }, context, user) {
  await db.transaction(async (tx) => {
    const current = await repo.findByIdForUpdate(tx, id);
    if (!current) throw ApiError.notFound('Visitor request not found');
    if (
      user.roleCode === ROLES.REPRESENTATIVE &&
      current.representative_id !== user.representativeId
    ) {
      throw ApiError.forbidden('This request is not assigned to you');
    }
    assertTransition(current.status, STATUS.RESOLVED);

    await repo.update(tx, id, { status: STATUS.RESOLVED, resolvedAt: new Date() });
    await repo.addStatusHistory(tx, {
      requestId: id,
      oldStatus: current.status,
      newStatus: STATUS.RESOLVED,
      changedBy: context.userId,
      remarks: resolution,
    });

    const meeting = await meetingRepository.findActiveForRequest(tx, id);
    if (meeting) {
      await meetingRepository.update(tx, meeting.id, {
        status: MEETING_STATUS.COMPLETED,
        endedAt: meeting.ended_at || new Date(),
        resolution,
      });
    }

    await writeAudit(tx, context, {
      action: 'REQUEST_RESOLVED',
      entityType: 'visitor_request',
      entityId: id,
      oldValue: { status: current.status },
      newValue: { status: STATUS.RESOLVED, resolution },
    });
  });

  return getById(id, { roleCode: ROLES.ADMIN });
}

async function cancel(id, { reason }, context) {
  await transition(
    id,
    { to: STATUS.CANCELLED, remarks: reason },
    context,
    'REQUEST_CANCELLED',
  );
  return getById(id, { roleCode: ROLES.ADMIN });
}

async function setPriority(id, { priority }, context) {
  const updated = await db.transaction(async (tx) => {
    const current = await repo.findByIdForUpdate(tx, id);
    if (!current) throw ApiError.notFound('Visitor request not found');
    await repo.update(tx, id, { priority });
    await writeAudit(tx, context, {
      action: 'REQUEST_PRIORITY_CHANGED',
      entityType: 'visitor_request',
      entityId: id,
      oldValue: { priority: current.priority },
      newValue: { priority },
    });
    return current;
  });
  return getById(updated.id, { roleCode: ROLES.ADMIN });
}

async function referToDepartment(id, { departmentId, remarks }, context) {
  const departments = await masterData.listDepartments({ activeOnly: true });
  if (!departments.some((d) => d.id === departmentId)) {
    throw ApiError.badRequest('Department not found or inactive');
  }

  await db.transaction(async (tx) => {
    const current = await repo.findByIdForUpdate(tx, id);
    if (!current) throw ApiError.notFound('Visitor request not found');
    await repo.update(tx, id, { departmentId });
    await repo.addStatusHistory(tx, {
      requestId: id,
      oldStatus: current.status,
      newStatus: current.status,
      changedBy: context.userId,
      remarks: remarks || 'Referred to department',
    });
    await writeAudit(tx, context, {
      action: 'REQUEST_REFERRED',
      entityType: 'visitor_request',
      entityId: id,
      oldValue: { department_id: current.department_id },
      newValue: { department_id: departmentId },
    });
  });

  return getById(id, { roleCode: ROLES.ADMIN });
}

async function checkIn(id, context) {
  const result = await db.transaction(async (tx) => {
    const current = await repo.findByIdForUpdate(tx, id);
    if (!current) throw ApiError.notFound('Visitor request not found');
    if (current.checked_in_at) throw ApiError.conflict('Visitor is already checked in');
    if ([STATUS.CHECKED_OUT, STATUS.CANCELLED].includes(current.status)) {
      throw ApiError.unprocessable('This visit has already been closed');
    }
    await repo.update(tx, id, { checkedInAt: new Date() });
    await writeAudit(tx, context, {
      action: 'VISITOR_CHECKED_IN',
      entityType: 'visitor_request',
      entityId: id,
      newValue: { checked_in_at: new Date().toISOString() },
    });
    return current;
  });
  return getById(result.id, { roleCode: ROLES.ADMIN });
}

async function checkOut(id, context) {
  await db.transaction(async (tx) => {
    const current = await repo.findByIdForUpdate(tx, id);
    if (!current) throw ApiError.notFound('Visitor request not found');
    if (!current.checked_in_at) throw ApiError.unprocessable('Visitor has not been checked in');
    if (current.checked_out_at) throw ApiError.conflict('Visitor is already checked out');

    const canClose = (STATUS_TRANSITIONS[current.status] || []).includes(STATUS.CHECKED_OUT);
    const updates = { checkedOutAt: new Date() };
    if (canClose) updates.status = STATUS.CHECKED_OUT;

    await repo.update(tx, id, updates);
    if (canClose) {
      await repo.addStatusHistory(tx, {
        requestId: id,
        oldStatus: current.status,
        newStatus: STATUS.CHECKED_OUT,
        changedBy: context.userId,
        remarks: 'Visitor checked out',
      });
    }
    await writeAudit(tx, context, {
      action: 'VISITOR_CHECKED_OUT',
      entityType: 'visitor_request',
      entityId: id,
      oldValue: { status: current.status },
      newValue: updates,
    });
  });
  return getById(id, { roleCode: ROLES.ADMIN });
}

/** Role-aware dashboard metrics, all database-backed. */
async function dashboard(user) {
  const scope = user.roleCode === ROLES.REPRESENTATIVE
    ? { representativeId: user.representativeId }
    : {};

  const [allTime, todayCounts] = await Promise.all([
    repo.statusCounts(scope),
    repo.statusCounts({ ...scope, today: true }),
  ]);

  const sum = (counts, statuses) => statuses.reduce((acc, s) => acc + (counts[s] || 0), 0);

  return {
    today: {
      total: Object.values(todayCounts).reduce((a, b) => a + b, 0),
      pending: sum(todayCounts, [STATUS.PENDING_APPROVAL]),
      approved: sum(todayCounts, [STATUS.APPROVED, STATUS.ASSIGNED]),
      waiting: sum(todayCounts, [STATUS.WAITING]),
      inMeeting: sum(todayCounts, [STATUS.MEETING]),
      resolved: sum(todayCounts, [STATUS.RESOLVED, STATUS.CHECKED_OUT]),
      rejected: sum(todayCounts, [STATUS.REJECTED]),
    },
    allTime: {
      total: Object.values(allTime).reduce((a, b) => a + b, 0),
      pending: sum(allTime, [STATUS.PENDING_APPROVAL]),
      approved: sum(allTime, [STATUS.APPROVED, STATUS.ASSIGNED]),
      waiting: sum(allTime, [STATUS.WAITING]),
      inMeeting: sum(allTime, [STATUS.MEETING]),
      resolved: sum(allTime, [STATUS.RESOLVED, STATUS.CHECKED_OUT]),
      rejected: sum(allTime, [STATUS.REJECTED]),
    },
    byStatus: allTime,
  };
}

module.exports = {
  list,
  getById,
  approve,
  reject,
  assign,
  queue,
  resolve,
  cancel,
  setPriority,
  referToDepartment,
  checkIn,
  checkOut,
  dashboard,
  assertTransition,
};
