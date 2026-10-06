const multer = require('multer');
const path = require('path');

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const allowedExtensions = new Set(['.pdf', '.doc', '.docx']);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const mimeAccepted = allowedMimeTypes.has(file.mimetype) || file.mimetype === 'application/octet-stream';
    if (!allowedExtensions.has(extension) || !mimeAccepted) {
      const error = new Error('El plan estratégico debe ser PDF o Word (.pdf, .doc, .docx).');
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  }
});
