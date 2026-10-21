const path = require('path');

const resolveStoredMeetingDocumentPath = (storedUrl, uploadsRoot) => {
  const url = String(storedUrl || '');
  if (!url.startsWith('/uploads/reuniones/')) {
    const error = new Error('La ruta del documento no es válida.');
    error.statusCode = 400;
    throw error;
  }
  const relativeUrl = url.slice('/uploads/reuniones/'.length);
  if (relativeUrl.includes('?') || relativeUrl.includes('#')) {
    const error = new Error('La ruta del documento no es válida.');
    error.statusCode = 400;
    throw error;
  }
  const filePath = path.resolve(uploadsRoot, relativeUrl);
  const relativePath = path.relative(uploadsRoot, filePath);
  if (!relativePath
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)) {
    const error = new Error('La ruta del documento no es válida.');
    error.statusCode = 400;
    throw error;
  }
  return filePath;
};

module.exports = resolveStoredMeetingDocumentPath;
