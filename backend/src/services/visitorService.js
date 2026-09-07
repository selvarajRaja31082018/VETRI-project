'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const visitorRepository = require('../repositories/visitorRepository');
const visitorRequestRepository = require('../repositories/visitorRequestRepository');
const { STATUS } = require('../utils/constants');
const { writeAudit } = require('../utils/audit');
const { getPagination } = require('../utils/pagination');

async function list(query) {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await visitorRepository.search({
    search: query.search,
    isRestricted: query.restricted === undefined ? undefined : query.restricted,
    limit,
    offset,
  });
  return { rows, total, page, limit };
}

async function getById(id) {
  const visitor = await visitorRepository.findById(id);
  if (!visitor) throw ApiError.notFound('Visitor not found');
  const history = await visitorRepository.historyFor(id);
  return { ...visitor, history };
}

/**
 * Register a visitor and open their visit request in one transaction. A group
 * visit produces one shared request with separate member records.
 */
async function registerVisitor(payload, context) {
  return db.transaction(async (tx) => {
    let visitorId = payload.visitorId || null;
    let visitorCode = null;

    if (visitorId) {
      const existing = await tx.queryOne(
        'SELECT id, visitor_code, is_restricted FROM visitors WHERE id = ? AND deleted_at IS NULL',
        [visitorId],
      );
      if (!existing) throw ApiError.notFound('Visitor not found');
      if (existing.is_restricted) {
        throw ApiError.unprocessable('This visitor is on the restricted list. Follow the escalation procedure.');
      }
      visitorCode = existing.visitor_code;
      await visitorRepository.update(tx, visitorId, {
        name: payload.name,
        mobile: payload.mobile,
        address: payload.address,
        district: payload.district,
        constituency: payload.constituency,
        visitorType: payload.visitorType,
      });
    } else {
      const created = await visitorRepository.create(tx, payload);
      visitorId = created.id;
      visitorCode = created.visitorCode;
    }

    const request = await visitorRequestRepository.create(tx, {
      visitorId,
      createdBy: context.userId,
      purpose: payload.purpose,
      reason: payload.reason,
      grievanceCategory: payload.grievanceCategory,
      personToMeet: payload.personToMeet,
      groupSize: payload.groupSize || 1,
      priority: payload.priority || 'NORMAL',
      status: STATUS.PENDING_APPROVAL,
    });

    await visitorRequestRepository.addStatusHistory(tx, {
      requestId: request.id,
      oldStatus: STATUS.REGISTERED,
      newStatus: STATUS.PENDING_APPROVAL,
      changedBy: context.userId,
      remarks: 'Registered at gate',
    });

    if (payload.groupMembers && payload.groupMembers.length) {
      await visitorRequestRepository.addGroupMembers(tx, request.id, payload.groupMembers);
    }

    await writeAudit(tx, context, {
      action: 'VISITOR_REGISTERED',
      entityType: 'visitor_request',
      entityId: request.id,
      newValue: {
        visitorId,
        visitorCode,
        requestCode: request.requestCode,
        groupSize: payload.groupSize || 1,
      },
    });

    return {
      visitorId,
      visitorCode,
      requestId: request.id,
      requestCode: request.requestCode,
      status: STATUS.PENDING_APPROVAL,
    };
  });
}

async function updateVisitor(id, payload, context) {
  const existing = await visitorRepository.findById(id);
  if (!existing) throw ApiError.notFound('Visitor not found');

  await db.transaction(async (tx) => {
    await visitorRepository.update(tx, id, payload);
    await writeAudit(tx, context, {
      action: 'VISITOR_UPDATED',
      entityType: 'visitor',
      entityId: id,
      oldValue: existing,
      newValue: payload,
    });
  });

  return visitorRepository.findById(id);
}

/** Returning-visitor lookup by mobile number (prototype: simulated face match). */
async function lookupByMobile(mobile) {
  const visitor = await visitorRepository.findByMobile(mobile);
  if (!visitor) throw ApiError.notFound('No visitor found with this mobile number');
  const history = await visitorRepository.historyFor(visitor.id);
  return {
    ...visitor,
    previousVisits: history.length,
    lastVisit: history.length ? history[0] : null,
    history,
  };
}

module.exports = { list, getById, registerVisitor, updateVisitor, lookupByMobile };
