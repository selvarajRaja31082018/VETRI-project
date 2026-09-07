'use strict';

const reportRepository = require('../repositories/reportRepository');
const { getPagination } = require('../utils/pagination');
const { ROLES } = require('../utils/constants');

function scopeForUser(user, filters) {
  if (user.roleCode === ROLES.REPRESENTATIVE) {
    return { ...filters, representativeId: user.representativeId };
  }
  return filters;
}

async function visitors(query, user, pagination = true) {
  const filters = scopeForUser(user, {
    search: query.search,
    status: query.status,
    representativeId: query.representative,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });
  if (!pagination) {
    return reportRepository.visitorReport(filters, { limit: 5000, offset: 0 });
  }
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await reportRepository.visitorReport(filters, { limit, offset });
  return { rows, total, page, limit };
}

async function requests(query, user) {
  const filters = scopeForUser(user, {
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });
  return reportRepository.requestsByCategory(filters);
}

async function meetings(query, user) {
  const representativeId = user.roleCode === ROLES.REPRESENTATIVE ? user.representativeId : query.representative;
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await reportRepository.meetingReport(
    { representativeId, dateFrom: query.dateFrom, dateTo: query.dateTo },
    { limit, offset },
  );
  return { rows, total, page, limit };
}

async function representatives(query) {
  return reportRepository.representativePerformance({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });
}

async function resolutions(query) {
  return reportRepository.resolutionReport(query);
}

async function trends(days) {
  return reportRepository.visitorsByDay(days);
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

module.exports = { visitors, requests, meetings, representatives, resolutions, trends, toCsv };
