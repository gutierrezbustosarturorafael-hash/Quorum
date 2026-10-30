const crypto = require('crypto');
const mongoose = require('mongoose');

const rateLimitSchema = new mongoose.Schema({
  _id: { type: String },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthRateLimit = mongoose.models.AuthRateLimit
  || mongoose.model('AuthRateLimit', rateLimitSchema);

const digest = value => crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(String(value))
  .digest('hex');

const initializeAuthSecurity = async () => {
  await AuthRateLimit.createIndexes();
};

const enforceRateLimit = async (key, limit, windowMs = 15 * 60 * 1000) => {
  const now = new Date();
  const keyDigest = digest(key);
  const activeUntil = new Date(now.getTime() + windowMs);
  let next = await AuthRateLimit.findOneAndUpdate(
    { _id: keyDigest, expiresAt: { $lte: now } },
    { $set: { count: 1, expiresAt: activeUntil } },
    { new: true, lean: true }
  );
  if (!next) {
    next = await AuthRateLimit.findOneAndUpdate(
      { _id: keyDigest, expiresAt: { $gt: now } },
      { $inc: { count: 1 } },
      { new: true, lean: true }
    );
  }
  if (!next) {
    try {
      next = await AuthRateLimit.findOneAndUpdate(
        { _id: keyDigest },
        { $setOnInsert: { expiresAt: activeUntil }, $inc: { count: 1 } },
        { upsert: true, new: true, lean: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      next = await AuthRateLimit.findOneAndUpdate(
        { _id: keyDigest, expiresAt: { $gt: now } },
        { $inc: { count: 1 } },
        { new: true, lean: true }
      );
      if (!next) throw error;
    }
  }
  if (next.count > limit) {
    const error = new Error('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
    error.statusCode = 429;
    error.retryAfter = Math.max(1, Math.ceil((next.expiresAt - now) / 1000));
    throw error;
  }
};

const enforceAuthLimits = async (req, email) => {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  await enforceRateLimit(`login-ip:${req.ip}`, 30);
  if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error('El correo no es valido.');
    error.statusCode = 400;
    throw error;
  }
  if (!req.path.endsWith('/register')) {
    await enforceRateLimit(`login-email:${normalizedEmail}`, 5);
  }
};

const enforceBootstrapLimits = async (req, email) => {
  await enforceRateLimit('bootstrap-ip:' + req.ip, 10);
  await enforceRateLimit('bootstrap-email:' + String(email).trim().toLowerCase(), 5);
};

const resetLoginFailures = async email => {
  await AuthRateLimit.deleteOne({
    _id: digest(`login-email:${String(email || '').trim().toLowerCase()}`)
  });
};

module.exports = {
  initializeAuthSecurity,
  enforceRateLimit,
  enforceBootstrapLimits,
  enforceAuthLimits,
  resetLoginFailures
};
