'use strict';

const { z } = require('zod');
const { paginationQuery, dateRangeQuery } = require('./common');

const query = {
  query: paginationQuery.merge(dateRangeQuery).extend({
    status: z.string().optional(),
    representative: z.coerce.number().int().positive().optional(),
    format: z.enum(['json', 'csv']).optional(),
  }),
};

module.exports = { query };
