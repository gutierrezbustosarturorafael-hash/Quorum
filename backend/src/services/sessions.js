const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { COOKIE_NAMES, getCookieToken } = require('../utils/authCookies');
const schema = new mongoose.Schema({
  _id: String,
  role: { type: String, enum: ['company', 'employee', 'reviewer'], required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, required: true },
  empresaId: mongoose.Schema.Types.ObjectId,
  credentialDigest: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const AuthSession = mongoose.models.AuthSession || mongoose.model('AuthSession', schema);
const fail = (message = 'La sesion vencio o fue revocada.', statusCode = 401) => Object.assign(new Error(message), { statusCode });
const digest = value => crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(value)).digest('hex');
const checkCompany = async empresaId => {
  const company = await mongoose.model('Empresa').findById(empresaId).select('verificacion.estado').lean();
  if (!company) throw fail();
  if (company.verificacion?.estado === 'suspendida') throw fail('La empresa esta suspendida. Contacta al administrador.', 403);
};
const issueSession = async (role, claims, seconds, expectedPasswordHash) => {
  if (!Object.hasOwn(COOKIE_NAMES, role)) throw fail();
  const Account = mongoose.model(role === 'employee' ? 'Empleado' : 'Usuario');
  const filter = role === 'employee' ? { _id: claims.employeeId, empresaId: claims.empresaId }
    : claims.usuarioId ? { _id: claims.usuarioId } : { empresaId: claims.empresaId, email: claims.email };
  const account = await Account.findOne(filter).select('passwordHash empresaId').lean();
  if (!account?.passwordHash || (expectedPasswordHash && account.passwordHash !== expectedPasswordHash)) throw fail();
  if (role !== 'reviewer') await checkCompany(account.empresaId);
  const sid = crypto.randomBytes(32).toString('hex');
  await AuthSession.create({ _id: sid, role, accountId: account._id, empresaId: account.empresaId, credentialDigest: digest(account.passwordHash), expiresAt: new Date(Date.now() + seconds * 1000) });
  return jwt.sign({ ...claims, sid }, process.env.JWT_SECRET, { expiresIn: seconds, algorithm: 'HS256' });
};
const validateSession = async (payload, role) => {
  const validPurpose = role === 'company' ? !payload.type && !payload.role
    : role === 'employee' ? payload.type === 'employee-account' && !payload.role
    : role === 'reviewer' ? payload.role === 'administrator' && !payload.type : false;
  if (!validPurpose) throw fail();
  if (!/^[a-f0-9]{64}$/.test(payload.sid || '')) throw fail();
  const session = await AuthSession.findOne({ _id: payload.sid, role, expiresAt: { $gt: new Date() } }).lean();
  if (!session) throw fail();
  if (role !== 'reviewer' && String(session.empresaId) !== String(payload.empresaId)) throw fail();
  if (role === 'employee' && String(session.accountId) !== String(payload.employeeId)) throw fail();
  if (role === 'reviewer' && String(session.accountId) !== String(payload.usuarioId)) throw fail();
  const account = await mongoose.model(role === 'employee' ? 'Empleado' : 'Usuario')
    .findOne({ _id: session.accountId, empresaId: session.empresaId }).select('passwordHash').lean();
  if (!account?.passwordHash || digest(account.passwordHash) !== session.credentialDigest) throw fail();
  if (role !== 'reviewer') await checkCompany(session.empresaId);
  return session;
};
const revokeSession = async (req, role) => {
  const token = getCookieToken(req, COOKIE_NAMES[role]);
  if (!token) return;
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { return; }
  if (payload.sid) await AuthSession.deleteOne({ _id: payload.sid, role });
};
module.exports = { issueSession, validateSession, revokeSession, initializeSessions: () => AuthSession.createIndexes() };
