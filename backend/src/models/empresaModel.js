const mongoose = require('mongoose');
const crypto = require('crypto');
const { encryptPassword, decryptPassword } = require('../utils/smtpCredentials');

// ============================================================
// SCHEMAS
// ============================================================

const directivoSchema = new mongoose.Schema({
  empleadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', default: null },
  tieneCuenta: { type: Boolean, default: false },
  nombre: { type: String, required: true },
  tipoPersona: { type: String, enum: ['fisica', 'moral'], default: 'fisica' },
  email: { type: String, required: true },
  area: { type: String, default: '' },
  cargo: { type: String, default: '' },
  telefono: { type: String, default: '' },
  trabajadoresACargo: { type: Number, default: 0 },
  subareas: { type: [String], default: [] },
  esJefeEmpresa: { type: Boolean, default: false },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

const fodaSchema = new mongoose.Schema({
  fortalezas: { type: [String], default: [] },
  debilidades: { type: [String], default: [] },
  oportunidades: { type: [String], default: [] },
  amenazas: { type: [String], default: [] }
}, { timestamps: true });

const acuerdoSchema = new mongoose.Schema({
  descripcion: { type: String, required: true },
  responsable: { type: String, default: '' },
  fechaCompromiso: { type: String, default: '' },
  estado: { type: String, enum: ['pendiente', 'en-proceso', 'completado'], default: 'pendiente' }
}, { timestamps: true });

const objetivoReunionSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  descripcion: { type: String, default: '' },
  area: { type: String, default: '' },
  prioridad: { type: String, enum: ['alta', 'media', 'baja'], default: 'media' },
  progreso: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ['pendiente', 'en-progreso', 'completado'], default: 'pendiente' },
  fechaDefinicion: { type: Date, default: Date.now }
}, { _id: true, timestamps: true });

const objetivoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  prioridad: { type: String, enum: ['alta', 'media', 'baja'], default: 'media' },
  progreso: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ['pendiente', 'en-progreso', 'completado'], default: 'pendiente' },
  descripcion: { type: String, default: '' },
  tasks: { type: [String], default: [] },
  tipoArea: { type: String, enum: ['general', 'especifico'], default: 'general' },
  areasInvolucradas: { type: [String], default: [] }
}, { timestamps: true });

const cronogramaAreaSchema = new mongoose.Schema({
  area: { type: String, required: true },
  tiempo: { type: String, default: '00:15' },
  indicadoresCompromiso: { type: [String], default: [] },
  indicadoresMetas: { type: [String], default: [] },
  documentos: { type: [String], default: [] }
}, { _id: true, timestamps: true });

const presentationAreaRangeSchema = new mongoose.Schema({
  area: { type: String, required: true, trim: true },
  paginaInicio: { type: Number, required: true, min: 1 },
  paginaFin: { type: Number, required: true, min: 1 }
}, { _id: false });

const documentoAreaSchema = new mongoose.Schema({
  area: { type: String, required: true },
  nombreArchivo: { type: String, required: true },
  tipo: { type: String, default: '' },
  url: { type: String, default: '' },
  esPresentacionPrincipal: { type: Boolean, default: false },
  rangosAreas: { type: [presentationAreaRangeSchema], default: [] },
  origen: { type: String, enum: ['organizador', 'empleado'], default: 'organizador' },
  empleadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', default: null },
  nombreCargador: { type: String, default: '' },
  fechaSubida: { type: Date, default: Date.now }
}, { _id: true, timestamps: true });

const seguimientoSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  fecha: { type: String, required: true },
  hora: { type: String, required: true },
  lugar: { type: String, default: '' },
  duracion: { type: String, default: '' },
  objetivo: { type: String, default: '' },
  coordinador: { type: String, default: '' },
  participantes: { type: [String], default: [] },
  directivosSeleccionados: [{ type: mongoose.Schema.Types.ObjectId }],
  empleadosInvitados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Empleado' }],
  departamentos: { type: [String], default: [] },
  agenda: { type: [String], default: [] },
  acuerdos: { type: [acuerdoSchema], default: [] },
  conclusion: { type: String, default: '' },
  minuta: { type: String, default: '' },
  status: { type: String, enum: ['pendiente', 'en-progreso', 'en_curso', 'completada', 'finalizada'], default: 'pendiente' },
  estado: { type: String, enum: ['pendiente', 'en-progreso', 'en_curso', 'completada', 'finalizada'], default: 'pendiente' },
  resultadoExitoso: { type: Boolean, default: false },
  tipoReunion: { type: String, default: 'check-in' },
  cronograma: { type: [cronogramaAreaSchema], default: [] },
  documentos: { type: [documentoAreaSchema], default: [] },
  indicadoresVinculados: { type: [String], default: [] },
  objetivosDefinidos: { type: [objetivoReunionSchema], default: [] }
}, { timestamps: true });

const reunionSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  fecha: { type: String, required: true },
  hora: { type: String, required: true },
  lugar: { type: String, default: '' },
  duracion: { type: String, default: '' },
  objetivo: { type: String, default: '' },
  coordinador: { type: String, default: '' },
  participantes: { type: [String], default: [] },
  directivosSeleccionados: [{ type: mongoose.Schema.Types.ObjectId }],
  empleadosInvitados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Empleado' }],
  departamentos: { type: [String], default: [] },
  agenda: { type: [String], default: [] },
  acuerdos: { type: [acuerdoSchema], default: [] },
  conclusion: { type: String, default: '' },
  minuta: { type: String, default: '' },
  status: { type: String, enum: ['pendiente', 'en-progreso', 'en_curso', 'completada', 'finalizada'], default: 'pendiente' },
  estado: { type: String, enum: ['pendiente', 'en-progreso', 'en_curso', 'completada', 'finalizada'], default: 'pendiente' },
  resultadoExitoso: { type: Boolean, default: false },
  seguimientos: { type: [seguimientoSchema], default: [] },
  tipoReunion: { type: String, default: 'check-in' },
  esParaTodos: { type: Boolean, default: false },
  recurrenciaSemanal: { type: Boolean, default: false },
  recurrenciaActiva: { type: Boolean, default: false },
  serieReunionId: { type: String, default: '' },
  recurrenceOccurrenceKey: { type: String, default: undefined },
  recurrenceLockUntil: { type: Date, default: null },
  convocatoriaEnviada: { type: Boolean, default: false },
  fechaConvocatoria: { type: Date },
  cronograma: { type: [cronogramaAreaSchema], default: [] },
  documentos: { type: [documentoAreaSchema], default: [] },
  indicadoresVinculados: { type: [String], default: [] },
  objetivosDefinidos: { type: [objetivoReunionSchema], default: [] }
}, { timestamps: true });

const empresaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  tipoPersona: { type: String, enum: ['fisica', 'moral'], default: 'fisica' },
  razonSocial: { type: String, required: true, trim: true },
  rfc: { type: String, required: true, uppercase: true, trim: true, unique: true, index: true },
  domicilioFiscal: { type: String, default: '', trim: true },
  regimenFiscal: { type: String, default: '', trim: true },
  representanteLegal: { type: String, required: true, trim: true },
  telefonoContacto: { type: String, required: true, trim: true },
  verificacion: {
    estado: { type: String, enum: ['pendiente', 'aprobada', 'rechazada', 'suspendida'], default: 'pendiente' },
    rfcValidoLocalmente: { type: Boolean, default: false },
    notas: { type: String, default: '' },
    revisadoEn: { type: Date },
    revisadoPor: { type: String, default: '' }
  },
  mision: { type: String, required: true },
  vision: { type: String, required: true },
  correoConvocatorias: { type: String, default: '' },
  smtpConvocatorias: {
    provider: { type: String, enum: ['gmail', 'outlook'] },
    email: { type: String, lowercase: true, trim: true },
    encryptedPassword: { type: String, select: false },
    encryptionIv: { type: String, select: false },
    encryptionTag: { type: String, select: false },
    configuredAt: { type: Date }
  },
  valores: { type: [String], default: [] },
  estrategias: { type: [String], default: [] },
  metas: { type: [String], default: [] },
  indicadores: { type: [String], default: [] },
  departamentos: { type: [String], default: [] },
  directivos: { type: [directivoSchema], default: [] },
  objetivos: { type: [objetivoSchema], default: [] },
  codigoInvitacion: { type: String, unique: true, sparse: true },
  planEstrategico: {
    nombreArchivo: { type: String, default: '' },
    url: { type: String, default: '' },
    fechaSubida: { type: Date }
  },
  foda: { type: fodaSchema, default: () => ({}) },
}, { timestamps: true });

const usuarioSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  termsAcceptedAt: { type: Date },
  termsVersion: { type: String, default: '' }
}, { timestamps: true });

const empleadoSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  nombre: { type: String, default: '', trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: null },
  tieneCuenta: { type: Boolean, default: true },
  rol: { type: String, enum: ['trabajador', 'directivo', ''], default: '' },
  area: { type: String, default: '', trim: true },
  subarea: { type: String, default: '', trim: true },
  telefono: { type: String, default: '', trim: true },
  trabajadoresACargo: { type: Number, default: 0, min: 0 },
  misionPersonal: { type: String, default: '', trim: true, maxlength: 3000 },
  visionPersonal: { type: String, default: '', trim: true, maxlength: 3000 },
  valoresPersonales: { type: [String], default: [] },
  estrategiasPersonales: { type: [String], default: [] },
  metasPersonales: { type: [String], default: [] },
  fodaPersonal: { type: fodaSchema, default: () => ({}) },
  dirigeSubareas: { type: Boolean, default: false },
  subareas: { type: [String], default: [] },
  esJefeDepartamento: { type: Boolean, default: false },
  esJefeEmpresa: { type: Boolean, default: false },
  liderazgoConfirmado: { type: Boolean, default: false },
  jefaturaConfirmada: { type: Boolean, default: false }
}, { timestamps: true });

const reunionPersonalEmpleadoSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  empleadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', required: true, index: true },
  titulo: { type: String, required: true, trim: true, maxlength: 160 },
  fecha: { type: String, required: true },
  hora: { type: String, required: true },
  lugar: { type: String, default: '', trim: true, maxlength: 200 },
  notas: { type: String, default: '', trim: true, maxlength: 3000 }
}, { timestamps: true });

const indicadorPersonalEmpleadoSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  empleadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', required: true, index: true },
  area: { type: String, required: true, trim: true },
  nombre: { type: String, required: true, trim: true, maxlength: 160 },
  descripcion: { type: String, default: '', trim: true, maxlength: 1000 },
  prioridad: { type: String, enum: ['alta', 'media', 'baja'], default: 'media' },
  progreso: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ['pendiente', 'en-progreso', 'completado'], default: 'pendiente' },
  tasks: { type: [String], default: [] },
  creadoPor: { type: String, enum: ['empleado', 'organizador'], required: true }
}, { timestamps: true });

indicadorPersonalEmpleadoSchema.index({ empresaId: 1, empleadoId: 1, updatedAt: -1 });

