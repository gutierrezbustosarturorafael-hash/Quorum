require('dotenv').config();
const mongoose = require('mongoose');
require('../src/models/empresaModel');
const { normalizeMeetingStatus, MEETING_STATUSES } = require('../src/utils/meetingStatus');
(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI requerida');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false });
  const collection = mongoose.model('Reunion').collection;
  let planned = 0, updated = 0, unknown = 0;
  for await (const meeting of collection.find({}, { projection: { status: 1, estado: 1, seguimientos: 1 } })) {
    const changes = {};
    const add = (record, prefix = '') => {
      const status = normalizeMeetingStatus(record.status || record.estado);
      if (!MEETING_STATUSES.includes(status)) { unknown++; return; }
      if (record.status !== status) changes[prefix + 'status'] = status;
      if (record.estado !== status) changes[prefix + 'estado'] = status;
    };
    add(meeting);
    (meeting.seguimientos || []).forEach((record, i) => add(record, 'seguimientos.' + i + '.'));
    if (!Object.keys(changes).length) continue;
    planned++;
    if (process.argv.includes('--apply')) {
      // Compare original values, including the embedded array; never overwrite a concurrent edit.
      const filter = { _id: meeting._id, status: Object.hasOwn(meeting, 'status') ? meeting.status : { $exists: false }, estado: Object.hasOwn(meeting, 'estado') ? meeting.estado : { $exists: false }, seguimientos: Object.hasOwn(meeting, 'seguimientos') ? meeting.seguimientos : { $exists: false } };
      updated += (await collection.updateOne(filter, { $set: changes })).modifiedCount;
    }
  }
  console.log({ planned, updated, unknown, apply: process.argv.includes('--apply') });
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
