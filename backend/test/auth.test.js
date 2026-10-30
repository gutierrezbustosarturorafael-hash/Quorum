const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { COOKIE_NAMES, setSessionCookie, clearSessionCookies } = require('../src/utils/authCookies');
const companyAuth = require('../src/middleware/auth');
const employeeAuth = require('../src/middleware/employeeAuth');
const reviewerAuth = require('../src/middleware/reviewerAuth');
const csrf = require('../src/middleware/csrf');
const EmpresaModel = require('../src/models/empresaModel');
const authSecurity = require('../src/services/authSecurity');
const sessions = require('../src/services/sessions');
const Controller = require('../src/controllers/empresaController');
process.env.JWT_SECRET = 'dummy-test-secret-with-at-least-32-characters';
const response = () => ({ statusCode: 200, cookies: [], status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; }, append(name, value) { this.cookies.push(value); } });
afterEach(() => mock.restoreAll());

test('logout clears only the requested role, and rejects invalid types without clearing cookies', async () => {
  for (const role of Object.keys(COOKIE_NAMES)) {
    const res = response();
    await Controller.logout({ headers: {}, body: { type: role } }, res);
    assert.equal(res.cookies.length, 1);
    assert.ok(res.cookies[0].startsWith(COOKIE_NAMES[role] + '='));
    assert.match(res.cookies[0], /HttpOnly/);
    assert.match(res.cookies[0], /Max-Age=0/);
  }
  for (const type of [undefined, null, '', 'all', 'constructor', {}, []]) {
    const res = response();
    await Controller.logout({ headers: {}, body: { type } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.cookies.length, 0);
    assert.throws(() => clearSessionCookies({ headers: {} }, response(), type));
  }
});

test('CSRF protects public logout: requires header and checks any supplied Origin', () => {
  const guard = csrf(['https://frontend.example']);
  for (const [method, origin, header, allowed] of [
    ['POST', 'https://evil.example', '1', false],
    ['POST', 'https://frontend.example', undefined, false],
    ['POST', 'https://frontend.example', '1', true],
    ['POST', undefined, '1', true],
    ['GET', undefined, undefined, true]
  ]) {
    let called = false;
    const res = response();
    guard({ method, path: '/auth/logout', get: name => name === 'Origin' ? origin : header }, res, () => { called = true; });
    assert.equal(called, allowed);
    if (!allowed) assert.equal(res.statusCode, 403);
  }
});

test('session cookies authenticate all roles and cannot cross role boundaries', async () => {
  mock.method(EmpresaModel, 'isAdministratorAccount', async () => true);
  mock.method(sessions, 'validateSession', async () => ({}));
  const companyId = new mongoose.Types.ObjectId().toString();
  const tokens = {
    company: jwt.sign({ empresaId: companyId }, process.env.JWT_SECRET),
    employee: jwt.sign({ empresaId: companyId, employeeId: new mongoose.Types.ObjectId().toString(), type: 'employee-account' }, process.env.JWT_SECRET),
    reviewer: jwt.sign({ usuarioId: new mongoose.Types.ObjectId().toString(), role: 'administrator' }, process.env.JWT_SECRET)
  };
  for (const [role, guard] of Object.entries({ company: companyAuth, employee: employeeAuth, reviewer: reviewerAuth })) {
    for (const [source, token] of Object.entries(tokens)) {
      let called = false;
      const req = { headers: { cookie: COOKIE_NAMES[role] + '=' + token } };
      await guard(req, response(), () => { called = true; });
      assert.equal(called, source === role);
    }
    const res = response();
    await guard({ headers: { authorization: 'Bearer ' + tokens[role] } }, res, () => assert.fail('Bearer must not authenticate'));
    assert.equal(res.statusCode, 401);
  }
  const res = response();
  setSessionCookie({ secure: true }, res, 'company', tokens.company, 3600);
  assert.match(res.cookies[0], /HttpOnly; SameSite=None; Secure/);
});

test('malformed email has only an IP bucket; valid email uses normalized identity', async () => {
  const keys = [];
  mock.method(mongoose.model('AuthRateLimit'), 'findOneAndUpdate', async filter => { keys.push(filter._id); return { count: 1, expiresAt: new Date(Date.now() + 60000) }; });
  for (const email of ['', undefined, {}, 'bad-address']) {
    keys.length = 0;
    await assert.rejects(authSecurity.enforceAuthLimits({ ip: '192.0.2.1', path: '/login' }, email), { statusCode: 400 });
    assert.equal(keys.length, 1);
  }
  keys.length = 0;
  await authSecurity.enforceAuthLimits({ ip: '192.0.2.1', path: '/login' }, ' Person@Example.com ');
  const first = [...keys]; keys.length = 0;
  await authSecurity.enforceAuthLimits({ ip: '192.0.2.1', path: '/login' }, 'person@example.com');
  assert.deepEqual(keys, first);
});

test('wrong bootstrap key never resets failures or claims an administrator', async () => {
  process.env.ADMIN_BOOTSTRAP_KEY = 'dummy-bootstrap-key';
  mock.method(EmpresaModel, 'verifyUser', async () => ({ id: new mongoose.Types.ObjectId().toString(), password_hash: 'dummy' }));
  mock.method(require('bcryptjs'), 'compare', async () => true);
  mock.method(EmpresaModel, 'isAdministratorAccount', async () => false);
  const claim = mock.method(EmpresaModel, 'claimFirstAdministrator', async () => assert.fail('must not claim'));
  const reset = mock.method(authSecurity, 'resetLoginFailures', async () => assert.fail('must not reset'));
  const limit = mock.method(authSecurity, 'enforceBootstrapLimits', async () => {});
  const res = response();
  await Controller.reviewerLogin({ body: { email: 'person@example.com', password: 'dummy', adminBootstrapKey: 'wrong' }, ip: '192.0.2.1' }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(claim.mock.callCount(), 0);
  assert.equal(reset.mock.callCount(), 0);
  assert.equal(limit.mock.callCount(), 1);
});