empresaSchema.pre('validate', function preventOversizedDocument(next) {
  if (!this.tipoPersona) {
    this.tipoPersona = 'fisica';
  }

  const estimatedBytes = Buffer.byteLength(JSON.stringify(this.toObject()), 'utf8');
  const safeDocumentLimit = 14 * 1024 * 1024;

  if (estimatedBytes > safeDocumentLimit) {
    const error = new Error('La información de la empresa es demasiado grande. Archiva reuniones o documentos antiguos antes de guardar más datos.');
    error.statusCode = 413;
    return next(error);
  }

  next();
});

// Índices
usuarioSchema.index({ email: 1 }, { unique: true });
empresaSchema.index({ nombre: 1 });
empresaSchema.index({ 'verificacion.estado': 1, createdAt: -1 });
reunionSchema.add({ empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true } });
reunionSchema.index({ empresaId: 1, fecha: -1 });
reunionSchema.index({ recurrenceOccurrenceKey: 1 }, { unique: true, sparse: true });

const Empresa = mongoose.model('Empresa', empresaSchema);
const Reunion = mongoose.model('Reunion', reunionSchema);
const Usuario = mongoose.model('Usuario', usuarioSchema);
const Empleado = mongoose.model('Empleado', empleadoSchema);
const ReunionPersonalEmpleado = mongoose.model('ReunionPersonalEmpleado', reunionPersonalEmpleadoSchema);
const IndicadorPersonalEmpleado = mongoose.model('IndicadorPersonalEmpleado', indicadorPersonalEmpleadoSchema);

const normalizeMeetingStatus = (value, fallback = 'pendiente') => {
  const status = String(value ?? '').trim().toLowerCase();
  if (!status) return fallback;

  const mapping = {
    pendiente: 'pendiente',
    'en-progreso': 'en_curso',
    en_progreso: 'en_curso',
    'en curso': 'en_curso',
    en_curso: 'en_curso',
    'en curso ': 'en_curso',
    completada: 'finalizada',
    completado: 'finalizada',
    'finalizada': 'finalizada',
    finalizado: 'finalizada',
    cerrada: 'finalizada',
    'finalizada ': 'finalizada'
  };

  return mapping[status] || status;
};

const normalizeArea = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeCronograma = (data = []) => {
  if (!Array.isArray(data) || !data.length) return [];

  return data.map((item, index) => ({
    area: item.area || item.departamento || `Área ${index + 1}`,
    tiempo: item.tiempo || item.time || '00:15',
    indicadoresCompromiso: Array.isArray(item.indicadoresCompromiso) ? item.indicadoresCompromiso : [],
    indicadoresMetas: Array.isArray(item.indicadoresMetas) ? item.indicadoresMetas : [],
    documentos: Array.isArray(item.documentos) ? item.documentos : []
  }));
};

// ============================================================
// MODELO CON MÉTODOS ESTÁTICOS
// ============================================================

class EmpresaModel {

  static async getEmployeeMeetings(empresaId, employeeProfile) {
    const employeeId = String(employeeProfile._id || employeeProfile.id);
    const managedAreas = [
      employeeProfile.area,
      ...(employeeProfile.dirigeSubareas ? employeeProfile.subareas || [] : [])
    ].filter(Boolean).map(normalizeArea);
    const isCompanyHead = Boolean(employeeProfile.esJefeEmpresa);
    const now = new Date();
    const meetings = await Reunion.find({
      empresaId,
      status: { $in: ['pendiente', 'en-progreso', 'en_curso'] }
    })
      .select('titulo fecha hora lugar duracion objetivo coordinador tipoReunion status estado participantes empleadosInvitados departamentos documentos esParaTodos')
      .sort({ fecha: 1, hora: 1 });

    return meetings.reduce((result, reunion) => {
      const time = new Date(`${reunion.fecha}T${reunion.hora || '00:00'}`);
      if (Number.isNaN(time.getTime()) || time < now) return result;

      const invited = (reunion.empleadosInvitados || []).some(id => String(id) === employeeId);
      const isPersonalMeeting = reunion.tipoReunion === 'one-to-one';
      const allCompanyMeeting = Boolean(reunion.esParaTodos)
        || (!reunion.departamentos?.length && !reunion.empleadosInvitados?.length && !isPersonalMeeting);
      const areaMeeting = !isPersonalMeeting && (isCompanyHead
        || allCompanyMeeting
        || (reunion.departamentos || []).some(area => managedAreas.includes(normalizeArea(area)))
      );
      if (!invited && !areaMeeting) return result;

      const meeting = reunion.toObject();
      const category = invited && (isPersonalMeeting || !areaMeeting)
        ? 'personal'
        : 'empresa';
      result.push({
        ...meeting,
        id: reunion._id,
        status: normalizeMeetingStatus(reunion.status || reunion.estado),
        categoriaEmpleado: category,
        documentos: (meeting.documentos || []).filter(documento => {
          const type = String(documento.tipo || '').toUpperCase();
          return type === 'PDF' || (
            ['XLS', 'XLSX', 'XLSB'].includes(type)
            && normalizeArea(documento.area) === normalizeArea(employeeProfile.area)
          );
        })
      });
      return result;
    }, []);
  }

  static async getEmployeePersonalMeetings(empresaId, empleadoId) {
    return ReunionPersonalEmpleado.find({ empresaId, empleadoId })
      .sort({ fecha: -1, hora: -1, createdAt: -1 })
      .lean();
  }

  static async createEmployeePersonalMeeting(empresaId, empleadoId, data) {
    const meeting = new ReunionPersonalEmpleado({
      empresaId,
      empleadoId,
      titulo: String(data.titulo || '').trim(),
      fecha: data.fecha,
      hora: data.hora,
      lugar: String(data.lugar || '').trim(),
      notas: String(data.notas || '').trim()
    });
    return meeting.save();
  }

  static async updateEmployeePersonalMeeting(empresaId, empleadoId, meetingId, data) {
    const meeting = await ReunionPersonalEmpleado.findOne({ _id: meetingId, empresaId, empleadoId });
    if (!meeting) {
      const error = new Error('No se encontró esa reunión personal.');
      error.statusCode = 404;
      throw error;
    }
    ['titulo', 'fecha', 'hora', 'lugar', 'notas'].forEach(field => {
      if (data[field] !== undefined) {
        meeting[field] = ['titulo', 'lugar', 'notas'].includes(field)
          ? String(data[field] || '').trim()
          : data[field];
      }
    });
    return meeting.save();
  }

  static async deleteEmployeePersonalMeeting(empresaId, empleadoId, meetingId) {
    const result = await ReunionPersonalEmpleado.deleteOne({ _id: meetingId, empresaId, empleadoId });
    if (!result.deletedCount) {
      const error = new Error('No se encontró esa reunión personal o ya fue eliminada.');
      error.statusCode = 404;
      throw error;
    }
  }

  static async getEmployeePersonalObjectives(empresaId, empleadoId) {
    return IndicadorPersonalEmpleado.find({ empresaId, empleadoId })
      .sort({ createdAt: -1 })
      .lean();
  }

  static async getEmployeeMeetingForSpreadsheetUpload(empresaId, employeeProfile, reunionId) {
    const reunion = await Reunion.findOne({ _id: reunionId, empresaId });
    if (!reunion) {
      const error = new Error('No se encontró la reunión seleccionada.');
      error.statusCode = 404;
      throw error;
    }
    if (normalizeMeetingStatus(reunion.status || reunion.estado) === 'finalizada') {
      const error = new Error('No se pueden agregar documentos a una reunión finalizada.');
      error.statusCode = 409;
      throw error;
    }
    const area = normalizeArea(employeeProfile.area);
    if (!area) {
      const error = new Error('Completa el departamento de tu perfil antes de subir documentos.');
      error.statusCode = 400;
      throw error;
    }
    const invited = (reunion.empleadosInvitados || [])
      .some(id => String(id) === String(employeeProfile._id));
    const companyWide = Boolean(reunion.esParaTodos)
      || (!reunion.departamentos?.length && !reunion.empleadosInvitados?.length
        && reunion.tipoReunion !== 'one-to-one');
    const areaParticipates = (reunion.departamentos || [])
      .some(department => normalizeArea(department) === area);
    const accessible = companyWide || areaParticipates || invited;
    if (!accessible) {
      const error = new Error('Solo puedes subir documentos a reuniones de tu área o a reuniones donde tengas invitación.');
      error.statusCode = 403;
      throw error;
    }
    if (!companyWide && !areaParticipates) {
      const error = new Error('Tu departamento no está asociado a esta reunión. No puedes adjuntar un documento de otra área.');
      error.statusCode = 403;
      throw error;
    }
    return reunion;
  }

  static async getEmployeeMeetingSpreadsheetForInsights(empresaId, employeeProfile, reunionId, documentoId) {
    const reunion = await Reunion.findOne({ _id: reunionId, empresaId });
    if (!reunion) {
      const error = new Error('No se encontró la reunión seleccionada.');
      error.statusCode = 404;
      throw error;
    }
    const area = normalizeArea(employeeProfile.area);
    const managedAreas = [
      employeeProfile.area,
      ...(employeeProfile.dirigeSubareas ? employeeProfile.subareas || [] : [])
    ].filter(Boolean).map(normalizeArea);
    const invited = (reunion.empleadosInvitados || [])
      .some(id => String(id) === String(employeeProfile._id));
    const companyWide = Boolean(reunion.esParaTodos)
      || (!reunion.departamentos?.length && !reunion.empleadosInvitados?.length
        && reunion.tipoReunion !== 'one-to-one');
    const areaMeeting = reunion.tipoReunion !== 'one-to-one' && (
      employeeProfile.esJefeEmpresa
      || companyWide
      || (reunion.departamentos || []).some(department => managedAreas.includes(normalizeArea(department)))
    );
    if (!invited && !areaMeeting) {
      const error = new Error('No tienes acceso a esta reunión.');
      error.statusCode = 403;
      throw error;
    }
    const documento = reunion.documentos.id(documentoId);
    if (!documento || !['XLS', 'XLSX', 'XLSB'].includes(String(documento.tipo || '').toUpperCase())) {
      const error = new Error('No se encontró el documento Excel solicitado.');
      error.statusCode = 404;
      throw error;
    }
    if (!area || normalizeArea(documento.area) !== area) {
      const error = new Error('Solo puedes consultar los indicadores de los documentos de tu departamento.');
      error.statusCode = 403;
      throw error;
    }
    return documento;
  }

