'use strict';

const { z } = require('zod');
const { idParam, visitorType } = require('./common');

const addDepartment = { body: z.object({ name: z.string().trim().min(1).max(150) }) };
const departmentStatus = { params: idParam, body: z.object({ isActive: z.boolean() }) };

const listReasons = { query: z.object({ visitorType: visitorType.optional() }) };
const addReason = {
  body: z.object({
    visitorType,
    reason: z.string().trim().min(1).max(150),
  }),
};
const reasonStatus = { params: idParam, body: z.object({ isActive: z.boolean() }) };

const updateSetting = {
  params: z.object({ key: z.string().trim().min(1).max(150) }),
  body: z.object({ value: z.string().max(4000) }),
};

module.exports = { addDepartment, departmentStatus, listReasons, addReason, reasonStatus, updateSetting };
