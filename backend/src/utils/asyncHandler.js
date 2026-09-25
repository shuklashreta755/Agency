// Wraps an async Express route handler so that any rejected promise (DB error,
// thrown exception, etc.) is passed to next(err) instead of becoming an unhandled
// promise rejection — which would otherwise crash the entire Node process.
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
