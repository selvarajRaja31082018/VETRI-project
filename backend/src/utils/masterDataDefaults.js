'use strict';

const { VISITOR_TYPES } = require('./constants');

const DEFAULT_DEPARTMENTS = [
  'Greater Chennai Corporation',
  'Revenue Administration',
  'Social Welfare',
  'School Education',
  'Health & Family Welfare',
  'Public Works Department',
];

const DEFAULT_REASONS = {
  'General Public': ['Grievance submission', 'Ration follow-up', 'Welfare assistance', 'Civic issue', 'Public meeting request'],
  'Entity Employee': ['Employment issue', 'Transfer request'],
  'Party Cadre': ['Party programme', 'Local coordination'],
  'Govt Staff': ['Departmental coordination'],
  Personal: ['Personal meeting request'],
};

module.exports = { DEFAULT_DEPARTMENTS, DEFAULT_REASONS, VISITOR_TYPES };
