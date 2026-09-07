'use strict';

const { z } = require('zod');
const { idParam, paginationQuery, dateRangeQuery, priority } = require('./common');

const list = {
  query: paginationQuery.merge(dateRangeQuery).extend({
    representativeId: z.coerce.number().int().positive().optional(),
    status: z.string().optional(),
    today: z.coerce.boolean().optional(),
  }),
};

const getOne = { params: idParam };

const start = {
  body: z.object({ visitorRequestId: z.coerce.number().int().positive() }),
};

const complete = {
  params: idParam,
  body: z.object({
    remarks: z.string().trim().max(4000).optional(),
    resolution: z.string().trim().max(4000).optional(),
    grievanceCategory: z.string().trim().max(100).optional(),
    priority: priority.optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    targetResolutionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
};

module.exports = { list, getOne, start, complete };
