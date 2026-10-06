import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Button, Form, Badge, Modal, Alert, Spinner } from 'react-bootstrap';
import { FileSpreadsheet } from 'lucide-react';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import ApiService from '../services/apiService';
import SlideCommit from './SlideCommit/SlideCommit';

// ============================================================
// TIPOS DE REUNION
// ============================================================
const TIPOS_REUNION = [{
  value: 'general',
  label: 'Reunión',
  desc: 'Reunión de trabajo',
  requiere: ['titulo', 'fecha', 'hora'],
  opcional: ['objetivo', 'lugar', 'duracion', 'coordinador', 'departamentos', 'agenda']
}];

// ============================================================
// ESTADOS DE REUNION
// ============================================================
const normalizeMeetingStatus = (status = 'pendiente') => {
  const normalized = String(status || 'pendiente').trim().toLowerCase();
  const map = {
    'pendiente': 'pendiente',
    'en-progreso': 'en_curso',
    'en_progreso': 'en_curso',
    'en curso': 'en_curso',
    'en_curso': 'en_curso',
    'completada': 'finalizada',
    'completado': 'finalizada',
    'finalizada': 'finalizada',
    'finalizado': 'finalizada'
  };
  return map[normalized] || normalized || 'pendiente';
};

const formatMeetingStatus = (status) => {
  const normalized = normalizeMeetingStatus(status);
  const labels = {
    pendiente: 'Pendiente',
    en_curso: 'En curso',
    finalizada: 'Finalizada'
  };
  return labels[normalized] || 'Pendiente';
};

const ESTADOS = ['pendiente', 'en_curso', 'finalizada'];
const ESTADOS_MAP = {
  'pendiente': { bg: '#dff5ff', color: '#0b477d' },
  'en_curso': { bg: '#b8e7fb', color: '#0b3c69' },
  'finalizada': { bg: '#67c7f5', color: '#06152b' }
};

// ============================================================
// CONFIGURACION DE CAMPOS DEL FORMULARIO
// ============================================================
const CAMPOS_FORMULARIO = {
  titulo: { label: 'Título *', tipo: 'text', placeholder: 'Ejemplo: Revisión de estándares', requerido: true },
  fecha: { label: 'Fecha *', tipo: 'date', requerido: true },
  hora: { label: 'Hora *', tipo: 'time', requerido: true },
  lugar: { label: 'Lugar', tipo: 'text', placeholder: 'Sala de juntas', requerido: false },
  duracion: { label: 'Duracion', tipo: 'text', placeholder: '1h 30min', requerido: false },
  objetivo: { label: 'Objetivo', tipo: 'textarea', placeholder: 'Que se espera lograr?', rows: 2, requerido: false },
  coordinador: { label: 'Coordinador', tipo: 'text', placeholder: 'Nombre del coordinador', requerido: false },
  departamentos: { label: 'Departamentos', tipo: 'checkbox', requerido: false },
  agenda: { label: 'Agenda (un tema por linea)', tipo: 'textarea', placeholder: 'Tema 1&#10;Tema 2', rows: 3, requerido: false }
};

const getMissingRequiredFields = meeting => {
  const requiredFields = TIPOS_REUNION.find(type => type.value === meeting.tipoReunion)?.requiere || TIPOS_REUNION[0].requiere;
  return requiredFields.filter(field => {
    const value = meeting[field];
    return Array.isArray(value) ? value.length === 0 : !String(value || '').trim();
  });
};

const getRequiredFieldLabel = field => (CAMPOS_FORMULARIO[field]?.label || field).replace(/\s*\*$/, '');

