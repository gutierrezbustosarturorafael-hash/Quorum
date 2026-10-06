const multer = require('multer');

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

const allowedExtensions = new Set(['.pdf', '.xlsx', '.xls', '.xlsb', '.doc', '.docx', '.ppt', '.pptx']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = require('path').extname(file.originalname).toLowerCase();
    const mimeAccepted = allowedMimeTypes.has(file.mimetype) || file.mimetype === 'application/octet-stream';
    if (!allowedExtensions.has(extension) || !mimeAccepted) {
      return callback(new Error('Solo se aceptan archivos PDF, Excel, Word o PowerPoint.'));
    }
    callback(null, true);
  }
});

module.exports = upload;
