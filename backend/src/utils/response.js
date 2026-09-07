'use strict';

function success(res, data = null, message = 'Success', status = 200) {
  return res.status(status).json({ success: true, data, message });
}

function created(res, data = null, message = 'Created') {
  return success(res, data, message, 201);
}

function paginated(res, { rows, total, page, limit }, message = 'Success') {
  return res.status(200).json({
    success: true,
    data: {
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    },
    message,
  });
}

module.exports = { success, created, paginated };
