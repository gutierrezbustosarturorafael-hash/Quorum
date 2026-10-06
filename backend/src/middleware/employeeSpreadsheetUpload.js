const path = require('path');
const multer = require('multer');

const allowedMimeTypes = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/octet-stream'
]);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx', '.xls', '.xlsb'].includes(extension) || !allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Solo puedes subir hojas de cálculo Excel (.xlsx, .xls o .xlsb).');
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  }
});
