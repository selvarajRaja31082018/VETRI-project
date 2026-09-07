'use strict';

const { z } = require('zod');
const { idParam, paginationQuery, mobile, priority, visitorType } = require('./common');

const groupMember = z.object({
  name: z.string().trim().min(1, 'Member name is required'),
  mobile: mobile.optional(),
  identityType: z.string().trim().max(50).optional(),
  identityReference: z.string().trim().max(100).optional(),
  address: z.string().trim().max(1000).optional(),
  photoUrl: z.string().trim().url().optional(),
});

const register = {
  body: z
    .object({
      visitorId: z.coerce.number().int().positive().optional(),
      name: z.string().trim().min(1, 'Visitor name is required').max(150),
      mobile,
      address: z.string().trim().max(1000).optional(),
      district: z.string().trim().max(100).optional(),
      constituency: z.string().trim().max(150).optional(),
      visitorType: visitorType.optional(),
      identityType: z.string().trim().max(50).optional(),
      identityReference: z.string().trim().max(100).optional(),
      photoUrl: z.string().trim().url().optional(),
      purpose: z.string().trim().min(1, 'Purpose is required').max(2000),
      reason: z.string().trim().max(150).optional(),
      grievanceCategory: z.string().trim().max(100).optional(),
      personToMeet: z.string().trim().max(150).optional(),
      priority: priority.optional(),
      groupSize: z.coerce.number().int().min(1).max(50).default(1),
      groupMembers: z.array(groupMember).max(49).optional(),
    })
    .refine(
      (data) => data.groupSize <= 1 || (data.groupMembers && data.groupMembers.length === data.groupSize - 1),
      { message: 'Provide details for every accompanying group member', path: ['groupMembers'] },
    ),
};

const update = {
  params: idParam,
  body: z.object({
    name: z.string().trim().min(1).max(150).optional(),
    mobile: mobile.optional(),
    address: z.string().trim().max(1000).optional(),
    district: z.string().trim().max(100).optional(),
    constituency: z.string().trim().max(150).optional(),
    visitorType: visitorType.optional(),
    identityType: z.string().trim().max(50).optional(),
    identityReference: z.string().trim().max(100).optional(),
    photoUrl: z.string().trim().url().optional(),
  }),
};

const list = { query: paginationQuery.extend({ restricted: z.coerce.boolean().optional() }) };
const getOne = { params: idParam };
const lookup = { query: z.object({ mobile }) };

module.exports = { register, update, list, getOne, lookup };
