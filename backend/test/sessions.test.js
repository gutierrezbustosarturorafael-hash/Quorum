const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('../src/models/empresaModel');
const sessions = require('../src/services/sessions');
const companyAuth = require('../src/middleware/auth');
const { COOKIE_NAMES } = require('../src/utils/authCookies');
process.env.JWT_SECRET = 'dummy-session-regression-secret-of-sufficient-length';
afterEach(() => mock.restoreAll());
const query = value => ({ select() { return this; }, lean: async () => value });
const response = () => ({ statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });

test('session registry rejects legacy, expired, revoked and password-changed tokens', async () => {
  const accountId = new mongoose.Types.ObjectId(), companyId = new mongoose.Types.ObjectId();
  const payload = { sid: 'a'.repeat(64), empresaId: String(companyId) };
  let record = null;
  let password = 'hash-one';
  mock.method(mongoose.model('AuthSession'), 'findOne', () => query(record));
  mock.method(mongoose.model('Usuario'), 'findOne', () => query({ passwordHash: password }));
  mock.method(mongoose.model('Empresa'), 'findById', () => query({ verificacion: { estado: 'aprobada' } }));
  await assert.rejects(sessions.validateSession({ empresaId: String(companyId) }, 'company'), { statusCode: 401 });
  await assert.rejects(sessions.validateSession({ ...payload, type: 'meeting-file' }, 'company'), { statusCode: 401 });
  await assert.rejects(sessions.validateSession(payload, 'company'), { statusCode: 401 });
  record = { _id: payload.sid, accountId, empresaId: companyId, credentialDigest: crypto.createHmac('sha256', process.env.JWT_SECRET).update(password).digest('hex') };
  assert.equal((await sessions.validateSession(payload, 'company'))._id, payload.sid);
  password = 'hash-two';
  await assert.rejects(sessions.validateSession(payload, 'company'), { statusCode: 401 });
  password = 'hash-one';
  await assert.rejects(sessions.validateSession({ ...payload, empresaId: String(new mongoose.Types.ObjectId()) }, 'company'), { statusCode: 401 });
});

test('company suspension is checked on every protected request, including an existing session', async () => {
  const companyId = String(new mongoose.Types.ObjectId());
  mock.method(sessions, 'validateSession', async () => { throw Object.assign(new Error('suspendida'), { statusCode: 403 }); });
  const token = jwt.sign({ empresaId: companyId, sid: 'a'.repeat(64) }, process.env.JWT_SECRET);
  const res = response();
  await companyAuth({ headers: { cookie: COOKIE_NAMES.company + '=' + token } }, res, () => assert.fail('Suspended access must not reach handler'));
  assert.equal(res.statusCode, 403);
});

test('logout revokes only the selected role and session, and invalid cookies are harmless', async () => {
  const remove = mock.method(mongoose.model('AuthSession'), 'deleteOne', async () => ({ deletedCount: 1 }));
  const sid = 'b'.repeat(64);
  const token = jwt.sign({ sid }, process.env.JWT_SECRET);
  await sessions.revokeSession({ headers: { cookie: COOKIE_NAMES.employee + '=' + token } }, 'employee');
  assert.deepEqual(remove.mock.calls[0].arguments[0], { _id: sid, role: 'employee' });
  await sessions.revokeSession({ headers: { cookie: COOKIE_NAMES.employee + '=invalid' } }, 'employee');
  assert.equal(remove.mock.callCount(), 1);
});

test('new sessions refuse suspended companies and password-change races', async () => {
  const companyId = String(new mongoose.Types.ObjectId());
  mock.method(mongoose.model('Usuario'), 'findOne', () => query({ _id: new mongoose.Types.ObjectId(), empresaId: companyId, passwordHash: 'current' }));
  mock.method(mongoose.model('Empresa'), 'findById', () => query({ verificacion: { estado: 'suspendida' } }));
  await assert.rejects(sessions.issueSession('company', { empresaId: companyId, email: 'dummy@example.test' }, 60, 'old'), { statusCode: 401 });
  await assert.rejects(sessions.issueSession('company', { empresaId: companyId, email: 'dummy@example.test' }, 60, 'current'), { statusCode: 403 });
});
