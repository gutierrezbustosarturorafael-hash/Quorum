const crypto = require('crypto');

const redact = value => String(value || '')
  .replace(/\bmongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, '[MongoDB URI redacted]')
  .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
  .replace(/\b(password|token|secret|authorization|cookie)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[REDACTED]');

const logErrorDetails = (label, error, context = {}) => {
  console.error(label, {
    ...context,
    name: error.name,
    code: error.code,
    message: redact(error.message),
    stack: redact(error.stack)
  });
};

const attachRequestId = (req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

const logRequestError = (label, req, error) => {
  logErrorDetails(label, error, {
    requestId: req.requestId,
    method: req.method,
    path: req.path
  });
};

module.exports = { attachRequestId, logRequestError, logErrorDetails };
