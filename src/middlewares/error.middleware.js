function notFoundHandler(req, res) {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    message: err.message || 'Internal server error'
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
