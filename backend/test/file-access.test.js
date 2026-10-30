const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('../src/models/empresaModel');
const sessions = require('../src/services/sessions');
const guard = require('../src/middleware/fileAccess');
const { COOKIE_NAMES } = require('../src/utils/authCookies');
process.env.JWT_SECRET = 'dummy-file-access-secret-with-at-least-32-characters';
afterEach(() => mock.restoreAll());
const response = () => ({ code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, sendStatus(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('documents require the issuing session cookie and deny foreign, expired and revoked access', async () => {
  const empresaId = new mongoose.Types.ObjectId().toString(), sid = 'a'.repeat(64);
  const filePath = '/uploads/planes/' + empresaId + '/plan.pdf';
  let exists = true;
  mock.method(mongoose.model('AuthSession'), 'findById', () => ({ select() { return this; }, lean: async () => ({ role: 'company' }) }));
  mock.method(mongoose.model('Empresa'), 'exists', async () => exists);
  const validate = mock.method(sessions, 'validateSession', async payload => {
    if (payload.type) throw Object.assign(new Error('Wrong token purpose'), { statusCode: 401 });
    return {};
  });
  const link = jwt.sign({ type: 'meeting-file', empresaId, sid, filePath }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const cookie = jwt.sign({ empresaId, sid }, process.env.JWT_SECRET);
  const call = async (sessionCookie, access = link) => {
    const res = response(); let allowed = false;
    await guard({ path: filePath.slice('/uploads'.length), query: { access }, headers: sessionCookie ? { cookie: COOKIE_NAMES.company + '=' + sessionCookie } : {} }, res, () => { allowed = true; });
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    return { res, allowed };
  };
  assert.equal((await call(cookie)).allowed, true);
  assert.equal((await call()).res.code, 401);
  assert.equal((await call(jwt.sign({ empresaId, sid: 'b'.repeat(64) }, process.env.JWT_SECRET))).res.code, 403);
  assert.equal((await call(link)).res.code, 401); // A file token must never serve as a session cookie.
  exists = false;
  assert.equal((await call(cookie)).res.code, 403);
  exists = true;
  const expired = jwt.sign({ type: 'meeting-file', empresaId, sid, filePath }, process.env.JWT_SECRET, { expiresIn: -1 });
  assert.equal((await call(cookie, expired)).res.code, 401);
  validate.mock.mockImplementation(async () => { throw Object.assign(new Error('Revoked'), { statusCode: 401 }); });
  assert.equal((await call(cookie)).res.code, 401);
});

test('public company lookup and pending portal data never resolve the organization directory', async () => {
  const Model = require('../src/models/empresaModel');
  const company = { _id: new mongoose.Types.ObjectId(), nombre: 'Dummy', departamentos: ['Ventas'], directivos: [] };
  const query = value => ({ select() { return this; }, lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
  mock.method(mongoose.model('Empresa'), 'findOne', () => query(company));
  mock.method(mongoose.model('Empresa'), 'findById', () => query(company));
  mock.method(mongoose.model('Empleado'), 'find', () => query([]));
  const directory = mock.method(Model, 'getCompanyOrganizationChart', async () => assert.fail('Must not expose directory'));
  assert.deepEqual((await Model.getEmployeeCompanyByCode('dummy')).organigrama, []);
  assert.deepEqual((await Model.getEmployeePortalData(company._id)).organigrama, []);
  assert.equal(directory.mock.callCount(), 0);
});
