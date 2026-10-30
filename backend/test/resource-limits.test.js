const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const fs = require('fs');
const mongoose = require('mongoose');
require('../src/models/empresaModel');
const budget = require('../src/middleware/uploadBudget');
const resourceLimits = require('../src/middleware/resourceLimits');
process.env.JWT_SECRET = 'dummy-resource-limit-secret-at-least-32-characters';
afterEach(() => { mock.restoreAll(); delete process.env.UPLOAD_COMPANY_QUOTA_BYTES; delete process.env.UPLOAD_VOLUME_QUOTA_BYTES; });
const response = () => Object.assign(new EventEmitter(), { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, destroy() {} });
const request = () => ({ user: { empresaId: new mongoose.Types.ObjectId().toString() }, ip: '192.0.2.1', headers: { 'content-length': '100' }, destroy() {} });
const storageMocks = () => {
  mock.method(mongoose.model('StorageLease'), 'findOneAndUpdate', async () => ({ owner: 'dummy' }));
  const remove = mock.method(mongoose.model('StorageLease'), 'deleteOne', async () => ({}));
  mock.method(mongoose.model('Reunion'), 'find', () => ({ select() { return this; }, lean: async () => [] }));
  mock.method(fs.promises, 'readdir', async () => []);
  mock.method(fs.promises, 'statfs', async () => ({ bavail: 1000000, bsize: 4096 }));
  return remove;
};
test('upload quota rejects before multipart parsing and releases its lease', async () => {
  const remove = storageMocks(); process.env.UPLOAD_COMPANY_QUOTA_BYTES = '50';
  let failure;
  await budget(request(), response(), error => { failure = error; });
  assert.equal(failure.statusCode, 413);
  assert.equal(remove.mock.callCount(), 1);
});
test('volume quota includes the proposed upload even when the company quota allows it', async () => {
  storageMocks(); process.env.UPLOAD_VOLUME_QUOTA_BYTES = '50';
  let failure;
  await budget(request(), response(), error => { failure = error; });
  assert.equal(failure.statusCode, 507);
});
test('an in-progress upload cannot be bypassed by another request', async () => {
  mock.method(mongoose.model('StorageLease'), 'findOneAndUpdate', async () => null);
  mock.method(mongoose.model('StorageLease'), 'create', async () => { throw Object.assign(new Error('occupied'), { code: 11000 }); });
  const res = response();
  await budget(request(), res, () => assert.fail('Must not start another upload'));
  assert.equal(res.code, 429); assert.equal(res.headers['Retry-After'], '5');
});
test('successful upload releases capacity when the response finishes', async () => {
  const remove = storageMocks(); const res = response(); let passed = false;
  await budget(request(), res, error => { assert.equal(error, undefined); passed = true; });
  assert.equal(passed, true); assert.equal(remove.mock.callCount(), 0);
  res.emit('finish'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(remove.mock.callCount(), 1);
});
test('preview rate limit returns a retry interval', async () => {
  mock.method(mongoose.model('AuthRateLimit'), 'findOneAndUpdate', async () => ({ count: 21, expiresAt: new Date(Date.now() + 60000) }));
  const res = response(); let failure;
  await resourceLimits('preview', 20)(request(), res, error => { failure = error; });
  assert.equal(failure.statusCode, 429); assert.ok(res.headers['Retry-After'] > 0);
});
