require('dotenv').config();
const mongoose = require('mongoose');
require('../src/models/empresaModel');
const { reconcileFiles } = require('../src/services/fileMaintenance');
(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI requerida');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false });
  console.log(JSON.stringify(await reconcileFiles({ apply: process.argv.includes('--apply') }), null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
