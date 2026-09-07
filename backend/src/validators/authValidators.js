'use strict';

const { z } = require('zod');

const login = {
  body: z.object({
    identifier: z.string().trim().min(3, 'Email or mobile is required'),
    password: z.string().min(1, 'Password is required'),
  }),
};

module.exports = { login };