  static async getEmployeeTeamObjectives(empresaId, employeeProfile) {
    if (employeeProfile?.rol !== 'directivo'
      || (!employeeProfile.esJefeEmpresa && !employeeProfile.esJefeDepartamento)) {
      return [];
    }
    if (!employeeProfile.esJefeEmpresa && !normalizeArea(employeeProfile.area)) return [];

    const employees = await Empleado.find({
      empresaId,
      _id: { $ne: employeeProfile._id }
    })
      .select('_id nombre area')
      .lean();
    const managedEmployees = employeeProfile.esJefeEmpresa
      ? employees
      : employees.filter(employee =>
        normalizeArea(employee.area) === normalizeArea(employeeProfile.area)
      );
    if (!managedEmployees.length) return [];

    const employeeById = new Map(managedEmployees.map(employee => [String(employee._id), employee]));
    const objectives = await IndicadorPersonalEmpleado.find({
      empresaId,
      empleadoId: { $in: managedEmployees.map(employee => employee._id) }
    })
      .sort({ createdAt: -1 })
      .lean();
    const objectivesByEmployee = new Map();

    objectives.forEach(objective => {
      const employeeId = String(objective.empleadoId);
      const employee = employeeById.get(employeeId);
      if (!employee) return;
      const employeeObjectives = objectivesByEmployee.get(employeeId) || [];
      employeeObjectives.push(objective);
      objectivesByEmployee.set(employeeId, employeeObjectives);
    });

    return [...objectivesByEmployee.entries()].map(([employeeId, indicadores]) => {
      const employee = employeeById.get(employeeId);
      return {
        empleadoId: employeeId,
        nombre: employee.nombre,
        area: employee.area,
        indicadores
      };
    });
  }

  static async createEmployeePersonalObjective(empresaId, empleadoId, area, data, creadoPor) {
    const objective = new IndicadorPersonalEmpleado({
      empresaId,
      empleadoId,
      area,
      nombre: String(data.nombre || '').trim(),
      descripcion: String(data.descripcion || '').trim(),
      prioridad: data.prioridad || 'media',
      progreso: Number(data.progreso) || 0,
      status: data.status || 'pendiente',
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      creadoPor
    });
    return objective.save();
  }

  static async updateEmployeePersonalObjective(empresaId, empleadoId, objectiveId, data) {
    const objective = await IndicadorPersonalEmpleado.findOne({ _id: objectiveId, empresaId, empleadoId });
    if (!objective) {
      const error = new Error('No se encontró ese indicador personal.');
      error.statusCode = 404;
      throw error;
    }
    ['nombre', 'descripcion', 'prioridad', 'progreso', 'status', 'tasks'].forEach(field => {
      if (data[field] !== undefined) objective[field] = data[field];
    });
    return objective.save();
  }

  static async deleteEmployeePersonalObjective(empresaId, empleadoId, objectiveId) {
    const objective = await IndicadorPersonalEmpleado.findOne({ _id: objectiveId, empresaId, empleadoId });
    if (!objective) {
      const error = new Error('No se encontró ese indicador personal.');
      error.statusCode = 404;
      throw error;
    }
    await objective.deleteOne();
  }

