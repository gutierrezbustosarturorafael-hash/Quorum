const crypto = require('crypto');
const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  _id: { type: String },
  accountType: { type: String, enum: ['company', 'employee', 'reviewer'], required: true },
  userId: { type: String, required: true },
  empresaId: { type: String, required: true },
  email: { type: String, required: true },
  claimAdministrator: { type: Boolean, default: false },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });
challengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const rateLimitSchema = new mongoose.Schema({
  _id: { type: String },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthChallenge = mongoose.models.AuthChallenge
  || mongoose.model('AuthChallenge', challengeSchema);
const AuthRateLimit = mongoose.models.AuthRateLimit
  || mongoose.model('AuthRateLimit', rateLimitSchema);

const digest = value => crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(String(value))
  .digest('hex');

const initializeAuthSecurity = async () => {
  await Promise.all([
    AuthChallenge.createIndexes(),
    AuthRateLimit.createIndexes()
  ]);
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
  const normalizedEmail = String(email || '').trim().toLowerCase();
  await enforceRateLimit(`login-ip:${req.ip}`, 30);
  if (!req.path.endsWith('/register')) {
    await enforceRateLimit(`login-email:${normalizedEmail}`, 5);
  }
};

const resetLoginFailures = async email => {
  await AuthRateLimit.deleteOne({
    _id: digest(`login-email:${String(email || '').trim().toLowerCase()}`)
  });
};

const sendChallenge = async (accountType, account) => {
  await enforceRateLimit(`otp-email:${String(account.email).trim().toLowerCase()}`, 5);
  const id = crypto.randomBytes(32).toString('hex');
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await AuthChallenge.create({
    _id: id,
    accountType,
    userId: String(account.userId),
    empresaId: String(account.empresaId),
    email: account.email,
    claimAdministrator: account.claimAdministrator === true,
    codeHash: digest(`${id}:${code}`),
    expiresAt
  });
  try {
    const emailService = require('./emailService');
    await emailService.sendSecurityCode(account.email, code);
  } catch (error) {
    await AuthChallenge.deleteOne({ _id: id });
    throw error;
  }
  return { success: true, requiresTwoFactor: true, challengeId: id, expiresInSeconds: 300 };
};

const verifyChallenge = async (challengeId, code, ip) => {
  await enforceRateLimit(`otp-ip:${ip}`, 30);
  const id = String(challengeId || '');
  const submittedCode = String(code || '');
  if (!/^[a-f\d]{64}$/i.test(id) || !/^\d{6}$/.test(submittedCode)) {
    const error = new Error('El código venció o no es válido.');
    error.statusCode = 401;
    throw error;
  }
  const now = new Date();
  const challenge = await AuthChallenge.findOneAndDelete(
    {
      _id: id,
      codeHash: digest(`${id}:${submittedCode}`),
      attempts: { $lt: 5 },
      expiresAt: { $gt: now }
    },
    { lean: true }
  );
  if (challenge) return challenge;
  const failed = await AuthChallenge.findOneAndUpdate(
    { _id: id, attempts: { $lt: 5 }, expiresAt: { $gt: now } },
    { $inc: { attempts: 1 } },
    { new: true, lean: true }
  );
  if (failed?.attempts >= 5) await AuthChallenge.deleteOne({ _id: id });
  const error = new Error('El código venció o no es válido.');
  error.statusCode = 401;
  throw error;
};

module.exports = {
  initializeAuthSecurity,
  enforceAuthLimits,
  resetLoginFailures,
  sendChallenge,
  verifyChallenge
};
