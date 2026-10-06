const express = require('express');
const router = express.Router();
const EmpresaController = require('../controllers/empresaController');
const authMiddleware = require('../middleware/auth');
const reviewerAuth = require('../middleware/reviewerAuth');
const meetingUpload = require('../middleware/meetingUpload');
const employeeAuth = require('../middleware/employeeAuth');
const employeeSpreadsheetUpload = require('../middleware/employeeSpreadsheetUpload');
const presentationUpload = require('../middleware/presentationUpload');
const strategicPlanUpload = require('../middleware/strategicPlanUpload');
const {
  registerValidation,
  loginValidation,
  reunionValidation,
  updateTextValidation
} = require('../middleware/validation');

// ===== RUTAS PUBLICAS =====
router.post('/register', registerValidation, EmpresaController.register);
router.post('/login', loginValidation, EmpresaController.login);
router.post('/reviewer/login', EmpresaController.reviewerLogin);
router.post('/admin/login', EmpresaController.reviewerLogin);
router.get('/reviewer/empresas', reviewerAuth, EmpresaController.listForReview);
router.put('/reviewer/empresas/:id', reviewerAuth, EmpresaController.reviewEmpresa);
router.get('/admin/empresas', reviewerAuth, EmpresaController.listForReview);
router.put('/admin/empresas/:id', reviewerAuth, EmpresaController.reviewEmpresa);
router.get('/health', EmpresaController.healthCheck);
router.post('/employee/company-lookup', EmpresaController.getEmployeeCompanyByCode);
router.post('/employee/account/register', EmpresaController.registerEmployeeAccount);
router.post('/employee/account/login', EmpresaController.employeeAccountLogin);

// ===== RUTAS PROTEGIDAS =====

// Empresa
router.get('/empresa', authMiddleware, EmpresaController.getEmpresa);
router.post('/empresa/codigo-invitacion', authMiddleware, EmpresaController.generateCompanyInviteCode);
router.put('/empresa/convocatorias/smtp', authMiddleware, EmpresaController.saveCompanySmtp);
router.delete('/empresa/convocatorias/smtp', authMiddleware, EmpresaController.deleteCompanySmtp);
router.put('/empresa', authMiddleware, EmpresaController.updateEmpresa);
router.put('/foda', authMiddleware, EmpresaController.updateFODA);
router.post('/empresa/plan-estrategico', authMiddleware, strategicPlanUpload.single('archivo'), EmpresaController.uploadStrategicPlan);
router.post('/empresa/empleados', authMiddleware, EmpresaController.createEmployee);
router.put('/empresa/empleados/:employeeId', authMiddleware, EmpresaController.updateEmployeeProfile);
router.delete('/empresa/empleados/:employeeId', authMiddleware, EmpresaController.deleteEmployee);
router.get('/empresa/empleados/:employeeId/indicadores-personales', authMiddleware, EmpresaController.getManagedEmployeeObjectives);
router.post('/empresa/empleados/:employeeId/indicadores-personales', authMiddleware, EmpresaController.createManagedEmployeeObjective);
router.put('/empresa/empleados/:employeeId/indicadores-personales/:objectiveId', authMiddleware, EmpresaController.updateManagedEmployeeObjective);
router.delete('/empresa/empleados/:employeeId/indicadores-personales/:objectiveId', authMiddleware, EmpresaController.deleteManagedEmployeeObjective);

// Portal independiente de empleados
router.get('/employee/portal', employeeAuth, EmpresaController.getEmployeePortal);
router.post('/employee/meetings/:id/spreadsheets', employeeAuth, employeeSpreadsheetUpload.single('archivo'), EmpresaController.uploadEmployeeMeetingSpreadsheet);
router.get('/employee/meetings/:id/spreadsheets/:documentId/indicators', employeeAuth, EmpresaController.getEmployeeMeetingSpreadsheetInsights);
router.put('/employee/profile', employeeAuth, EmpresaController.completeEmployeeProfile);
router.put('/employee/personal-strategy', employeeAuth, EmpresaController.updateEmployeePersonalStrategy);
router.post('/employee/personal-meetings', employeeAuth, EmpresaController.createEmployeePersonalMeeting);
router.put('/employee/personal-meetings/:meetingId', employeeAuth, EmpresaController.updateEmployeePersonalMeeting);
router.delete('/employee/personal-meetings/:meetingId', employeeAuth, EmpresaController.deleteEmployeePersonalMeeting);
router.get('/employee/personal-objectives', employeeAuth, EmpresaController.getEmployeePersonalObjectives);
router.post('/employee/personal-objectives', employeeAuth, EmpresaController.createEmployeePersonalObjective);
router.put('/employee/personal-objectives/:objectiveId', employeeAuth, EmpresaController.updateEmployeePersonalObjective);
router.delete('/employee/personal-objectives/:objectiveId', employeeAuth, EmpresaController.deleteEmployeePersonalObjective);

// Reuniones
router.post('/reuniones', authMiddleware, reunionValidation, EmpresaController.createReunion);
router.put('/reuniones/:id/repeticion/detener', authMiddleware, EmpresaController.stopWeeklyReunion);
router.put('/reuniones/:id', authMiddleware, updateTextValidation, EmpresaController.updateReunion);
router.put('/reuniones/:id/completar', authMiddleware, EmpresaController.completeReunion);
router.put('/reuniones/:id/minuta', authMiddleware, updateTextValidation, EmpresaController.updateMinuta);
router.post('/reuniones/:id/documentos', authMiddleware, presentationUpload.array('archivo', 20), EmpresaController.uploadReunionDocumento);
router.get('/reuniones/:id/documentos/:documentoId/vista-previa', authMiddleware, EmpresaController.previewReunionDocumento);
router.put('/reuniones/:id/presentacion/:documentoId/rangos', authMiddleware, EmpresaController.updatePresentationAreaRanges);
router.put('/reuniones/:id/documentos/:documentoId', authMiddleware, meetingUpload.single('archivo'), EmpresaController.replaceReunionDocumento);
router.delete('/reuniones/:id/documentos/:documentoId', authMiddleware, EmpresaController.deleteReunionDocumento);
router.delete('/reuniones/:id', authMiddleware, EmpresaController.deleteReunion);
router.post('/reuniones/:id/reenviar', authMiddleware, EmpresaController.reenviarConvocatoria);

// Seguimientos
router.post('/reuniones/:reunionId/seguimientos', authMiddleware, EmpresaController.createSeguimiento);
router.put('/reuniones/:reunionId/seguimientos/:id', authMiddleware, updateTextValidation, EmpresaController.updateSeguimiento);
router.delete('/reuniones/:reunionId/seguimientos/:id', authMiddleware, EmpresaController.deleteSeguimiento);

// Objetivos
router.post('/objetivos', authMiddleware, EmpresaController.createObjetivo);
router.put('/objetivos/:id', authMiddleware, EmpresaController.updateObjetivo);
router.delete('/objetivos/:id', authMiddleware, EmpresaController.deleteObjetivo);

module.exports = router;