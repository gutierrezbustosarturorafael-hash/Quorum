const { enforceAuthLimits } = require('../services/authSecurity');

module.exports = async (req, res, next) => {
  try {
    await enforceAuthLimits(req, req.body?.email);
    next();
  } catch (error) {
    if (error.statusCode === 429) {
      res.setHeader('Retry-After', error.retryAfter);
      return res.status(429).json({ success: false, message: error.message });
    }
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
};