const normalizeAreaName = value => String(value || '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const spreadsheetTypes = ['XLS', 'XLSX', 'XLSB'];
const presentationTypes = ['PDF', 'DOC', 'DOCX', 'PPT', 'PPTX'];

const sortDocumentsForPresentation = documents => [...(documents || [])]
  .filter(document => [...presentationTypes, ...spreadsheetTypes].includes(String(document.tipo || '').toUpperCase()))
  .sort((first, second) => {
    const firstIsPresentation = presentationTypes.includes(String(first.tipo || '').toUpperCase());
    const secondIsPresentation = presentationTypes.includes(String(second.tipo || '').toUpperCase());
    if (firstIsPresentation !== secondIsPresentation) return firstIsPresentation ? -1 : 1;
    const typeOrder = { PPTX: 0, PPT: 1, DOCX: 2, DOC: 3, PDF: 4, XLSX: 5, XLS: 6, XLSB: 7 };
    const firstType = String(first.tipo || '').toUpperCase();
    const secondType = String(second.tipo || '').toUpperCase();
    if (typeOrder[firstType] !== typeOrder[secondType]) return typeOrder[firstType] - typeOrder[secondType];
    return String(first.nombreArchivo || '').localeCompare(String(second.nombreArchivo || ''), 'es', { sensitivity: 'base' });
  });

const getPresentationSlides = (documents, areas = []) => {
  const orderedDocuments = sortDocumentsForPresentation(documents);
  const mainPresentation = orderedDocuments.find(document => document.esPresentacionPrincipal);
  const areaNames = [...new Map([
    ...areas.map(area => [normalizeAreaName(area), String(area || '').trim()]),
    ...orderedDocuments
      .filter(document => !document.esPresentacionPrincipal)
      .map(document => [normalizeAreaName(document.area || 'Empresa'), String(document.area || 'Empresa').trim()])
  ]).values()].filter(Boolean).sort((first, second) => first.localeCompare(second, 'es', { sensitivity: 'base' }));
  return areaNames.map(area => {
    const areaDocuments = orderedDocuments.filter(document =>
      !document.esPresentacionPrincipal
      &&
      normalizeAreaName(document.area || 'Empresa') === normalizeAreaName(area)
    );
    const areaRange = mainPresentation?.rangosAreas?.find(range =>
      normalizeAreaName(range.area) === normalizeAreaName(area)
    );
    const legacyPresentations = areaDocuments.filter(document =>
      presentationTypes.includes(String(document.tipo || '').toUpperCase())
    );
    return {
      type: 'area',
      area,
      presentations: areaRange
        ? [{
            ...mainPresentation,
            paginaInicio: areaRange.paginaInicio,
            paginaFin: areaRange.paginaFin
          }]
        : legacyPresentations,
      spreadsheets: areaDocuments.filter(document => spreadsheetTypes.includes(String(document.tipo || '').toUpperCase()))
    };
  });
};

const getMeetingDocumentAreas = meeting => [...new Set([
  ...(meeting?.departamentos || []),
  ...(meeting?.documentos || [])
    .filter(document => !document.esPresentacionPrincipal)
    .map(document => document.area)
    .filter(Boolean)
])].sort((first, second) => first.localeCompare(second, 'es', { sensitivity: 'base' }));

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const MeetingManager = ({ reuniones, setReuniones, companyData, objetivos = [], setObjetivos, meetingPreferences = {}, documentPreferences = {} }) => {
  // Estados de modales
  const [modals, setModals] = useState({
    new: false,
    config: false,
    minute: false,
    followUp: false,
    presentation: false
  });
  const [selected, setSelected] = useState(null);
  const [minuteContent, setMinuteContent] = useState('');
  const [minuteSections, setMinuteSections] = useState({});
  const [loading, setLoading] = useState(false);
  const [followUpFeedback, setFollowUpFeedback] = useState('');
  const [minuteAgreements, setMinuteAgreements] = useState([]);
  const [meetingObjectives, setMeetingObjectives] = useState([]);
  const [newMeetingObjective, setNewMeetingObjective] = useState({
    nombre: '', descripcion: '', area: '', prioridad: 'media', progreso: 0, status: 'pendiente'
  });
  const [newAgreement, setNewAgreement] = useState({
    descripcion: '',
    responsable: '',
    fechaCompromiso: '',
    estado: 'pendiente'
  });
  const [documentArea, setDocumentArea] = useState('');
  const [documentFiles, setDocumentFiles] = useState([]);
  const [presentationFile, setPresentationFile] = useState(null);
  const [presentationRangesDraft, setPresentationRangesDraft] = useState({});
  const [presentationPreviewPage, setPresentationPreviewPage] = useState(1);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [showPresentationObjective, setShowPresentationObjective] = useState(false);
  const [presentationObjective, setPresentationObjective] = useState({
    nombre: '',
    descripcion: '',
    prioridad: 'media'
  });
  const [presentationFinished, setPresentationFinished] = useState(false);
  const [presentationView, setPresentationView] = useState('presentation');
  const [presentationDocumentIndex, setPresentationDocumentIndex] = useState(0);
  const [presentationSpreadsheetIndex, setPresentationSpreadsheetIndex] = useState(0);
  const [spreadsheetPreview, setSpreadsheetPreview] = useState({ key: '', sheets: [], activeSheet: 0, insights: null, error: '' });
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false);
  const [employeeAreaFilter, setEmployeeAreaFilter] = useState('');
  const [employeeNameFilter, setEmployeeNameFilter] = useState('');
  const [meetingSearch, setMeetingSearch] = useState('');
  const [meetingDateFilter, setMeetingDateFilter] = useState('');
  const primaryPresentationDocument = (selected?.documentos || [])
    .find(document => document.esPresentacionPrincipal);

  useEffect(() => {
    const savedRanges = (selected?.documentos || [])
      .find(document => document.esPresentacionPrincipal)?.rangosAreas || [];
    setPresentationRangesDraft(Object.fromEntries(
      (selected?.departamentos || []).map(area => {
        const savedRange = savedRanges.find(range =>
          normalizeAreaName(range.area) === normalizeAreaName(area)
        );
        return [area, {
          paginaInicio: savedRange ? String(savedRange.paginaInicio) : '',
          paginaFin: savedRange ? String(savedRange.paginaFin) : ''
        }];
      })
    ));
    setPresentationPreviewPage(1);
  }, [selected]);

  const getMinuteSections = (content = '') => {
    return {
      desarrollo: content,
      votaciones: '',
      cierre: ''
    };
  };

  const openMinuteEditor = (content = '') => {
    setMinuteContent(content);
    setMinuteSections(getMinuteSections(content));
  };

  const updateMinuteSection = (section, value) => {
    setMinuteSections(current => {
      const updated = { ...current, [section]: value };
      setMinuteContent(Object.values(updated).filter(Boolean).join('\n\n'));
      return updated;
    });
  };

  // Estado del formulario de nueva reunion
  const emptyMeeting = {
    titulo: '',
    fecha: '',
    hora: '',
    lugar: meetingPreferences.defaultLocation || '',
    duracion: meetingPreferences.defaultDuration || '',
    objetivo: '',
    coordinador: '',
    departamentos: [],
    agenda: '',
    tipoReunion: 'general',
    directivosSeleccionados: [],
    empleadosInvitados: [],
    recurrenciaSemanal: false
  };

  const emptyFollowUp = {
    titulo: '',
    fecha: '',
    hora: '',
    lugar: meetingPreferences.defaultLocation || '',
    duracion: meetingPreferences.defaultDuration || '',
    objetivo: '',
    coordinador: '',
    departamentos: [],
    agenda: '',
    tipoReunion: 'general'
  };

  const [newMeeting, setNewMeeting] = useState(emptyMeeting);
  const [followUpData, setFollowUpData] = useState(emptyFollowUp);
  const [configData, setConfigData] = useState({
    status: 'pendiente',
    resultadoExitoso: false,
    conclusion: '',
    tipoReunion: 'general',
    indicadoresVinculados: [],
    cronograma: []
  });

  // Directivos desde companyData
  const directivos = (companyData?.directivos || []).map(directivo => ({
    ...directivo,
    id: directivo.id || directivo._id
  }));
  const empleados = companyData?.empleados || [];

  const getAreaDirector = area => directivos.find(directivo =>
    normalizeAreaName(directivo.area) === normalizeAreaName(area)
  );

  // Renderizar campo segun tipo
  const renderCampo = (campo, data, setData) => {
    const config = CAMPOS_FORMULARIO[campo];
    if (!config) return null;

    const value = data[campo];
    const isRequired = TIPOS_REUNION
      .find(type => type.value === data.tipoReunion)?.requiere.includes(campo) || false;
    const label = isRequired && !config.label.endsWith('*') ? `${config.label} *` : config.label;
    const setValue = (val) => setData({ ...data, [campo]: val });

    // Campo de Departamentos (checkbox)
    if (campo === 'departamentos') {
      const depts = companyData?.departamentos || [];
      if (depts.length === 0) {
        return (
          <Form.Group className="mb-2" key={campo}>
            <Form.Label>{label}</Form.Label>
            <div className="text-muted small">No hay departamentos registrados</div>
          </Form.Group>
        );
      }
      return (
        <Form.Group className="mb-2" key={campo}>
          <Form.Label>{label} <span className="text-muted fw-normal">(área y directivo en la misma fila)</span></Form.Label>
          <div className="border rounded overflow-hidden">
            {depts.map((dept, index) => {
              const areaDirectors = directivos.filter(directivo =>
                normalizeAreaName(directivo.area) === normalizeAreaName(dept)
              );
              return (
                <div
                  key={dept}
                  className={`d-flex flex-wrap align-items-center gap-3 px-3 py-2 ${index ? 'border-top' : ''}`}
                >
                  <Form.Check
                    className="mb-0 flex-grow-1"
                    type="checkbox"
                    label={<span className="fw-semibold">{dept}</span>}
                    checked={(value || []).includes(dept)}
                    onChange={() => {
                      const selectedDepartments = (value || []).includes(dept)
                        ? value.filter(area => area !== dept)
                        : [...(value || []), dept];
                      setValue(selectedDepartments);
                    }}
                  />
                  <span className="small text-muted text-end">
                    {areaDirectors.length
                      ? areaDirectors.map(director => director.nombre).join(', ')
                      : 'Sin directivo asignado'}
                  </span>
                </div>
              );
            })}
          </div>
        </Form.Group>
      );
    }

    // Textarea
    if (config.tipo === 'textarea') {
      return (
        <Form.Group className="mb-2" key={campo}>
          <Form.Label>{label}</Form.Label>
          <Form.Control
            as="textarea"
            rows={config.rows || 2}
            value={value || ''}
            onChange={(e) => setValue(e.target.value)}
            placeholder={config.placeholder || ''}
            required={isRequired || config.requerido}
          />
        </Form.Group>
      );
    }

    // Fecha y Hora (en columna de 4)
    if (config.tipo === 'date' || config.tipo === 'time') {
      return (
        <Col md={4} key={campo}>
          <Form.Group className="mb-2">
            <Form.Label>{label}</Form.Label>
            <Form.Control
              type={config.tipo}
              value={value || ''}
              onChange={(e) => setValue(e.target.value)}
              required={isRequired || config.requerido}
            />
          </Form.Group>
        </Col>
      );
    }

    // Texto normal
    return (
      <Form.Group className="mb-2" key={campo}>
      <Form.Label>{label}</Form.Label>
        <Form.Control
          type={config.tipo}
          value={value || ''}
          onChange={(e) => setValue(e.target.value)}
          placeholder={config.placeholder || ''}
          required={isRequired || config.requerido}
        />
      </Form.Group>
    );
  };

  // ============================================================
  // CRUD REUNIONES
  // ============================================================

  // Crear reunion
  const crearReunion = async () => {
    // Validar campos obligatorios
    const faltan = getMissingRequiredFields(newMeeting);
    if (faltan.length > 0) {
      alert(`Faltan campos obligatorios: ${faltan.map(getRequiredFieldLabel).join(', ')}. Completa los campos marcados con *.`);
      return;
    }

    setLoading(true);
    try {
      const selectedDepartments = newMeeting.departamentos || [];
      const selectedDirectors = directivos.filter(directive =>
        selectedDepartments.some(area => normalizeAreaName(area) === normalizeAreaName(directive.area))
      );
      const selectedEmployees = empleados.filter(employee =>
        (newMeeting.empleadosInvitados || []).includes(String(employee._id || employee.id))
      );
      const isCompanyWide = selectedDepartments.length === 0 && selectedEmployees.length === 0;
      const participantes = [
        ...selectedDirectors.map(directive => directive.nombre),
        ...selectedEmployees.map(employee => employee.nombre || employee.email),
        ...(isCompanyWide ? ['Toda la empresa'] : [])
      ];

      const normalizedStatus = normalizeMeetingStatus('pendiente');
      const meetingData = {
        titulo: newMeeting.titulo.trim(),
        fecha: newMeeting.fecha,
        hora: newMeeting.hora,
        lugar: newMeeting.lugar || '',
        duracion: newMeeting.duracion || '',
        objetivo: newMeeting.objetivo || '',
        coordinador: newMeeting.coordinador || '',
        participantes: participantes,
        empleadosInvitados: newMeeting.empleadosInvitados || [],
        departamentos: newMeeting.departamentos || [],
        agenda: newMeeting.agenda ? newMeeting.agenda.split('\n').filter(item => item.trim()) : [],
        tipoReunion: 'general',
        directivosSeleccionados: selectedDirectors
          .map(directive => directive.id || directive._id)
          .filter(Boolean),
        esParaTodos: isCompanyWide,
        recurrenciaSemanal: Boolean(newMeeting.recurrenciaSemanal),
        status: normalizedStatus,
        estado: normalizedStatus,
        cronograma: (newMeeting.departamentos || []).map(area => ({
          area,
          tiempo: '00:15',
          indicadoresCompromiso: [],
          indicadoresMetas: [],
          documentos: []
        }))
      };

      const response = await ApiService.createReunion(meetingData);

      if (response.success) {
        const newMeetingObj = {
          id: response.data._id || response.data.id || Date.now(),
          ...meetingData,
          serieReunionId: response.data.serieReunionId || '',
          recurrenciaActiva: Boolean(response.data.recurrenciaActiva),
          status: 'pendiente',
          resultadoExitoso: false,
          seguimientos: [],
          convocatoriaEnviada: response.convocatoriaEnviada || false,
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0]
        };
        setReuniones(current => [...current, newMeetingObj]);
        setNewMeeting(emptyMeeting);
        setShowEmployeeSelector(false);
        setEmployeeAreaFilter('');
        setEmployeeNameFilter('');
        setModals({ ...modals, new: false });
        const recurrenceMessage = newMeeting.recurrenciaSemanal
          ? ' Se repetirá cada semana hasta que detengas la repetición.'
          : '';
        if (response.convocatoriaEnviada) {
          alert(`Reunión creada.${recurrenceMessage} ${response.convocatoriaMensaje || 'Convocatoria enviada.'}`);
        } else {
          alert(`Reunión creada.${recurrenceMessage} No se envió la convocatoria. ${response.convocatoriaMensaje || 'No hay destinatarios válidos.'}`);
        }
      } else {
        alert(`No se creó la reunión. ${response.message || 'Completa los campos obligatorios e inténtalo de nuevo.'}`);
      }
    } catch (error) {
      console.error('Error al crear reunion:', error);
      alert(`No se creó la reunión. ${error.message || 'Verifica tu conexión e inténtalo de nuevo.'}`);
    } finally {
      setLoading(false);
    }
  };

  const detenerRecurrencia = async meeting => {
    const seriesId = meeting.serieReunionId;
    if (!seriesId || !meeting.recurrenciaActiva) return;
    if (!window.confirm(`¿Detener las reuniones semanales de "${meeting.titulo}"? Las reuniones ya agendadas se conservarán.`)) return;
    setLoading(true);
    try {
      await ApiService.stopWeeklyReunion(meeting.id || meeting._id);
      setReuniones(current => current.map(item =>
        item.serieReunionId === seriesId ? { ...item, recurrenciaActiva: false } : item
      ));
      alert('Se detuvo la repetición. Las reuniones que ya estaban agendadas se conservarán.');
    } catch (error) {
      alert(`No se detuvo la repetición. ${error.message || 'Inténtalo de nuevo.'}`);
    } finally {
      setLoading(false);
    }
  };

  const iniciarReunion = async (meeting) => {
    const allowsNoDepartments = meeting.esParaTodos
      || meeting.empleadosInvitados?.length > 0
      || ['one-to-one', 'check-in', 'all-hands'].includes(meeting.tipoReunion);
    if (!meeting.departamentos?.length && !allowsNoDepartments) {
      alert('No se puede iniciar: la reunión no tiene áreas asignadas. Configúrala y guarda los cambios.');
      return;
    }
    setLoading(true);
    try {
      await actualizarReunion(meeting.id, { status: 'en_curso', estado: 'en_curso' });
    } catch (error) {
      alert(`No se inició la reunión. ${error.message || 'Inténtalo de nuevo.'}`);
    } finally {
      setLoading(false);
    }
  };

  const subirDocumento = async () => {
    if (!selected || !documentArea || !documentFiles.length) {
      alert('Selecciona un área y al menos un documento PDF, Excel o Word.');
      return;
    }

    for (const file of documentFiles) {
      const extension = file.name.toLowerCase().split('.').pop();
      if (!['pdf', 'xlsx', 'xls', 'xlsb', 'doc', 'docx', 'ppt', 'pptx'].includes(extension)) {
        alert(`"${file.name}" no es válido. Usa un archivo PDF, Excel, Word o PowerPoint.`);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        alert(`"${file.name}" supera el límite de 15 MB.`);
        return;
      }
    }

    setLoading(true);
    try {
      const response = await ApiService.uploadReunionDocumento(selected.id, documentArea, documentFiles);
      const documentos = Array.isArray(response.data) ? response.data : [response.data];
      for (const documento of documentos) {
        setReuniones(current => current.map(meeting => String(meeting.id || meeting._id) === String(selected.id || selected._id)
          ? {
              ...meeting,
              documentos: [...(meeting.documentos || []), documento],
              cronograma: (meeting.cronograma || []).map(area => area.area === documentArea
                ? { ...area, documentos: [...(area.documentos || []), documento.nombreArchivo] }
                : area)
            }
          : meeting
        ));
        setSelected(current => current ? {
          ...current,
          documentos: [...(current.documentos || []), documento],
          cronograma: (current.cronograma || []).map(area => area.area === documentArea
            ? { ...area, documentos: [...(area.documentos || []), documento.nombreArchivo] }
            : area)
        } : current);
      }
      setDocumentFiles([]);
      alert(`${documentos.length} documento(s) guardado(s).`);
    } catch (error) {
      alert(`No se guardó el documento. ${error.message || 'Inténtalo de nuevo.'}`);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentUrl = document => {
    if (!document?.url) return '#';
    if (document.url.startsWith('http')) return document.url;
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const serverUrl = apiUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    const documentPath = String(document.url).startsWith('/')
      ? document.url
      : `/${document.url}`;
    return encodeURI(`${serverUrl}${documentPath}`);
  };

  const updateMeetingDocuments = (meetingId, updater) => {
    setReuniones(current => current.map(meeting => (
      String(meeting.id || meeting._id) === String(meetingId)
        ? { ...meeting, documentos: updater(meeting.documentos || []) }
        : meeting
    )));
    setSelected(current => current && String(current.id || current._id) === String(meetingId)
      ? { ...current, documentos: updater(current.documentos || []) }
      : current);
  };

  const subirPresentacionPrincipal = async () => {
    if (!selected || !presentationFile) {
      alert('Selecciona el PDF de la presentación inicial.');
      return;
    }
    if (presentationFile.name.split('.').pop()?.toLowerCase() !== 'pdf') {
      alert('La presentación inicial debe ser un archivo PDF.');
      return;
    }
    if (presentationFile.size > 15 * 1024 * 1024) {
      alert('El PDF supera el límite de 15 MB.');
      return;
    }
    setLoading(true);
    try {
      const meetingId = selected.id || selected._id;
      const response = await ApiService.uploadReunionDocumento(
        meetingId,
        'Presentación',
        presentationFile,
        { esPresentacionPrincipal: true }
      );
      const documento = Array.isArray(response.data) ? response.data[0] : response.data;
      if (!documento?._id) throw new Error('El servidor no devolvió el PDF cargado.');
      updateMeetingDocuments(meetingId, documents => [...documents, documento]);
      setPresentationFile(null);
      alert('PDF de presentación cargado. Ahora asigna los rangos de páginas a cada área.');
    } catch (error) {
      alert(`No se cargó la presentación. ${error.message || 'Inténtalo de nuevo.'}`);
    } finally {
      setLoading(false);
    }
  };

  const guardarRangosPresentacion = async () => {
    if (!selected || !primaryPresentationDocument?._id) return;
    const areas = selected.departamentos || [];
    const ranges = [];
    for (const area of areas) {
      const draft = presentationRangesDraft[area] || {};
      const paginaInicio = Number(draft.paginaInicio);
      const paginaFin = Number(draft.paginaFin);
      if (!Number.isInteger(paginaInicio) || !Number.isInteger(paginaFin)
        || paginaInicio < 1 || paginaFin < paginaInicio) {
        alert(`Indica un rango de páginas válido para ${area}.`);
        return;
      }
      ranges.push({ area, paginaInicio, paginaFin });
    }
    setLoading(true);
    try {
      const meetingId = selected.id || selected._id;
      const response = await ApiService.updatePresentationAreaRanges(
        meetingId,
        primaryPresentationDocument._id,
        ranges
      );
      updateMeetingDocuments(meetingId, documents => documents.map(document =>
        document._id === primaryPresentationDocument._id ? response.data : document
      ));
      alert('Se guardaron los rangos de páginas por área.');
    } catch (error) {
      alert(`No se guardaron los rangos. ${error.message || 'Verifica los números de página e inténtalo de nuevo.'}`);
    } finally {
      setLoading(false);
    }
  };

  const eliminarDocumento = async documento => {
    if (!selected || !documento?._id) {
      alert('No se puede eliminar: el documento no tiene un identificador válido.');
      return;
    }
    if (!window.confirm(`¿Eliminar "${documento.nombreArchivo}"? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    try {
      await ApiService.deleteReunionDocumento(selected.id, documento._id);
      updateMeetingDocuments(selected.id, documents => documents.filter(item => item._id !== documento._id));
      alert('Documento eliminado. El área está disponible para cargar otro archivo.');
    } catch (error) {
      alert(`No se eliminó el documento. ${error.message || 'Verifica que la reunión siga disponible.'}`);
    } finally {
      setLoading(false);
    }
  };

  const editarDocumento = async (documento, file) => {
    if (!selected || !file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    if (!['pdf', 'xlsx', 'xls', 'xlsb', 'doc', 'docx', 'ppt', 'pptx'].includes(extension)) {
      alert('El archivo de reemplazo no es válido. Usa PDF, Excel, Word o PowerPoint.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert('El archivo de reemplazo supera el límite de 15 MB.');
      return;
    }
    setLoading(true);
    try {
      const response = await ApiService.replaceReunionDocumento(selected.id, documento._id, file);
      updateMeetingDocuments(selected.id, documents => documents.map(item =>
        item._id === documento._id ? response.data : item
      ));
      alert('Documento reemplazado.');
    } catch (error) {
      alert(`No se reemplazó el documento. ${error.message || 'Verifica que la reunión siga en curso.'}`);
    } finally {
      setLoading(false);
    }
  };

  const presentationSlides = getPresentationSlides(selected?.documentos, selected?.departamentos);
  const currentPresentationSlide = presentationSlides[presentationIndex] || null;
  const currentPresentationDocument = currentPresentationSlide?.presentations?.[presentationDocumentIndex] || null;
  const currentSpreadsheetDocument = currentPresentationSlide?.spreadsheets?.[presentationSpreadsheetIndex] || null;
  const spreadsheetDocument = presentationView === 'spreadsheet' ? currentSpreadsheetDocument : null;

  useEffect(() => {
    const currentDocument = spreadsheetDocument;
    const documentType = String(currentDocument?.tipo || '').toUpperCase();
    const documentKey = currentDocument
      ? (currentDocument._id || currentDocument.url || currentDocument.nombreArchivo)
      : '';
    if (!currentDocument || !spreadsheetTypes.includes(documentType)) {
      setSpreadsheetPreview({ key: '', sheets: [], activeSheet: 0, insights: null, error: '' });
      return;
    }
    let cancelled = false;
    const loadSpreadsheet = async () => {
      try {
        const response = await ApiService.previewReunionDocumento(selected.id, currentDocument._id);
        const sheets = response.data?.sheets || [];
        if (!cancelled) {
          setSpreadsheetPreview({
            key: documentKey,
            sheets,
            activeSheet: 0,
            insights: response.data?.insights || null,
            error: ''
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSpreadsheetPreview({
            key: documentKey,
            sheets: [],
            activeSheet: 0,
            insights: null,
            error: `No se pudo mostrar el Excel dentro del sistema (${error.message}).`
          });
        }
      }
    };
    loadSpreadsheet();
    return () => { cancelled = true; };
  }, [selected, presentationIndex, presentationSpreadsheetIndex, presentationView, spreadsheetDocument, objetivos]);

  // Actualizar reunion
  const actualizarReunion = async (id, data) => {
    try {
      const sanitizedData = {
        ...data,
        status: data.status !== undefined ? normalizeMeetingStatus(data.status) : undefined,
        estado: data.estado !== undefined ? normalizeMeetingStatus(data.estado) : undefined
      };
      const response = await ApiService.updateReunion(id, sanitizedData);
      if (response.success) {
        setReuniones(current => current.map(m =>
          m.id === id ? { ...m, ...sanitizedData, updatedAt: new Date().toISOString().split('T')[0] } : m
        ));
        return response;
      }
      throw new Error(response.message || 'No se pudo actualizar la reunion');
    } catch (error) {
      console.error('Error al actualizar reunion:', error);
      throw error;
    }
  };

  // Guardar configuracion
  const guardarConfiguracion = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const payload = {
        ...configData,
        status: normalizeMeetingStatus(configData.status),
        estado: normalizeMeetingStatus(configData.status)
      };
      await actualizarReunion(selected.id, payload);
      setModals({ ...modals, config: false });
      setSelected(null);
    } catch (error) {
      console.error('Error al guardar configuracion:', error);
    } finally {
      setLoading(false);
    }
  };

  const actualizarSeguimiento = async (reunionId, seguimiento, data) => {
    const response = await ApiService.updateSeguimiento(reunionId, seguimiento.id, data);
    if (!response.success) {
      throw new Error(response.message || 'No se pudo actualizar el seguimiento');
    }
    setReuniones(current => current.map(reunion => reunion.id === reunionId
      ? {
          ...reunion,
          seguimientos: (reunion.seguimientos || []).map(item =>
            item.id === seguimiento.id ? { ...item, ...data } : item
          )
        }
      : reunion
    ));
  };

  const completarSeguimiento = async (reunion, seguimiento, resultadoExitoso) => {
    const mensaje = resultadoExitoso
      ? '¿Marcar este seguimiento como completado y exitoso?'
      : '¿Marcar este seguimiento como no exitoso? Podrás programar otra reunión de seguimiento con el mismo objetivo.';
    if (!window.confirm(mensaje)) return;

    setLoading(true);
    try {
      await actualizarSeguimiento(reunion.id, seguimiento, {
        status: 'finalizada',
        estado: 'finalizada',
        resultadoExitoso
      });
      setFollowUpFeedback(
        resultadoExitoso
          ? 'Seguimiento completado como exitoso.'
          : 'Seguimiento completado como no exitoso. Ahora puedes programar otra reunión con el mismo objetivo.'
      );
    } catch (error) {
      console.error('Error al completar seguimiento:', error);
      alert(`No se actualizó el seguimiento. ${error.message || 'Inténtalo de nuevo.'}`);
    } finally {
      setLoading(false);
    }
  };

  const eliminarReunion = async () => {
    if (!selected) return;
    const confirmado = !meetingPreferences.confirmDelete || window.confirm(
      `¿Eliminar la reunión "${selected.titulo}"?\n\nSe perderán también su minuta, acuerdos y seguimientos. Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setLoading(true);
    try {
      const response = await ApiService.deleteReunion(selected.id);
      if (!response.success) {
        throw new Error(response.message || 'No se pudo eliminar la reunión');
      }
      setReuniones(current => current.filter(reunion => reunion.id !== selected.id));
      setModals({ ...modals, config: false });
      setSelected(null);
      if (response.warning) {
        alert(`${response.message} ${response.warning}`);
      }
    } catch (error) {
      console.error('Error al eliminar reunión:', error);
      alert(`No se eliminó la reunión. ${error.message || 'Inténtalo de nuevo.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Guardar minuta
  const guardarMinuta = async (isFollowUp = false, followUpId = null) => {
    if (!selected) return;
    setLoading(true);
    try {
      if (isFollowUp && followUpId) {
        const response = await ApiService.updateSeguimiento(selected.parentReunionId, followUpId, {
          minuta: minuteContent,
          acuerdos: minuteAgreements
        });
        if (response.success) {
          setReuniones(current => current.map(m =>
            m.id === selected.parentReunionId ? {
              ...m,
              seguimientos: m.seguimientos.map(f =>
                f.id === followUpId ? { ...f, minuta: minuteContent, acuerdos: minuteAgreements } : f
              )
            } : m
          ));
        }
      } else {
        const shouldFinalize = normalizeMeetingStatus(selected.status || selected.estado) === 'en_curso';
        await actualizarReunion(selected.id, {
          minuta: minuteContent,
          acuerdos: minuteAgreements,
          objetivosDefinidos: meetingObjectives,
          ...(shouldFinalize ? { status: 'finalizada', estado: 'finalizada', resultadoExitoso: true } : {})
        });
      }
      setModals({ ...modals, minute: false });
      setSelected(null);
      setMinuteContent('');
      setMinuteSections({});
      setMinuteAgreements([]);
      setMeetingObjectives([]);
      setNewMeetingObjective({ nombre: '', descripcion: '', area: '', prioridad: 'media', progreso: 0, status: 'pendiente' });
      setNewAgreement({ descripcion: '', responsable: '', fechaCompromiso: '', estado: 'pendiente' });
      return true;
    } catch (error) {
      console.error('Error al guardar minuta:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addAgreement = () => {
    if (!newAgreement.descripcion.trim()) return;
    setMinuteAgreements(current => [...current, {
      ...newAgreement,
      descripcion: newAgreement.descripcion.trim()
    }]);
    setNewAgreement({ descripcion: '', responsable: '', fechaCompromiso: '', estado: 'pendiente' });
  };

  const addMeetingObjective = () => {
    if (!newMeetingObjective.nombre.trim()) return;
    const progreso = Math.min(100, Math.max(0, Number(newMeetingObjective.progreso) || 0));
    setMeetingObjectives(current => [...current, {
      ...newMeetingObjective,
      nombre: newMeetingObjective.nombre.trim(),
      descripcion: newMeetingObjective.descripcion.trim(),
      progreso,
      status: progreso >= 100 ? 'completado' : progreso > 0 ? 'en-progreso' : 'pendiente'
    }]);
    setNewMeetingObjective({ nombre: '', descripcion: '', area: '', prioridad: 'media', progreso: 0, status: 'pendiente' });
  };

  const crearObjetivoDesdePresentacion = async () => {
    const currentSlide = currentPresentationSlide;
    const area = currentSlide?.area;
    const nombre = presentationObjective.nombre.trim();
    if (!area || !nombre) {
      alert('Indica el nombre del indicador.');
      return;
    }

    setLoading(true);
    try {
      const response = await ApiService.createObjetivo({
        nombre,
        descripcion: presentationObjective.descripcion.trim(),
        prioridad: presentationObjective.prioridad,
        progreso: 0,
        status: 'pendiente',
        tipoArea: 'especifico',
        areasInvolucradas: [area]
      });
      const createdObjective = response.data || response.objetivo;
      if (!createdObjective) {
        throw new Error(response.message || 'El servidor no devolvió el indicador creado.');
      }

      if (setObjetivos) {
        setObjetivos(current => [...current, {
          ...createdObjective,
          id: createdObjective.id || createdObjective._id
        }]);
      }
      setPresentationObjective({ nombre: '', descripcion: '', prioridad: 'media' });
      setShowPresentationObjective(false);
      alert(`Indicador creado para el área ${area}.`);
    } catch (error) {
      alert(`No se creó el indicador. ${error.message || 'Inténtalo de nuevo.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Crear seguimiento
  const crearSeguimiento = async () => {
    if (!selected) return;
    const missingFields = getMissingRequiredFields(followUpData);
    if (missingFields.length) {
      alert(`Faltan campos obligatorios: ${missingFields.map(getRequiredFieldLabel).join(', ')}.`);
      return;
    }
    setLoading(true);
    try {
      const participantes = directivos
        .filter(directive => (followUpData.departamentos || []).some(area =>
          normalizeAreaName(area) === normalizeAreaName(directive.area)
        ))
        .map(directive => directive.nombre);

      const data = {
        ...followUpData,
        tipoReunion: 'general',
        participantes,
        agenda: followUpData.agenda ? followUpData.agenda.split('\n').filter(item => item.trim()) : [],
        reunionId: selected.id
      };

      const response = await ApiService.createSeguimiento(selected.id, data);

      if (response.success) {
        setReuniones(current => current.map(m =>
          m.id === selected.id ? {
            ...m,
            seguimientos: [...(m.seguimientos || []), {
              ...data,
              id: response.data._id || response.data.id || Date.now(),
              status: 'pendiente',
              resultadoExitoso: false,
              createdAt: new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString().split('T')[0]
            }]
          } : m
        ));
        setModals({ ...modals, followUp: false });
        setSelected(null);
        setFollowUpData(emptyFollowUp);
        alert('Seguimiento creado.');
      }
    } catch (error) {
      console.error('Error al crear seguimiento:', error);
      alert('No se creó el seguimiento. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // GENERAR MINUTA PDF
  const generarPdf = () => {
    if (!selected) return;
    const pdf = new jsPDF();
    const content = minuteContent || selected.minuta || 'No se ha registrado contenido.';
    const meetingDate = new Date(`${selected.fecha}T${selected.hora || '00:00'}`);
    const folioPrefix = documentPreferences.folioPrefix || 'MIN';
    const folio = `${folioPrefix}-${meetingDate.getFullYear()}-${String(selected.fecha || '').replaceAll('-', '').slice(4) || '0000'}`;
    const margin = 14;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = 14;
    const colors = {
      navy: [31, 50, 78],
      blue: [41, 98, 163],
      light: [235, 241, 247],
      border: [155, 168, 181],
      text: [35, 43, 51]
    };
    const ensureSpace = height => {
      if (y + height > pageHeight - 15) {
        pdf.addPage();
        y = 14;
      }
    };
    const addText = (text, options = {}) => {
      const lines = pdf.splitTextToSize(String(text || 'No aplica'), options.width || contentWidth);
      const lineHeight = options.lineHeight || 4.5;
      ensureSpace(lines.length * lineHeight + 4);
      pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
      pdf.setFontSize(options.size || 10);
      pdf.setTextColor(...(options.color || colors.text));
      pdf.text(lines, options.x || margin, y);
      y += lines.length * lineHeight + (options.spacing ?? 3);
    };
    const drawTable = (headers, rows, widths) => {
      const rowHeight = 8;
      const drawRow = (values, header = false) => {
        ensureSpace(rowHeight);
        let x = margin;
        values.forEach((value, index) => {
          const width = widths[index];
          pdf.setFillColor(...(header ? colors.blue : [255, 255, 255]));
          pdf.setDrawColor(...colors.border);
          pdf.rect(x, y - 5, width, rowHeight, header ? 'FD' : 'D');
          pdf.setFont('helvetica', header ? 'bold' : 'normal');
          pdf.setFontSize(header ? 8 : 7.5);
          pdf.setTextColor(...(header ? [255, 255, 255] : colors.text));
          const lines = pdf.splitTextToSize(String(value || ''), width - 3);
          pdf.text(lines.slice(0, 2), x + 1.5, y);
          x += width;
        });
        y += rowHeight;
      };
      drawRow(headers, true);
      rows.forEach(row => drawRow(row));
      y += 4;
    };
    const participants = selected.participantes || [];
    const agreements = selected.acuerdos || [];
    const agenda = selected.agenda || [];

    pdf.setDrawColor(...colors.border);
    pdf.rect(margin, y - 7, contentWidth, 28);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(...colors.navy);
    pdf.text('MINUTA DE REUNIÓN DE TRABAJO', pageWidth / 2, y + 1, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...colors.text);
    pdf.text(
      documentPreferences.includeInstitution
        ? (companyData?.nombre || 'Quorum · Información institucional')
        : 'Documento generado desde Quorum',
      pageWidth / 2,
      y + 8,
      { align: 'center' }
    );
    y += 28;

    drawTable(
      ['Fecha', 'No. de folio', 'Lugar', 'Hora de inicio'],
      [[selected.fecha || 'Por definir', folio, selected.lugar || 'Por definir', selected.hora || 'Por definir']],
      [contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.38, contentWidth * 0.22]
    );
    addText('AGENDA DE LA REUNIÓN', { size: 11, bold: true, color: colors.navy, spacing: 4 });
    drawTable(
      ['Núm.', 'ORDEN DEL DÍA', 'Tiempo requerido', 'Responsable'],
      (agenda.length ? agenda : ['No se registró orden del día.']).map((item, index) => [
        index + 1,
        item,
        selected.duracion || 'Por definir',
        selected.coordinador || 'Por definir'
      ]),
      [contentWidth * 0.08, contentWidth * 0.48, contentWidth * 0.18, contentWidth * 0.26]
    );
    addText('PARTICIPANTES', { size: 11, bold: true, color: colors.navy, spacing: 4 });
    drawTable(
      ['PARTICIPANTE', 'ÁREA / FUNCIÓN', 'FIRMA', 'HORA DE LLEGADA'],
      (participants.length ? participants : ['No se registraron participantes']).map(participant => [
        participant,
        selected.departamentos?.join(', ') || 'Por definir',
        '',
        ''
      ]),
      [contentWidth * 0.34, contentWidth * 0.25, contentWidth * 0.25, contentWidth * 0.16]
    );
    addText('DESARROLLO DE LA REUNIÓN', { size: 11, bold: true, color: colors.navy, spacing: 4 });
    addText(content, { size: 9, lineHeight: 4.2, spacing: 6 });
    addText('NUEVOS ACUERDOS ESTABLECIDOS', { size: 11, bold: true, color: colors.navy, spacing: 4 });
    drawTable(
      ['Número', 'Acuerdo', 'Responsable', 'Fecha compromiso', 'Estatus'],
      (agreements.length ? agreements : [{ descripcion: 'No se registraron acuerdos.' }]).map((agreement, index) => [
        index + 1,
        agreement.descripcion,
        agreement.responsable || 'Por definir',
        agreement.fechaCompromiso || 'Por definir',
        agreement.estado || 'Pendiente'
      ]),
      [contentWidth * 0.1, contentWidth * 0.36, contentWidth * 0.2, contentWidth * 0.19, contentWidth * 0.15]
    );
    addText('OBSERVACIONES', { size: 11, bold: true, color: colors.navy, spacing: 4 });
    addText(selected.conclusion || 'Sin observaciones registradas.', { size: 9, lineHeight: 4.2, spacing: 8 });
    if (documentPreferences.includeSignatures) {
      drawTable(
        ['HORA DE TÉRMINO', 'ELABORÓ / PRESIDIÓ', 'FIRMA'],
        [['', selected.coordinador || 'Por definir', '']],
        [contentWidth * 0.25, contentWidth * 0.45, contentWidth * 0.3]
      );
    }
    addText(`Generado: ${new Date().toLocaleString('es-MX')}`, { size: 7.5, color: [100, 116, 139], spacing: 0 });
    const blob = pdf.output('blob');
    saveAs(blob, `minuta_${selected.fecha}_${selected.titulo.slice(0, 30)}.pdf`);
  };

  const parseMeetingDate = meeting => {
    const date = new Date(`${meeting.fecha}T${meeting.hora || '00:00'}`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const now = new Date();
  const pendingMeetings = (reuniones || []).filter(meeting =>
    ['pendiente', 'en-progreso', 'en_curso'].includes(
      normalizeMeetingStatus(meeting.status || meeting.estado)
    )
  );
  const visibleMeetings = (reuniones || []).filter(meeting => {
    const titleMatches = !meetingSearch.trim()
      || String(meeting.titulo || '').toLocaleLowerCase('es').includes(meetingSearch.trim().toLocaleLowerCase('es'));
    const dateMatches = !meetingDateFilter || meeting.fecha === meetingDateFilter;
    return titleMatches && dateMatches;
  });
  const nextMeeting = (reuniones || [])
    .map(meeting => ({ meeting, date: parseMeetingDate(meeting) }))
    .filter(item => item.date && item.date >= now
      && ['pendiente', 'en-progreso', 'en_curso'].includes(
        normalizeMeetingStatus(item.meeting.status || item.meeting.estado)
      ))
    .sort((a, b) => a.date - b.date)[0] || null;

  // RENDER TARJETA DE REUNION
  const renderMeetingCard = (meeting, isFollowUp = false, parentMeeting = null) => {
    const normalizedStatus = normalizeMeetingStatus(meeting.status || meeting.estado || 'pendiente');
    const status = ESTADOS_MAP[normalizedStatus] || ESTADOS_MAP['pendiente'];
    const tipoLabel = 'Reunión';

    return (
      <Card key={meeting.id} className={`mb-2 ${isFollowUp ? 'ms-4 border-start' : 'mb-3'}`}>
        <Card.Body className="py-2">
          <div className="d-flex flex-wrap justify-content-between align-items-start">
            <div className="flex-grow-1">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <h6 className="mb-0 fw-semibold">{meeting.titulo}</h6>
                <Badge style={{ background: status.bg, color: status.color }}>{formatMeetingStatus(normalizedStatus)}</Badge>
                {normalizedStatus === 'finalizada' && (
                  <Badge bg={meeting.resultadoExitoso ? 'success' : 'danger'}>
                    {meeting.resultadoExitoso ? 'Exitoso' : 'No Exitoso'}
                  </Badge>
                )}
                <Badge bg="secondary" className="small">{tipoLabel}</Badge>
                {meeting.recurrenciaActiva && <Badge bg="primary" className="small">Cada semana</Badge>}
                {meeting.convocatoriaEnviada && <Badge bg="info" className="small">Convocatoria enviada</Badge>}
              </div>
              <div className="d-flex flex-wrap gap-3 small text-muted">
                <span>{meeting.fecha} - {meeting.hora}</span>
                <span>{meeting.lugar}</span>
                <span>Coord: {meeting.coordinador}</span>
                <span>{meeting.duracion}</span>
              </div>
              <div className="mt-1 small">
                <p className="mb-0"><strong>Objetivo:</strong> {meeting.objetivo}</p>
                <p className="mb-0"><strong>Participantes:</strong> {meeting.participantes?.join(', ')}</p>
                {meeting.conclusion && <p className="mb-0"><strong>Conclusion:</strong> {meeting.conclusion}</p>}
              </div>
              {meeting.minuta && (
                <div className="bg-light p-1 rounded small mt-1">
                  <strong>Minuta:</strong> {meeting.minuta.length > 100 ? meeting.minuta.slice(0, 100) + '...' : meeting.minuta}
                </div>
              )}
            </div>
            <div className="d-flex gap-1 mt-1">
              {!isFollowUp && (
                <>
                  {normalizedStatus === 'pendiente' && (
                    <Button
                      variant="outline-success"
                      size="sm"
                      onClick={() => iniciarReunion(meeting)}
                      disabled={loading}
                    >
                      Iniciar reunión
                    </Button>
                  )}
                  {normalizedStatus === 'en_curso' && meeting.documentos?.some(document =>
                    [...presentationTypes, ...spreadsheetTypes].includes(String(document.tipo || '').toUpperCase())
                  ) && (
                    <Button
                      variant="outline-info"
                      size="sm"
                      onClick={() => {
                        setSelected(meeting);
                        setPresentationIndex(0);
                        setPresentationDocumentIndex(0);
                        setPresentationSpreadsheetIndex(0);
                        setPresentationView('presentation');
                        setPresentationFinished(false);
                        setModals({ ...modals, presentation: true });
                      }}
                    >
                      Presentar documentos
                    </Button>
                  )}
                  <Button variant="outline-primary" size="sm" onClick={() => {
                    setSelected(meeting);
                    setConfigData({
                      status: normalizedStatus,
                      resultadoExitoso: meeting.resultadoExitoso || false,
                      conclusion: meeting.conclusion || '',
                      tipoReunion: 'general',
                      indicadoresVinculados: meeting.indicadoresVinculados || [],
                      cronograma: (meeting.cronograma || []).map(area => ({
                        ...area,
                        indicadoresCompromiso: area.indicadoresCompromiso || [],
                        indicadoresMetas: area.indicadoresMetas || [],
                        indicadoresVinculados: meeting.indicadoresVinculados || []
                      }))
                    });
                    setModals({ ...modals, config: true });
                  }}>
                    Configurar
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={() => {
                    if (normalizeMeetingStatus(meeting.status) !== 'finalizada') {
                      alert('Solo se puede dar seguimiento a reuniones finalizadas.');
                      return;
                    }
                    setSelected(meeting);
                    setFollowUpData({
                      titulo: `Seguimiento - ${meeting.titulo}`,
                      fecha: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      hora: '09:00',
                      lugar: meeting.lugar,
                      duracion: '1h',
                      objetivo: meeting.objetivo,
                      coordinador: meeting.coordinador,
                      departamentos: meeting.departamentos,
                      agenda: meeting.agenda.join('\n'),
                      tipoReunion: 'general'
                    });
                    setModals({ ...modals, followUp: true });
                  }} disabled={normalizeMeetingStatus(meeting.status) !== 'finalizada'}>
                    Seguimiento
                  </Button>
                  {meeting.recurrenciaActiva && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => detenerRecurrencia(meeting)}
                      disabled={loading}
                    >
                      Detener repetición
                    </Button>
                  )}
                </>
              )}
              {isFollowUp && (
                <>
                  <Button variant="outline-primary" size="sm" onClick={() => {
                    setSelected({ ...meeting, isFollowUp: true, followUpId: meeting.id, parentReunionId: parentMeeting.id });
                    openMinuteEditor(meeting.minuta || '');
                    setMinuteAgreements(meeting.acuerdos || []);
                    setMeetingObjectives(meeting.objetivosDefinidos || []);
                    setModals({ ...modals, minute: true });
                  }}>
                    Minuta
                  </Button>
                  {normalizeMeetingStatus(meeting.status) !== 'finalizada' && (
                    <>
                      <Button
                        variant="outline-success"
                        size="sm"
                        onClick={() => completarSeguimiento(parentMeeting, meeting, true)}
                        disabled={loading}
                      >
                        Exitoso
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => completarSeguimiento(parentMeeting, meeting, false)}
                        disabled={loading}
                      >
                        No exitoso
                      </Button>
                    </>
                  )}
                  {normalizeMeetingStatus(meeting.status) === 'finalizada' && !meeting.resultadoExitoso && (
                    <Button
                      variant="outline-warning"
                      size="sm"
                      onClick={() => {
                        setSelected(parentMeeting);
                        setFollowUpData({
                          titulo: `Seguimiento - ${parentMeeting.titulo}`,
                          fecha: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                          hora: '09:00',
                          lugar: parentMeeting.lugar,
                          duracion: '1h',
                          objetivo: parentMeeting.objetivo,
                          coordinador: parentMeeting.coordinador,
                          departamentos: parentMeeting.departamentos,
                          agenda: (parentMeeting.agenda || []).join('\n'),
                          tipoReunion: 'general'
                        });
                        setModals({ ...modals, followUp: true });
                      }}
                    >
                      Programar otra reunión
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          {!isFollowUp && meeting.seguimientos?.length > 0 && (
            <div className="mt-2 pt-2 border-top">
              <div className="small fw-semibold text-muted mb-1">Seguimientos:</div>
              {meeting.seguimientos.map(fu => renderMeetingCard(fu, true, meeting))}
            </div>
          )}
        </Card.Body>
      </Card>
    );
  };

  // ============================================================
  // RENDER FORMULARIO DE REUNION (NUEVA O SEGUIMIENTO)
  // ============================================================
  const renderFormularioReunion = (data, setData, esSeguimiento = false) => {
    const tipoActual = TIPOS_REUNION[0];
    const camposReq = tipoActual.requiere;
    const camposOpc = tipoActual.opcional;
    const camposOrdenados = [...camposReq, ...camposOpc];
    const filteredEmployees = empleados.filter(employee => {
      const areaMatches = !employeeAreaFilter
        || normalizeAreaName(employee.area) === normalizeAreaName(employeeAreaFilter);
      const search = employeeNameFilter.trim().toLocaleLowerCase('es');
      const nameMatches = !search
        || `${employee.nombre || ''} ${employee.email || ''}`.toLocaleLowerCase('es').includes(search);
      return areaMatches && nameMatches;
    });

    return (
      <Form>
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold">Tipo de reunión</Form.Label>
          <Form.Control value="Reunión" readOnly aria-label="Tipo de reunión" />
        </Form.Group>

        {/* CAMPOS DEL FORMULARIO */}
        {camposOrdenados.map(campo => {
          if (campo === 'fecha' || campo === 'hora') {
            return (
              <Row key={campo}>
                {renderCampo(campo, data, setData)}
              </Row>
            );
          }
          return renderCampo(campo, data, setData);
        })}

        {!esSeguimiento && (
          <Form.Group className="mb-3">
            <Button
              type="button"
              variant="outline-primary"
              onClick={() => setShowEmployeeSelector(current => !current)}
              aria-expanded={showEmployeeSelector}
              className="mb-2"
            >
              {showEmployeeSelector
                ? 'Ocultar búsqueda de empleados'
                : `¿Invitar a un empleado en particular?${data.empleadosInvitados?.length ? ` (${data.empleadosInvitados.length} seleccionado${data.empleadosInvitados.length === 1 ? '' : 's'})` : ''}`}
            </Button>
            {showEmployeeSelector && (
              <div className="border rounded p-3">
                {empleados.length ? (
                  <>
                    <Row className="g-2 mb-3">
                      <Col md={5}>
                        <Form.Label className="small">Área del empleado</Form.Label>
                        <Form.Select value={employeeAreaFilter} onChange={event => setEmployeeAreaFilter(event.target.value)}>
                          <option value="">Todas las áreas</option>
                          {(companyData?.departamentos || []).map(area => <option key={area} value={area}>{area}</option>)}
                        </Form.Select>
                      </Col>
                      <Col md={7}>
                        <Form.Label className="small">Buscar por nombre</Form.Label>
                        <Form.Control
                          type="search"
                          value={employeeNameFilter}
                          onChange={event => setEmployeeNameFilter(event.target.value)}
                          placeholder="Escribe el nombre del empleado"
                        />
                      </Col>
                    </Row>
                    {filteredEmployees.length ? (
                      <div className="d-flex flex-column gap-2">
                        {filteredEmployees.map(employee => {
                          const employeeId = String(employee._id || employee.id);
                          return (
                            <Form.Check
                              key={employeeId}
                              type="checkbox"
                              label={`${employee.nombre || 'Perfil pendiente'} · ${employee.area || 'Sin área'} · ${employee.email}`}
                              checked={(data.empleadosInvitados || []).includes(employeeId)}
                              onChange={() => {
                                const selected = (data.empleadosInvitados || []).includes(employeeId)
                                  ? data.empleadosInvitados.filter(id => id !== employeeId)
                                  : [...(data.empleadosInvitados || []), employeeId];
                                setData({ ...data, empleadosInvitados: selected });
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : <div className="small text-muted">No hay empleados que coincidan con la búsqueda.</div>}
                  </>
                ) : (
                  <div className="small text-muted">Aún no hay personas en el directorio. Agrégalas o comparte el código de invitación desde Configuración.</div>
                )}
              </div>
            )}
          </Form.Group>
        )}

        {!esSeguimiento && (
          <Alert variant={
            !(data.departamentos || []).length && !(data.empleadosInvitados || []).length
              ? 'info'
              : 'light'
          } className="small py-2">
            Si no seleccionas departamentos ni empleados, la reunión se considerará para toda la empresa.
          </Alert>
        )}

        {!esSeguimiento && (
          <Form.Check
            className="mb-3"
            type="switch"
            id="weekly-meeting-switch"
            label="Repetir cada semana, hasta que la detenga manualmente"
            checked={Boolean(data.recurrenciaSemanal)}
            onChange={event => setData({ ...data, recurrenciaSemanal: event.target.checked })}
          />
        )}

        {/* BOTON DE ENVIO */}
        <Button
          type="submit"
          variant="primary"
          className="mt-2"
          onClick={(e) => {
            e.preventDefault();
            if (esSeguimiento) {
              crearSeguimiento();
            } else {
              crearReunion();
            }
          }}
          disabled={loading}
        >
          {loading ? 'Creando...' : (esSeguimiento ? 'Crear Seguimiento' : 'Crear Reunion')}
        </Button>
      </Form>
    );
  };

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  return (
    <div>
      {followUpFeedback && (
        <Alert variant="primary" dismissible onClose={() => setFollowUpFeedback('')} className="app-inline-notification">
          {followUpFeedback}
        </Alert>
      )}
      {/* HEADER */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <h2 className="h4 mb-0">Gestion de Reuniones</h2>
          <div className="small text-muted mt-1">Los empleados consultan sus reuniones e invitaciones con su cuenta individual de Quorum.</div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button variant="primary" onClick={() => setModals({ ...modals, new: true })}>
            + Nueva Reunion
          </Button>
        </div>
      </div>

      <Alert variant="info" className="mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-sm-4">
            <div className="small text-muted">Reuniones pendientes</div>
            <div className="h4 fw-bold mb-0">{pendingMeetings.length}</div>
          </div>
          <div className="col-sm-8">
            <div className="small text-muted">Próxima reunión</div>
            {nextMeeting ? (
              <>
                <div className="fw-semibold">{nextMeeting.meeting.titulo}</div>
                <div className="small">
                  {nextMeeting.date.toLocaleString('es-MX', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </div>
              </>
            ) : <div className="fw-semibold">No hay reuniones próximas agendadas.</div>}
          </div>
        </div>
      </Alert>

      {/* LISTA DE REUNIONES */}
      {!!reuniones?.length && (
        <Row className="g-2 mb-3">
          <Col md={7}>
            <Form.Label className="small text-muted mb-1">Buscar reunión por nombre</Form.Label>
            <Form.Control
              type="search"
              value={meetingSearch}
              onChange={event => setMeetingSearch(event.target.value)}
              placeholder="Escribe el nombre de la reunión"
            />
          </Col>
          <Col md={5}>
            <Form.Label className="small text-muted mb-1">Filtrar por fecha</Form.Label>
            <div className="d-flex gap-2">
              <Form.Control
                type="date"
                value={meetingDateFilter}
                onChange={event => setMeetingDateFilter(event.target.value)}
              />
              {meetingDateFilter && (
                <Button variant="outline-secondary" onClick={() => setMeetingDateFilter('')}>
                  Limpiar
                </Button>
              )}
            </div>
          </Col>
        </Row>
      )}
      {!reuniones?.length ? (
        <Card className="text-center p-5">
          <div className="text-muted">No hay reuniones registradas</div>
          <Button variant="primary" className="mt-3" onClick={() => setModals({ ...modals, new: true })}>
            + Programar primera reunion
          </Button>
        </Card>
      ) : (
        visibleMeetings.length
          ? visibleMeetings.map(m => renderMeetingCard(m))
          : <Alert variant="light">No hay reuniones que coincidan con esos filtros.</Alert>
      )}

      {/* ===== MODAL NUEVA REUNION ===== */}
      <Modal show={modals.new} onHide={() => setModals({ ...modals, new: false })} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Nueva Reunion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {renderFormularioReunion(newMeeting, setNewMeeting, false)}
        </Modal.Body>
      </Modal>

      {/* ===== MODAL CONFIGURACION ===== */}
      <Modal show={modals.config} onHide={() => { setModals({ ...modals, config: false }); setSelected(null); }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Configurar Reunion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p><strong>{selected?.titulo}</strong></p>
          <p className="text-muted small">Fecha: {selected?.fecha}</p>

          <Card className="mb-3 border-primary-subtle">
            <Card.Body>
              <Card.Title className="h6">Cronograma por área</Card.Title>
              <p className="small text-muted">
                Define el tiempo y los indicadores que se revisarán. Los documentos se cargan cuando la reunión esté en curso.
              </p>
              {(configData.cronograma || []).length === 0 ? (
                <div className="small text-muted">No hay áreas asignadas a esta reunión.</div>
              ) : (
                (configData.cronograma || []).map((area, index) => (
                  <Card key={`${area.area}-${index}`} className="mb-2 bg-light">
                    <Card.Body className="py-2">
                      <div className="fw-semibold mb-2">{area.area}</div>
                      <Row className="g-2">
                        <Col md={3}>
                          <Form.Label className="small">Tiempo</Form.Label>
                          <Form.Control
                            type="time"
                            value={area.tiempo || '00:15'}
                            onChange={event => setConfigData(current => ({
                              ...current,
                              cronograma: current.cronograma.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, tiempo: event.target.value } : item
                              )
                            }))}
                          />
                        </Col>
                        <Col md={4}>
                          <Form.Label className="small">Indicadores de compromiso</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            value={(area.indicadoresCompromiso || []).join('\n')}
                            onChange={event => setConfigData(current => ({
                              ...current,
                              cronograma: current.cronograma.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, indicadoresCompromiso: event.target.value.split('\n').filter(value => value.trim()) }
                                  : item
                              )
                            }))}
                            placeholder="Uno por línea"
                          />
                        </Col>
                        <Col md={5}>
                          <Form.Label className="small">Indicadores de metas</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            value={(area.indicadoresMetas || []).join('\n')}
                            onChange={event => setConfigData(current => ({
                              ...current,
                              cronograma: current.cronograma.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, indicadoresMetas: event.target.value.split('\n').filter(value => value.trim()) }
                                  : item
                              )
                            }))}
                            placeholder="Uno por línea"
                          />
                        </Col>
                      </Row>
                      <Form.Label className="small mt-2">Objetivos vinculados</Form.Label>
                      <div className="d-flex flex-wrap gap-2">
                        {objetivos
                          .filter(obj => obj.tipoArea === 'general'
                            || (obj.areasInvolucradas || []).includes(area.area))
                          .map(obj => {
                            const objectiveId = String(obj.id || obj._id);
                            const linked = (configData.indicadoresVinculados || []).includes(objectiveId);
                            return (
                              <Form.Check
                                key={objectiveId}
                                type="checkbox"
                                label={obj.nombre}
                                checked={linked}
                                onChange={() => setConfigData(current => ({
                                  ...current,
                                  indicadoresVinculados: linked
                                    ? (current.indicadoresVinculados || []).filter(id => id !== objectiveId)
                                    : [...(current.indicadoresVinculados || []), objectiveId]
                                }))}
                              />
                            );
                          })}
                        {!objetivos.some(obj => obj.tipoArea === 'general' || (obj.areasInvolucradas || []).includes(area.area)) && (
                          <span className="small text-muted">No hay objetivos generales o vinculados a esta área.</span>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                ))
              )}
            </Card.Body>
          </Card>

          <Form.Group className="mb-2">
            <Form.Label>Estado</Form.Label>
            <Form.Select
              value={configData.status}
              onChange={(e) => setConfigData({ ...configData, status: e.target.value })}
            >
              {ESTADOS.map(s => <option key={s} value={s}>{formatMeetingStatus(s)}</option>)}
            </Form.Select>
          </Form.Group>

          {normalizeMeetingStatus(configData.status) !== 'finalizada' && selected && (
            <>
            <Card className="mb-3 border-primary-subtle">
              <Card.Body>
                <Card.Title className="h6">Presentación inicial de la reunión</Card.Title>
                <p className="small text-muted">
                  Sube aquí un único PDF maestro, independiente de los Excel. Previsualiza sus páginas y asigna el rango que corresponde a cada área.
                </p>
                {!primaryPresentationDocument ? (
                  <Row className="g-2 align-items-end">
                    <Col md={9}>
                      <Form.Label className="small">PDF de presentación (máximo 15 MB)</Form.Label>
                      <Form.Control
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={event => {
                          setPresentationFile(event.target.files?.[0] || null);
                          event.target.value = '';
                        }}
                      />
                    </Col>
                    <Col md={3}>
                      <Button
                        variant="primary"
                        className="w-100"
                        onClick={subirPresentacionPrincipal}
                        disabled={loading || !presentationFile}
                      >
                        {loading ? 'Subiendo...' : 'Subir PDF maestro'}
                      </Button>
                    </Col>
                  </Row>
                ) : (
                  <>
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                      <div className="small">
                        <strong>{primaryPresentationDocument.nombreArchivo}</strong>
                        <Badge bg="secondary" className="ms-2">PDF maestro</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => eliminarDocumento(primaryPresentationDocument)}
                        disabled={loading}
                      >
                        Eliminar presentación
                      </Button>
                    </div>
                    <div className="presentation-assignment-preview">
                      <iframe
                        title={`Vista previa del PDF ${primaryPresentationDocument.nombreArchivo}`}
                        src={`${getDocumentUrl(primaryPresentationDocument)}#page=${Math.max(1, Number(presentationPreviewPage) || 1)}`}
                      />
                    </div>
                    <Form.Group className="mt-2 mb-3">
                      <Form.Label className="small mb-1">Página que quieres previsualizar</Form.Label>
                      <Form.Control
                        type="number"
                        min="1"
                        max="10000"
                        value={presentationPreviewPage}
                        onChange={event => setPresentationPreviewPage(Math.max(1, Number(event.target.value) || 1))}
                        className="presentation-preview-page-input"
                      />
                    </Form.Group>
                    {(selected.departamentos || []).length ? (
                      <>
                        <div className="small fw-semibold mb-2">Asignar páginas por área</div>
                        <div className="presentation-range-list">
                          {selected.departamentos.map(area => {
                            const range = presentationRangesDraft[area] || {};
                            return (
                              <div className="presentation-range-row" key={area}>
                                <strong>{area}</strong>
                                <Form.Control
                                  aria-label={`Página inicial para ${area}`}
                                  type="number"
                                  min="1"
                                  max="10000"
                                  placeholder="Desde"
                                  value={range.paginaInicio || ''}
                                  onChange={event => setPresentationRangesDraft(current => ({
                                    ...current,
                                    [area]: { ...current[area], paginaInicio: event.target.value }
                                  }))}
                                />
                                <Form.Control
                                  aria-label={`Página final para ${area}`}
                                  type="number"
                                  min="1"
                                  max="10000"
                                  placeholder="Hasta"
                                  value={range.paginaFin || ''}
                                  onChange={event => setPresentationRangesDraft(current => ({
                                    ...current,
                                    [area]: { ...current[area], paginaFin: event.target.value }
                                  }))}
                                />
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  disabled={!range.paginaInicio}
                                  onClick={() => setPresentationPreviewPage(Math.max(1, Number(range.paginaInicio) || 1))}
                                >
                                  Previsualizar
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                        <Button
                          className="mt-3"
                          variant="primary"
                          onClick={guardarRangosPresentacion}
                          disabled={loading}
                        >
                          {loading ? 'Guardando...' : 'Guardar rangos por área'}
                        </Button>
                      </>
                    ) : (
                      <Alert variant="info" className="mb-0">
                        Asigna áreas a la reunión para poder vincular sus rangos de páginas.
                      </Alert>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
            <Card className="mb-3 border-info-subtle">
              <Card.Body>
                <Card.Title className="h6">Documentos complementarios por área</Card.Title>
                <p className="small text-muted mb-2">Carga aquí archivos de apoyo vinculados a un área. El PDF maestro de la presentación se administra por separado arriba.</p>
                <Row className="g-2 align-items-end">
                  <Col md={4}>
                    <Form.Label className="small">Área</Form.Label>
                    {(() => {
                      const availableAreas = selected.departamentos || [];
                      return availableAreas.length ? (
                        <Form.Select value={documentArea} onChange={event => setDocumentArea(event.target.value)}>
                          <option value="">Selecciona un área</option>
                          {availableAreas.map(area => <option key={area} value={area}>{area}</option>)}
                        </Form.Select>
                      ) : (
                        <div className="small text-muted border rounded p-2">
                          No hay departamentos asignados. Configura al menos un área para cargar documentos.
                        </div>
                      );
                    })()}
                  </Col>
                  <Col md={5}>
                    <Form.Label className="small">Archivo</Form.Label>
                    <Form.Control
                      type="file"
                      multiple
                      accept=".pdf,.xlsx,.xls,.xlsb,.doc,.docx,.ppt,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.binary.macroEnabled.12,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      onChange={event => setDocumentFiles(Array.from(event.target.files || []))}
                    />
                  </Col>
                  <Col md={3}>
                    <Button variant="info" className="w-100" onClick={subirDocumento} disabled={loading || !documentArea}>
                      {loading ? 'Subiendo...' : 'Guardar documento(s)'}
                    </Button>
                  </Col>
                </Row>
                <div className="mt-3">
                  {(selected.documentos || []).filter(document => !document.esPresentacionPrincipal).length === 0 ? (
                    <div className="small text-muted">Todavía no hay documentos cargados.</div>
                  ) : (
                    getMeetingDocumentAreas(selected).map(area => {
                      const areaDocuments = (selected.documentos || []).filter(document =>
                        !document.esPresentacionPrincipal && document.area === area
                      );
                      if (!areaDocuments.length) return null;
                      return (
                        <Card key={area} className="mb-2">
                          <Card.Body className="py-2">
                            <div className="fw-semibold mb-1">{area}</div>
                            {areaDocuments.map(document => (
                              <div className="d-flex justify-content-between align-items-center border-top py-2 small" key={document._id}>
                                <span>{document.nombreArchivo} <Badge bg="secondary">{document.tipo}</Badge></span>
                                <div className="d-flex gap-2 align-items-center">
                                  <a href={getDocumentUrl(document)} target="_blank" rel="noreferrer">Abrir</a>
                                  <Button
                                    size="sm"
                                    variant="outline-primary"
                                    onClick={() => window.document.getElementById(`replace-document-${document._id}`)?.click()}
                                    disabled={loading}
                                  >
                                    Editar
                                  </Button>
                                  <Form.Control
                                    id={`replace-document-${document._id}`}
                                    type="file"
                                    className="d-none"
                                    accept=".pdf,.xlsx,.xls,.xlsb,.doc,.docx,.ppt,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.binary.macroEnabled.12,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                    onChange={event => {
                                      editarDocumento(document, event.target.files?.[0] || null);
                                      event.target.value = '';
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => eliminarDocumento(document)}
                                    disabled={loading}
                                  >
                                    Eliminar
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </Card.Body>
                        </Card>
                      );
                    })
                  )}
                </div>
              </Card.Body>
            </Card>
            </>
          )}

          {normalizeMeetingStatus(configData.status) === 'finalizada' && (
            <>
              <Form.Group className="mb-2">
                <Form.Label>Resultado</Form.Label>
                <div className="d-flex gap-2">
                  <Button
                    variant={configData.resultadoExitoso ? 'success' : 'outline-success'}
                    onClick={() => setConfigData({ ...configData, resultadoExitoso: true })}
                  >
                    Exitosa
                  </Button>
                  <Button
                    variant={!configData.resultadoExitoso ? 'danger' : 'outline-danger'}
                    onClick={() => setConfigData({ ...configData, resultadoExitoso: false })}
                  >
                    No Exitosa
                  </Button>
                </div>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Conclusion</Form.Label>
                <Form.Control
                  as="textarea"
                  rows="3"
                  value={configData.conclusion}
                  onChange={(e) => setConfigData({ ...configData, conclusion: e.target.value })}
                  placeholder="Conclusion de la reunion..."
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Minuta</Form.Label>
                <div className="d-flex gap-2">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => {
                      setModals({ ...modals, config: false });
                      setSelected({ ...selected, isFollowUp: false });
                      openMinuteEditor(selected?.minuta || '');
                      setMinuteAgreements(selected?.acuerdos || []);
                      setMeetingObjectives(selected?.objetivosDefinidos || []);
                      setModals({ ...modals, minute: true });
                    }}
                  >
                    Editar Minuta
                  </Button>
                  {selected?.minuta && (
                    <Button
                      variant="outline-success"
                      size="sm"
                      onClick={() => {
                        setModals({ ...modals, config: false });
                        setSelected({ ...selected, isFollowUp: false });
                        openMinuteEditor(selected.minuta);
                        setMinuteAgreements(selected.acuerdos || []);
                        setMeetingObjectives(selected.objetivosDefinidos || []);
                        setModals({ ...modals, minute: true });
                      }}
                    >
                      Ver Minuta
                    </Button>
                  )}
                </div>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          <Button variant="outline-danger" onClick={eliminarReunion} disabled={loading}>
            Eliminar reunión
          </Button>
          <div>
          <Button variant="secondary" onClick={() => { setModals({ ...modals, config: false }); setSelected(null); }}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardarConfiguracion} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* ===== MODAL MINUTA ===== */}
      <Modal show={modals.minute} onHide={() => { setModals({ ...modals, minute: false }); setSelected(null); }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Minuta - {selected?.titulo}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row small text-muted mb-2">
            <div className="col-md-6"><strong>Fecha:</strong> {selected?.fecha} - {selected?.hora}</div>
            <div className="col-md-6"><strong>Coordinador:</strong> {selected?.coordinador}</div>
            <div className="col-12"><strong>Participantes:</strong> {selected?.participantes?.join(', ')}</div>
          </div>
          <div className="minute-editor">
            <div className="minute-editor-intro">
              <div>
                <span className="minute-editor-kicker">Plantilla activa</span>
                <h6 className="mb-1">
                  Minuta detallada con votaciones
                </h6>
                <p className="small text-muted mb-0">
                  Completa cada apartado de la estructura unificada de minuta.
                </p>
              </div>
              <span className="minute-editor-badge">Formato unificado</span>
            </div>
            <>
                <Form.Group className="mb-3">
                  <Form.Label>3. Desarrollo de la sesión</Form.Label>
                  <Form.Control as="textarea" rows={6} value={minuteSections.desarrollo || ''} onChange={(e) => updateMinuteSection('desarrollo', e.target.value)} placeholder="Describe los temas tratados, intervenciones y decisiones tomadas..." />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Registro de votaciones</Form.Label>
                  <Form.Control as="textarea" rows={3} value={minuteSections.votaciones || ''} onChange={(e) => updateMinuteSection('votaciones', e.target.value)} placeholder="Registra la propuesta, resultado y observaciones de cada votación..." />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Cierre y observaciones</Form.Label>
                  <Form.Control as="textarea" rows={3} value={minuteSections.cierre || ''} onChange={(e) => updateMinuteSection('cierre', e.target.value)} placeholder="Anota el cierre de la sesión y cualquier observación relevante..." />
                </Form.Group>
            </>
          </div>
          <div className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="fw-semibold mb-0">Indicadores definidos en esta reunión</Form.Label>
              <span className="small text-muted">{meetingObjectives.length} registrados</span>
            </div>
            <p className="small text-muted">
              Registra aquí los indicadores acordados durante la sesión. Estos alimentarán el avance estratégico.
            </p>
            {meetingObjectives.map((objective, index) => (
              <div className="agreement-row mb-2" key={objective._id || index}>
                <div className="flex-grow-1">
                  <strong>{objective.nombre}</strong>
                  <div className="small text-muted">
                    {objective.area || 'General'} · Avance: {objective.progreso || 0}% · Estado: {objective.status}
                  </div>
                </div>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setMeetingObjectives(current => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Quitar
                </Button>
              </div>
            ))}
            <Row className="g-2">
              <Col md={4}>
                <Form.Control
                  placeholder="Indicador acordado *"
                  value={newMeetingObjective.nombre}
                  onChange={event => setNewMeetingObjective(current => ({ ...current, nombre: event.target.value }))}
                />
              </Col>
              <Col md={3}>
                <Form.Control
                  placeholder="Descripción"
                  value={newMeetingObjective.descripcion}
                  onChange={event => setNewMeetingObjective(current => ({ ...current, descripcion: event.target.value }))}
                />
              </Col>
              <Col md={2}>
                <Form.Select
                  value={newMeetingObjective.area}
                  onChange={event => setNewMeetingObjective(current => ({ ...current, area: event.target.value }))}
                >
                  <option value="">Área</option>
                  {(selected?.departamentos || []).map(area => <option key={area} value={area}>{area}</option>)}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Control
                  type="number"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={newMeetingObjective.progreso}
                  onChange={event => setNewMeetingObjective(current => ({ ...current, progreso: event.target.value }))}
                />
              </Col>
              <Col md={1}>
                <Button variant="outline-primary" className="w-100" onClick={addMeetingObjective}>+</Button>
              </Col>
            </Row>
          </div>
          <div className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="fw-semibold mb-0">Acuerdos de la sesión</Form.Label>
              <span className="small text-muted">{minuteAgreements.length} registrados</span>
            </div>
            {minuteAgreements.map((agreement, index) => (
              <div className="agreement-row mb-2" key={agreement._id || index}>
                <div className="flex-grow-1">
                  <strong>{agreement.descripcion}</strong>
                  <div className="small text-muted">
                    Responsable: {agreement.responsable || 'Por definir'} · Fecha: {agreement.fechaCompromiso || 'Sin fecha'} · Estado: {agreement.estado}
                  </div>
                </div>
                <Button variant="outline-danger" size="sm" onClick={() => setMinuteAgreements(current => current.filter((_, itemIndex) => itemIndex !== index))}>
                  Quitar
                </Button>
              </div>
            ))}
            <Row className="g-2">
              <Col md={5}>
                <Form.Control placeholder="Acuerdo *" value={newAgreement.descripcion} onChange={(e) => setNewAgreement({ ...newAgreement, descripcion: e.target.value })} />
              </Col>
              <Col md={3}>
                <Form.Control placeholder="Responsable" value={newAgreement.responsable} onChange={(e) => setNewAgreement({ ...newAgreement, responsable: e.target.value })} />
              </Col>
              <Col md={2}>
                <Form.Control type="date" value={newAgreement.fechaCompromiso} onChange={(e) => setNewAgreement({ ...newAgreement, fechaCompromiso: e.target.value })} />
              </Col>
              <Col md={2}>
                <Button variant="outline-primary" className="w-100" onClick={addAgreement}>Añadir</Button>
              </Col>
            </Row>
          </div>
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          <Button variant="success" onClick={generarPdf}>Descargar PDF</Button>
          <div>
            <Button variant="secondary" className="me-2" onClick={() => { setModals({ ...modals, minute: false }); setSelected(null); }}>
              Cancelar
            </Button>
            <SlideCommit
              label="Desliza para guardar minuta"
              doneLabel="Minuta guardada"
              errorLabel="No se pudo guardar"
              onConfirm={() => guardarMinuta(!!selected?.isFollowUp, selected?.followUpId || null)}
              trackColor="#e5e7eb"
              handleColor="#172b4d"
              successColor="#16845b"
              dangerColor="#bd3544"
              disabled={loading}
            />
          </div>
        </Modal.Footer>
      </Modal>

      {/* ===== MODAL PRESENTACION DE DOCUMENTOS ===== */}
      <Modal
        show={modals.presentation}
        onHide={() => {
          setModals({ ...modals, presentation: false });
          setSelected(null);
          setPresentationFinished(false);
        }}
        size="xl"
        centered
        fullscreen="xl-down"
        dialogClassName="presentation-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Presentación - {selected?.titulo}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="presentation-modal-body">
          {presentationFinished ? (
            <div className="presentation-thank-you">
              <div className="presentation-thank-you-icon" aria-hidden="true">✓</div>
              <h3>Gracias por su participación</h3>
              <p className="mb-0">
                La presentación de documentos ha finalizado. Agradecemos a todos los integrantes por sus aportaciones.
              </p>
            </div>
          ) : currentPresentationSlide ? (() => {
            const currentSlide = currentPresentationSlide;
            const isLastSlide = presentationIndex >= presentationSlides.length - 1;
            const areaDirector = getAreaDirector(currentSlide.area);
            const primaryDocument = currentPresentationDocument;
            const excelDocument = currentSpreadsheetDocument;
            const spreadsheetKey = excelDocument
              ? (excelDocument._id || excelDocument.url || excelDocument.nombreArchivo)
              : '';
            const previewReady = spreadsheetPreview.key === spreadsheetKey;
            const insightSummary = spreadsheetPreview.insights?.summary;
            const hasPresentation = currentSlide.presentations.length > 0;
            const hasSpreadsheets = currentSlide.spreadsheets.length > 0;
            const useSpreadsheetView = presentationView === 'spreadsheet' && hasSpreadsheets;
            const selectedDocument = useSpreadsheetView ? excelDocument : primaryDocument;
            const documentType = String(selectedDocument?.tipo || '').toUpperCase();
            const activeSpreadsheetSheet = spreadsheetPreview.sheets[spreadsheetPreview.activeSheet];
            const hasInsightValue = value => value !== null && value !== undefined;
            const displaySummary = summary => summary && (
              hasInsightValue(summary.progress)
              || hasInsightValue(summary.target)
              || hasInsightValue(summary.achieved)
              || hasInsightValue(summary.clients)
            );
            return (
              <>
                <div className="presentation-area-heading mb-3">
                  <div>
                    <span className="small text-uppercase fw-semibold">Área {presentationIndex + 1} de {presentationSlides.length}</span>
                    <h2>{currentSlide.area}</h2>
                    <p className="mb-0">Presenta: {areaDirector?.nombre || 'Directivo no asignado'}</p>
                  </div>
                  {selectedDocument && (
                    <div className="presentation-selected-file">
                      <Badge bg="info">{documentType}</Badge>
                      <span>{selectedDocument.nombreArchivo}</span>
                      {selectedDocument.paginaInicio && selectedDocument.paginaFin && (
                        <Badge bg="light" text="dark">
                          Páginas {selectedDocument.paginaInicio}–{selectedDocument.paginaFin}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <div className="presentation-view-switch mb-3" role="group" aria-label="Vista del área">
                  {(hasPresentation || hasSpreadsheets) && (
                    <Button
                      variant={useSpreadsheetView ? 'outline-primary' : 'primary'}
                      onClick={() => {
                        if (useSpreadsheetView) {
                          setPresentationView('presentation');
                        } else {
                          setPresentationView('spreadsheet');
                          setPresentationSpreadsheetIndex(0);
                        }
                      }}
                      aria-pressed={useSpreadsheetView}
                    >
                      {useSpreadsheetView
                        ? (hasPresentation ? 'Volver a la presentación' : 'Volver al área')
                        : 'Ver indicadores y Excel'}
                    </Button>
                  )}
                  {!hasPresentation && !hasSpreadsheets && (
                    <span className="small text-muted">Esta área todavía no tiene documentos cargados.</span>
                  )}
                  {currentSlide.presentations.length > 1 && !useSpreadsheetView && (
                    <Form.Select
                      className="presentation-file-select"
                      aria-label="Elegir documento inicial"
                      value={presentationDocumentIndex}
                      onChange={event => setPresentationDocumentIndex(Number(event.target.value))}
                    >
                      {currentSlide.presentations.map((document, index) => (
                        <option key={document._id || document.url} value={index}>
                          {document.nombreArchivo}
                        </option>
                      ))}
                    </Form.Select>
                  )}
                  {currentSlide.spreadsheets.length > 1 && useSpreadsheetView && (
                    <Form.Select
                      className="presentation-file-select"
                      aria-label="Elegir documento Excel"
                      value={presentationSpreadsheetIndex}
                      onChange={event => setPresentationSpreadsheetIndex(Number(event.target.value))}
                    >
                      {currentSlide.spreadsheets.map((document, index) => (
                        <option key={document._id || document.url} value={index}>
                          {document.nombreArchivo}
                        </option>
                      ))}
                    </Form.Select>
                  )}
                </div>

                {!useSpreadsheetView && hasPresentation && primaryDocument && (
                  <>
                    {primaryDocument.nombreCargador && (
                      <p className="small text-muted mb-2">Documento subido por {primaryDocument.nombreCargador}</p>
                    )}
                    {documentType === 'PDF' ? (
                      <div className="presentation-document-frame presentation-pdf-frame">
                        <iframe
                          title={`Presentación ${primaryDocument.nombreArchivo}`}
                          src={`${getDocumentUrl(primaryDocument)}#page=${primaryDocument.paginaInicio || 1}`}
                        />
                      </div>
                    ) : (
                      <div className="presentation-office-preview presentation-office-card">
                        <div className="presentation-office-icon" aria-hidden="true">
                          {documentType.startsWith('PPT') ? 'PPT' : 'DOC'}
                        </div>
                        <span className="small text-uppercase fw-semibold">
                          {documentType.startsWith('PPT') ? 'Presentación PowerPoint' : 'Documento de Word'}
                        </span>
                        <h3>{primaryDocument.nombreArchivo}</h3>
                        <p>
                          Abre el archivo para presentar sus diapositivas o páginas. Al terminar, podrás cambiar aquí mismo a los resultados del Excel.
                        </p>
                        <a
                          className="btn btn-primary"
                          href={getDocumentUrl(primaryDocument)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir {documentType.startsWith('PPT') ? 'PowerPoint' : 'documento'}
                        </a>
                      </div>
                    )}
                  </>
                )}

                {useSpreadsheetView && (
                  <div className="presentation-spreadsheet-preview">
                    {previewReady && displaySummary(insightSummary) && (
                      <section className="meeting-spreadsheet-summary mb-3" aria-label="Resultados generales del área">
                        <div className="meeting-spreadsheet-summary-title">
                          <div>
                            <span className="small text-uppercase fw-semibold">Resultados del área</span>
                            <h3>{insightSummary.unitName || currentSlide.area}</h3>
                          </div>
                          {spreadsheetPreview.insights.period && (
                            <Badge bg="light" text="dark">Periodo {spreadsheetPreview.insights.period}</Badge>
                          )}
                        </div>
                        <div className="meeting-spreadsheet-summary-stats">
                          {hasInsightValue(insightSummary.progress) && (
                            <div className="meeting-spreadsheet-summary-stat meeting-spreadsheet-summary-result">
                              <span>Resultado general</span>
                              <strong>{insightSummary.progress}%</strong>
                              <div className="progress" role="progressbar" aria-label={`Resultado general ${insightSummary.progress}%`} aria-valuenow={insightSummary.progress} aria-valuemin="0" aria-valuemax="100">
                                <div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, insightSummary.progress))}%` }} />
                              </div>
                              <Badge bg={insightSummary.status === 'Eficiente' ? 'success' : insightSummary.status === 'Deficiente' ? 'danger' : 'warning'}>
                                {insightSummary.status}
                              </Badge>
                            </div>
                          )}
                          {hasInsightValue(insightSummary.clients) && (
                            <div className="meeting-spreadsheet-summary-stat">
                              <span>Clientes del área</span><strong>{insightSummary.clients}</strong>
                            </div>
                          )}
                          {hasInsightValue(insightSummary.target) && (
                            <div className="meeting-spreadsheet-summary-stat">
                              <span>Meta del periodo</span><strong>{insightSummary.target}</strong>
                            </div>
                          )}
                          {hasInsightValue(insightSummary.achieved) && (
                            <div className="meeting-spreadsheet-summary-stat">
                              <span>Logrado</span><strong>{insightSummary.achieved}</strong>
                            </div>
                          )}
                        </div>
                      </section>
                    )}
                    {previewReady && spreadsheetPreview.insights?.metrics?.length > 0 && (
                      <section className="meeting-spreadsheet-insights mb-3" aria-label="Indicadores del área">
                        <div className="meeting-spreadsheet-insights-header">
                          <div>
                            <span className="small text-uppercase fw-semibold">Indicadores</span>
                            <h5 className="mb-0">Avance por rubro</h5>
                          </div>
                          <FileSpreadsheet size={19} aria-hidden="true" />
                        </div>
                        <div className="meeting-spreadsheet-metrics">
                          {spreadsheetPreview.insights.metrics.map(item => (
                            <div className="meeting-spreadsheet-metric" key={item.name}>
                              <div className="d-flex justify-content-between gap-2">
                                <strong>{item.name}</strong>
                                {!hasInsightValue(item.progress) ? (
                                  <Badge bg="secondary">Sin datos</Badge>
                                ) : (
                                  <Badge bg={item.status === 'Eficiente' ? 'success' : item.status === 'Deficiente' ? 'danger' : 'warning'}>
                                    {item.status || 'Con avance'}
                                  </Badge>
                                )}
                              </div>
                              {hasInsightValue(item.progress) && (
                                <div className="progress mt-2" role="progressbar" aria-label={`${item.name}: ${item.progress}%`} aria-valuenow={item.progress} aria-valuemin="0" aria-valuemax="100">
                                  <div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }} />
                                </div>
                              )}
                              {hasInsightValue(item.progress) && (
                                <div className="meeting-spreadsheet-metric-advance">
                                  Avance <strong>{item.progress}%</strong>
                                  {item.status && <span>{item.status}</span>}
                                </div>
                              )}
                              {(hasInsightValue(item.target) || hasInsightValue(item.achieved)) && (
                                <div className="small text-muted mt-2">
                                  {hasInsightValue(item.achieved) && `Logrado: ${item.achieved}`}
                                  {hasInsightValue(item.achieved) && hasInsightValue(item.target) && ' de '}
                                  {hasInsightValue(item.target) && `Meta: ${item.target}`}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="small text-muted mb-0 mt-3">{spreadsheetPreview.insights.note}</p>
                      </section>
                    )}
                    {previewReady
                      && !spreadsheetPreview.error
                      && !displaySummary(insightSummary)
                      && !spreadsheetPreview.insights?.metrics?.length && (
                        <Alert variant="info" className="mb-3">
                          No se reconocieron indicadores automáticos en este archivo. Puedes consultar sus hojas de cálculo abajo.
                        </Alert>
                      )}
                    {!previewReady ? (
                      <div className="presentation-spreadsheet-loading">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Leyendo resultados y hojas del Excel...
                      </div>
                    ) : spreadsheetPreview.error ? (
                      <Alert variant="warning">{spreadsheetPreview.error}</Alert>
                    ) : (
                      <>
                        {spreadsheetPreview.sheets.length > 0 && (
                          <section className="presentation-spreadsheet-data" aria-label="Datos del documento Excel">
                            <div className="presentation-spreadsheet-data-heading">
                              <div>
                                <span className="small text-uppercase fw-semibold">Detalle del Excel</span>
                                <h4>{activeSpreadsheetSheet?.name || 'Hoja de cálculo'}</h4>
                              </div>
                              {activeSpreadsheetSheet?.rows?.length > 0 && (
                                <span className="presentation-spreadsheet-row-count">
                                  {activeSpreadsheetSheet.rows.length} filas
                                </span>
                              )}
                            </div>
                            {spreadsheetPreview.sheets.length > 1 && (
                              <div className="presentation-sheet-tabs" role="tablist" aria-label="Hojas del Excel">
                                {spreadsheetPreview.sheets.map((sheet, sheetIndex) => (
                                  <Button
                                    key={sheet.name}
                                    size="sm"
                                    role="tab"
                                    aria-selected={spreadsheetPreview.activeSheet === sheetIndex}
                                    variant={spreadsheetPreview.activeSheet === sheetIndex ? 'primary' : 'outline-secondary'}
                                    onClick={() => setSpreadsheetPreview(current => ({ ...current, activeSheet: sheetIndex }))}
                                  >
                                    {sheet.name}
                                  </Button>
                                ))}
                              </div>
                            )}
                            {activeSpreadsheetSheet?.rows?.length ? (
                              <div className="presentation-spreadsheet-frame table-responsive">
                                <table className="table table-sm table-bordered table-striped mb-0">
                                  <tbody>
                                    {activeSpreadsheetSheet.rows.map((row, rowIndex) => (
                                      <tr key={rowIndex}>
                                        {row.map((cell, columnIndex) => (
                                          <td key={columnIndex}>{cell}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <Alert variant="info" className="mb-0">No hay una hoja de datos visible en este archivo.</Alert>
                            )}
                            {activeSpreadsheetSheet?.truncated && (
                              <div className="small text-muted mt-2">
                                Vista previa limitada a 500 filas y 50 columnas.
                              </div>
                            )}
                          </section>
                        )}
                      </>
                    )}
                  </div>
                )}

                {!hasPresentation && !useSpreadsheetView && (
                  <div className="presentation-area-slide presentation-area-only">
                    <span className="small text-uppercase fw-semibold">Área en revisión</span>
                    <h2>{currentSlide.area}</h2>
                    <p>{hasSpreadsheets
                      ? 'No se cargó una presentación inicial para esta área. Selecciona “Ver resultados y Excel” para consultar sus avances.'
                      : 'No hay una presentación ni hojas de cálculo cargadas para esta área.'}</p>
                  </div>
                )}

                <div className="d-flex justify-content-between align-items-center gap-2 mt-3">
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-secondary"
                      disabled={presentationIndex === 0}
                      onClick={() => {
                        setPresentationIndex(index => Math.max(0, index - 1));
                        setPresentationDocumentIndex(0);
                        setPresentationSpreadsheetIndex(0);
                        setPresentationView('presentation');
                      }}
                    >
                      Área anterior
                    </Button>
                    <Button variant="outline-primary" onClick={() => setShowPresentationObjective(true)}>
                      Crear indicadores
                    </Button>
                  </div>
                  {isLastSlide ? (
                    <SlideCommit
                      label="Desliza para finalizar"
                      doneLabel="Presentación finalizada"
                      errorLabel="No se pudo finalizar"
                      onConfirm={() => setPresentationFinished(true)}
                      trackColor="#e5e7eb"
                      handleColor="#172b4d"
                      successColor="#16845b"
                      dangerColor="#bd3544"
                      width={240}
                      holdMs={300}
                    />
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setPresentationIndex(index => Math.min(presentationSlides.length - 1, index + 1));
                        setPresentationDocumentIndex(0);
                        setPresentationSpreadsheetIndex(0);
                        setPresentationView('presentation');
                      }}
                    >
                      Siguiente área
                    </Button>
                  )}
                </div>
              </>
            );
          })() : (
            <Alert variant="warning">No hay áreas ni documentos cargados para presentar.</Alert>
          )}
        </Modal.Body>
      </Modal>

      <Modal
        show={showPresentationObjective}
        onHide={() => setShowPresentationObjective(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Nuevo indicador del área</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {(() => {
            const currentSlide = currentPresentationSlide;
            return (
              <div className="small text-muted mb-3">
                <p className="mb-1">Área: <strong>{currentSlide?.area || 'Sin área'}</strong></p>
                <p className="mb-0">
                  Se guardará como indicador de esta área en el plan estratégico, donde podrás consultar y actualizar su avance.
                </p>
              </div>
            );
          })()}
          <Form.Group className="mb-3">
            <Form.Label>Nombre del indicador *</Form.Label>
            <Form.Control
              value={presentationObjective.nombre}
              onChange={event => setPresentationObjective(current => ({ ...current, nombre: event.target.value }))}
              placeholder="Ejemplo: Reducir el tiempo de respuesta"
              autoFocus
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Descripción</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={presentationObjective.descripcion}
              onChange={event => setPresentationObjective(current => ({ ...current, descripcion: event.target.value }))}
              placeholder="Describe brevemente el resultado esperado"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Prioridad</Form.Label>
            <Form.Select
              value={presentationObjective.prioridad}
              onChange={event => setPresentationObjective(current => ({ ...current, prioridad: event.target.value }))}
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPresentationObjective(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={crearObjetivoDesdePresentacion} disabled={loading}>
            {loading ? 'Guardando...' : 'Crear indicador'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ===== MODAL SEGUIMIENTO ===== */}
      <Modal show={modals.followUp} onHide={() => { setModals({ ...modals, followUp: false }); setSelected(null); }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Reunion de Seguimiento</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-muted small mb-2"><strong>Original:</strong> {selected?.titulo} - {selected?.fecha}</div>
          {renderFormularioReunion(followUpData, setFollowUpData, true)}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default MeetingManager;