const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { uploadsRoot } = require('../config/uploads');

const isReferenced = async url => {
  const meeting = mongoose.model('Reunion');
  const company = mongoose.model('Empresa');
  return Boolean(await meeting.exists({ $or: [{ 'documentos.url': url }, { 'seguimientos.documentos.url': url }] })
    || await company.exists({ 'planEstrategico.url': url }));
};

// MongoDB is authoritative. Failure to inspect references must never remove a file.
const removeStoredFile = async filePath => {
  try {
    const relative = path.relative(uploadsRoot, path.resolve(filePath));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Ruta fuera de uploads');
    const url = '/uploads/' + relative.split(path.sep).join('/');
    if (await isReferenced(url)) return;
    const destination = path.join(uploadsRoot, '.trash', require('crypto').randomUUID(), relative);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.rename(filePath, destination);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('File cleanup deferred; run files:reconcile:', error.message);
  }
};

// Preview by default; quarantine unreferenced files older than seven days, never delete them.
const reconcileFiles = async ({ apply = false, now = Date.now() } = {}) => {
  const candidates = [];
  const visit = async directory => {
    for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name === '.trash') continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { await visit(file); continue; }
      if (!entry.isFile()) continue;
      const stat = await fs.promises.stat(file);
      if (now - stat.mtimeMs < 7 * 24 * 60 * 60 * 1000) continue;
      const relative = path.relative(uploadsRoot, file);
      const url = '/uploads/' + relative.split(path.sep).join('/');
      if (await isReferenced(url)) continue;
      candidates.push(url);
      if (apply) {
        const destination = path.join(uploadsRoot, '.trash', String(now), relative);
        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        // Recheck immediately before moving; fresh uploads have a seven day grace period.
        if (!await isReferenced(url)) await fs.promises.rename(file, destination);
      }
    }
  };
  await visit(uploadsRoot);
  return candidates;
};
module.exports = { removeStoredFile, reconcileFiles, isReferenced };
