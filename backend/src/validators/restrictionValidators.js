'use strict';

const { z } = require('zod');
const { idParam } = require('./common');

const restrict = {
  params: idParam,
  body: z.object({
    reason: z.string().trim().min(1, 'Restriction reason is required').max(2000),
    restrictedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
};

const idOnly = { params: idParam };

module.exports = { restrict, idOnly };
