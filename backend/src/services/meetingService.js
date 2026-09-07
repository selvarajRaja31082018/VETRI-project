'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const meetingRepository = require('../repositories/meetingRepository');
const visitorRequestRepository = require('../repositories/visitorRequestRepository');
const { writeAudit } = require('../utils/audit');
const { getPagination } = require('../utils/pagination');
const { STATUS, STATUS_TRANSITIONS, MEETING_STATUS, ROLES } = require('../utils/constants');

async function list(query, user) {
  const { page, limit, offset } = getPagination(query);
  const representativeId = user.roleCode === ROLES.REPRESENTATIVE ? user.representativeId : query.representativeId;
  const { rows, total } = await meetingRepository.search(
    { ...query, representativeId },
    { limit, offset },
  );
  return { rows, total, page, limit };
}

async function getById(id, user) {
  const meeting = await meetingRepository.findById(id);
  if (!meeting) throw ApiError.notFound('Meeting not found');
  if (user.roleCode === ROLES.REPRESENTATIVE && meeting.representative_id !== user.representativeId) {
    throw ApiError.forbidden('This meeting is not assigned to you');
  }
  return meeting;
}

/** Create (or resume) a meeting and move the request into MEETING/IN_PROGRESS. */
async function start(visitorRequestId, context, user) {
  return db.transaction(async (tx) => {
    const request = await visitorRequestRepository.findByIdForUpdate(tx, visitorRequestId);
    if (!request) throw ApiError.notFound('Visitor request not found');

    const representativeId = user.representativeId;
    if (!representativeId) throw ApiError.forbidden('This account is not linked to a representative profile');
    if (request.representative_id && request.representative_id !== representativeId) {
      throw ApiError.forbidden('This visitor is assigned to a different representative');
    }
    if (![STATUS.ASSIGNED, STATUS.APPROVED, STATUS.WAITING].includes(request.status)) {
      throw ApiError.unprocessable(`Cannot start a meeting while the request is ${request.status}`);
    }

    let meeting = await meetingRepository.findActiveForRequest(tx, visitorRequestId);
    if (!meeting) {
      const meetingId = await meetingRepository.create(tx, {
        visitorRequestId,
        representativeId,
        status: MEETING_STATUS.IN_PROGRESS,
      });
      await meetingRepository.update(tx, meetingId, { startedAt: new Date() });
      meeting = { id: meetingId };
    } else {
      await meetingRepository.update(tx, meeting.id, {
        status: MEETING_STATUS.IN_PROGRESS,
        startedAt: meeting.started_at || new Date(),
      });
    }

    await visitorRequestRepository.update(tx, visitorRequestId, {
      status: STATUS.MEETING,
      representativeId,
    });
    await visitorRequestRepository.addStatusHistory(tx, {
      requestId: visitorRequestId,
      oldStatus: request.status,
      newStatus: STATUS.MEETING,
      changedBy: context.userId,
      remarks: 'Meeting started',
    });
    await writeAudit(tx, context, {
      action: 'MEETING_STARTED',
      entityType: 'meeting',
      entityId: meeting.id,
      newValue: { visitorRequestId, representativeId },
    });

    return meeting.id;
  }).then((meetingId) => meetingRepository.findById(meetingId));
}

/**
 * Record grievance details and complete the meeting. Per the visitor status
 * model, recording a resolution here also moves the request straight to
 * RESOLVED - a representative does not need a second explicit "resolve" call
 * for the common case where the meeting outcome IS the resolution. The
 * standalone /visitor-requests/:id/resolve endpoint remains available for a
 * resolution recorded without a formal meeting.
 */
async function complete(id, payload, context, user) {
  const { remarks, resolution, grievanceCategory, priority, departmentId, targetResolutionDate, followUpDate } = payload;

  await db.transaction(async (tx) => {
    const meeting = await meetingRepository.findByIdForUpdate(tx, id);
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (user.roleCode === ROLES.REPRESENTATIVE && meeting.representative_id !== user.representativeId) {
      throw ApiError.forbidden('This meeting is not assigned to you');
    }
    if (meeting.status === MEETING_STATUS.COMPLETED) {
      throw ApiError.conflict('This meeting has already been completed');
    }

    await meetingRepository.update(tx, id, {
      status: MEETING_STATUS.COMPLETED,
      endedAt: new Date(),
      remarks,
      resolution,
    });

    const request = await visitorRequestRepository.findByIdForUpdate(tx, meeting.visitor_request_id);
    const canResolve = resolution && (STATUS_TRANSITIONS[request.status] || []).includes(STATUS.RESOLVED);

    await visitorRequestRepository.update(tx, request.id, {
      grievanceCategory,
      priority: priority || request.priority,
      departmentId: departmentId || request.department_id,
      ...(canResolve ? { status: STATUS.RESOLVED, resolvedAt: new Date() } : {}),
    });

    if (canResolve) {
      await visitorRequestRepository.addStatusHistory(tx, {
        requestId: request.id,
        oldStatus: request.status,
        newStatus: STATUS.RESOLVED,
        changedBy: context.userId,
        remarks: resolution,
      });
    }

    if (grievanceCategory || departmentId) {
      await tx.query(
        `INSERT INTO complaints (visitor_request_id, category, description, department_id, priority, target_resolution_date, follow_up_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
        [
          request.id,
          grievanceCategory || null,
          resolution || remarks || request.purpose,
          departmentId || null,
          priority || request.priority,
          targetResolutionDate || null,
          followUpDate || null,
        ],
      );
    }

    await writeAudit(tx, context, {
      action: 'MEETING_COMPLETED',
      entityType: 'meeting',
      entityId: id,
      newValue: { resolution, grievanceCategory, departmentId, targetResolutionDate, followUpDate },
    });
  });

  return meetingRepository.findById(id);
}

module.exports = { list, getById, start, complete };
