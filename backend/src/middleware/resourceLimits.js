const { enforceRateLimit } = require('../services/authSecurity');
module.exports = (kind, limit = 20) => async (req, res, next) => {
  try {
    await enforceRateLimit(kind + ':company:' + req.user.empresaId, limit, 60000);
    await enforceRateLimit(kind + ':ip:' + req.ip, limit * 2, 60000);
    next();
  } catch (error) {
    if (error.statusCode === 429) res.setHeader('Retry-After', error.retryAfter);
    next(error);
  }
};
