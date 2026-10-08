const EmpresaModel = require('../models/empresaModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { validateEncryptionKey } = require('../utils/smtpCredentials');
const { extractSpreadsheetInsights, readSpreadsheetInsights } = require('../utils/spreadsheetInsights');

const getStoredMeetingDocumentPath = documento => {
  const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads', 'reuniones');
  const filePath = path.resolve(__dirname, '..', '..', String(documento.url || '').replace(/^\/+/, ''));
  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    const error = new Error('La ruta del documento no es válida.');
    error.statusCode = 400;
    throw error;
  }
  return filePath;
};

const normalizeArea = value => String(value || '').trim().toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const hideSubareaObjectives = (objectives = [], directivos = [], empleados = []) => {
  const subareas = new Set(
    Object.values(EmpresaModel.getSubareasPorDepartamento([
      ...directivos,
      ...empleados.filter(empleado => empleado.dirigeSubareas)
    ]))
      .flat()
      .map(normalizeArea)
  );
  return objectives.filter(objective =>
    objective.tipoArea === 'general'
      || !(objective.areasInvolucradas || []).some(area => subareas.has(normalizeArea(area)))
  );
};

const sendMeetingInvitation = async (empresaId, reunion) => {
  try {
    const companyData = await EmpresaModel.getEmpresaCompleta(empresaId);
    const company = companyData?.empresa;
    if (!company || (company.verificacion?.estado || 'pendiente') !== 'aprobada') {
      return {
        success: false,
        message: 'La empresa aún no está verificada por un administrador. La reunión se guardó, pero no se enviaron correos.'
      };
    }

    const allDirectors = companyData.directivos || [];
    const selectedDepartments = new Set((reunion.departamentos || []).map(area => normalizeArea(area)));
    const directors = reunion.esParaTodos
      ? allDirectors
      : reunion.directivosSeleccionados?.length
        ? allDirectors.filter(director => reunion.directivosSeleccionados.some(id => String(id) === String(director.id || director._id)))
        : allDirectors.filter(director => selectedDepartments.has(normalizeArea(director.area)));
    const employees = reunion.esParaTodos
      ? await EmpresaModel.getAllCompanyEmployees(empresaId)
      : await EmpresaModel.getInvitedEmployees(empresaId, reunion.empleadosInvitados || []);
    const recipients = [...directors, ...employees]
      .filter((person, index, people) => person.email
        && people.findIndex(item => String(item.email).toLowerCase() === String(person.email).toLowerCase()) === index);

    if (!recipients.length) {
      return { success: false, message: 'La reunión se guardó, pero no hay personas invitadas con correo disponible.' };
    }

    const smtpConfig = await EmpresaModel.getSmtpCredentials(empresaId);
    if (!smtpConfig) {
      return { success: false, message: 'La reunión se guardó, pero falta configurar el correo de convocatorias.' };
    }
    const result = await emailService.sendConvocatoria(reunion, company.nombre || 'Empresa', recipients, smtpConfig);
    if (result.success) {
      await EmpresaModel.marcarConvocatoriaEnviada(empresaId, reunion._id);
    }
    return {
      success: Boolean(result.success),
      message: result.success
        ? 'Convocatoria enviada correctamente.'
        : result.message || 'No se pudo enviar la convocatoria. Revisa el correo guardado e inténtalo de nuevo.'
    };
  } catch (error) {
    console.error('Convocatoria no enviada:', error.message);
    return {
      success: false,
      message: 'La reunión se guardó, pero no se pudo enviar la convocatoria. Revisa el correo e inténtalo de nuevo.'
    };
  }
};