  static async validateInvitedEmployees(empresaId, employeeIds = []) {
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) return [];
    const uniqueIds = [...new Set(employeeIds.map(id => String(id)))];
    if (uniqueIds.some(id => !mongoose.isValidObjectId(id))) {
      const error = new Error('La lista de empleados invitados contiene identificadores no válidos.');
      error.statusCode = 400;
      throw error;
    }
    const employees = await Empleado.find({
      _id: { $in: uniqueIds },
      empresaId
    }).select('_id');
    if (employees.length !== uniqueIds.length) {
      const error = new Error('Solo puedes invitar cuentas de empleado vinculadas a esta empresa.');
      error.statusCode = 400;
      throw error;
    }
    return employees.map(employee => employee._id);
  }

  // ---------- CREAR EMPRESA COMPLETA ----------
  static async createEmpresaCompleta(data) {
    try {
      const foda = {
        fortalezas: data.fortalezas || [],
        debilidades: data.debilidades || [],
        oportunidades: data.oportunidades || [],
        amenazas: data.amenazas || []
      };

      const objetivos = (data.objetivos || [])
        .filter(obj => obj?.nombre?.trim())
        .map(obj => ({
          nombre: obj.nombre.trim(),
          prioridad: obj.prioridad || 'media',
          progreso: obj.progreso || 0,
          status: obj.status || 'pendiente',
          descripcion: obj.descripcion || '',
          tasks: obj.tasks || [],
          tipoArea: obj.tipoArea || 'general',
          areasInvolucradas: obj.areasInvolucradas || []
        }));

      const empresa = new Empresa({
        nombre: data.nombre,
        tipoPersona: data.tipoPersona || 'fisica',
        razonSocial: data.razonSocial,
        rfc: data.rfc,
        domicilioFiscal: data.domicilioFiscal || '',
        regimenFiscal: data.regimenFiscal || '',
        representanteLegal: data.representanteLegal,
        telefonoContacto: data.telefonoContacto,
        verificacion: {
          estado: 'pendiente',
          rfcValidoLocalmente: data.rfcValidoLocalmente === true
        },
        mision: data.mision,
        vision: data.vision,
        valores: data.valores || [],
        estrategias: data.estrategias || [],
        metas: data.metas || [],
        indicadores: data.indicadores || [],
        departamentos: data.departamentos || [],
        directivos: data.directivos || [],
        correoConvocatorias: data.correoConvocatorias || '',
        objetivos,
        codigoInvitacion: `QRM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        foda,
      });

      await empresa.save();

      if (data.email && data.passwordHash) {
        await Usuario.create({
          empresaId: empresa._id,
          email: String(data.email).trim().toLowerCase(),
          passwordHash: data.passwordHash,
          termsAcceptedAt: data.termsAcceptedAt,
          termsVersion: data.termsVersion
        });
      }

      return { id: empresa._id, success: true };
    } catch (error) {
      console.error('Error en createEmpresaCompleta:', error.message);
      throw error;
    }
  }

  // ---------- OBTENER EMPRESA COMPLETA ----------
  static async getEmpresaCompleta(empresaId) {
    try {
      const empresa = await Empresa.findById(empresaId);
      if (!empresa) return null;

      const empresaData = empresa.toObject();
      delete empresaData.objetivos;
      delete empresaData.smtpConvocatorias;

      const reuniones = await Reunion.find({ empresaId }).sort({ fecha: -1, createdAt: -1 });
      const smtpConvocatorias = empresa.smtpConvocatorias?.email
        ? {
          configured: true,
          provider: empresa.smtpConvocatorias.provider,
          email: empresa.smtpConvocatorias.email
        }
        : { configured: false };
      return {
        empresa: empresaData,
        foda: empresa.foda || {},
        objetivos: empresa.objetivos || [],
        reuniones,
        directivos: empresa.directivos || [],
        smtpConvocatorias,
      };
    } catch (error) {
      console.error('Error en getEmpresaCompleta:', error.message);
      throw error;
    }
  }

  static getSubareasPorDepartamento(directivos = []) {
    return directivos.reduce((subareasByDepartment, directivo) => {
      const area = String(directivo.area || '').trim();
      if (!area) return subareasByDepartment;
      const combined = [...(subareasByDepartment[area] || []), ...(directivo.subareas || [])]
        .map(subarea => String(subarea).trim())
        .filter(Boolean);
      const uniqueSubareas = new Map();
      combined.forEach(subarea => {
        const key = normalizeArea(subarea);
        if (!uniqueSubareas.has(key)) uniqueSubareas.set(key, subarea);
      });
      subareasByDepartment[area] = [...uniqueSubareas.values()];
      return subareasByDepartment;
    }, {});
  }

  static async getEmployeePortalData(empresaId) {
    const empresa = await Empresa.findById(empresaId).select('nombre departamentos directivos');
    if (!empresa) return null;
    const empleadosDirectivos = await Empleado.find({ empresaId, dirigeSubareas: true })
      .select('area subareas')
      .lean();
    const directivosConSubareas = [...(empresa.directivos || []), ...empleadosDirectivos];
    return {
      empresa: {
        id: empresa._id,
        nombre: empresa.nombre,
        departamentos: empresa.departamentos,
        subareasPorDepartamento: this.getSubareasPorDepartamento(directivosConSubareas)
      },
      reuniones: []
    };
  }

  static async getEmployeeCompanyByCode(companyCode) {
    const empresa = await Empresa.findOne({
      codigoInvitacion: String(companyCode || '').trim().toUpperCase()
    }).select('_id nombre departamentos directivos');
    if (!empresa) {
      const error = new Error('El código de invitación no existe. Verifica el código con el organizador.');
      error.statusCode = 404;
      throw error;
    }
    const empleadosDirectivos = await Empleado.find({ empresaId: empresa._id, dirigeSubareas: true })
      .select('area subareas')
      .lean();
    return {
      id: empresa._id,
      nombre: empresa.nombre,
      departamentos: empresa.departamentos || [],
      subareasPorDepartamento: this.getSubareasPorDepartamento([
        ...(empresa.directivos || []),
        ...empleadosDirectivos
      ])
    };
  }

  static async registerEmpleado({ companyCode, nombre, email, passwordHash }) {
    const empresa = await Empresa.findOne({ codigoInvitacion: String(companyCode || '').trim().toUpperCase() })
      .select('_id departamentos directivos');
    if (!empresa) {
      const error = new Error('El código de invitación no existe. Solicita el código vigente al organizador.');
      error.statusCode = 404;
      throw error;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingEmployee = await Empleado.findOne({ email: normalizedEmail });
    const manualDirector = empresa.directivos.find(
      directivo => String(directivo.email || '').trim().toLowerCase() === normalizedEmail
    );
    if (manualDirector && !existingEmployee?.passwordHash) {
      const error = new Error('Esta cuenta directiva fue asignada por la empresa y no puede reclamarse desde el registro público. Pide al organizador que habilite tu acceso.');
      error.statusCode = 403;
      error.code = 'DIRECTOR_ACCOUNT_REQUIRES_ORGANIZER';
      throw error;
    }
    if (existingEmployee) {
      if (String(existingEmployee.empresaId) !== String(empresa._id)) {
        const error = new Error('Este correo ya está vinculado a otra empresa. Usa el correo que registró tu empresa.');
        error.statusCode = 409;
        throw error;
      }
      if (existingEmployee.passwordHash) {
        const error = new Error('Ya existe una cuenta de empleado con este correo. Inicia sesión para continuar.');
        error.statusCode = 409;
        error.code = 'EMPLOYEE_ACCOUNT_EXISTS';
        throw error;
      }
      existingEmployee.passwordHash = passwordHash;
      existingEmployee.tieneCuenta = true;
      existingEmployee.nombre = String(nombre || existingEmployee.nombre).trim();
      await existingEmployee.save();
      const linkedDirector = empresa.directivos.find(
        directivo => String(directivo.email || '').trim().toLowerCase() === normalizedEmail
      );
      if (linkedDirector) {
        linkedDirector.empleadoId = existingEmployee._id;
        linkedDirector.tieneCuenta = true;
        await empresa.save();
      }
      return {
        id: existingEmployee._id,
        empresaId: empresa._id,
        departamentos: empresa.departamentos || [],
        subareasPorDepartamento: this.getSubareasPorDepartamento(empresa.directivos || []),
        profileComplete: Boolean(existingEmployee.liderazgoConfirmado && existingEmployee.jefaturaConfirmada)
      };
    }
    const existingCompanyAccount = await Usuario.findOne({ email: String(email).trim().toLowerCase() }).select('empresaId');
    if (existingCompanyAccount && String(existingCompanyAccount.empresaId) !== String(empresa._id)) {
      const error = new Error('Este correo ya está asociado a una cuenta organizadora de otra empresa. Usa un correo distinto para el perfil de empleado.');
      error.statusCode = 409;
      throw error;
    }
    const empleado = await Empleado.create({
      empresaId: empresa._id,
      nombre: String(nombre || manualDirector?.nombre || '').trim(),
      email: normalizedEmail,
      passwordHash,
      tieneCuenta: true,
      rol: manualDirector ? 'directivo' : '',
      area: manualDirector?.area || '',
      telefono: manualDirector?.telefono || '',
      trabajadoresACargo: manualDirector?.trabajadoresACargo || 0,
      dirigeSubareas: Boolean(manualDirector?.subareas?.length),
      subareas: manualDirector?.subareas || [],
      esJefeDepartamento: Boolean(manualDirector && !manualDirector.esJefeEmpresa),
      esJefeEmpresa: Boolean(manualDirector?.esJefeEmpresa),
      liderazgoConfirmado: Boolean(manualDirector),
      jefaturaConfirmada: Boolean(manualDirector)
    });
    if (manualDirector) {
      manualDirector.empleadoId = empleado._id;
      manualDirector.tieneCuenta = true;
      await empresa.save();
    }
    return {
      id: empleado._id,
      empresaId: empresa._id,
      departamentos: empresa.departamentos || [],
      subareasPorDepartamento: this.getSubareasPorDepartamento(empresa.directivos || []),
      profileComplete: false
    };
  }

  static async getCompanyAccountForEmployee(email) {
    const usuario = await Usuario.findOne({ email: String(email || '').trim().toLowerCase() })
      .select('empresaId passwordHash');
    if (!usuario) return null;
    return { empresaId: usuario.empresaId, passwordHash: usuario.passwordHash };
  }

  static async verifyEmpleado(email) {
    const empleado = await Empleado.findOne({ email: String(email).trim().toLowerCase() });
    if (!empleado?.passwordHash) return null;
    const missingProfileFields = this.getMissingEmployeeProfileFields(empleado);
    return {
      id: empleado._id,
      empresaId: empleado.empresaId,
      email: empleado.email,
      passwordHash: empleado.passwordHash,
      missingProfileFields,
      profileComplete: missingProfileFields.length === 0
    };
  }

  static getMissingEmployeeProfileFields(profile) {
    const missing = [];
    if (!String(profile.nombre || '').trim()) missing.push('nombre completo');
    if (!['trabajador', 'directivo'].includes(profile.rol)) missing.push('puesto');
    if (!profile.esJefeEmpresa && !String(profile.area || '').trim()) missing.push('departamento');
    if (!profile.liderazgoConfirmado || !profile.jefaturaConfirmada) {
      missing.push('responsabilidad de jefatura');
    }
    if (profile.dirigeSubareas
      && !(Array.isArray(profile.subareas) && profile.subareas.some(item => String(item).trim()))) {
      missing.push('subáreas a cargo');
    }
    return missing;
  }

  static async completeEmpleadoProfile(empleadoId, profile) {
    const empleado = await Empleado.findById(empleadoId);
    if (!empleado) {
      const error = new Error('No se encontró el perfil del empleado.');
      error.statusCode = 404;
      throw error;
    }
    const empresa = await Empresa.findById(empleado.empresaId).select('departamentos directivos');
    if (!empresa) {
      const error = new Error('La empresa vinculada ya no existe.');
      error.statusCode = 404;
      throw error;
    }
    const area = String(profile.area || '').trim();
    const subarea = String(profile.subarea || '').trim();
    const rol = String(profile.rol || '').trim();
    const jefatura = String(profile.jefatura || '');
    if (!['ninguna', 'departamento', 'empresa'].includes(jefatura)) {
      const error = new Error('Indica si eres jefe de departamento, jefe de la empresa o si no tienes una jefatura.');
      error.statusCode = 400;
      throw error;
    }
    const esJefeDepartamento = Boolean(profile.esJefeDepartamento);
    const esJefeEmpresa = Boolean(profile.esJefeEmpresa);
    if (esJefeDepartamento !== (jefatura === 'departamento') || esJefeEmpresa !== (jefatura === 'empresa')) {
      const error = new Error('La responsabilidad de jefatura seleccionada no coincide con el perfil.');
      error.statusCode = 400;
      throw error;
    }
    const tieneJefaturaAprobada = Boolean(empleado.esJefeDepartamento || empleado.esJefeEmpresa);
    if ((esJefeDepartamento || esJefeEmpresa) && !tieneJefaturaAprobada) {
      const error = new Error('La jefatura debe ser asignada por el organizador de la empresa.');
      error.statusCode = 403;
      throw error;
    }
    if (profile.dirigeSubareas && !empleado.dirigeSubareas) {
      const error = new Error('La responsabilidad de subáreas debe ser asignada por el organizador de la empresa.');
      error.statusCode = 403;
      throw error;
    }
    if (!['trabajador', 'directivo'].includes(rol)) {
      const error = new Error('Selecciona si eres trabajador o directivo.');
      error.statusCode = 400;
      throw error;
    }
    if ((tieneJefaturaAprobada || esJefeDepartamento || esJefeEmpresa) && rol !== 'directivo') {
      const error = new Error('Las jefaturas deben registrarse con el rol de directivo.');
      error.statusCode = 400;
      throw error;
    }
    if (tieneJefaturaAprobada && normalizeArea(area) !== normalizeArea(empleado.area)) {
      const error = new Error('El departamento de una jefatura debe cambiarlo el organizador de la empresa.');
      error.statusCode = 403;
      throw error;
    }
    if (normalizeArea(empleado.area) && normalizeArea(area) !== normalizeArea(empleado.area)) {
      const error = new Error('El departamento asignado debe cambiarlo el organizador de la empresa.');
      error.statusCode = 403;
      throw error;
    }
    if ((!esJefeEmpresa || area) && !(empresa.departamentos || []).some(department =>
      normalizeArea(department) === normalizeArea(area)
    )) {
      const error = new Error('Selecciona un área registrada en tu empresa.');
      error.statusCode = 400;
      throw error;
    }
    const registeredSubareas = this.getSubareasPorDepartamento(empresa.directivos || []);
    const areaSubareas = Object.entries(registeredSubareas)
      .find(([department]) => normalizeArea(department) === normalizeArea(area))?.[1] || [];
    const dirigeSubareas = Boolean(empleado.dirigeSubareas);
    const managerSubareas = rol === 'directivo' && dirigeSubareas
      ? (Array.isArray(empleado.subareas) ? empleado.subareas : []).map(item => String(item).trim()).filter(Boolean)
      : [];
    if (rol === 'directivo' && dirigeSubareas && !managerSubareas.length) {
      const error = new Error('Escribe al menos una subárea para que los empleados puedan seleccionarla.');
      error.statusCode = 400;
      throw error;
    }
    const keepCurrentSubarea = areaSubareas.length === 0
      && normalizeArea(subarea) === normalizeArea(empleado.subarea)
      && normalizeArea(area) === normalizeArea(empleado.area);
    if (subarea && !keepCurrentSubarea
      && ![...areaSubareas, ...managerSubareas].some(item => normalizeArea(item) === normalizeArea(subarea))) {
      const error = new Error('Selecciona una subárea registrada por el responsable de tu departamento.');
      error.statusCode = 400;
      throw error;
    }
    empleado.nombre = String(profile.nombre || empleado.nombre).trim();
    empleado.rol = tieneJefaturaAprobada ? 'directivo' : rol;
    empleado.area = area;
    empleado.subarea = subarea;
    empleado.telefono = String(profile.telefono || '').trim();
    empleado.dirigeSubareas = dirigeSubareas;
    empleado.subareas = dirigeSubareas ? [...new Set(managerSubareas)] : [];
    empleado.esJefeDepartamento = Boolean(empleado.esJefeDepartamento);
    empleado.esJefeEmpresa = Boolean(empleado.esJefeEmpresa);
    empleado.liderazgoConfirmado = true;
    empleado.jefaturaConfirmada = true;
    await this.syncEmpleadoDirectivo(empleado);
    await empleado.save();
    await IndicadorPersonalEmpleado.updateMany(
      { empresaId: empleado.empresaId, empleadoId: empleado._id },
      { $set: { area: empleado.area } }
    );
    return this.getEmpleadoProfile(empleadoId);
  }

  static async updateEmployeePersonalStrategy(empresaId, empleadoId, data) {
    const empleado = await Empleado.findOne({ _id: empleadoId, empresaId });
    if (!empleado) {
      const error = new Error('No se encontró el perfil del empleado.');
      error.statusCode = 404;
      throw error;
    }
    if (data.trabajadoresACargo !== undefined) {
      if (!empleado.esJefeDepartamento) {
        const error = new Error('Solo una jefatura de departamento puede actualizar la cantidad de personas a su cargo.');
        error.statusCode = 403;
        throw error;
      }
      empleado.trabajadoresACargo = Number(data.trabajadoresACargo);
    }
    ['misionPersonal', 'visionPersonal'].forEach(field => {
      if (data[field] !== undefined) empleado[field] = String(data[field] || '').trim();
    });
    ['valoresPersonales', 'estrategiasPersonales', 'metasPersonales'].forEach(field => {
      if (data[field] !== undefined) empleado[field] = data[field];
    });
    if (data.fodaPersonal !== undefined) {
      empleado.fodaPersonal = data.fodaPersonal;
    }
    if (data.trabajadoresACargo !== undefined) {
      await this.syncEmpleadoDirectivo(empleado);
    }
    await empleado.save();
    return this.getEmpleadoProfile(empleadoId);
  }

  static async syncEmpleadoDirectivo(empleado) {
    const empresa = await Empresa.findById(empleado.empresaId);
    if (!empresa) {
      const error = new Error('No se encontró la empresa vinculada.');
      error.statusCode = 404;
      throw error;
    }
    const email = String(empleado.email || '').trim().toLowerCase();
    const emailIndex = empresa.directivos.findIndex(
      directivo => String(directivo.email || '').trim().toLowerCase() === email
    );

    if (empleado.rol !== 'directivo') {
      if (emailIndex !== -1) {
        empresa.directivos.splice(emailIndex, 1);
        await empresa.save();
      }
      return;
    }

    const area = String(empleado.area || '').trim();
    const areaIndex = area
      ? empresa.directivos.findIndex(directivo =>
        normalizeArea(directivo.area) === normalizeArea(area)
        && String(directivo.email || '').trim().toLowerCase() !== email
      )
      : -1;
    if (areaIndex !== -1) {
      const error = new Error('Ya hay un directivo registrado para esta área. Pide al organizador que revise el registro antes de continuar.');
      error.statusCode = 409;
      throw error;
    }

    const directorData = {
      empleadoId: empleado._id,
      nombre: empleado.nombre || empleado.email,
      email,
      area,
      cargo: empleado.esJefeEmpresa ? 'Dirección de empresa' : 'Dirección de departamento',
      telefono: empleado.telefono || '',
      trabajadoresACargo: empleado.trabajadoresACargo || 0,
      subareas: empleado.dirigeSubareas ? empleado.subareas || [] : [],
      esJefeEmpresa: Boolean(empleado.esJefeEmpresa),
      tieneCuenta: Boolean(empleado.passwordHash),
      activo: true
    };
    if (emailIndex !== -1) {
      Object.assign(empresa.directivos[emailIndex], directorData);
    } else {
      empresa.directivos.push(directorData);
    }
    await empresa.save();
  }

  static async getEmpleadoProfile(empleadoId) {
    return Empleado.findById(empleadoId)
      .select('empresaId nombre email tieneCuenta rol area subarea telefono trabajadoresACargo misionPersonal visionPersonal valoresPersonales estrategiasPersonales metasPersonales fodaPersonal dirigeSubareas subareas esJefeDepartamento esJefeEmpresa liderazgoConfirmado jefaturaConfirmada')
      .lean();
  }

  static async getEmployeeAreaObjectives(empresaId, employeeProfile) {
    if (employeeProfile?.rol !== 'directivo'
      || !(employeeProfile.esJefeEmpresa || employeeProfile.esJefeDepartamento || employeeProfile.dirigeSubareas)) {
      return [];
    }
    const company = await Empresa.findById(empresaId).select('objetivos directivos');
    if (!company) return [];
    if (employeeProfile.esJefeEmpresa) {
      const empleadosDirectivos = await Empleado.find({ empresaId, dirigeSubareas: true })
        .select('area subareas')
        .lean();
      const subareas = new Set(
        Object.values(this.getSubareasPorDepartamento([
          ...(company.directivos || []),
          ...empleadosDirectivos
        ]))
          .flat()
          .map(normalizeArea)
      );
      return (company.objetivos || [])
        .filter(objective => objective.tipoArea === 'general'
          || !(objective.areasInvolucradas || []).some(area => subareas.has(normalizeArea(area))))
        .map(objective => objective.toObject());
    }
    if (!employeeProfile.area) return [];
    const managedAreas = [employeeProfile.area, ...(employeeProfile.dirigeSubareas ? employeeProfile.subareas || [] : [])]
      .map(normalizeArea);
    return (company.objetivos || [])
      .filter(objective => objective.tipoArea === 'general'
        || (objective.areasInvolucradas || []).some(area => managedAreas.includes(normalizeArea(area))))
      .map(objective => objective.toObject());
  }

  static async updateEmpleadoProfile(empresaId, empleadoId, profile) {
    const empleado = await Empleado.findOne({ _id: empleadoId, empresaId });
    if (!empleado) {
      const error = new Error('No se encontró una cuenta de empleado de esta empresa.');
      error.statusCode = 404;
      throw error;
    }
    const empresa = await Empresa.findById(empresaId).select('departamentos directivos');
    const area = String(profile.area || '').trim();
    const subarea = String(profile.subarea || '').trim();
    const rol = String(profile.rol || '').trim();
    const esJefeDepartamento = Boolean(profile.esJefeDepartamento);
    const esJefeEmpresa = Boolean(profile.esJefeEmpresa);
    if (!['trabajador', 'directivo'].includes(rol)) {
      const error = new Error('Selecciona si la persona es trabajador o directivo.');
      error.statusCode = 400;
      throw error;
    }
    if ((esJefeDepartamento || esJefeEmpresa) && rol !== 'directivo') {
      const error = new Error('Las jefaturas deben registrarse con el rol de directivo.');
      error.statusCode = 400;
      throw error;
    }
    if ((!esJefeEmpresa || area) && !(empresa?.departamentos || []).some(department =>
      normalizeArea(department) === normalizeArea(area)
    )) {
      const error = new Error('Selecciona un área registrada en la empresa.');
      error.statusCode = 400;
      throw error;
    }
    const registeredSubareas = this.getSubareasPorDepartamento(empresa?.directivos || []);
    const areaSubareas = Object.entries(registeredSubareas)
      .find(([department]) => normalizeArea(department) === normalizeArea(area))?.[1] || [];
    const managerSubareas = rol === 'directivo' && profile.dirigeSubareas
      ? (Array.isArray(profile.subareas) ? profile.subareas : []).map(item => String(item).trim()).filter(Boolean)
      : [];
    if (rol === 'directivo' && profile.dirigeSubareas && !managerSubareas.length) {
      const error = new Error('Escribe al menos una subárea para que los empleados puedan seleccionarla.');
      error.statusCode = 400;
      throw error;
    }
    const keepCurrentSubarea = areaSubareas.length === 0
      && normalizeArea(subarea) === normalizeArea(empleado.subarea)
      && normalizeArea(area) === normalizeArea(empleado.area);
    if (subarea && !keepCurrentSubarea
      && ![...areaSubareas, ...managerSubareas].some(item => normalizeArea(item) === normalizeArea(subarea))) {
      const error = new Error('Selecciona una subárea registrada por el responsable de tu departamento.');
      error.statusCode = 400;
      throw error;
    }
    empleado.nombre = String(profile.nombre || '').trim();
    empleado.rol = rol;
    empleado.area = area;
    empleado.subarea = subarea;
    empleado.telefono = String(profile.telefono || '').trim();
    empleado.trabajadoresACargo = Math.max(0, Number(profile.trabajadoresACargo) || 0);
    empleado.dirigeSubareas = rol === 'directivo' && Boolean(profile.dirigeSubareas);
    empleado.subareas = empleado.dirigeSubareas
      ? [...new Set((Array.isArray(profile.subareas) ? profile.subareas : [])
        .map(item => String(item).trim()).filter(Boolean))]
      : [];
    empleado.esJefeDepartamento = esJefeDepartamento;
    empleado.esJefeEmpresa = esJefeEmpresa;
    empleado.liderazgoConfirmado = true;
    empleado.jefaturaConfirmada = true;
    if (profile.passwordHash) {
      empleado.passwordHash = profile.passwordHash;
      empleado.tieneCuenta = true;
    }
    await this.syncEmpleadoDirectivo(empleado);
    await empleado.save();
    await IndicadorPersonalEmpleado.updateMany(
      { empresaId, empleadoId: empleado._id },
      { $set: { area: empleado.area } }
    );
    return this.getEmpleadoProfile(empleadoId);
  }

  static async createManualEmpleado(empresaId, profile) {
    const empresa = await Empresa.findById(empresaId).select('departamentos directivos');
    if (!empresa) {
      const error = new Error('No se encontró la empresa.');
      error.statusCode = 404;
      throw error;
    }
    const nombre = String(profile.nombre || '').trim();
    const email = String(profile.email || '').trim().toLowerCase();
    const rol = String(profile.rol || '').trim();
    const area = String(profile.area || '').trim();
    const esJefeEmpresa = Boolean(profile.esJefeEmpresa);
    const passwordHash = String(profile.passwordHash || '');
    if (!nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !['trabajador', 'directivo'].includes(rol) || !passwordHash) {
      const error = new Error('Indica el nombre, un correo válido, el puesto y una contraseña inicial.');
      error.statusCode = 400;
      throw error;
    }
    if ((rol === 'directivo' && !esJefeEmpresa) || area) {
      if (!(empresa.departamentos || []).some(department => normalizeArea(department) === normalizeArea(area))) {
        const error = new Error('Selecciona un departamento registrado en la empresa.');
        error.statusCode = 400;
        throw error;
      }
    }
    if (rol === 'trabajador' && esJefeEmpresa) {
      const error = new Error('El responsable de la empresa debe registrarse con el puesto de directivo.');
      error.statusCode = 400;
      throw error;
    }
    if (rol === 'directivo' && !esJefeEmpresa
      && (empresa.directivos || []).some(directivo => normalizeArea(directivo.area) === normalizeArea(area))) {
      const error = new Error('Ya hay un directivo asignado a ese departamento.');
      error.statusCode = 409;
      throw error;
    }
    if (await Empleado.exists({ email })) {
      const error = new Error('Ya existe una persona con ese correo. Revisa el directorio.');
      error.statusCode = 409;
      throw error;
    }
    const subareas = [...new Set((Array.isArray(profile.subareas) ? profile.subareas : [])
      .map(item => String(item).trim()).filter(Boolean))];
    if (rol === 'directivo' && profile.dirigeSubareas && !subareas.length) {
      const error = new Error('Agrega al menos una subárea o desactiva la opción de dirigir subáreas.');
      error.statusCode = 400;
      throw error;
    }
    const empleado = await Empleado.create({
      empresaId,
      nombre,
      email,
      passwordHash,
      tieneCuenta: true,
      rol,
      area,
      telefono: String(profile.telefono || '').trim(),
      trabajadoresACargo: Math.max(0, Number(profile.trabajadoresACargo) || 0),
      dirigeSubareas: rol === 'directivo' && Boolean(profile.dirigeSubareas),
      subareas: rol === 'directivo' && profile.dirigeSubareas ? subareas : [],
      esJefeDepartamento: rol === 'directivo' && !esJefeEmpresa,
      esJefeEmpresa,
      liderazgoConfirmado: true,
      jefaturaConfirmada: true
    });
    if (rol === 'directivo') {
      empresa.directivos.push({
        empleadoId: empleado._id,
        tieneCuenta: true,
        nombre,
        email,
        area,
        cargo: esJefeEmpresa ? 'Dirección de empresa' : 'Dirección de departamento',
        telefono: empleado.telefono,
        trabajadoresACargo: empleado.trabajadoresACargo,
        subareas: empleado.subareas,
        esJefeEmpresa,
        activo: true
      });
      await empresa.save();
    }
    return this.getEmpleadoProfile(empleado._id);
  }

  static async deleteEmpleado(empresaId, empleadoId) {
    const empleado = await Empleado.findOne({ _id: empleadoId, empresaId }).select('_id email');
    if (!empleado) {
      const error = new Error('No se encontró a esa persona en el directorio de la empresa.');
      error.statusCode = 404;
      throw error;
    }
    const email = String(empleado.email || '').trim().toLowerCase();
    await Promise.all([
      Reunion.updateMany(
        { empresaId, status: { $in: ['pendiente', 'en-progreso', 'en_curso'] } },
        { $pull: { empleadosInvitados: empleado._id } }
      ),
      ReunionPersonalEmpleado.deleteMany({ empresaId, empleadoId: empleado._id }),
      IndicadorPersonalEmpleado.deleteMany({ empresaId, empleadoId: empleado._id }),
      Empresa.updateOne(
        { _id: empresaId },
        { $pull: { directivos: { email } } }
      )
    ]);
    await Empleado.deleteOne({ _id: empleado._id, empresaId });
    return { id: empleado._id };
  }

  static async getEmpleadoDirectory(empresaId) {
    const empleados = await Empleado.find({ empresaId })
      .select('nombre email passwordHash tieneCuenta rol area subarea telefono trabajadoresACargo dirigeSubareas subareas esJefeDepartamento esJefeEmpresa liderazgoConfirmado jefaturaConfirmada createdAt')
      .sort({ nombre: 1 })
      .lean();
    return empleados.map(({ passwordHash, ...empleado }) => ({
      ...empleado,
      tieneCuenta: Boolean(passwordHash)
    }));
  }

  static async syncManualDirectivoMembers(empresa) {
    const manualDirectivos = (empresa.directivos || []).filter(directivo => !directivo.tieneCuenta);
    const manualEmails = manualDirectivos.map(directivo => String(directivo.email || '').trim().toLowerCase());
    await this.validateManualDirectivoMembers(empresa, manualEmails);
    await Empleado.deleteMany({
      empresaId: empresa._id,
      tieneCuenta: false,
      rol: 'directivo',
      email: { $nin: manualEmails }
    });

    for (const directivo of manualDirectivos) {
      const email = String(directivo.email || '').trim().toLowerCase();
      let empleado = await Empleado.findOne({ email });
      if (empleado && String(empleado.empresaId) !== String(empresa._id)) {
        const error = new Error(`El correo ${email} ya está vinculado a otra empresa y no puede agregarse como directivo.`);
        error.statusCode = 409;
        throw error;
      }
      if (empleado?.tieneCuenta || empleado?.passwordHash) {
        empleado.nombre = String(directivo.nombre || empleado.nombre).trim();
        empleado.rol = 'directivo';
        empleado.area = String(directivo.area || '').trim();
        empleado.telefono = String(directivo.telefono || '').trim();
        empleado.trabajadoresACargo = Math.max(0, Number(directivo.trabajadoresACargo) || 0);
        empleado.dirigeSubareas = Boolean(directivo.subareas?.length);
        empleado.subareas = directivo.subareas || [];
        empleado.esJefeDepartamento = Boolean(empleado.area && !directivo.esJefeEmpresa);
        empleado.esJefeEmpresa = Boolean(directivo.esJefeEmpresa);
        empleado.liderazgoConfirmado = true;
        empleado.jefaturaConfirmada = true;
        empleado.tieneCuenta = true;
        await empleado.save();
        directivo.empleadoId = empleado._id;
        directivo.tieneCuenta = true;
        continue;
      }
      if (!empleado) {
        empleado = new Empleado({ empresaId: empresa._id, email, passwordHash: null });
      }
      empleado.empresaId = empresa._id;
      empleado.nombre = String(directivo.nombre || '').trim();
      empleado.rol = 'directivo';
      empleado.area = String(directivo.area || '').trim();
      empleado.telefono = String(directivo.telefono || '').trim();
      empleado.trabajadoresACargo = Math.max(0, Number(directivo.trabajadoresACargo) || 0);
      empleado.dirigeSubareas = Boolean(directivo.subareas?.length);
      empleado.subareas = directivo.subareas || [];
      empleado.esJefeDepartamento = Boolean(empleado.area && !directivo.esJefeEmpresa);
      empleado.esJefeEmpresa = Boolean(directivo.esJefeEmpresa);
      empleado.liderazgoConfirmado = true;
      empleado.jefaturaConfirmada = true;
      empleado.tieneCuenta = false;
      await empleado.save();
      directivo.empleadoId = empleado._id;
      directivo.tieneCuenta = false;
    }
    await empresa.save();
  }

  static async validateManualDirectivoMembers(empresa, manualEmails = (empresa.directivos || [])
    .filter(directivo => !directivo.tieneCuenta)
    .map(directivo => String(directivo.email || '').trim().toLowerCase())) {
    if (!manualEmails.length) return;
    const conflictingEmployee = await Empleado.findOne({
      email: { $in: manualEmails },
      empresaId: { $ne: empresa._id }
    }).select('email').lean();
    if (conflictingEmployee) {
      const error = new Error(`El correo ${conflictingEmployee.email} ya está vinculado a otra empresa y no puede agregarse como directivo.`);
      error.statusCode = 409;
      throw error;
    }
  }

  static async ensureManualDirectivoDirectory(empresaId) {
    const empresa = await Empresa.findById(empresaId).select('directivos');
    if (empresa?.directivos?.some(directivo => !directivo.tieneCuenta && !directivo.empleadoId)) {
      await this.syncManualDirectivoMembers(empresa);
    }
  }

  static async getCompanyInviteCode(empresaId) {
    const empresa = await Empresa.findById(empresaId).select('_id codigoInvitacion');
    if (!empresa) {
      const error = new Error('No se encontró la empresa.');
      error.statusCode = 404;
      throw error;
    }
    if (empresa.codigoInvitacion) return empresa.codigoInvitacion;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const codigoInvitacion = `QRM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      try {
        const updatedEmpresa = await Empresa.findOneAndUpdate(
          {
            _id: empresaId,
            $or: [
              { codigoInvitacion: { $exists: false } },
              { codigoInvitacion: null },
              { codigoInvitacion: '' }
            ]
          },
          { $set: { codigoInvitacion } },
          { new: true, runValidators: false }
        ).select('codigoInvitacion');

        if (updatedEmpresa?.codigoInvitacion) return updatedEmpresa.codigoInvitacion;

        const currentEmpresa = await Empresa.findById(empresaId).select('codigoInvitacion');
        if (currentEmpresa?.codigoInvitacion) return currentEmpresa.codigoInvitacion;
        if (!currentEmpresa) {
          const error = new Error('No se encontró la empresa.');
          error.statusCode = 404;
          throw error;
        }
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }

    const error = new Error('No se pudo generar un código de invitación único. Inténtalo nuevamente.');
    error.statusCode = 503;
    throw error;
  }

  static async saveSmtpCredentials(empresaId, { provider, email, password }) {
    const encryptedCredentials = encryptPassword(password);
    const empresa = await Empresa.findByIdAndUpdate(
      empresaId,
      {
        $set: {
          smtpConvocatorias: {
            provider,
            email: String(email).trim().toLowerCase(),
            ...encryptedCredentials,
            configuredAt: new Date()
          },
          correoConvocatorias: String(email).trim().toLowerCase()
        }
      },
      { new: true, runValidators: true }
    ).select('smtpConvocatorias.provider smtpConvocatorias.email smtpConvocatorias.configuredAt');

    if (!empresa) {
      const error = new Error('No se encontró la empresa.');
      error.statusCode = 404;
      throw error;
    }

    return {
      configured: true,
      provider: empresa.smtpConvocatorias.provider,
      email: empresa.smtpConvocatorias.email,
      configuredAt: empresa.smtpConvocatorias.configuredAt
    };
  }

  static async getSmtpCredentials(empresaId) {
    const empresa = await Empresa.findById(empresaId)
      .select('+smtpConvocatorias.encryptedPassword +smtpConvocatorias.encryptionIv +smtpConvocatorias.encryptionTag');
    const settings = empresa?.smtpConvocatorias;
    if (!settings?.encryptedPassword || !settings.encryptionIv || !settings.encryptionTag) return null;
    return {
      provider: settings.provider,
      email: settings.email,
      password: decryptPassword(settings)
    };
  }

  static async getInvitedEmployees(empresaId, employeeIds = []) {
    if (!Array.isArray(employeeIds) || !employeeIds.length) return [];
    return Empleado.find({ _id: { $in: employeeIds }, empresaId })
      .select('nombre email area')
      .lean();
  }

  static async getAllCompanyEmployees(empresaId) {
    return Empleado.find({ empresaId }).select('nombre email area').lean();
  }

  static async createNextWeeklyReunions(now = new Date()) {
    const activeMeetings = await Reunion.find({
      recurrenciaSemanal: true,
      recurrenciaActiva: true,
      serieReunionId: { $ne: '' }
    }).sort({ fecha: 1 }).lean();
    const groups = new Map();
    activeMeetings.forEach(meeting => {
      const seriesId = meeting.serieReunionId;
      const current = groups.get(seriesId);
      if (!current || meeting.fecha > current.fecha) groups.set(seriesId, meeting);
    });

    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const generationLimit = new Date(today);
    generationLimit.setUTCDate(generationLimit.getUTCDate() + 7);
    const created = [];

    for (const [seriesId, latest] of groups) {
      if (latest.fecha > generationLimit.toISOString().slice(0, 10)) continue;

      const lockedMeeting = await Reunion.findOneAndUpdate(
        {
          _id: latest._id,
          recurrenciaActiva: true,
          $or: [
            { recurrenceLockUntil: { $exists: false } },
            { recurrenceLockUntil: null },
            { recurrenceLockUntil: { $lte: now } }
          ]
        },
        { $set: { recurrenceLockUntil: new Date(now.getTime() + 30 * 1000) } },
        { new: true }
      ).lean();
      if (!lockedMeeting) continue;

      try {
        const latestDate = new Date(`${lockedMeeting.fecha}T00:00:00.000Z`);
        let nextDate = new Date(latestDate);
        nextDate.setUTCDate(nextDate.getUTCDate() + 7);
        while (nextDate <= today) nextDate.setUTCDate(nextDate.getUTCDate() + 7);
        const nextDateString = nextDate.toISOString().slice(0, 10);
        const next = {
          ...lockedMeeting,
          fecha: nextDateString,
          serieReunionId: seriesId,
          recurrenciaSemanal: true,
          recurrenciaActiva: true,
          recurrenceOccurrenceKey: `${seriesId}-${nextDateString}`,
          recurrenceLockUntil: null,
          convocatoriaEnviada: false,
          fechaConvocatoria: undefined,
          documentos: [],
          acuerdos: [],
          conclusion: '',
          minuta: '',
          resultadoExitoso: false,
          status: 'pendiente',
          estado: 'pendiente',
          cronograma: (lockedMeeting.cronograma || []).map(area => ({
            ...area,
            _id: undefined,
            documentos: []
          }))
        };
        delete next._id;
        delete next.__v;
        delete next.createdAt;
        delete next.updatedAt;
        const seriesIsStillActive = await Reunion.exists({
          _id: lockedMeeting._id,
          recurrenciaActiva: true
        });
        if (!seriesIsStillActive) continue;
        created.push(await this.createReunion(latest.empresaId, next));
      } catch (error) {
        if (error.code !== 11000) throw error;
      } finally {
        await Reunion.updateOne({ _id: lockedMeeting._id }, { $set: { recurrenceLockUntil: null } });
      }
    }
    return created;
  }

  static async deleteSmtpCredentials(empresaId) {
    const empresa = await Empresa.findByIdAndUpdate(
      empresaId,
      {
        $unset: { smtpConvocatorias: '' },
        $set: { correoConvocatorias: '' }
      },
      { new: true }
    ).select('_id');
    if (!empresa) {
      const error = new Error('No se encontró la empresa.');
      error.statusCode = 404;
      throw error;
    }
  }

  static async savePlanEstrategico(empresaId, planEstrategico) {
    const empresa = await Empresa.findByIdAndUpdate(
      empresaId,
      { $set: { planEstrategico } },
      { new: true, runValidators: true }
    ).select('planEstrategico');
    if (!empresa) {
      const error = new Error('No se encontró la empresa.');
      error.statusCode = 404;
      throw error;
    }
    return empresa.planEstrategico;
  }

  // ---------- ACTUALIZAR EMPRESA ----------
  static async updateEmpresa(id, data) {
    try {
      const empresa = await Empresa.findById(id);
      if (!empresa) throw new Error('Empresa no encontrada');

      if (data.directivos !== undefined) {
        const departamentos = new Set((data.departamentos || empresa.departamentos || [])
          .map(normalizeArea)
          .filter(Boolean));
        const directivosRecibidos = Array.isArray(data.directivos) ? data.directivos : [];
        const directivosVinculados = (empresa.directivos || []).filter(directivo =>
          directivo.empleadoId && directivo.tieneCuenta
          && !directivosRecibidos.some(item =>
            String(item.email || '').trim().toLowerCase() === String(directivo.email || '').trim().toLowerCase()
          )
        );
        const directivos = [...directivosRecibidos, ...directivosVinculados];
        const areas = new Set();
        directivos.forEach(directivo => {
          const area = String(directivo?.area || '').trim();
          const normalizedArea = normalizeArea(area);
          if ((!area && !directivo?.esJefeEmpresa) || (area && !departamentos.has(normalizedArea))) {
            const error = new Error(`El área "${area || 'sin área'}" no existe en los departamentos de la empresa. Registra primero el departamento y después asigna su directivo.`);
            error.statusCode = 400;
            throw error;
          }
          if (normalizedArea && areas.has(normalizedArea)) {
            const error = new Error(`El departamento "${area}" ya tiene un directivo. Solo se permite un directivo por departamento.`);
            error.statusCode = 409;
            throw error;
          }
          if (normalizedArea) areas.add(normalizedArea);
        });
        data.directivos = directivos;
      }

      const campos = ['nombre', 'razonSocial', 'rfc', 'domicilioFiscal', 'regimenFiscal', 'mision', 'vision', 'valores', 'estrategias', 'metas', 'indicadores', 'departamentos', 'directivos'];
      campos.forEach(campo => {
        if (data[campo] !== undefined) empresa[campo] = data[campo];
      });
      if (data.foda !== undefined) this.applyFodaUpdate(empresa, data.foda);
      if (data.directivos !== undefined) await this.validateManualDirectivoMembers(empresa);

      await empresa.save();
      if (data.directivos !== undefined) {
        await this.syncManualDirectivoMembers(empresa);
      }
      return empresa;
    } catch (error) {
      console.error('Error en updateEmpresa:', error.message);
      throw error;
    }
  }

  static applyFodaUpdate(empresa, data = {}) {
    if (!empresa.foda) empresa.foda = {};
    ['fortalezas', 'debilidades', 'oportunidades', 'amenazas'].forEach(campo => {
      if (data[campo] !== undefined) empresa.foda[campo] = data[campo];
    });
  }

  // ---------- ACTUALIZAR FODA ----------
  static async updateFODA(empresaId, data) {
    try {
      const empresa = await Empresa.findById(empresaId);
      if (!empresa) throw new Error('Empresa no encontrada');

      this.applyFodaUpdate(empresa, data);

      await empresa.save();
      return empresa.foda;
    } catch (error) {
      console.error('Error en updateFODA:', error.message);
      throw error;
    }
  }

  // ---------- REUNIONES (colección independiente) ----------
  static async createReunion(empresaId, data) {
    try {
      const empresa = await Empresa.findById(empresaId).select('_id directivos');
      if (!empresa) throw new Error('Empresa no encontrada');
      if (!data.titulo || !data.fecha || !data.hora) throw new Error('Los campos titulo, fecha y hora son obligatorios');
      const estadoNorm = normalizeMeetingStatus(data.estado ?? data.status ?? 'pendiente');
      const empleadosInvitados = await this.validateInvitedEmployees(empresaId, data.empleadosInvitados);
      const selectedDirectorIds = [...new Set((Array.isArray(data.directivosSeleccionados) ? data.directivosSeleccionados : [])
        .map(id => String(id)))];
      if (selectedDirectorIds.some(id => !mongoose.isValidObjectId(id))) {
        const error = new Error('La selección contiene un identificador de directivo no válido. Actualiza el directorio e inténtalo de nuevo.');
        error.statusCode = 400;
        throw error;
      }
      const companyDirectorIds = new Set((empresa.directivos || []).map(directivo => String(directivo._id)));
      if (selectedDirectorIds.some(id => !companyDirectorIds.has(id))) {
        const error = new Error('Revisa la selección de directivos: alguno ya no pertenece al directorio de la empresa.');
        error.statusCode = 400;
        throw error;
      }
      const departments = Array.isArray(data.departamentos) ? data.departamentos : [];
      const isCompanyWide = departments.length === 0
        && empleadosInvitados.length === 0
        && selectedDirectorIds.length === 0;
      const serieReunionId = data.serieReunionId
        || (data.recurrenciaSemanal ? new mongoose.Types.ObjectId().toString() : '');
      const recurrenceActive = Boolean(data.recurrenciaSemanal && (data.recurrenciaActiva ?? true));
      const recurrenceOccurrenceKey = recurrenceActive
        ? (data.recurrenceOccurrenceKey || `${serieReunionId}-${data.fecha}`)
        : undefined;
      const reunion = new Reunion({
        empresaId, titulo: data.titulo.trim(), fecha: data.fecha, hora: data.hora,
        lugar: data.lugar || '', duracion: data.duracion || '', objetivo: data.objetivo || '',
        coordinador: data.coordinador || '', participantes: data.participantes || [],
        directivosSeleccionados: selectedDirectorIds,
        empleadosInvitados,
        departamentos: departments, agenda: data.agenda || [],
        tipoReunion: 'general',
        esParaTodos: isCompanyWide,
        recurrenciaSemanal: Boolean(data.recurrenciaSemanal),
        recurrenciaActiva: recurrenceActive,
        serieReunionId,
        recurrenceOccurrenceKey,
        convocatoriaEnviada: false,
        status: estadoNorm, estado: estadoNorm, resultadoExitoso: Boolean(data.resultadoExitoso),
        cronograma: normalizeCronograma(data.cronograma || []),
        documentos: Array.isArray(data.documentos) ? data.documentos : [],
        indicadoresVinculados: Array.isArray(data.indicadoresVinculados) ? data.indicadoresVinculados : [],
        objetivosDefinidos: Array.isArray(data.objetivosDefinidos) ? data.objetivosDefinidos : [], seguimientos: []
      });
      return await reunion.save();
    } catch (error) { console.error('Error en createReunion:', error.message); throw error; }
  }

  static async findReunion(empresaId, reunionId) {
    const reunion = await Reunion.findOne({ _id: reunionId, empresaId });
    if (!reunion) throw new Error('Reunion no encontrada');
    return reunion;
  }

  static async updateReunion(empresaId, reunionId, data) {
    try {
      const reunion = await this.findReunion(empresaId, reunionId);
      if (data.status !== undefined || data.estado !== undefined) {
        const requestedStatus = normalizeMeetingStatus(data.estado ?? data.status);
        if (!['pendiente', 'en_curso', 'finalizada'].includes(requestedStatus)) {
          const error = new Error('El estado de la reunión no es válido. Usa pendiente, en curso o finalizada.'); error.statusCode = 400; throw error;
        }

      }
      const campos = ['status', 'estado', 'conclusion', 'minuta', 'acuerdos', 'resultadoExitoso', 'tipoReunion', 'convocatoriaEnviada', 'fechaConvocatoria', 'cronograma', 'documentos', 'indicadoresVinculados', 'objetivosDefinidos'];
      campos.forEach(campo => {
        if (data[campo] !== undefined) reunion[campo] = campo === 'status' || campo === 'estado' ? normalizeMeetingStatus(data[campo], reunion[campo] || 'pendiente') : campo === 'cronograma' ? normalizeCronograma(data[campo]) : campo === 'fechaConvocatoria' ? new Date(data[campo]) : data[campo];
      });
      if (data.status !== undefined || data.estado !== undefined) {
        const status = normalizeMeetingStatus(data.estado ?? data.status ?? reunion.status, 'pendiente'); reunion.status = status; reunion.estado = status;
      }
      await reunion.save(); return reunion;
    } catch (error) { console.error('Error en updateReunion:', error.message); throw error; }
  }

  static async stopWeeklyReunion(empresaId, reunionId) {
    const reunion = await this.findReunion(empresaId, reunionId);
    if (!reunion.serieReunionId || !reunion.recurrenciaActiva) {
      const error = new Error('Esta reunión no tiene una repetición semanal activa.');
      error.statusCode = 409;
      throw error;
    }
    await Reunion.updateMany(
      { empresaId, serieReunionId: reunion.serieReunionId, recurrenciaActiva: true },
      { $set: { recurrenciaActiva: false } }
    );
    return { serieReunionId: reunion.serieReunionId, recurrenciaActiva: false };
  }

  static async addReunionDocumento(empresaId, reunionId, documento) {
    const reunion = await this.findReunion(empresaId, reunionId);
    if (normalizeMeetingStatus(reunion.status || reunion.estado) === 'finalizada') { const e = new Error('No se puede cargar documentación a una reunión finalizada.'); e.statusCode = 409; throw e; }
    if (documento.esPresentacionPrincipal) {
      if (String(documento.tipo || '').toUpperCase() !== 'PDF') {
        const error = new Error('La presentación inicial debe ser un archivo PDF.');
        error.statusCode = 400;
        throw error;
      }
      if (reunion.documentos.some(item => item.esPresentacionPrincipal)) {
        const error = new Error('Esta reunión ya tiene una presentación inicial. Elimínala antes de cargar otra.');
        error.statusCode = 409;
        throw error;
      }
      documento.area = 'Presentación';
    } else {
      const areaParticipates = (reunion.departamentos || [])
        .some(area => normalizeArea(area) === normalizeArea(documento.area));
      if (!areaParticipates && !reunion.esParaTodos) { const e = new Error(`El área "${documento.area}" no participa en esta reunión. Selecciona una de las áreas asignadas en el cronograma.`); e.statusCode = 400; throw e; }
    }
    reunion.documentos.push(documento);
    if (!documento.esPresentacionPrincipal) {
      let cronogramaArea = (reunion.cronograma || []).find(item => normalizeArea(item.area) === normalizeArea(documento.area));
      if (!cronogramaArea && reunion.esParaTodos) {
        reunion.cronograma.push({ area: documento.area });
        cronogramaArea = reunion.cronograma[reunion.cronograma.length - 1];
      }
      if (cronogramaArea && !cronogramaArea.documentos.includes(documento.nombreArchivo)) cronogramaArea.documentos.push(documento.nombreArchivo);
    }
    await reunion.save(); return reunion.documentos[reunion.documentos.length - 1];
  }

  static async updatePresentationAreaRanges(empresaId, reunionId, documentoId, ranges) {
    const reunion = await this.findReunion(empresaId, reunionId);
    if (normalizeMeetingStatus(reunion.status || reunion.estado) === 'finalizada') {
      const error = new Error('No se pueden cambiar los rangos de una reunión finalizada.');
      error.statusCode = 409;
      throw error;
    }
    const documento = reunion.documentos.id(documentoId);
    if (!documento || !documento.esPresentacionPrincipal || String(documento.tipo || '').toUpperCase() !== 'PDF') {
      const error = new Error('No se encontró el PDF de presentación inicial.');
      error.statusCode = 404;
      throw error;
    }
    if (!Array.isArray(ranges) || ranges.length > 100) {
      const error = new Error('La asignación de páginas no es válida.');
      error.statusCode = 400;
      throw error;
    }
    const allowedAreas = new Map((reunion.departamentos || [])
      .map(area => [normalizeArea(area), String(area).trim()]));
    const seenAreas = new Set();
    const validatedRanges = ranges.map(range => {
      const normalizedArea = normalizeArea(range?.area);
      const area = allowedAreas.get(normalizedArea);
      const paginaInicio = Number(range?.paginaInicio);
      const paginaFin = Number(range?.paginaFin);
      if (!area || seenAreas.has(normalizedArea)
        || !Number.isInteger(paginaInicio) || !Number.isInteger(paginaFin)
        || paginaInicio < 1 || paginaFin < paginaInicio || paginaFin > 10000) {
        const error = new Error('Cada área debe tener un rango único de páginas válido, entre 1 y 10,000.');
        error.statusCode = 400;
        throw error;
      }
      seenAreas.add(normalizedArea);
      return { area, paginaInicio, paginaFin };
    });
    documento.rangosAreas = validatedRanges;
    await reunion.save();
    return documento;
  }

  static async deleteReunionDocumento(empresaId, reunionId, documentoId) {
    const reunion = await this.findReunion(empresaId, reunionId); const documento = reunion.documentos.id(documentoId);
    if (!documento) { const e = new Error('El documento ya no existe o fue eliminado.'); e.statusCode = 404; throw e; }
    if (normalizeMeetingStatus(reunion.status || reunion.estado) === 'finalizada') {
      const e = new Error('No se pueden eliminar documentos de una reunión finalizada.');
      e.statusCode = 409;
      throw e;
    }
    const deleted = documento.toObject(); reunion.documentos.pull(documentoId);
    const area = reunion.cronograma.find(item => normalizeArea(item.area) === normalizeArea(deleted.area));
    if (area) area.documentos = area.documentos.filter(name => name !== deleted.nombreArchivo);
    await reunion.save(); return deleted;
  }

  static async getReunionDocumento(empresaId, reunionId, documentoId) {
    const reunion = await this.findReunion(empresaId, reunionId); const documento = reunion.documentos.id(documentoId);
    if (!documento) { const e = new Error('El documento no existe o fue eliminado.'); e.statusCode = 404; throw e; }
    return documento;
  }

  static async replaceReunionDocumento(empresaId, reunionId, documentoId, documentoNuevo) {
    const reunion = await this.findReunion(empresaId, reunionId); const documento = reunion.documentos.id(documentoId);
    if (!documento) { const e = new Error('El documento que deseas editar ya no existe.'); e.statusCode = 404; throw e; }
    if (normalizeMeetingStatus(reunion.status || reunion.estado) === 'finalizada') { const e = new Error('No se puede editar el documento porque la reunión está finalizada.'); e.statusCode = 409; throw e; }
    const oldUrl = documento.url, oldName = documento.nombreArchivo, oldArea = documento.area;
    documento.area = documentoNuevo.area || oldArea; documento.nombreArchivo = documentoNuevo.nombreArchivo; documento.tipo = documentoNuevo.tipo; documento.url = documentoNuevo.url; documento.fechaSubida = documentoNuevo.fechaSubida || new Date();
    const oldCronograma = reunion.cronograma.find(item => normalizeArea(item.area) === normalizeArea(oldArea)); if (oldCronograma) oldCronograma.documentos = oldCronograma.documentos.filter(name => name !== oldName);
    const newCronograma = reunion.cronograma.find(item => normalizeArea(item.area) === normalizeArea(documento.area)); if (newCronograma && !newCronograma.documentos.includes(documento.nombreArchivo)) newCronograma.documentos.push(documento.nombreArchivo);
    await reunion.save(); return { documento, oldUrl };
  }

  static async marcarConvocatoriaEnviada(empresaId, reunionId) { return this.updateReunion(empresaId, reunionId, { convocatoriaEnviada: true, fechaConvocatoria: new Date() }); }

  static async deleteReunion(empresaId, reunionId) {
    const reunion = await Reunion.findOne({ _id: reunionId, empresaId }).select('documentos');
    if (!reunion) {
      const error = new Error('Reunión no encontrada.');
      error.statusCode = 404;
      throw error;
    }
    const result = await Reunion.deleteOne({ _id: reunionId, empresaId });
    if (!result.deletedCount) throw new Error('Reunion no encontrada');
    return {
      id: reunionId,
      documentos: (reunion.documentos || []).map(documento => documento.url).filter(Boolean)
    };
  }

  static async createSeguimiento(empresaId, reunionId, data) {
    const reunion = await this.findReunion(empresaId, reunionId); const status = normalizeMeetingStatus(data.estado ?? data.status ?? 'pendiente');
    reunion.seguimientos.push({ titulo: data.titulo, fecha: data.fecha, hora: data.hora, lugar: data.lugar || '', duracion: data.duracion || '', objetivo: data.objetivo || '', coordinador: data.coordinador || '', participantes: data.participantes || [], departamentos: data.departamentos || [], agenda: data.agenda || [], tipoReunion: data.tipoReunion || 'check-in', status, estado: status, resultadoExitoso: Boolean(data.resultadoExitoso), cronograma: normalizeCronograma(data.cronograma || []), documentos: Array.isArray(data.documentos) ? data.documentos : [], indicadoresVinculados: Array.isArray(data.indicadoresVinculados) ? data.indicadoresVinculados : [] });
    await reunion.save(); return reunion.seguimientos[reunion.seguimientos.length - 1];
  }

  static async updateSeguimiento(empresaId, reunionId, seguimientoId, data) {
    const reunion = await this.findReunion(empresaId, reunionId);
    const seguimiento = reunion.seguimientos.id(seguimientoId);
    if (!seguimiento) {
      const error = new Error('No se encontró el seguimiento que intentas actualizar.');
      error.statusCode = 404;
      throw error;
    }
    const campos = ['status', 'estado', 'conclusion', 'minuta', 'acuerdos', 'resultadoExitoso', 'tipoReunion', 'cronograma', 'documentos', 'indicadoresVinculados'];
    campos.forEach(campo => { if (data[campo] !== undefined) seguimiento[campo] = campo === 'status' || campo === 'estado' ? normalizeMeetingStatus(data[campo], seguimiento[campo] || 'pendiente') : campo === 'cronograma' ? normalizeCronograma(data[campo]) : data[campo]; });
    if (data.status !== undefined || data.estado !== undefined) { const status = normalizeMeetingStatus(data.estado ?? data.status ?? seguimiento.status, 'pendiente'); seguimiento.status = status; seguimiento.estado = status; }
    await reunion.save(); return seguimiento;
  }

  static async deleteSeguimiento(empresaId, reunionId, seguimientoId) {
    const reunion = await this.findReunion(empresaId, reunionId);
    if (!reunion.seguimientos.id(seguimientoId)) {
      const error = new Error('No se encontró el seguimiento que intentas eliminar.');
      error.statusCode = 404;
      throw error;
    }
    reunion.seguimientos.pull(seguimientoId);
    await reunion.save();
    return { id: seguimientoId };
  }

  // ---------- OBJETIVOS DE EMPRESA ----------
  static async createObjetivo(empresaId, data) {
    const empresa = await Empresa.findById(empresaId);
    if (!empresa) throw new Error('Empresa no encontrada');
    empresa.objetivos.push({ nombre: data.nombre, prioridad: data.prioridad || 'media', progreso: data.progreso || 0, status: data.status || 'pendiente', descripcion: data.descripcion || '', tasks: data.tasks || [], tipoArea: data.tipoArea || 'general', areasInvolucradas: data.areasInvolucradas || [] });
    await empresa.save();
    return empresa.objetivos[empresa.objetivos.length - 1];
  }

  static async updateObjetivo(empresaId, objetivoId, data) {
    const empresa = await Empresa.findById(empresaId);
    if (!empresa) throw new Error('Empresa no encontrada');
    const objetivo = empresa.objetivos.id(objetivoId);
    if (!objetivo) throw new Error('Objetivo no encontrado');
    ['nombre', 'prioridad', 'progreso', 'status', 'descripcion', 'tasks', 'tipoArea', 'areasInvolucradas'].forEach(campo => { if (data[campo] !== undefined) objetivo[campo] = data[campo]; });
    await empresa.save();
    return objetivo;
  }

  static async deleteObjetivo(empresaId, objetivoId) {
    const empresa = await Empresa.findById(empresaId);
    if (!empresa) throw new Error('Empresa no encontrada');
    if (!empresa.objetivos.id(objetivoId)) {
      const error = new Error('No se encontró el objetivo que intentas eliminar.');
      error.statusCode = 404;
      throw error;
    }
    empresa.objetivos.pull(objetivoId);
    await empresa.save();
    return { id: objetivoId };
  }
  // ---------- VERIFICAR USUARIO ----------
  static async verifyUser(email) {
    try {
      const usuario = await Usuario.findOne({ email: String(email).trim().toLowerCase() }).populate('empresaId');
      if (!usuario) return null;
      return {
        id: usuario._id,
        empresa_id: usuario.empresaId._id,
        email: usuario.email,
        password_hash: usuario.passwordHash
      };
    } catch (error) {
      console.error('Error en verifyUser:', error.message);
      throw error;
    }
  }

  static async getEmpresasParaRevision() {
      return Empresa.find({})
        .select('nombre tipoPersona razonSocial rfc domicilioFiscal regimenFiscal representanteLegal telefonoContacto verificacion email createdAt')
        .sort({ 'verificacion.estado': 1, createdAt: -1 })
        .lean();
    }

  static async actualizarVerificacion(empresaId, estado, notas, revisadoPor) {
      const empresa = await Empresa.findByIdAndUpdate(
        empresaId,
        {
          $set: {
            'verificacion.estado': estado,
            'verificacion.notas': notas || '',
            'verificacion.revisadoEn': new Date(),
            'verificacion.revisadoPor': revisadoPor
          }
        },
        { new: true, runValidators: true }
      ).select('nombre razonSocial rfc verificacion');
      if (!empresa) throw new Error('Empresa no encontrada');
      return empresa;
  }
}

module.exports = EmpresaModel;
