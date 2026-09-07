'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success, paginated } = require('../utils/response');
const service = require('../services/reportService');

function sendCsvOrJson(res, filename, rows, format) {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(service.toCsv(rows));
  }
  return success(res, rows);
}

const visitors = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  if (query.format === 'csv') {
    const rows = await service.visitors(query, req.user, false);
    return sendCsvOrJson(res, 'visitor-register.csv', rows, 'csv');
  }
  const result = await service.visitors(query, req.user);
  paginated(res, result);
});

const requests = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const rows = await service.requests(query, req.user);
  sendCsvOrJson(res, 'request-report.csv', rows, query.format);
});

const meetings = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  if (query.format === 'csv') {
    const { rows } = await service.meetings({ ...query, limit: 5000, page: 1 }, req.user);
    return sendCsvOrJson(res, 'meeting-report.csv', rows, 'csv');
  }
  const result = await service.meetings(query, req.user);
  paginated(res, result);
});

const representatives = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const rows = await service.representatives(query);
  sendCsvOrJson(res, 'representative-performance.csv', rows, query.format);
});

const resolutions = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const rows = await service.resolutions(query);
  sendCsvOrJson(res, 'resolution-report.csv', rows, query.format);
});

const trends = asyncHandler(async (req, res) => {
  const rows = await service.trends(Number(req.query.days) || 14);
  success(res, rows);
});

module.exports = { visitors, requests, meetings, representatives, resolutions, trends };
