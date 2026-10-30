const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const { uploadsRoot } = require('../config/uploads');
const stagingDirectory = path.join(uploadsRoot, '.staging');

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    fs.mkdir(stagingDirectory, { recursive: true }, error => callback(error, stagingDirectory));
  },
  filename: (req, file, callback) => {
    callback(null, `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const createUpload = options => multer({ storage, ...options, limits: { files: 20, fields: 10, parts: 30, fieldSize: 64 * 1024, ...options?.limits } });

const moveUploadedFile = (file, destination) => fs.promises.rename(file.path, destination);

const withUploadedFileCleanup = handler => (req, res, next) => {
  const uploads = [...(req.files || []), ...(req.file ? [req.file] : [])];
  return Promise.resolve()
    .then(() => handler(req, res, next))
    .catch(next)
    .finally(async () => {
      await Promise.all(uploads.map(async file => {
        if (!file.path || path.dirname(path.resolve(file.path)) !== stagingDirectory) return;
        try {
          await fs.promises.unlink(file.path);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error('Could not clean temporary upload:', error.message);
          }
        }
      }));
    });
};

module.exports = { createUpload, moveUploadedFile, withUploadedFileCleanup };
