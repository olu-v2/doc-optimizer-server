exports.success = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
};

exports.error = (res, message, code = 'INTERNAL_ERROR', statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    error: { message, code },
    timestamp: new Date().toISOString(),
  });
};