const protectDocument = (documento, empresaId) => {
  const plainDocument = typeof documento?.toObject === 'function'
    ? documento.toObject()
    : documento;
  if (!plainDocument?.url?.startsWith('/uploads/')) return plainDocument;
  const accessToken = jwt.sign(
    { type: 'meeting-file', empresaId: String(empresaId), filePath: plainDocument.url },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  return {
    ...plainDocument,
    url: `${plainDocument.url}?access=${encodeURIComponent(accessToken)}`
  };
};

const protectMeetingDocuments = (reunion, empresaId) => {
  const plainMeeting = typeof reunion?.toObject === 'function' ? reunion.toObject() : reunion;
  return {
    ...plainMeeting,
    documentos: (plainMeeting.documentos || []).map(documento => protectDocument(documento, empresaId)),
    seguimientos: (plainMeeting.seguimientos || []).map(seguimiento => ({
      ...seguimiento,
      documentos: (seguimiento.documentos || []).map(documento => protectDocument(documento, empresaId))
    }))
  };
};

const validateEmployeePersonalMeeting = data => {
  const title = String(data.titulo || '').trim();
  const date = String(data.fecha || '');
  const time = String(data.hora || '');
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (title.length < 2 || title.length > 160 || !validDate || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    const error = new Error('Escribe un título, una fecha y una hora válidos para guardar tu reunión.');
    error.statusCode = 400;
    throw error;
  }
  if (String(data.lugar || '').length > 200 || String(data.notas || '').length > 3000) {
    const error = new Error('El lugar o las notas superan el límite permitido. Acórtalos e inténtalo de nuevo.');
    error.statusCode = 400;
    throw error;
  }
};

const validateEmployeePersonalObjective = (data, partial = false) => {
  const fields = ['nombre', 'descripcion', 'prioridad', 'progreso', 'status', 'tasks'];
  if (partial && !fields.some(field => data[field] !== undefined)) {
    const error = new Error('Indica qué dato del indicador quieres actualizar.');
    error.statusCode = 400;
    throw error;
  }
  if ((!partial || data.nombre !== undefined)
    && (String(data.nombre || '').trim().length < 2 || String(data.nombre).trim().length > 160)) {
    const error = new Error('El nombre del indicador debe tener entre 2 y 160 caracteres.');
    error.statusCode = 400;
    throw error;
  }
  if (data.descripcion !== undefined && String(data.descripcion || '').length > 1000) {
    const error = new Error('La descripción del indicador no puede superar los 1000 caracteres.');
    error.statusCode = 400;
    throw error;
  }
  if (data.prioridad !== undefined && !['alta', 'media', 'baja'].includes(data.prioridad)) {
    const error = new Error('Selecciona una prioridad válida.');
    error.statusCode = 400;
    throw error;
  }
  if (data.progreso !== undefined
    && (!Number.isFinite(Number(data.progreso)) || Number(data.progreso) < 0 || Number(data.progreso) > 100)) {
    const error = new Error('El avance debe estar entre 0 y 100.');
    error.statusCode = 400;
    throw error;
  }
  if (data.status !== undefined && !['pendiente', 'en-progreso', 'completado'].includes(data.status)) {
    const error = new Error('Selecciona un estado válido.');
    error.statusCode = 400;
    throw error;
  }
  if (data.tasks !== undefined
    && (!Array.isArray(data.tasks) || data.tasks.length > 30
      || data.tasks.some(task => typeof task !== 'string' || task.trim().length > 200))) {
    const error = new Error('Agrega hasta 30 tareas y mantén cada una debajo de 200 caracteres.');
    error.statusCode = 400;
    throw error;
  }
};

const validateEmployeePersonalStrategy = data => {
  ['misionPersonal', 'visionPersonal'].forEach(field => {
    if (data[field] !== undefined && String(data[field] || '').length > 3000) {
      const error = new Error('La misión y la visión personales no pueden superar los 3000 caracteres.');
      error.statusCode = 400;
      throw error;
    }
  });
  ['valoresPersonales', 'estrategiasPersonales', 'metasPersonales'].forEach(field => {
    const items = data[field];
    if (items !== undefined
      && (!Array.isArray(items) || items.length > 30
        || items.some(item => typeof item !== 'string' || item.trim().length > 200))) {
      const error = new Error('Cada lista puede tener hasta 30 elementos de máximo 200 caracteres.');
      error.statusCode = 400;
      throw error;
    }
  });
  if (data.fodaPersonal !== undefined) {
    const sections = ['fortalezas', 'debilidades', 'oportunidades', 'amenazas'];
    if (!data.fodaPersonal || typeof data.fodaPersonal !== 'object' || Array.isArray(data.fodaPersonal)
      || sections.some(section => !Array.isArray(data.fodaPersonal[section])
        || data.fodaPersonal[section].length > 30
        || data.fodaPersonal[section].some(item => typeof item !== 'string' || item.trim().length > 200))) {
      const error = new Error('Completa cada apartado del FODA con hasta 30 elementos de máximo 200 caracteres.');
      error.statusCode = 400;
      throw error;
    }
  }
  if (data.trabajadoresACargo !== undefined
    && (!Number.isInteger(Number(data.trabajadoresACargo))
      || Number(data.trabajadoresACargo) < 0 || Number(data.trabajadoresACargo) > 100000)) {
    const error = new Error('Indica una cantidad válida de personas a tu cargo.');
    error.statusCode = 400;
    throw error;
  }
};

const formatExportList = values => {
  const entries = Array.isArray(values)
    ? values.map(value => String(value || '').trim()).filter(Boolean)
    : [];
  return entries.length ? entries.map(value => `- ${value}`).join('\n') : '- Sin datos registrados';
};

const formatCompanyExport = ({ empresa, empleados }) => {
  const directivos = (empresa.directivos || [])
    .filter(directivo => directivo.activo !== false)
    .map(directivo => `- ${directivo.nombre}${directivo.cargo || directivo.area ? ` · ${directivo.cargo || directivo.area}` : ''}`);
  const lines = [
    'INFORMACIÓN INSTITUCIONAL Y ANÁLISIS FODA',
    `Empresa: ${empresa.nombre || 'Sin registrar'}`,
    `Exportado: ${new Date().toLocaleString('es-MX')}`,
    '',
    'INFORMACIÓN INSTITUCIONAL',
    'Misión:',
    empresa.mision || 'Sin datos registrados',
    '',
    'Visión:',
    empresa.vision || 'Sin datos registrados',
    '',
    'Valores:',
    formatExportList(empresa.valores),
    '',
    'Estrategias:',
    formatExportList(empresa.estrategias),
    '',
    'Metas:',
    formatExportList(empresa.metas),
    '',
    'Indicadores institucionales:',
    formatExportList(empresa.indicadores),
    '',
    'Departamentos:',
    formatExportList(empresa.departamentos),
    '',
    'Directivos:',
    directivos.length ? directivos.join('\n') : '- Sin directivos registrados',
    '',
    'ANÁLISIS FODA',
    'Fortalezas:',
    formatExportList(empresa.foda?.fortalezas),
    '',
    'Oportunidades:',
    formatExportList(empresa.foda?.oportunidades),
    '',
    'Debilidades:',
    formatExportList(empresa.foda?.debilidades),
    '',
    'Amenazas:',
    formatExportList(empresa.foda?.amenazas),
    '',
    `PERFILES E INDICADORES DE EMPLEADOS CON CUENTA (${empleados.length})`
  ];

  empleados.forEach((empleado, index) => {
    lines.push(
      '',
      `${index + 1}. ${empleado.nombre || 'Nombre pendiente'}`,
      `Correo: ${empleado.email}`,
      `Puesto: ${empleado.rol || 'Sin definir'}`,
      `Área: ${empleado.area || 'Sin definir'}`,
      `Subárea: ${empleado.subarea || 'Sin definir'}`,
      `Teléfono: ${empleado.telefono || 'Sin registrar'}`,
      `Personas a cargo: ${Number(empleado.trabajadoresACargo) || 0}`,
      `Jefatura de departamento: ${empleado.esJefeDepartamento ? 'Sí' : 'No'}`,
      `Jefatura de empresa: ${empleado.esJefeEmpresa ? 'Sí' : 'No'}`,
      `Dirige subáreas: ${empleado.dirigeSubareas ? 'Sí' : 'No'}`,
      `Subáreas a cargo: ${(empleado.subareas || []).join(', ') || 'Sin definir'}`,
      'Indicadores:',
      ...(empleado.indicadores.length
        ? empleado.indicadores.flatMap(indicador => [
          `- ${indicador.nombre} (${indicador.area || empleado.area || 'Sin área'})`,
          `  Avance: ${Number(indicador.progreso) || 0}% · Estado: ${indicador.status || 'pendiente'} · Prioridad: ${indicador.prioridad || 'media'}`,
          ...(indicador.descripcion ? [`  Descripción: ${indicador.descripcion}`] : []),
          ...(indicador.tasks || []).map(task => `  - ${task}`)
        ])
        : ['- Sin indicadores registrados'])
    );
  });

  return `\uFEFF${lines.join('\n')}\n`;
};

class EmpresaController {
  static async sendMeetingInvitation(empresaId, reunion) {
    return sendMeetingInvitation(empresaId, reunion);
  }

  // ============================================================
  // REGISTRO
  // ============================================================
  static async register(req, res) {
    try {
      const { nombre, tipoPersona, razonSocial, rfc, domicilioFiscal, regimenFiscal, representanteLegal, telefonoContacto, mision, vision, email, password, termsAccepted, termsVersion, ...resto } = req.body;

      if (!nombre || !razonSocial || !rfc || !domicilioFiscal || !regimenFiscal || !mision || !vision || !email || !password || termsAccepted !== true) {
        return res.status(400).json({
          success: false,
          message: 'Faltan datos empresariales, fiscales o de acceso obligatorios'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const data = {
        nombre,
        tipoPersona,
        razonSocial: razonSocial.trim(),
        rfc: rfc.trim().toUpperCase(),
        domicilioFiscal: domicilioFiscal.trim(),
        regimenFiscal: regimenFiscal.trim(),
        representanteLegal: representanteLegal.trim(),
        telefonoContacto: telefonoContacto.trim(),
        rfcValidoLocalmente: /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim()),
        mision,
        vision,
        email,
        passwordHash,
        termsAcceptedAt: new Date(),
        termsVersion,
        valores: resto.valores || [],
        estrategias: resto.estrategias || [],
        metas: resto.metas || [],
        indicadores: resto.indicadores || [],
        departamentos: resto.departamentos || [],
        directivos: resto.directivos || [],
        objetivos: (resto.objetivos || []).filter(o => o?.nombre?.trim()),
        fortalezas: resto.fortalezas || [],
        debilidades: resto.debilidades || [],
        oportunidades: resto.oportunidades || [],
        amenazas: resto.amenazas || []
      };

      const result = await EmpresaModel.createEmpresaCompleta(data);

      const token = jwt.sign(
        { empresaId: result.id, email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({ success: true, token, empresaId: result.id, verificationStatus: 'pendiente' });
    } catch (error) {
      console.error('Register error:', error.message);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'El RFC o correo ya está registrado' });
      }
      res.status(500).json({ success: false, message: 'Error al registrar empresa' });
    }
  }

  // ============================================================
  // LOGIN
  // ============================================================
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await EmpresaModel.verifyUser(email);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Credenciales invalidas' });
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Credenciales invalidas' });
      }

      const token = jwt.sign(
        { empresaId: user.empresa_id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ success: true, token, empresaId: user.empresa_id });
    } catch (error) {
      console.error('Login error:', error.message);
      res.status(500).json({ success: false, message: 'Error al iniciar sesion' });
    }
  }

  // ============================================================
  // EMPRESA
  // ============================================================
  static async exportCompanyText(req, res) {
    try {
      const data = await EmpresaModel.getCompanyExportData(req.user.empresaId);
      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="quorum-exportacion-empresa.txt"',
        'Cache-Control': 'no-store'
      });
      res.send(formatCompanyExport(data));
    } catch (error) {
      console.error('Export company data error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudieron exportar los datos de la empresa.'
      });
    }
  }

  static async getEmpresa(req, res) {
    try {
      const empresaId = req.user.empresaId;
      await EmpresaModel.ensureManualDirectivoDirectory(empresaId);
      const data = await EmpresaModel.getEmpresaCompleta(empresaId);
      if (!data) {
        return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
      }
      const empleados = await EmpresaModel.getEmpleadoDirectory(empresaId);
      res.json({
        success: true,
        data: {
          ...data,
          objetivos: hideSubareaObjectives(data.objetivos || [], data.directivos || [], empleados),
          reuniones: data.reuniones.map(reunion => protectMeetingDocuments(reunion, empresaId)),
          empleados,
          organigrama: await EmpresaModel.getCompanyOrganizationChart(empresaId),
          codigoInvitacion: await EmpresaModel.getCompanyInviteCode(empresaId),
          planEstrategico: protectDocument(data.empresa?.planEstrategico, empresaId)
        }
      });
    } catch (error) {
      console.error('Get empresa error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Error al obtener datos'
      });
    }
  }

  static async generateCompanyInviteCode(req, res) {
    try {
      const codigoInvitacion = await EmpresaModel.getCompanyInviteCode(req.user.empresaId);
      res.json({ success: true, data: { codigoInvitacion } });
    } catch (error) {
      console.error('Generate company invite code error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo generar el código de invitación.'
      });
    }
  }

  static async saveCompanySmtp(req, res) {
    try {
      const provider = String(req.body?.provider || '').trim().toLowerCase();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!['gmail', 'outlook'].includes(provider)
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        || password.replace(/\s+/g, '').length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Selecciona Gmail u Outlook e ingresa el correo y su contraseña especial de aplicación.'
        });
      }

      validateEncryptionKey();
      await emailService.verifySmtpCredentials({ provider, email, password });
      const smtpConvocatorias = await EmpresaModel.saveSmtpCredentials(req.user.empresaId, {
        provider,
        email,
        password
      });
      res.json({
        success: true,
        message: 'El correo quedó verificado y guardado.',
        data: { smtpConvocatorias }
      });
    } catch (error) {
      const status = error.statusCode || 502;
      console.error(
        'Save company invitation email error:',
        status === 503 ? 'La configuración requiere ayuda del responsable de Quorum.' : error.message
      );
      res.status(status).json({
        success: false,
        message: status === 503
          ? 'Por el momento no se pudo guardar el correo. Inténtalo más tarde o pide ayuda al responsable de Quorum.'
          : emailService.getVerificationError(error)
      });
    }
  }

  static async deleteCompanySmtp(req, res) {
    try {
      await EmpresaModel.deleteSmtpCredentials(req.user.empresaId);
      res.json({ success: true, message: 'Se eliminó el correo guardado para las convocatorias.' });
    } catch (error) {
      console.error('Delete company SMTP error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
          ? 'No se pudo completar la solicitud. Inténtalo más tarde o pide ayuda al responsable de Quorum.'
          : 'No se pudo eliminar el correo guardado.'
      });
    }
  }

  static async registerEmployeeAccount(req, res) {
    try {
      const { companyCode, nombre, email, password, area, subarea } = req.body || {};
      if (!companyCode || !email || !password || String(password).length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Ingresa el código de empresa, correo y una contraseña de al menos 8 caracteres.'
        });
      }
      const existingCompanyAccount = await EmpresaModel.getCompanyAccountForEmployee(email);
      let passwordHash;
      if (existingCompanyAccount) {
        const passwordMatches = await bcrypt.compare(String(password), existingCompanyAccount.passwordHash);
        if (!passwordMatches) {
          return res.status(401).json({
            success: false,
            message: 'La contraseña no coincide con tu cuenta existente de empresa. Usa el mismo correo y contraseña para vincularla.'
          });
        }
        passwordHash = existingCompanyAccount.passwordHash;
      } else {
        passwordHash = await bcrypt.hash(String(password), 10);
      }
      const employee = await EmpresaModel.registerEmpleado({
        companyCode,
        nombre,
        email,
        passwordHash,
        area,
        subarea
      });
      const token = jwt.sign(
        { employeeId: employee.id, empresaId: employee.empresaId, email: String(email).trim().toLowerCase(), type: 'employee-account' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.status(201).json({
        success: true,
        token,
        empresaId: employee.empresaId,
        departamentos: employee.departamentos,
        subareasPorDepartamento: employee.subareasPorDepartamento,
        profileComplete: false
      });
    } catch (error) {
      console.error('Employee account registration error:', error.message);
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          code: 'EMPLOYEE_ACCOUNT_EXISTS',
          message: 'Ya existe una cuenta de empleado con este correo. Inicia sesión para completar los datos pendientes.'
        });
      }
      res.status(error.statusCode || 500).json({
        success: false,
        code: error.code,
        message: error.statusCode ? error.message : 'No se pudo crear la cuenta de empleado.'
      });
    }
  }

  static async getEmployeeCompanyByCode(req, res) {
    try {
      const company = await EmpresaModel.getEmployeeCompanyByCode(req.body?.companyCode);
      res.json({ success: true, data: company });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo consultar la empresa.'
      });
    }
  }

  static async employeeAccountLogin(req, res) {
    try {
      const { email, password } = req.body || {};
      const employee = await EmpresaModel.verifyEmpleado(email || '');
      if (!employee || !(await bcrypt.compare(String(password || ''), employee.passwordHash))) {
        return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
      }
      const token = jwt.sign(
        { employeeId: employee.id, empresaId: employee.empresaId, email: employee.email, type: 'employee-account' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.json({
        success: true,
        token,
        empresaId: employee.empresaId,
        profileComplete: employee.profileComplete,
        missingProfileFields: employee.missingProfileFields
      });
    } catch (error) {
      console.error('Employee account login error:', error.message);
      res.status(500).json({ success: false, message: 'No se pudo iniciar sesión como empleado.' });
    }
  }

  static async getEmployeePortal(req, res) {
    try {
      if (!req.user.employeeId) {
        return res.status(403).json({ success: false, message: 'Inicia sesión con tu cuenta individual de empleado.' });
      }
      const company = await EmpresaModel.getEmployeePortalData(req.user.empresaId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'No se encontró la empresa para este portal.' });
      }
      const profile = await EmpresaModel.getEmpleadoProfile(req.user.employeeId);
      if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
        return res.status(403).json({ success: false, message: 'La cuenta no pertenece a esta empresa.' });
      }
      const indicadoresArea = await EmpresaModel.getEmployeeAreaObjectives(req.user.empresaId, profile);
      const missingProfileFields = EmpresaModel.getMissingEmployeeProfileFields(profile);
      const profileComplete = missingProfileFields.length === 0;
      const meetings = profileComplete
        ? await EmpresaModel.getEmployeeMeetings(req.user.empresaId, profile)
        : [];
      const reunionesPersonales = await EmpresaModel.getEmployeePersonalMeetings(
        req.user.empresaId,
        req.user.employeeId
      );
      const indicadoresPersonales = await EmpresaModel.getEmployeePersonalObjectives(
        req.user.empresaId,
        req.user.employeeId
      );
      const indicadoresEquipo = await EmpresaModel.getEmployeeTeamObjectives(
        req.user.empresaId,
        profile
      );
      res.json({
        success: true,
        data: {
          empresa: company.empresa,
          organigrama: company.organigrama,
          reuniones: meetings.map(meeting => ({
            ...meeting,
            documentos: (meeting.documentos || []).map(documento => protectDocument(documento, req.user.empresaId))
          })),
          reunionesPersonales,
          indicadoresPersonales,
          indicadoresEquipo,
          profile,
          indicadoresArea,
          profileComplete,
          missingProfileFields
        }
      });
    } catch (error) {
      console.error('Get employee portal error:', error.message);
      res.status(500).json({ success: false, message: 'No se pudo cargar tu espacio de empleado. Inténtalo de nuevo.' });
    }
  }

  static async createEmployeePersonalMeeting(req, res) {
    try {
      const data = req.body || {};
      validateEmployeePersonalMeeting(data);
      const profile = await EmpresaModel.getEmpleadoProfile(req.user.employeeId);
      if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
        return res.status(403).json({ success: false, message: 'No se encontró tu cuenta de empleado. Inicia sesión de nuevo.' });
      }
      const meeting = await EmpresaModel.createEmployeePersonalMeeting(
        req.user.empresaId,
        req.user.employeeId,
        data
      );
      res.status(201).json({ success: true, data: meeting });
    } catch (error) {
      console.error('Create employee personal meeting error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo guardar tu reunión personal. Inténtalo de nuevo.'
      });
    }
  }

  static async updateEmployeePersonalMeeting(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.meetingId)) {
        return res.status(400).json({ success: false, message: 'El identificador de la reunión no es válido.' });
      }
      const data = req.body || {};
      validateEmployeePersonalMeeting(data);
      const meeting = await EmpresaModel.updateEmployeePersonalMeeting(
        req.user.empresaId,
        req.user.employeeId,
        req.params.meetingId,
        data
      );
      res.json({ success: true, data: meeting });
    } catch (error) {
      console.error('Update employee personal meeting error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo actualizar tu reunión personal. Inténtalo de nuevo.'
      });
    }
  }

  static async deleteEmployeePersonalMeeting(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.meetingId)) {
        return res.status(400).json({ success: false, message: 'El identificador de la reunión no es válido.' });
      }
      await EmpresaModel.deleteEmployeePersonalMeeting(
        req.user.empresaId,
        req.user.employeeId,
        req.params.meetingId
      );
      res.json({ success: true, message: 'Tu reunión personal se eliminó.' });
    } catch (error) {
      console.error('Delete employee personal meeting error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo eliminar tu reunión personal. Inténtalo de nuevo.'
      });
    }
  }

  static async getEmployeePersonalObjectives(req, res) {
    try {
      const profile = await EmpresaModel.getEmpleadoProfile(req.user.employeeId);
      if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
        return res.status(403).json({ success: false, message: 'No se encontró tu cuenta de empleado. Inicia sesión de nuevo.' });
      }
      const data = await EmpresaModel.getEmployeePersonalObjectives(req.user.empresaId, req.user.employeeId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Get employee personal objectives error:', error.message);
      res.status(500).json({ success: false, message: 'No se pudo cargar tu plan estratégico personal.' });
    }
  }

  static async updateEmployeePersonalStrategy(req, res) {
    try {
      validateEmployeePersonalStrategy(req.body || {});
      const profile = await EmpresaModel.updateEmployeePersonalStrategy(
        req.user.empresaId,
        req.user.employeeId,
        req.body || {}
      );
      res.json({ success: true, data: profile, message: 'Tu información estratégica quedó guardada.' });
    } catch (error) {
      console.error('Update employee personal strategy error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo guardar tu información estratégica personal.'
      });
    }
  }

  static async createEmployeePersonalObjective(req, res) {
    try {
      validateEmployeePersonalObjective(req.body || {});
      const profile = await EmpresaModel.getEmpleadoProfile(req.user.employeeId);
      if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
        return res.status(403).json({ success: false, message: 'No se encontró tu cuenta de empleado. Inicia sesión de nuevo.' });
      }
      if (!String(profile.area || '').trim()) {
        return res.status(400).json({ success: false, message: 'Completa primero tu área en el perfil para vincular el indicador.' });
      }
      const objective = await EmpresaModel.createEmployeePersonalObjective(
        req.user.empresaId,
        req.user.employeeId,
        profile.area,
        req.body,
        'empleado'
      );
      res.status(201).json({ success: true, data: objective });
    } catch (error) {
      console.error('Create employee personal objective error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo agregar el indicador a tu plan personal.'
      });
    }
  }

  static async updateEmployeePersonalObjective(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.objectiveId)) {
        return res.status(400).json({ success: false, message: 'El identificador del indicador no es válido.' });
      }
      validateEmployeePersonalObjective(req.body || {}, true);
      const objective = await EmpresaModel.updateEmployeePersonalObjective(
        req.user.empresaId,
        req.user.employeeId,
        req.params.objectiveId,
        req.body || {}
      );
      res.json({ success: true, data: objective });
    } catch (error) {
      console.error('Update employee personal objective error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo actualizar el indicador personal.'
      });
    }
  }

  static async deleteEmployeePersonalObjective(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.objectiveId)) {
        return res.status(400).json({ success: false, message: 'El identificador del indicador no es válido.' });
      }
      await EmpresaModel.deleteEmployeePersonalObjective(
        req.user.empresaId,
        req.user.employeeId,
        req.params.objectiveId
      );
      res.json({ success: true, message: 'El indicador se eliminó de tu plan personal.' });
    } catch (error) {
      console.error('Delete employee personal objective error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo eliminar el indicador personal.'
      });
    }
  }

  static async getManagedEmployeeObjectives(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.employeeId)) {
        return res.status(400).json({ success: false, message: 'El identificador del empleado no es válido.' });
      }
      const profile = await EmpresaModel.getEmpleadoProfile(req.params.employeeId);
      if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
        return res.status(404).json({ success: false, message: 'No se encontró a esa persona en el directorio de la empresa.' });
      }
      const data = await EmpresaModel.getEmployeePersonalObjectives(req.user.empresaId, req.params.employeeId);
      res.json({ success: true, data, area: profile.area });
    } catch (error) {
      console.error('Get managed employee objectives error:', error.message);
      res.status(500).json({ success: false, message: 'No se pudo cargar el plan personal del empleado.' });
    }
  }

  static async createManagedEmployeeObjective(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.employeeId)) {
        return res.status(400).json({ success: false, message: 'El identificador del empleado no es válido.' });
      }
      validateEmployeePersonalObjective(req.body || {});
      const profile = await EmpresaModel.getEmpleadoProfile(req.params.employeeId);
      if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
        return res.status(404).json({ success: false, message: 'No se encontró a esa persona en el directorio de la empresa.' });
      }
      if (!String(profile.area || '').trim()) {
        return res.status(400).json({ success: false, message: 'Asigna un área al empleado antes de agregar indicadores.' });
      }
      const objective = await EmpresaModel.createEmployeePersonalObjective(
        req.user.empresaId,
        req.params.employeeId,
        profile.area,
        req.body,
        'organizador'
      );
      res.status(201).json({ success: true, data: objective });
    } catch (error) {
      console.error('Create managed employee objective error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo asignar el indicador al empleado.'
      });
    }
  }

  static async updateManagedEmployeeObjective(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.employeeId) || !mongoose.isValidObjectId(req.params.objectiveId)) {
        return res.status(400).json({ success: false, message: 'El identificador del empleado o del indicador no es válido.' });
      }
      validateEmployeePersonalObjective(req.body || {}, true);
      const objective = await EmpresaModel.updateEmployeePersonalObjective(
        req.user.empresaId,
        req.params.employeeId,
        req.params.objectiveId,
        req.body || {}
      );
      res.json({ success: true, data: objective });
    } catch (error) {
      console.error('Update managed employee objective error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo actualizar el indicador asignado.'
      });
    }
  }

  static async deleteManagedEmployeeObjective(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.employeeId) || !mongoose.isValidObjectId(req.params.objectiveId)) {
        return res.status(400).json({ success: false, message: 'El identificador del empleado o del indicador no es válido.' });
      }
      await EmpresaModel.deleteEmployeePersonalObjective(
        req.user.empresaId,
        req.params.employeeId,
        req.params.objectiveId
      );
      res.json({ success: true, message: 'El indicador se quitó del plan personal del empleado.' });
    } catch (error) {
      console.error('Delete managed employee objective error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo quitar el indicador asignado.'
      });
    }
  }

  static async completeEmployeeProfile(req, res) {
    try {
      if (!req.user.employeeId) {
        return res.status(403).json({ success: false, message: 'Este acceso no tiene una cuenta de empleado para completar.' });
      }
      const profile = await EmpresaModel.completeEmpleadoProfile(req.user.employeeId, req.body || {});
      res.json({ success: true, data: profile });
    } catch (error) {
      console.error('Employee profile completion error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudieron guardar los datos del empleado.'
      });
    }
  }

  static async addEmployeeFromEmployeePortal(req, res) {
    try {
      const profile = await EmpresaModel.addEmployeeToManagedArea(
        req.user.empresaId,
        req.user.employeeId,
        req.body || {}
      );
      res.status(201).json({ success: true, data: profile });
    } catch (error) {
      console.error('Add employee from employee portal error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo agregar o asignar al empleado.'
      });
    }
  }

  static async updateEmployeeProfile(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.employeeId)) {
        return res.status(400).json({ success: false, message: 'El identificador del empleado no es válido.' });
      }
      const profileData = { ...(req.body || {}) };
      if (profileData.password) {
        if (String(profileData.password).length < 8) {
          return res.status(400).json({
            success: false,
            message: 'La nueva contraseña debe tener al menos 8 caracteres.'
          });
        }
        profileData.passwordHash = await bcrypt.hash(String(profileData.password), 10);
      }
      delete profileData.password;
      const profile = await EmpresaModel.updateEmpleadoProfile(
        req.user.empresaId,
        req.params.employeeId,
        profileData
      );
      res.json({ success: true, data: profile });
    } catch (error) {
      console.error('Employee profile update error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo actualizar el perfil del empleado.'
      });
    }
  }

  static async createEmployee(req, res) {
    try {
      const employeeData = { ...(req.body || {}) };
      const password = String(employeeData.password || '');
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña inicial debe tener al menos 8 caracteres.'
        });
      }
      employeeData.passwordHash = await bcrypt.hash(password, 10);
      delete employeeData.password;
      const employee = await EmpresaModel.createManualEmpleado(req.user.empresaId, employeeData);
      res.status(201).json({ success: true, data: employee });
    } catch (error) {
      console.error('Create employee error:', error.message);
      const status = error.statusCode || (error.code === 11000 ? 409 : 500);
      res.status(status).json({
        success: false,
        message: error.statusCode
          ? error.message
          : status === 409
            ? 'Ya existe una persona con ese correo. Revisa el directorio.'
            : 'No se pudo agregar a la persona al directorio.'
      });
    }
  }

  static async deleteEmployee(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.employeeId)) {
        return res.status(400).json({ success: false, message: 'No se encontró a esa persona en el directorio.' });
      }
      await EmpresaModel.deleteEmpleado(req.user.empresaId, req.params.employeeId);
      res.json({ success: true, message: 'La persona se eliminó del directorio de la empresa.' });
    } catch (error) {
      console.error('Delete employee error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo eliminar a la persona. Inténtalo de nuevo.'
      });
    }
  }

  static async uploadStrategicPlan(req, res) {
    let savedFilePath = '';
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Selecciona un archivo PDF o Word para el plan estratégico.' });
      }
      const empresaId = String(req.user.empresaId);
      const currentData = await EmpresaModel.getEmpresaCompleta(empresaId);
      const extension = path.extname(req.file.originalname).toLowerCase();
      const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;
      const directory = path.join(__dirname, '..', '..', 'uploads', 'planes', empresaId);
      fs.mkdirSync(directory, { recursive: true });
      savedFilePath = path.join(directory, safeName);
      fs.writeFileSync(savedFilePath, req.file.buffer);
      const planEstrategico = await EmpresaModel.savePlanEstrategico(empresaId, {
        nombreArchivo: req.file.originalname,
        url: `/uploads/planes/${empresaId}/${safeName}`,
        fechaSubida: new Date()
      });
      const oldUrl = currentData?.empresa?.planEstrategico?.url;
      if (oldUrl && oldUrl !== planEstrategico.url) {
        const uploadRoot = path.resolve(__dirname, '..', '..', 'uploads');
        const oldFilePath = path.resolve(uploadRoot, oldUrl.replace(/^\/uploads\/?/, ''));
        if (oldFilePath.startsWith(`${uploadRoot}${path.sep}`) && fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (cleanupError) {
            console.error('Could not remove replaced strategic plan:', cleanupError.message);
          }
        }
      }
      res.status(201).json({
        success: true,
        data: protectDocument(planEstrategico, empresaId)
      });
    } catch (error) {
      if (savedFilePath && fs.existsSync(savedFilePath)) fs.unlinkSync(savedFilePath);
      console.error('Strategic plan upload error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo guardar el plan estratégico.'
      });
    }
  }

  static async updateEmpresa(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const data = req.body;
      const result = await EmpresaModel.updateEmpresa(empresaId, data);
      const empresaCompleta = await EmpresaModel.getEmpresaCompleta(empresaId);
      empresaCompleta.empleados = await EmpresaModel.getEmpleadoDirectory(empresaId);
      const resultData = result.toObject();
      resultData.objetivos = hideSubareaObjectives(resultData.objetivos || [], resultData.directivos || [], empresaCompleta.empleados);
      empresaCompleta.objetivos = hideSubareaObjectives(empresaCompleta.objetivos || [], empresaCompleta.directivos || [], empresaCompleta.empleados);
      res.json({ success: true, data: resultData, empresaCompleta });
    } catch (error) {
      console.error('Update empresa error:', error.message);
      const validationMessage = error.name === 'ValidationError'
        ? Object.values(error.errors).map(detail => detail.message).join(' ')
        : null;
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
          ? error.message
          : validationMessage || 'Error al actualizar la información de la empresa.'
      });
    }
  }

  // ============================================================
  // FODA
  // ============================================================
  static async updateFODA(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const data = req.body;
      const result = await EmpresaModel.updateFODA(empresaId, data);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Update FODA error:', error.message);
      res.status(500).json({ success: false, message: 'Error al actualizar FODA' });
    }
  }

  // ============================================================
  // REUNIONES - CREAR
  // ============================================================
  static async createReunion(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const data = req.body;

      if (!data.titulo || !data.fecha || !data.hora) {
        return res.status(400).json({
          success: false,
          message: 'Los campos titulo, fecha y hora son obligatorios'
        });
      }

      const reunion = await EmpresaModel.createReunion(empresaId, data);

      const invitation = await sendMeetingInvitation(empresaId, reunion);

      res.status(201).json({
        success: true,
        data: reunion,
        convocatoriaEnviada: invitation.success,
        convocatoriaMensaje: invitation.message
      });
    } catch (error) {
      console.error('Create reunion error:', error);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      if (error.name === 'ValidationError') {
        const details = Object.values(error.errors || {}).map(detail => detail.message);
        return res.status(400).json({
          success: false,
          message: details.length ? details.join(' ') : 'Revisa los datos de la reunión.'
        });
      }
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'La reunión ya está registrada. Actualiza la lista de reuniones e inténtalo de nuevo.'
        });
      }
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Uno de los datos seleccionados ya no es válido. Actualiza la página e inténtalo de nuevo.'
        });
      }
      res.status(500).json({
        success: false,
        message: 'No se pudo guardar la reunión. Inténtalo de nuevo; si vuelve a fallar, comparte la hora del error con el administrador.'
      });
    }
  }

  static async stopWeeklyReunion(req, res) {
    try {
      const result = await EmpresaModel.stopWeeklyReunion(req.user.empresaId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Stop weekly reunion error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo detener la repetición de la reunión.'
      });
    }
  }

  // ============================================================
  // REUNIONES - COMPLETAR
  // ============================================================
  static async completeReunion(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { id } = req.params;
      const { resultadoExitoso, conclusion, minuta } = req.body;

      const result = await EmpresaModel.updateReunion(empresaId, id, {
        status: 'finalizada',
        estado: 'finalizada',
        resultadoExitoso,
        conclusion: conclusion || '',
        minuta: minuta || ''
      });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Complete reunion error:', error.message);
      res.status(500).json({ success: false, message: 'Error al completar reunion' });
    }
  }

  static async updateReunion(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { id } = req.params;
      const result = await EmpresaModel.updateReunion(empresaId, id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Update reunion error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo actualizar la reunión. Verifica los datos e inténtalo nuevamente.'
      });
    }
  }

  // ============================================================
  // REUNIONES - ACTUALIZAR MINUTA (IMPORTANTE)
  // ============================================================
  static async updateMinuta(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { id } = req.params;
      const { minuta } = req.body;

      if (minuta === undefined) {
        return res.status(400).json({ success: false, message: 'El contenido de la minuta es obligatorio' });
      }

      const result = await EmpresaModel.updateReunion(empresaId, id, { minuta });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Update minuta error:', error.message);
      res.status(500).json({ success: false, message: 'Error al actualizar minuta' });
    }
  }

  static async uploadEmployeeMeetingSpreadsheet(req, res) {
    let savedFilePath = '';
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'El identificador de la reunión no es válido.' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Selecciona un archivo Excel (.xlsx, .xls o .xlsb).' });
      }
      const extension = path.extname(req.file.originalname).toLowerCase();
      if (!['.xlsx', '.xls', '.xlsb'].includes(extension)) {
        return res.status(400).json({ success: false, message: 'Solo puedes subir hojas de cálculo Excel (.xlsx, .xls o .xlsb).' });
      }
      const profile = await EmpresaModel.getEmpleadoProfile(req.user.employeeId);
      if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
        return res.status(403).json({ success: false, message: 'No se encontró tu cuenta de empleado. Inicia sesión de nuevo.' });
      }
      const reunion = await EmpresaModel.getEmployeeMeetingForSpreadsheetUpload(
        req.user.empresaId,
        profile,
        req.params.id
      );
      const directory = path.join(__dirname, '..', '..', 'uploads', 'reuniones', String(reunion._id));
      await fs.promises.mkdir(directory, { recursive: true });
      const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
      savedFilePath = path.join(directory, safeName);
      await fs.promises.writeFile(savedFilePath, req.file.buffer);

      const documento = await EmpresaModel.addReunionDocumento(req.user.empresaId, reunion._id, {
        area: profile.area,
        nombreArchivo: req.file.originalname,
        tipo: extension.slice(1).toUpperCase(),
        url: `/uploads/reuniones/${reunion._id}/${safeName}`,
        origen: 'empleado',
        empleadoId: profile._id,
        nombreCargador: profile.nombre || profile.email,
        fechaSubida: new Date()
      });
      savedFilePath = '';
      res.status(201).json({
        success: true,
        data: protectDocument(documento, req.user.empresaId),
        message: 'El Excel se agregó a los documentos de tu área para esta reunión.'
      });
    } catch (error) {
      if (savedFilePath) {
        try {
          await fs.promises.unlink(savedFilePath);
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') {
            console.error('Employee spreadsheet cleanup error:', cleanupError.message);
          }
        }
      }
      console.error('Upload employee meeting spreadsheet error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
          ? error.message
          : 'No se pudo guardar el Excel. Verifica que la reunión siga disponible e inténtalo de nuevo.'
      });
    }
  }

  static async deleteEmployeeMeetingSpreadsheet(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.documentId)) {
        return res.status(400).json({
          success: false,
          message: 'El identificador de la reunión o del documento no es válido.'
        });
      }
      const profile = await EmpresaModel.getEmpleadoProfile(req.user.employeeId);
      if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
        return res.status(403).json({
          success: false,
          message: 'No se encontró tu cuenta de empleado. Inicia sesión de nuevo.'
        });
      }
      const documento = await EmpresaModel.deleteEmployeeMeetingSpreadsheet(
        req.user.empresaId,
        profile,
        req.params.id,
        req.params.documentId
      );
      if (documento.url) {
        const filePath = getStoredMeetingDocumentPath(documento);
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      return res.json({ success: true, message: 'Tu documento Excel se eliminó de la reunión.' });
    } catch (error) {
      console.error('Delete employee meeting spreadsheet error:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
          ? error.message
          : 'No se pudo eliminar el Excel. Inténtalo de nuevo o pide ayuda al responsable de Quorum.'
      });
    }
  }

  static async getEmployeeMeetingSpreadsheetInsights(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.documentId)) {
        return res.status(400).json({ success: false, message: 'El identificador de la reunión o del documento no es válido.' });
      }
      const profile = await EmpresaModel.getEmpleadoProfile(req.user.employeeId);
      if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
        return res.status(403).json({ success: false, message: 'No se encontró tu cuenta de empleado. Inicia sesión de nuevo.' });
      }
      const documento = await EmpresaModel.getEmployeeMeetingSpreadsheetForInsights(
        req.user.empresaId,
        profile,
        req.params.id,
        req.params.documentId
      );
      const filePath = getStoredMeetingDocumentPath(documento);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'El archivo Excel ya no está disponible en el servidor.' });
      }
      res.json({ success: true, data: readSpreadsheetInsights(filePath) });
    } catch (error) {
      console.error('Employee spreadsheet insights error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
          ? error.message
          : 'No se pudieron leer los indicadores del archivo. Comprueba que sea un Excel válido y esté guardado en el formato original.'
      });
    }
  }

  static async uploadReunionDocumento(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { id } = req.params;
      const area = String(req.body.area || '').trim();

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'El identificador de la reunión no es válido.' });
      }

      const files = req.files || (req.file ? [req.file] : []);
      if (!files.length) {
        return res.status(400).json({ success: false, message: 'Selecciona los documentos que deseas cargar.' });
      }

      const isPrimaryPresentation = String(req.body.esPresentacionPrincipal || '').toLowerCase() === 'true';
      if (isPrimaryPresentation) {
        if (files.length !== 1 || path.extname(files[0].originalname).toLowerCase() !== '.pdf') {
          return res.status(400).json({
            success: false,
            message: 'La presentación inicial debe ser un único archivo PDF.'
          });
        }
        const directory = path.join(__dirname, '..', '..', 'uploads', 'reuniones', String(id));
        await fs.promises.mkdir(directory, { recursive: true });
        const safeName = `${crypto.randomBytes(16).toString('hex')}.pdf`;
        const filePath = path.join(directory, safeName);
        await fs.promises.writeFile(filePath, files[0].buffer, { flag: 'wx' });
        try {
          const documento = await EmpresaModel.addReunionDocumento(empresaId, id, {
            area: 'Presentación',
            nombreArchivo: files[0].originalname,
            tipo: 'PDF',
            url: `/uploads/reuniones/${id}/${safeName}`,
            esPresentacionPrincipal: true,
            fechaSubida: new Date()
          });
          return res.status(201).json({
            success: true,
            data: [protectDocument(documento, empresaId)]
          });
        } catch (error) {
          try {
            await fs.promises.unlink(filePath);
          } catch (cleanupError) {
            if (cleanupError.code !== 'ENOENT') {
              console.error('Presentation upload cleanup error:', cleanupError.message);
            }
          }
          throw error;
        }
      }

      if (!area) {
        return res.status(400).json({ success: false, message: 'El área del documento es obligatoria.' });
      }

      const directory = path.join(__dirname, '..', '..', 'uploads', 'reuniones', String(id));
      fs.mkdirSync(directory, { recursive: true });
      const documentos = [];
      for (const file of files) {
        const extension = path.extname(file.originalname).toLowerCase();
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        fs.writeFileSync(path.join(directory, safeName), file.buffer);
        const documento = await EmpresaModel.addReunionDocumento(empresaId, id, {
          area,
          nombreArchivo: file.originalname,
          tipo: extension.slice(1).toUpperCase(),
          url: `/uploads/reuniones/${id}/${safeName}`,
          fechaSubida: new Date()
        });
        documentos.push(protectDocument(documento, empresaId));
      }

      res.status(201).json({ success: true, data: documentos });
    } catch (error) {
      console.error('Upload reunion document error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
          ? error.message
          : 'No se pudo guardar el documento. Verifica que la reunión exista y no esté finalizada.'
      });
    }
  }

  static async updatePresentationAreaRanges(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.documentoId)) {
        return res.status(400).json({
          success: false,
          message: 'El identificador de la reunión o de la presentación no es válido.'
        });
      }
      const ranges = req.body?.rangosAreas;
      const documento = await EmpresaModel.updatePresentationAreaRanges(
        req.user.empresaId,
        req.params.id,
        req.params.documentoId,
        ranges
      );
      res.json({
        success: true,
        data: protectDocument(documento, req.user.empresaId)
      });
    } catch (error) {
      console.error('Update presentation area ranges error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudieron guardar los rangos de páginas.'
      });
    }
  }

  static async deleteReunionDocumento(req, res) {
    try {
      const deleted = await EmpresaModel.deleteReunionDocumento(
        req.user.empresaId,
        req.params.id,
        req.params.documentoId
      );
      if (deleted.url) {
        const filePath = path.join(__dirname, '..', '..', deleted.url.replace(/^\/+/, ''));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      res.json({ success: true, message: 'Documento eliminado correctamente.' });
    } catch (error) {
      console.error('Delete reunion document error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo eliminar el documento.'
      });
    }
  }

  static async previewReunionDocumento(req, res) {
    try {
      const documento = await EmpresaModel.getReunionDocumento(
        req.user.empresaId,
        req.params.id,
        req.params.documentoId
      );
      if (!['XLS', 'XLSX', 'XLSB'].includes(String(documento.tipo || '').toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'La vista previa solo está disponible para archivos Excel.'
        });
      }
      const filePath = getStoredMeetingDocumentPath(documento);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'El archivo Excel ya no está disponible en el servidor.'
        });
      }
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const insights = extractSpreadsheetInsights(workbook);
      const maxRows = 500;
      const maxColumns = 50;
      const sheets = workbook.SheetNames.map(name => {
        const allRows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
          header: 1,
          raw: false,
          defval: '',
          blankrows: false
        });
        return {
          name,
          rows: allRows.slice(0, maxRows).map(row =>
            row.slice(0, maxColumns).map(value => String(value ?? ''))
          ),
          truncated: allRows.length > maxRows || allRows.some(row => row.length > maxColumns)
        };
      });
      res.json({ success: true, data: { sheets, insights } });
    } catch (error) {
      console.error('Preview reunion document error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo preparar la vista previa del Excel.'
      });
    }
  }

  static async replaceReunionDocumento(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Selecciona el nuevo archivo PDF, Excel o Word que reemplazará al documento actual.'
        });
      }
      const extension = path.extname(req.file.originalname).toLowerCase();
      const existingDocument = await EmpresaModel.getReunionDocumento(
        req.user.empresaId,
        req.params.id,
        req.params.documentoId
      );
      if (existingDocument.esPresentacionPrincipal && extension !== '.pdf') {
        return res.status(400).json({
          success: false,
          message: 'La presentación inicial solo puede reemplazarse por otro archivo PDF.'
        });
      }
      const safeName = `${Date.now()}-${req.file.originalname
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const directory = path.join(__dirname, '..', '..', 'uploads', 'reuniones', String(req.params.id));
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, safeName), req.file.buffer);

      const result = await EmpresaModel.replaceReunionDocumento(
        req.user.empresaId,
        req.params.id,
        req.params.documentoId,
        {
          nombreArchivo: req.file.originalname,
          tipo: extension.slice(1).toUpperCase(),
          url: `/uploads/reuniones/${req.params.id}/${safeName}`,
          fechaSubida: new Date()
        }
      );
      if (result.oldUrl) {
        const oldPath = path.join(__dirname, '..', '..', result.oldUrl.replace(/^\/+/, ''));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      res.json({
        success: true,
        data: protectDocument(result.documento, req.user.empresaId)
      });
    } catch (error) {
      console.error('Replace reunion document error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo reemplazar el documento.'
      });
    }
  }

  // ============================================================
  // REUNIONES - ELIMINAR
  // ============================================================
  static async deleteReunion(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'El identificador de la reunión no es válido.' });
      }
      const deletedMeeting = await EmpresaModel.deleteReunion(empresaId, id);
      const meetingDirectory = path.resolve(__dirname, '..', '..', 'uploads', 'reuniones', String(id));
      const uploadDirectory = path.resolve(__dirname, '..', '..', 'uploads', 'reuniones');
      const cleanupErrors = [];
      await Promise.all((deletedMeeting.documentos || []).map(async url => {
        const prefix = `/uploads/reuniones/${id}/`;
        if (!url.startsWith(prefix)) return;
        const filename = url.slice(prefix.length);
        if (!filename || filename !== path.basename(filename)) return;
        const filePath = path.resolve(meetingDirectory, filename);
        if (!filePath.startsWith(`${meetingDirectory}${path.sep}`)
          || !meetingDirectory.startsWith(`${uploadDirectory}${path.sep}`)) return;
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          if (error.code !== 'ENOENT') cleanupErrors.push(error);
        }
      }));
      if (!cleanupErrors.length) {
        try {
          await fs.promises.rm(meetingDirectory, { recursive: true, force: true });
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      if (cleanupErrors.length) {
        cleanupErrors.forEach(error => console.error('Meeting document cleanup error:', error.message));
        return res.json({
          success: true,
          message: 'La reunión se eliminó, pero no se pudieron retirar todos sus archivos del almacenamiento.',
          warning: 'Comprueba los permisos o el estado del almacenamiento de documentos.'
        });
      }
      res.json({ success: true, message: 'Reunión eliminada.' });
    } catch (error) {
      console.error('Delete reunion error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Error al eliminar la reunión.'
      });
    }
  }

  // ============================================================
  // REUNIONES - REENVIAR CONVOCATORIA
  // ============================================================
  static async reenviarConvocatoria(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { id } = req.params;

      const empresaData = await EmpresaModel.getEmpresaCompleta(empresaId);
      if (empresaData?.empresa?.verificacion?.estado !== 'aprobada') {
        return res.status(403).json({
          success: false,
          code: 'COMPANY_NOT_VERIFIED',
          message: 'La empresa debe ser aprobada por un administrador antes de enviar convocatorias por correo.'
        });
      }
      const reunion = empresaData?.reuniones?.find(r => r._id.toString() === id);
      if (!reunion) {
        return res.status(404).json({ success: false, message: 'Reunion no encontrada' });
      }

      const invitation = await sendMeetingInvitation(empresaId, reunion);
      if (invitation.success) {
        res.json({ success: true, message: 'Convocatoria reenviada correctamente.' });
      } else {
        res.status(502).json({ success: false, message: invitation.message });
      }
    } catch (error) {
      console.error('Reenviar convocatoria error:', error.message);
      res.status(500).json({ success: false, message: 'Error al reenviar convocatoria' });
    }
  }

  // ============================================================
  // SEGUIMIENTOS
  // ============================================================
  static async createSeguimiento(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { reunionId } = req.params;
      const data = req.body;

      const seguimiento = await EmpresaModel.createSeguimiento(empresaId, reunionId, data);
      res.status(201).json({ success: true, data: seguimiento });
    } catch (error) {
      console.error('Create seguimiento error:', error.message);
      res.status(500).json({ success: false, message: 'Error al crear seguimiento' });
    }
  }

  static async updateSeguimiento(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { reunionId, id } = req.params;
      const data = req.body;

      const result = await EmpresaModel.updateSeguimiento(empresaId, reunionId, id, data);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Update seguimiento error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo actualizar el seguimiento.'
      });
    }
  }

  static async deleteSeguimiento(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { reunionId, id } = req.params;
      await EmpresaModel.deleteSeguimiento(empresaId, reunionId, id);
      res.json({ success: true, message: 'Seguimiento eliminado' });
    } catch (error) {
      console.error('Delete seguimiento error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo eliminar el seguimiento.'
      });
    }
  }


  static async createObjetivo(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const data = req.body;
      const result = await EmpresaModel.createObjetivo(empresaId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Create objetivo error:', error.message);
      res.status(500).json({ success: false, message: 'Error al crear objetivo' });
    }
  }

  static async updateObjetivo(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { id } = req.params;
      const data = req.body;
      const result = await EmpresaModel.updateObjetivo(empresaId, id, data);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Update objetivo error:', error.message);
      res.status(500).json({ success: false, message: 'Error al actualizar objetivo' });
    }
  }

  static async deleteObjetivo(req, res) {
    try {
      const empresaId = req.user.empresaId;
      const { id } = req.params;
      await EmpresaModel.deleteObjetivo(empresaId, id);
      res.json({ success: true, message: 'Objetivo eliminado' });
    } catch (error) {
      console.error('Delete objetivo error:', error.message);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'No se pudo eliminar el objetivo.'
      });
    }
  }

  static async healthCheck(req, res) {
    res.json({
      success: true,
      status: 'OK',
      timestamp: new Date().toISOString()
    });
  }

  static async reviewerLogin(req, res) {
    try {
      const { email, password } = req.body;
      const adminEmail = process.env.ADMIN_EMAIL || process.env.REVIEWER_EMAIL;
      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || process.env.REVIEWER_PASSWORD_HASH;
      const adminJwtSecret = process.env.ADMIN_JWT_SECRET || process.env.REVIEWER_JWT_SECRET;
      if (!adminEmail || !adminPasswordHash || !adminJwtSecret) {
        console.error('Reviewer login: faltan variables de configuración administrativa');
        return res.status(503).json({ success: false, message: 'El acceso de revisores no está configurado' });
      }
      const validPassword = await bcrypt.compare(password, adminPasswordHash);
      if (email !== adminEmail || !validPassword) {
        console.warn(`Reviewer login rechazado para ${email || 'correo vacío'}`);
        return res.status(401).json({ success: false, message: 'Credenciales de revisor inválidas' });
      }
      const token = jwt.sign({ email, role: 'administrator' }, adminJwtSecret, { expiresIn: '8h' });
      console.log(`Reviewer login correcto para ${email}`);
      return res.json({ success: true, token });
    } catch (error) {
      console.error('Reviewer login error:', error.message);
      return res.status(500).json({ success: false, message: 'No se pudo iniciar el panel administrativo' });
    }
  }

  static async listForReview(req, res) {
    try {
      if (req.reviewer.role !== 'administrator') {
        return res.status(403).json({ success: false, message: 'Se requiere un administrador' });
      }
      const empresas = await EmpresaModel.getEmpresasParaRevision();
      console.log(`Panel administrativo: ${empresas.length} empresas cargadas`);
      res.json({ success: true, data: empresas });
    } catch (error) {
      console.error('List reviewer companies error:', error.message);
      res.status(500).json({ success: false, message: 'No se pudieron cargar las empresas para revisión' });
    }
  }

  static async reviewEmpresa(req, res) {
    if (req.reviewer.role !== 'administrator') {
      return res.status(403).json({ success: false, message: 'Se requiere un administrador' });
    }
    const { estado, notas } = req.body;
    if (!['pendiente', 'aprobada', 'rechazada', 'suspendida'].includes(estado)) {
      return res.status(400).json({ success: false, message: 'Estado de revisión inválido' });
    }
    const empresa = await EmpresaModel.actualizarVerificacion(req.params.id, estado, notas, req.reviewer.email);
    res.json({ success: true, data: empresa });
  }
}

module.exports = EmpresaController;