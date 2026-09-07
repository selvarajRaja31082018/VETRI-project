'use strict';

const { z } = require('zod');
const { PRIORITIES, VISITOR_TYPES } = require('../utils/constants');

const idParam = z.object({ id: z.coerce.number().int().positive() });

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(200).optional(),
});

const dateRangeQuery = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
});

const mobile = z
  .string()
  .trim()
  .regex(/^[0-9+][0-9\s-]{6,19}$/, 'Enter a valid mobile number');

const priority = z.enum(PRIORITIES);
const visitorType = z.enum(VISITOR_TYPES);

module.exports = { idParam, paginationQuery, dateRangeQuery, mobile, priority, visitorType };
