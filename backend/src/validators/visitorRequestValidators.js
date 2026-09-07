'use strict';

const { z } = require('zod');
const { idParam, paginationQuery, dateRangeQuery, priority } = require('./common');

const list = {
  query: paginationQuery.merge(dateRangeQuery).extend({
    status: z.union([z.string(), z.array(z.string())]).optional(),
    priority: priority.optional(),
    representativeId: z.coerce.number().int().positive().optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    visitorId: z.coerce.number().int().positive().optional(),
    today: z.coerce.boolean().optional(),
  }),
};

const getOne = { params: idParam };

const approve = {
  params: idParam,
  body: z.object({
    remarks: z.string().trim().max(2000).optional(),
    representativeId: z.coerce.number().int().positive().optional(),
  }),
};

const reject = {
  params: idParam,
  body: z.object({ reason: z.string().trim().min(1, 'Rejection reason is required').max(2000) }),
};

const assign = {
  params: idParam,
  body: z.object({
    representativeId: z.coerce.number().int().positive(),
    remarks: z.string().trim().max(2000).optional(),
  }),
};

const queue = {
  params: idParam,
  body: z.object({ remarks: z.string().trim().max(2000).optional() }),
};

const scheduleAppointment = {
  params: idParam,
  body: z.object({
    appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  }),
};

const resolve = {
  params: idParam,
  body: z.object({ resolution: z.string().trim().min(1, 'Resolution is required').max(4000) }),
};

const cancel = {
  params: idParam,
  body: z.object({ reason: z.string().trim().max(2000).optional() }),
};

const setPriority = {
  params: idParam,
  body: z.object({ priority }),
};

const referToDepartment = {
  params: idParam,
  body: z.object({
    departmentId: z.coerce.number().int().positive(),
    remarks: z.string().trim().max(2000).optional(),
  }),
};

const idOnly = { params: idParam };

module.exports = {
  list,
  getOne,
  approve,
  reject,
  assign,
  queue,
  scheduleAppointment,
  resolve,
  cancel,
  setPriority,
  referToDepartment,
  idOnly,
};
