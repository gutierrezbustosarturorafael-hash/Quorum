const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { uploadsRoot } = require('../config/uploads');
const schema = new mongoose.Schema({ _id: String, owner: String, expiresAt: Date }, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Lease = mongoose.models.StorageLease || mongoose.model('StorageLease', schema);
const number = (key, fallback) => Number.isSafeInteger(Number(process.env[key])) && Number(process.env[key]) > 0 ? Number(process.env[key]) : fallback;
const maxRequestBytes = 20 * 15 * 1024 * 1024 + 1024 * 1024;
const sizeOf = async (directory, budget = { entries: 0, limit: 50000 }) => {
  let total = 0;
  let entries;
  try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  for (const entry of entries) {
    if (++budget.entries > budget.limit) throw Object.assign(new Error('Se alcanzo el limite de archivos y carpetas. Revisa el almacenamiento.'), { statusCode: 413 });
    if (entry.isSymbolicLink()) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) total += await sizeOf(filename, budget);
    else if (entry.isFile()) total += (await fs.promises.stat(filename)).size;
  }
  return total;
};
module.exports = async (req, res, next) => {
  const owner = crypto.randomUUID();
  let acquired = false;
  const release = async () => { if (acquired) { acquired = false; await Lease.deleteOne({ _id: 'uploads', owner }).catch(error => console.error('Upload lease cleanup failed:', error.message)); } };
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60000);
    acquired = Boolean(await Lease.findOneAndUpdate({ _id: 'uploads', expiresAt: { $lte: now } }, { $set: { owner, expiresAt } }, { new: true }));
    if (!acquired) {
      try { await Lease.create({ _id: 'uploads', owner, expiresAt }); acquired = true; }
      catch (error) { if (error.code !== 11000) throw error; }
    }
    if (!acquired) { res.setHeader('Retry-After', '5'); return res.status(429).json({ success: false, message: 'Hay una carga de archivos en curso. Intentalo en unos segundos.' }); }
    const length = Number(req.headers['content-length']);
    if (Number.isFinite(length) && length > maxRequestBytes) throw Object.assign(new Error('La carga supera el tamano permitido.'), { statusCode: 413 });
    const reserved = Number.isFinite(length) && length > 0 ? length : maxRequestBytes;
    const space = await fs.promises.statfs(uploadsRoot);
    if (space.bavail * space.bsize < reserved + 64 * 1024 * 1024) throw Object.assign(new Error('No hay espacio suficiente para completar la carga.'), { statusCode: 507 });
    const company = String(req.user.empresaId);
    const meetings = await mongoose.model('Reunion').find({ empresaId: company }).select('_id').lean();
    const companyBudget = { entries: 0, limit: 10000 };
    let companySize = await sizeOf(path.join(uploadsRoot, 'planes', company), companyBudget);
    for (const meeting of meetings) companySize += await sizeOf(path.join(uploadsRoot, 'reuniones', String(meeting._id)), companyBudget);
    if (companySize + reserved > number('UPLOAD_COMPANY_QUOTA_BYTES', 1024 ** 3)) throw Object.assign(new Error('La empresa alcanzo su cuota de archivos.'), { statusCode: 413 });
    if (await sizeOf(uploadsRoot) + reserved > number('UPLOAD_VOLUME_QUOTA_BYTES', 5 * 1024 ** 3)) throw Object.assign(new Error('El almacenamiento esta lleno. Contacta al administrador.'), { statusCode: 507 });
    const timeout = setTimeout(() => { req.destroy(); res.destroy(); }, 120000);
    timeout.unref();
    const finish = () => { clearTimeout(timeout); release(); };
    res.once('finish', finish);
    res.once('close', finish);
    next();
  } catch (error) { await release(); next(error); }
};
module.exports.initialize = () => Lease.createIndexes();
