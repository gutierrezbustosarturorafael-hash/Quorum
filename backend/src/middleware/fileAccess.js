const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const sessions = require('../services/sessions');
const { COOKIE_NAMES, getCookieToken } = require('../utils/authCookies');
module.exports = async (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const access = jwt.verify(req.query.access, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (access.type !== 'meeting-file' || access.filePath !== '/uploads' + req.path || !access.sid) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este documento.' });
    }
    const record = await mongoose.model('AuthSession').findById(access.sid).select('role').lean();
    if (!record || !['company', 'employee'].includes(record.role)) return res.sendStatus(401);
    const cookie = getCookieToken(req, COOKIE_NAMES[record.role]);
    const payload = jwt.verify(cookie || '', process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.sid !== access.sid || String(payload.empresaId) !== String(access.empresaId)) return res.sendStatus(403);
    await sessions.validateSession(payload, record.role);
    let ownsFile = false;
    const meetingPath = access.filePath.match(/^\/uploads\/reuniones\/([a-f0-9]{24})\/[^/\\?#]+$/i);
    const planPath = access.filePath.match(/^\/uploads\/planes\/([a-f0-9]{24})\/[^/\\?#]+$/i);
    if (meetingPath) ownsFile = Boolean(await mongoose.model('Reunion').exists({ _id: meetingPath[1], empresaId: payload.empresaId, $or: [{ 'documentos.url': access.filePath }, { 'seguimientos.documentos.url': access.filePath }] }));
    if (planPath && record.role === 'company' && planPath[1] === String(payload.empresaId)) ownsFile = Boolean(await mongoose.model('Empresa').exists({ _id: payload.empresaId, 'planEstrategico.url': access.filePath }));
    if (!ownsFile) return res.sendStatus(403);
    if (record.role === 'employee') {
      const Model = require('../models/empresaModel');
      const profile = await Model.getEmpleadoProfile(payload.empresaId, payload.employeeId);
      if (!profile || Model.getMissingEmployeeProfileFields(profile).length) return res.sendStatus(403);
      const meetings = await Model.getEmployeeMeetings(payload.empresaId, profile);
      if (!meetings.some(meeting => (meeting.documentos || []).some(document => document.url === access.filePath))) return res.sendStatus(403);
    }
    next();
  } catch (error) {
    const status = error.statusCode || (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name) ? 401 : 503);
    res.status(status).json({ success: false, message: status === 503 ? 'No se pudo verificar el documento.' : 'El acceso al documento vencio o fue revocado. Abrelo de nuevo desde Quorum.' });
  }
};
