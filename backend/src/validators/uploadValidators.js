'use strict';

const { z } = require('zod');

const uploadPhoto = {
  body: z.object({
    image: z.string().min(1, 'Image data is required'),
  }),
};

module.exports = { uploadPhoto };
