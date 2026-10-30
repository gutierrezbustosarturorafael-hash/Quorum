const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

test('multipart uploads enforce limits, reject unsupported files and clean only staging', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quorum-upload-test-'));
  process.env.UPLOADS_DIR = root;
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { createUpload, withUploadedFileCleanup, moveUploadedFile } = require('../src/utils/uploadFiles');
  const upload = require('../src/middleware/meetingUpload').single('archivo');
  const submit = (middleware, name, mime, content) => new Promise((resolve, reject) => {
    const boundary = 'quorum-test-boundary';
    const body = Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="archivo"; filename="' + name + '"\r\nContent-Type: ' + mime + '\r\n\r\n' + content + '\r\n--' + boundary + '--\r\n');
    const req = Readable.from([body]);
    req.headers = { 'content-type': 'multipart/form-data; boundary=' + boundary, 'content-length': String(body.length) };
    req.method = 'POST';
    middleware(req, {}, error => error ? reject(error) : resolve(req));
  });
  await assert.rejects(submit(upload, 'unsafe.exe', 'application/octet-stream', 'dummy'));
  await assert.rejects(submit(createUpload({ limits: { fileSize: 16 } }).single('archivo'), 'large.pdf', 'application/pdf', 'x'.repeat(32)), { code: 'LIMIT_FILE_SIZE' });
  const req = await submit(upload, 'report.pdf', 'application/pdf', 'dummy-pdf');
  assert.equal(path.dirname(req.file.path), path.join(root, '.staging'));
  const failure = new Error('Simulated persistence failure');
  let received;
  await withUploadedFileCleanup(async () => { throw failure; })(req, {}, error => { received = error; });
  assert.equal(received, failure);
  await assert.rejects(fs.stat(req.file.path), { code: 'ENOENT' });
  const success = await submit(upload, 'report.pdf', 'application/pdf', 'dummy-pdf');
  const destination = path.join(root, 'saved.pdf');
  await withUploadedFileCleanup(async current => moveUploadedFile(current.file, destination))(success, {}, error => assert.fail(error.message));
  assert.equal(await fs.readFile(destination, 'utf8'), 'dummy-pdf');
});
