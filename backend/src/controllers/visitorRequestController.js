'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { success, paginated } = require('../utils/response');
const service = require('../services/visitorRequestService');
const { auditContext } = require('../utils/audit');

const ctx = (req) => ({ ...auditContext(req), userId: req.user.id });

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.validatedQuery || req.query, req.user);
  paginated(res, result);
});

const getOne = asyncHandler(async (req, res) => {
  const request = await service.getById(req.params.id, req.user);
  success(res, request);
});

const dashboard = asyncHandler(async (req, res) => {
  const metrics = await service.dashboard(req.user);
  success(res, metrics);
});

const approve = asyncHandler(async (req, res) => {
  const result = await service.approve(req.params.id, req.body, ctx(req));
  success(res, result, 'Request approved');
});

const reject = asyncHandler(async (req, res) => {
  const result = await service.reject(req.params.id, req.body, ctx(req));
  success(res, result, 'Request rejected');
});

const assign = asyncHandler(async (req, res) => {
  const result = await service.assign(req.params.id, req.body, ctx(req));
  success(res, result, 'Representative assigned');
});

const queue = asyncHandler(async (req, res) => {
  const result = await service.queue(req.params.id, req.body, ctx(req));
  success(res, result, 'Visitor kept waiting');
});

const scheduleAppointment = asyncHandler(async (req, res) => {
  const result = await service.scheduleAppointment(req.params.id, req.body, ctx(req));
  success(res, result, 'Appointment scheduled');
});

const resolve = asyncHandler(async (req, res) => {
  const result = await service.resolve(req.params.id, req.body, ctx(req), req.user);
  success(res, result, 'Request resolved');
});

const cancel = asyncHandler(async (req, res) => {
  const result = await service.cancel(req.params.id, req.body, ctx(req));
  success(res, result, 'Request cancelled');
});

const setPriority = asyncHandler(async (req, res) => {
  const result = await service.setPriority(req.params.id, req.body, ctx(req));
  success(res, result, 'Priority updated');
});

const referToDepartment = asyncHandler(async (req, res) => {
  const result = await service.referToDepartment(req.params.id, req.body, ctx(req));
  success(res, result, 'Request referred to department');
});

const checkIn = asyncHandler(async (req, res) => {
  const result = await service.checkIn(req.params.id, ctx(req));
  success(res, result, 'Visitor checked in');
});

const checkOut = asyncHandler(async (req, res) => {
  const result = await service.checkOut(req.params.id, ctx(req));
  success(res, result, 'Visitor checked out');
});

module.exports = {
  list,
  getOne,
  dashboard,
  approve,
  reject,
  assign,
  queue,
  scheduleAppointment,
  resolve,
  cancel,
  setPriority,
  referToDepartment,
  checkIn,
  checkOut,
};
