'use strict';

const { z } = require('zod');
const { idParam, paginationQuery, mobile } = require('./common');
const { ROLES } = require('../utils/constants');

const roleCode = z.enum(Object.values(ROLES));

const list = {
  query: paginationQuery.extend({
    role: roleCode.optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
};

const getOne = { params: idParam };

const create = {
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(150),
    email: z.string().trim().email().optional(),
    mobile: mobile.optional(),
    roleCode,
    designation: z.string().trim().max(150).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    isActive: z.boolean().optional(),
  }).refine((data) => data.email || data.mobile, {
    message: 'Provide an email or mobile number',
    path: ['email'],
  }),
};

const update = {
  params: idParam,
  body: z.object({
    name: z.string().trim().min(1).max(150).optional(),
    email: z.string().trim().email().optional(),
    mobile: mobile.optional(),
    roleCode: roleCode.optional(),
  }),
};

const setStatus = {
  params: idParam,
  body: z.object({ isActive: z.boolean() }),
};

module.exports = { list, getOne, create, update, setStatus };
