const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { MEETING_STATUSES, normalizeMeetingStatus } = require('../src/utils/meetingStatus');
const resolvePath = require('../src/utils/meetingDocumentPath');
test('legacy status aliases have one canonical value and match frontend contract', () => {
  for (const alias of ['en-progreso', 'en_progreso', 'en curso', 'en_curso']) assert.equal(normalizeMeetingStatus(alias), 'en_curso');
  for (const alias of ['completada', 'completado', 'finalizado', 'finalizada', 'cerrada']) assert.equal(normalizeMeetingStatus(alias), 'finalizada');
  assert.deepEqual(MEETING_STATUSES, ['pendiente', 'en_curso', 'finalizada']);
  const backend = fs.readFileSync(path.join(__dirname, '../src/utils/meetingStatus.js'), 'utf8').split('module.exports')[0];
  const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/utils/meetingStatus.js'), 'utf8').split('export {')[0];
  assert.equal(backend, frontend);
});
test('stored paths cannot escape the meeting upload root', () => {
  const root = path.resolve('dummy-uploads/reuniones');
  assert.equal(resolvePath('/uploads/reuniones/123/a.pdf', root), path.join(root, '123/a.pdf'));
  for (const url of ['/uploads/reuniones/../../secret', '/uploads/reuniones/../secret', '/uploads/reuniones/a?x=1', '/other/a.pdf']) assert.throws(() => resolvePath(url, root));
});
