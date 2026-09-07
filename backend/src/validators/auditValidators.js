'use strict';

const { z } = require('zod');
const { paginationQuery, dateRangeQuery } = require('./common');

const list = {
  query: paginationQuery.merge(dateRangeQuery).extend({
    userId: z.coerce.number().int().positive().optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
  }),
};

module.exports = { list };
