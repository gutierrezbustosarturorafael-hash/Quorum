import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Container, Form, Modal, Spinner } from 'react-bootstrap';
import { ArrowUpRight, BriefcaseBusiness, Building2, CalendarDays, Clock3, FileSpreadsheet, LogOut, MapPin, Moon, Pencil, Plus, RefreshCw, Settings2, Sun, Target, Trash2, UserRound, X } from 'lucide-react';
import ApiService from '../services/apiService';
import RisingLines from './RisingLines';
import PrivacyNotice from './PrivacyNotice';
import ProductivityGraph from './ProductivityGraph';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SERVER_URL = API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
const tokenStorageKey = companyId => `quorumEmployeeToken:${companyId}`;
const getTodayLocalDate = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const getInitials = value => String(value || 'Q')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map(part => part[0]?.toLocaleUpperCase('es') || '')
  .join('');

const documentUrl = document => {
  if (!document?.url) return '#';
  return document.url.startsWith('http')
    ? document.url
    : encodeURI(`${SERVER_URL}${document.url.startsWith('/') ? document.url : `/${document.url}`}`);
};

const EmployeeSpreadsheetInsights = ({ token, meetingId, document }) => {
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(true);

  useEffect(() => {
    let cancelled = false;
    ApiService.getEmployeeMeetingSpreadsheetInsights(token, meetingId, document._id)
      .then(response => {
        if (!cancelled) setInsights(response.data);
      })
      .catch(requestError => {
        if (!cancelled) setError(requestError.message || 'No se pudieron cargar los indicadores.');
      })
      .finally(() => {
        if (!cancelled) setLoadingInsights(false);
      });
    return () => { cancelled = true; };
  }, [token, meetingId, document._id]);

  return (
    <div className="employee-spreadsheet-insights">
      <div className="employee-spreadsheet-insights-heading">
        <div>
          <span className="employee-profile-caption">INDICADORES DEL DOCUMENTO</span>
          <h4>{insights?.summary?.unitName || document.area || 'Indicadores del área'}</h4>
        </div>
        <FileSpreadsheet size={18} aria-hidden="true" />
      </div>
      {loadingInsights ? (
        <div className="small text-muted"><Spinner size="sm" className="me-2" />Leyendo indicadores del Excel...</div>
      ) : error ? (
        <div className="small text-muted">{error}</div>
      ) : insights && (
        insights.metrics?.length
        || [insights.summary?.progress, insights.summary?.target, insights.summary?.achieved, insights.summary?.clients]
          .some(value => value !== null && value !== undefined)
      ) ? (
        <>
          {insights.period && <div className="small text-muted mb-2">Periodo: {insights.period}</div>}
          {insights.summary && (
            <div className="employee-spreadsheet-summary">
              {insights.summary.progress !== null && (
                <div className="employee-spreadsheet-summary-result">
                  <span>Resultado general</span>
                  <strong>{insights.summary.progress}%</strong>
                  <div className="progress" role="progressbar" aria-label={`Resultado general ${insights.summary.progress}%`} aria-valuenow={insights.summary.progress} aria-valuemin="0" aria-valuemax="100">
                    <div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, insights.summary.progress))}%` }} />
                  </div>
                  {insights.summary.status && <Badge bg={insights.summary.status === 'Eficiente' ? 'success' : insights.summary.status === 'Deficiente' ? 'danger' : 'warning'}>{insights.summary.status}</Badge>}
                </div>
              )}
              {insights.summary.clients !== null && (
                <div><span>Clientes del área</span><strong>{insights.summary.clients}</strong></div>
              )}
              {insights.summary.target !== null && (
                <div><span>Meta del periodo</span><strong>{insights.summary.target}</strong></div>
              )}
              {insights.summary.achieved !== null && (
                <div><span>Logrado</span><strong>{insights.summary.achieved}</strong></div>
              )}
            </div>
          )}
          <div className="employee-spreadsheet-metrics">
            {insights.metrics.map(item => (
              <div className="employee-spreadsheet-metric" key={item.name}>
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <strong>{item.name}</strong>
                  <span>{item.progress === null ? 'S/D' : `${item.progress}%`}</span>
                </div>
                {item.progress !== null && (
                  <div className="progress mt-2" role="progressbar" aria-label={`${item.name}: ${item.progress}%`} aria-valuenow={item.progress} aria-valuemin="0" aria-valuemax="100">
                    <div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }} />
                  </div>
                )}
                {(item.target !== null || item.achieved !== null) && (
                  <div className="small text-muted mt-1">
                    {item.achieved !== null && `Logrado: ${item.achieved}`}
                    {item.achieved !== null && item.target !== null && ' · '}
                    {item.target !== null && `Meta: ${item.target}`}
                  </div>
                )}
              </div>
            ))}
          </div>
          {insights.note && <p className="employee-spreadsheet-insights-note">{insights.note}</p>}
        </>
      ) : (
        <div className="small text-muted">No se encontró una hoja de resumen reconocida en este archivo.</div>
      )}
    </div>
  );
};

const EmployeePortal = ({ companyId }) => {
  const [employeeTheme, setEmployeeTheme] = useState(() => (
    localStorage.getItem('quorumEmployeeTheme') === 'dark' ? 'dark' : 'light'
  ));
  const [largeText, setLargeText] = useState(() => localStorage.getItem('quorumEmployeeLargeText') === 'true');
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem('quorumEmployeeReduceMotion') === 'true');
  const [showEmployeeSettings, setShowEmployeeSettings] = useState(false);
  const [showPersonalStrategyForm, setShowPersonalStrategyForm] = useState(false);
  const [savingPersonalStrategy, setSavingPersonalStrategy] = useState(false);
  const [personalStrategyError, setPersonalStrategyError] = useState('');
  const [personalStrategyDraft, setPersonalStrategyDraft] = useState({
    misionPersonal: '',
    visionPersonal: '',
    valoresPersonales: '',
    estrategiasPersonales: '',
    metasPersonales: '',
    fortalezas: '',
    debilidades: '',
    oportunidades: '',
    amenazas: '',
    trabajadoresACargo: 0
  });
  const [accessMode, setAccessMode] = useState(companyId ? 'login' : 'register');
  const [account, setAccount] = useState({ companyCode: '', nombre: '', email: '', password: '' });
  const [profileForm, setProfileForm] = useState({
    nombre: '', rol: '', area: '', subarea: '', dirigeSubareas: false, subareas: '',
    esJefeDepartamento: false, esJefeEmpresa: false, jefatura: '',
    telefono: '', trabajadoresACargo: 0
  });
  const [registrationDepartments, setRegistrationDepartments] = useState([]);
  const [registrationCompany, setRegistrationCompany] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [companyLookupError, setCompanyLookupError] = useState('');
  const [lookingUpCompany, setLookingUpCompany] = useState(false);
  const [token, setToken] = useState('');
  const [portal, setPortal] = useState(null);
  const [refreshingPortal, setRefreshingPortal] = useState(false);
  const [uploadingSpreadsheetMeetingId, setUploadingSpreadsheetMeetingId] = useState('');
  const [spreadsheetUploadErrors, setSpreadsheetUploadErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPersonalMeetingForm, setShowPersonalMeetingForm] = useState(false);
  const [savingPersonalMeeting, setSavingPersonalMeeting] = useState(false);
  const [personalMeetingError, setPersonalMeetingError] = useState('');
  const [personalMeetingDraft, setPersonalMeetingDraft] = useState({
    id: '',
    titulo: '',
    fecha: getTodayLocalDate(),
    hora: '09:00',
    lugar: '',
    notas: ''
  });
  const [showPersonalObjectiveForm, setShowPersonalObjectiveForm] = useState(false);
  const [savingPersonalObjective, setSavingPersonalObjective] = useState(false);
  const [personalObjectiveError, setPersonalObjectiveError] = useState('');
  const [personalObjectiveDraft, setPersonalObjectiveDraft] = useState({
    id: '',
    nombre: '',
    descripcion: '',
    prioridad: 'media',
    progreso: 0,
    tasks: ''
  });

  useEffect(() => {
    document.body.classList.toggle('dark-theme', employeeTheme === 'dark');
    localStorage.setItem('quorumEmployeeTheme', employeeTheme);
    return () => document.body.classList.remove('dark-theme');
  }, [employeeTheme]);

  useEffect(() => {
    localStorage.setItem('quorumEmployeeLargeText', String(largeText));
    localStorage.setItem('quorumEmployeeReduceMotion', String(reduceMotion));
  }, [largeText, reduceMotion]);

  const loadPortal = useCallback(async accessToken => {
    const response = await ApiService.getEmployeePortal(accessToken);
    setPortal(response.data);
  }, []);

  const refreshPortal = async () => {
    if (!token || refreshingPortal) return;
    setRefreshingPortal(true);
    try {
      await loadPortal(token);
      setError('');
    } catch (refreshError) {
      setError(refreshError.message || 'No se pudo actualizar la información del equipo.');
    } finally {
      setRefreshingPortal(false);
    }
  };

  const uploadMeetingSpreadsheet = async (meeting, file) => {
    if (!token || !file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'xlsb'].includes(extension)) {
      setSpreadsheetUploadErrors(current => ({
        ...current,
        [meeting.id || meeting._id]: 'Solo puedes subir archivos Excel (.xlsx, .xls o .xlsb).'
      }));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setSpreadsheetUploadErrors(current => ({
        ...current,
        [meeting.id || meeting._id]: 'El archivo supera el límite de 15 MB.'
      }));
      return;
    }

    const meetingId = String(meeting.id || meeting._id);
    setUploadingSpreadsheetMeetingId(meetingId);
    setSpreadsheetUploadErrors(current => ({ ...current, [meetingId]: '' }));
    try {
      await ApiService.uploadEmployeeMeetingSpreadsheet(token, meetingId, file);
      await loadPortal(token);
    } catch (uploadError) {
      setSpreadsheetUploadErrors(current => ({
        ...current,
        [meetingId]: uploadError.message || 'No se pudo subir el Excel. Inténtalo de nuevo.'
      }));
    } finally {
      setUploadingSpreadsheetMeetingId('');
    }
  };

  useEffect(() => {
    const rememberedCompanyId = companyId || sessionStorage.getItem('quorumEmployeeCompanyId');
    if (!rememberedCompanyId) return;
    const savedToken = sessionStorage.getItem(tokenStorageKey(rememberedCompanyId));
    if (!savedToken) return;
    setLoading(true);
    loadPortal(savedToken)
      .then(() => {
        setToken(savedToken);
        setError('');
        sessionStorage.setItem('quorumEmployeeCompanyId', rememberedCompanyId);
      })
      .catch(loadError => {
        if ([401, 403, 404].includes(loadError.status)) {
          sessionStorage.removeItem(tokenStorageKey(rememberedCompanyId));
          if (!companyId) sessionStorage.removeItem('quorumEmployeeCompanyId');
        }
        setError(loadError.message || 'No se pudo cargar tu espacio. Inténtalo de nuevo.');
      })
      .finally(() => setLoading(false));
  }, [companyId, loadPortal]);

  useEffect(() => {
    if (!portal?.profile) return;
    setProfileForm({
      nombre: portal.profile.nombre || '',
      rol: portal.profile.rol || '',
      area: portal.profile.area || '',
      subarea: portal.profile.subarea || '',
      dirigeSubareas: Boolean(portal.profile.dirigeSubareas),
      subareas: (portal.profile.subareas || []).join('\n'),
      esJefeDepartamento: Boolean(portal.profile.esJefeDepartamento),
      esJefeEmpresa: Boolean(portal.profile.esJefeEmpresa),
      jefatura: portal.profile.jefaturaConfirmada
        ? (portal.profile.esJefeEmpresa
          ? 'empresa'
          : portal.profile.esJefeDepartamento ? 'departamento' : 'ninguna')
        : '',
      telefono: portal.profile.telefono || '',
      trabajadoresACargo: portal.profile.trabajadoresACargo || 0
    });
  }, [portal?.profile]);

  const employeeDepartments = portal?.empresa?.departamentos || registrationDepartments;
  const employeeSubareas = portal?.empresa?.subareasPorDepartamento
    || registrationCompany?.subareasPorDepartamento
    || {};
  const subareasForArea = area => {
    const matchingArea = Object.keys(employeeSubareas).find(
      name => name.trim().toLowerCase() === String(area || '').trim().toLowerCase()
    );
    const choices = matchingArea ? employeeSubareas[matchingArea] : [];
    const currentSubarea = portal?.profile?.subarea;
    const currentArea = portal?.profile?.area;
    if (!choices.length && currentSubarea
      && String(currentArea || '').trim().toLowerCase() === String(area || '').trim().toLowerCase()
      && !choices.some(subarea => String(subarea).trim().toLowerCase() === currentSubarea.trim().toLowerCase())) {
      return [...choices, currentSubarea];
    }
    return choices;
  };
  const employeeProfilePayload = form => ({
    ...form,
    esJefeDepartamento: form.jefatura === 'departamento',
    esJefeEmpresa: form.jefatura === 'empresa',
    subareas: form.subareas.split('\n').map(item => item.trim()).filter(Boolean)
  });

  const lookupCompany = async () => {
    setCompanyLookupError('');
    setRegistrationCompany(null);
    setRegistrationDepartments([]);
    setLookingUpCompany(true);
    try {
      const response = await ApiService.getEmployeeCompanyByCode(account.companyCode);
      setRegistrationCompany(response.data);
      setRegistrationDepartments(response.data.departamentos || []);
    } catch (lookupError) {
      setCompanyLookupError(lookupError.message || 'No se pudo encontrar la empresa.');
    } finally {
      setLookingUpCompany(false);
    }
  };

  const submitAccount = async event => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = accessMode === 'register'
        ? await ApiService.registerEmployeeAccount(account)
        : await ApiService.employeeAccountLogin(account.email, account.password);
      sessionStorage.setItem(tokenStorageKey(response.empresaId), response.token);
      sessionStorage.setItem('quorumEmployeeCompanyId', response.empresaId);
      if (accessMode === 'register') {
        setRegistrationDepartments(response.departamentos || []);
        try {
          await ApiService.completeEmployeeProfile(response.token, employeeProfilePayload({
            ...profileForm,
            nombre: account.nombre
          }));
        } catch (profileError) {
          if (String(response.empresaId) !== String(companyId)) {
            window.location.assign(`/empleados/${response.empresaId}`);
            return;
          }
          setToken(response.token);
          await loadPortal(response.token);
          throw profileError;
        }
      }
      if (String(response.empresaId) !== String(companyId)) {
        window.location.assign(`/empleados/${response.empresaId}`);
        return;
      }
      setToken(response.token);
      await loadPortal(response.token);
    } catch (requestError) {
      setError(requestError.message || 'No se pudo procesar la cuenta de empleado.');
      if (requestError.code === 'EMPLOYEE_ACCOUNT_EXISTS') setAccessMode('login');
    } finally {
      setLoading(false);
    }
  };

  const saveEmployeeProfile = async event => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await ApiService.completeEmployeeProfile(token, {
        ...employeeProfilePayload(profileForm)
      });
      await loadPortal(token);
      setEditingProfile(false);
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron guardar los datos faltantes.');
    } finally {
      setLoading(false);
    }
  };

  const leavePortal = () => {
    const activeCompanyId = companyId || sessionStorage.getItem('quorumEmployeeCompanyId');
    if (activeCompanyId) sessionStorage.removeItem(tokenStorageKey(activeCompanyId));
    sessionStorage.removeItem('quorumEmployeeCompanyId');
    setPortal(null);
    setToken('');
  };

  const missingProfileFields = portal?.missingProfileFields || [];
  const profileNeedsCompletion = Boolean(portal?.profile && (!portal.profileComplete || missingProfileFields.length));
  const showProfileForm = profileNeedsCompletion || editingProfile;
  const meetings = portal?.reuniones || [];
  const personalRecords = portal?.reunionesPersonales || [];
  const personalObjectives = portal?.indicadoresPersonales || [];
  const personalMeetings = meetings.filter(meeting => meeting.categoriaEmpleado === 'personal');
  const companyMeetings = meetings.filter(meeting => meeting.categoriaEmpleado !== 'personal');

  const openPersonalMeetingForm = meeting => {
    setPersonalMeetingError('');
    setPersonalMeetingDraft(meeting
      ? {
        id: meeting._id || meeting.id,
        titulo: meeting.titulo || '',
        fecha: meeting.fecha || getTodayLocalDate(),
        hora: meeting.hora || '09:00',
        lugar: meeting.lugar || '',
        notas: meeting.notas || ''
      }
      : {
        id: '',
        titulo: '',
        fecha: getTodayLocalDate(),
        hora: '09:00',
        lugar: '',
        notas: ''
      });
    setShowPersonalMeetingForm(true);
  };

  const savePersonalMeeting = async event => {
    event.preventDefault();
    if (!token) return;
    setSavingPersonalMeeting(true);
    setPersonalMeetingError('');
    const { id, ...meetingData } = personalMeetingDraft;
    try {
      if (id) {
        await ApiService.updateEmployeePersonalMeeting(token, id, meetingData);
      } else {
        await ApiService.createEmployeePersonalMeeting(token, meetingData);
      }
      await loadPortal(token);
      setShowPersonalMeetingForm(false);
    } catch (requestError) {
      setPersonalMeetingError(requestError.message || 'No se pudo guardar la reunión personal. Inténtalo de nuevo.');
    } finally {
      setSavingPersonalMeeting(false);
    }
  };

  const deletePersonalMeeting = async meeting => {
    const id = meeting._id || meeting.id;
    if (!token || !id || !window.confirm(`¿Eliminar "${meeting.titulo}" de tu registro personal?`)) return;
    setSavingPersonalMeeting(true);
    setPersonalMeetingError('');
    try {
      await ApiService.deleteEmployeePersonalMeeting(token, id);
      await loadPortal(token);
    } catch (requestError) {
      setPersonalMeetingError(requestError.message || 'No se pudo eliminar la reunión personal. Inténtalo de nuevo.');
    } finally {
      setSavingPersonalMeeting(false);
    }
  };

  const openPersonalStrategyForm = () => {
    const profile = portal?.profile || {};
    const foda = profile.fodaPersonal || {};
    setPersonalStrategyError('');
    setPersonalStrategyDraft({
      misionPersonal: profile.misionPersonal || '',
      visionPersonal: profile.visionPersonal || '',
      valoresPersonales: (profile.valoresPersonales || []).join('\n'),
      estrategiasPersonales: (profile.estrategiasPersonales || []).join('\n'),
      metasPersonales: (profile.metasPersonales || []).join('\n'),
      fortalezas: (foda.fortalezas || []).join('\n'),
      debilidades: (foda.debilidades || []).join('\n'),
      oportunidades: (foda.oportunidades || []).join('\n'),
      amenazas: (foda.amenazas || []).join('\n'),
      trabajadoresACargo: Number(profile.trabajadoresACargo) || 0
    });
    setShowPersonalStrategyForm(true);
  };

  const savePersonalStrategy = async event => {
    event.preventDefault();
    if (!token) return;
    setSavingPersonalStrategy(true);
    setPersonalStrategyError('');
    const listFromLines = value => value.split('\n').map(item => item.trim()).filter(Boolean);
    const strategy = {
      misionPersonal: personalStrategyDraft.misionPersonal.trim(),
      visionPersonal: personalStrategyDraft.visionPersonal.trim(),
      valoresPersonales: listFromLines(personalStrategyDraft.valoresPersonales),
      estrategiasPersonales: listFromLines(personalStrategyDraft.estrategiasPersonales),
      metasPersonales: listFromLines(personalStrategyDraft.metasPersonales),
      fodaPersonal: {
        fortalezas: listFromLines(personalStrategyDraft.fortalezas),
        debilidades: listFromLines(personalStrategyDraft.debilidades),
        oportunidades: listFromLines(personalStrategyDraft.oportunidades),
        amenazas: listFromLines(personalStrategyDraft.amenazas)
      }
    };
    if (portal.profile.esJefeDepartamento) {
      strategy.trabajadoresACargo = Number(personalStrategyDraft.trabajadoresACargo) || 0;
    }
    try {
      await ApiService.updateEmployeePersonalStrategy(token, strategy);
      await loadPortal(token);
      setShowPersonalStrategyForm(false);
    } catch (requestError) {
      setPersonalStrategyError(requestError.message || 'No se pudo guardar tu información personal. Inténtalo de nuevo.');
    } finally {
      setSavingPersonalStrategy(false);
    }
  };

  const openPersonalObjectiveForm = objective => {
    setPersonalObjectiveError('');
    setPersonalObjectiveDraft(objective
      ? {
        id: objective._id || objective.id,
        nombre: objective.nombre || '',
        descripcion: objective.descripcion || '',
        prioridad: objective.prioridad || 'media',
        progreso: Number(objective.progreso) || 0,
        tasks: (objective.tasks || []).join('\n')
      }
      : { id: '', nombre: '', descripcion: '', prioridad: 'media', progreso: 0, tasks: '' });
    setShowPersonalObjectiveForm(true);
  };

  const savePersonalObjective = async event => {
    event.preventDefault();
    if (!token) return;
    setSavingPersonalObjective(true);
    setPersonalObjectiveError('');
    const { id, ...draft } = personalObjectiveDraft;
    const progreso = Math.min(100, Math.max(0, Number(draft.progreso) || 0));
    const objectiveData = {
      ...draft,
      progreso,
      status: progreso >= 100 ? 'completado' : progreso > 0 ? 'en-progreso' : 'pendiente',
      tasks: draft.tasks.split('\n').map(task => task.trim()).filter(Boolean)
    };
    try {
      if (id) {
        await ApiService.updateEmployeePersonalObjective(token, id, objectiveData);
      } else {
        await ApiService.createEmployeePersonalObjective(token, objectiveData);
      }
      await loadPortal(token);
      setShowPersonalObjectiveForm(false);
    } catch (requestError) {
      setPersonalObjectiveError(requestError.message || 'No se pudo guardar el indicador. Inténtalo de nuevo.');
    } finally {
      setSavingPersonalObjective(false);
    }
  };

  const deletePersonalObjective = async objective => {
    const id = objective._id || objective.id;
    if (!token || !id || !window.confirm(`¿Eliminar "${objective.nombre}" de tu plan personal?`)) return;
    setSavingPersonalObjective(true);
    setPersonalObjectiveError('');
    try {
      await ApiService.deleteEmployeePersonalObjective(token, id);
      await loadPortal(token);
    } catch (requestError) {
      setPersonalObjectiveError(requestError.message || 'No se pudo eliminar el indicador. Inténtalo de nuevo.');
    } finally {
      setSavingPersonalObjective(false);
    }
  };

  const renderPersonalRecord = meeting => (
    <Card key={meeting._id || meeting.id} className="employee-meeting-card employee-personal-record h-100">
      <Card.Body>
        <div className="employee-meeting-topline">
          <div className="employee-meeting-icon"><CalendarDays size={19} /></div>
          <div className="d-flex align-items-center gap-2">
            <Badge bg="secondary">Agregada por ti</Badge>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                aria-label={`Editar ${meeting.titulo}`}
                title="Editar"
                onClick={() => openPersonalMeetingForm(meeting)}
                disabled={savingPersonalMeeting}
              >
                <Pencil size={15} />
              </Button>
              <Button
                variant="outline-danger"
                size="sm"
                aria-label={`Eliminar ${meeting.titulo}`}
                title="Eliminar"
                onClick={() => deletePersonalMeeting(meeting)}
                disabled={savingPersonalMeeting}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
        </div>
        <h3 className="employee-meeting-title">{meeting.titulo}</h3>
        <div className="employee-meeting-details">
          <span><CalendarDays size={15} />{new Date(`${meeting.fecha}T00:00:00`).toLocaleDateString('es-MX', {
            weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
          })}</span>
          <span><Clock3 size={15} />{meeting.hora}</span>
          {meeting.lugar && <span><MapPin size={15} />{meeting.lugar}</span>}
        </div>
        {meeting.notas && <p className="employee-meeting-objective">{meeting.notas}</p>}
      </Card.Body>
    </Card>
  );

  const renderMeeting = meeting => {
    const meetingId = String(meeting._id || meeting.id);
    const employeeArea = String(portal?.profile?.area || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const meetingAreas = (meeting.departamentos || []).map(area =>
      String(area).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    );
    const companyWide = Boolean(meeting.esParaTodos)
      || (!meetingAreas.length && !meeting.empleadosInvitados?.length && meeting.tipoReunion !== 'one-to-one');
    const canUploadSpreadsheet = Boolean(employeeArea)
      && meeting.categoriaEmpleado !== 'personal'
      && (companyWide || meetingAreas.includes(employeeArea));
    return (
    <Card key={meetingId} className="employee-meeting-card h-100">
      <Card.Body>
        <div className="employee-meeting-topline">
          <div className="employee-meeting-icon"><CalendarDays size={19} /></div>
          <div className="d-flex flex-wrap justify-content-end gap-2">
            {meeting.categoriaEmpleado === 'personal' && <Badge bg="info">Invitación personal</Badge>}
            <Badge bg={meeting.status === 'en_curso' ? 'warning' : 'primary'} className="employee-meeting-status">
              {meeting.status === 'en_curso' ? 'En curso' : 'Próxima'}
            </Badge>
          </div>
        </div>
        <h3 className="employee-meeting-title">{meeting.titulo}</h3>
        <div className="employee-meeting-details">
          <span><CalendarDays size={15} />{new Date(`${meeting.fecha}T${meeting.hora || '00:00'}`).toLocaleDateString('es-MX', {
            weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
          })}</span>
          <span><Clock3 size={15} />{meeting.hora}</span>
          {meeting.lugar && <span><MapPin size={15} />{meeting.lugar}</span>}
        </div>
        {meeting.departamentos?.length > 0 && (
          <div className="employee-meeting-area"><BriefcaseBusiness size={15} />{meeting.departamentos.join(', ')}</div>
        )}
        {meeting.objetivo && <p className="employee-meeting-objective">{meeting.objetivo}</p>}
        {(meeting.documentos || []).length > 0 && (
          <div className="employee-meeting-documents">
            {meeting.documentos.map(document => (
              <Button
                key={document._id || document.url}
                as="a"
                href={documentUrl(document)}
                target="_blank"
                rel="noreferrer"
                size="sm"
                variant="outline-primary"
              >
                {String(document.tipo || '').toUpperCase() === 'PDF'
                  ? <>Abrir presentación <ArrowUpRight size={15} /></>
                  : <><FileSpreadsheet size={15} /> {document.nombreArchivo || 'Excel del área'}{document.nombreCargador ? ` · ${document.nombreCargador}` : ''}</>}
              </Button>
            ))}
          </div>
        )}
        {canUploadSpreadsheet && (
          <div className="employee-meeting-documents mt-3">
            <Form.Group className="w-100">
              <Form.Label className="small fw-semibold mb-1">
                <FileSpreadsheet size={15} className="me-1" />
                Subir Excel de {portal.profile.area} (máximo 15 MB)
              </Form.Label>
              <Form.Control
                type="file"
                accept=".xlsx,.xls,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.binary.macroEnabled.12"
                disabled={uploadingSpreadsheetMeetingId === meetingId}
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) uploadMeetingSpreadsheet(meeting, file);
                  event.target.value = '';
                }}
              />
              <Form.Text className="text-muted">
                Puedes cargarlo directamente aquí; no necesitas que lo suba el organizador. Solo se aceptan archivos de Excel.
              </Form.Text>
            </Form.Group>
            {spreadsheetUploadErrors[meetingId] && (
              <Alert variant="danger" className="w-100 mb-0 py-2">{spreadsheetUploadErrors[meetingId]}</Alert>
            )}
            {uploadingSpreadsheetMeetingId === meetingId && (
              <span className="small text-muted" role="status">
                <Spinner size="sm" className="me-2" />Subiendo documento...
              </span>
            )}
          </div>
        )}
        {(meeting.documentos || [])
          .filter(document => ['XLS', 'XLSX', 'XLSB'].includes(String(document.tipo || '').toUpperCase()) && document._id)
          .map(document => (
            <EmployeeSpreadsheetInsights
              key={`insights-${document._id}`}
              token={token}
              meetingId={meetingId}
              document={document}
            />
          ))}
      </Card.Body>
    </Card>
    );
  };

  return (
    <div className={`employee-portal-page ${employeeTheme}-theme ${largeText ? 'employee-large-text' : ''} ${reduceMotion ? 'employee-reduced-motion' : ''}`}>
      <Container className="employee-portal-shell py-4 py-lg-5">
        <header className="employee-portal-header app-navbar">
          <div className="employee-brand-mark" aria-label="Quorum">Q</div>
          <div className="employee-portal-heading">
            <div className="employee-portal-eyebrow">
              <span className="employee-eyebrow-dot" />
              Quorum · Portal de empleados
            </div>
            <h1>Portal de empleados</h1>
            <p>{portal?.empresa?.nombre || 'Reuniones, indicadores e información de tu empresa.'}</p>
          </div>
          <div className="employee-header-actions">
            <Button
              variant="outline-secondary"
              className={`employee-settings-toggle ${showEmployeeSettings ? 'is-active' : ''}`}
              onClick={() => setShowEmployeeSettings(true)}
              aria-expanded={showEmployeeSettings}
              aria-controls="employee-settings"
            >
              <Settings2 size={17} />
              <span>Configuración</span>
            </Button>
            {portal && (
              <>
                {!profileNeedsCompletion && (
                  <Button variant="outline-primary" onClick={() => setEditingProfile(true)}>
                    <UserRound size={16} /><span>Mi perfil</span>
                  </Button>
                )}
                <Button variant="outline-secondary" onClick={leavePortal} aria-label="Cerrar sesión" title="Cerrar sesión">
                  <LogOut size={17} /><span className="d-lg-none">Salir</span>
                </Button>
              </>
            )}
            <Button as="a" href="/" variant="link" className="employee-home-link">Inicio</Button>
          </div>
        </header>

        {portal?.profileComplete && !loading && (
          <>
            <section className="employee-dashboard-hero dashboard-hero mb-3">
              <RisingLines className="dashboard-rising-lines" />
              <div>
                <span className="dashboard-eyebrow">Panel de empleado</span>
                <h1 className="dashboard-title">
                  Hola, {portal.profile.nombre?.trim().split(/\s+/)[0] || 'bienvenido'}
                </h1>
                <p className="dashboard-subtitle mb-0">
                  Consulta tu plan, organiza tus reuniones y mantente al día con {portal.empresa?.nombre || 'tu empresa'}.
                </p>
              </div>
              <div className="dashboard-hero-mark" aria-hidden="true"><span>Q</span></div>
            </section>
            <nav className="employee-portal-nav mb-4" aria-label="Secciones de tu portal">
              <a href="#employee-personal-plan"><Target size={16} />Mi plan</a>
              <a href="#employee-personal-meetings"><CalendarDays size={16} />Mi agenda</a>
              <a href="#employee-company-meetings"><Building2 size={16} />Reuniones de empresa</a>
            </nav>
          </>
        )}

        <Modal
          id="employee-settings"
          show={showEmployeeSettings}
          onHide={() => setShowEmployeeSettings(false)}
          centered
          className="employee-settings-modal"
        >
          <Modal.Header closeButton>
            <div className="employee-settings-copy">
              <div className="employee-settings-icon"><Settings2 size={18} /></div>
              <div>
                <span className="employee-profile-caption">TU ESPACIO</span>
                <Modal.Title>Configuración</Modal.Title>
                <p>Personaliza la lectura y el movimiento. Estos ajustes solo se guardan en este dispositivo.</p>
              </div>
            </div>
          </Modal.Header>
          <Modal.Body>
            <div className="employee-settings-controls">
              <div className="employee-setting-control">
                <span className="employee-setting-label">Tema</span>
                <div className="employee-theme-options" role="group" aria-label="Tema de la página">
                  <button
                    type="button"
                    className={`employee-theme-option ${employeeTheme === 'light' ? 'is-selected' : ''}`}
                    onClick={() => setEmployeeTheme('light')}
                    aria-pressed={employeeTheme === 'light'}
                  >
                    <Sun size={18} /><span>Claro</span>
                  </button>
                  <button
                    type="button"
                    className={`employee-theme-option ${employeeTheme === 'dark' ? 'is-selected' : ''}`}
                    onClick={() => setEmployeeTheme('dark')}
                    aria-pressed={employeeTheme === 'dark'}
                  >
                    <Moon size={18} /><span>Oscuro</span>
                  </button>
                </div>
              </div>
              <div className="employee-setting-control">
                <span className="employee-setting-label">Tamaño del texto</span>
                <div className="employee-theme-options" role="group" aria-label="Tamaño del texto">
                  <button type="button" className={`employee-theme-option ${!largeText ? 'is-selected' : ''}`} onClick={() => setLargeText(false)} aria-pressed={!largeText}>Normal</button>
                  <button type="button" className={`employee-theme-option ${largeText ? 'is-selected' : ''}`} onClick={() => setLargeText(true)} aria-pressed={largeText}>Grande</button>
                </div>
              </div>
              <Form.Check
                className="employee-motion-setting"
                type="switch"
                id="employee-reduced-motion"
                label="Reducir animaciones"
                checked={reduceMotion}
                onChange={event => setReduceMotion(event.target.checked)}
              />
            </div>
          </Modal.Body>
        </Modal>

        {portal?.profileComplete && (
          <Card className="employee-profile-card mb-4">
            <Card.Body className="d-flex flex-wrap align-items-center gap-3">
              <div className="employee-avatar">{getInitials(portal.profile.nombre)}</div>
              <div className="employee-profile-main">
                <span className="employee-profile-caption">Tu cuenta</span>
                <h2>{portal.profile.nombre}</h2>
                <div className="employee-profile-tags">
                  <span><BriefcaseBusiness size={14} />{portal.profile.area || 'Dirección de empresa'}</span>
                  {portal.profile.subarea && <span>{portal.profile.subarea}</span>}
                  <span><UserRound size={14} />{portal.profile.rol === 'directivo' ? 'Directivo' : 'Empleado'}</span>
                </div>
              </div>
              <div className="employee-profile-email">{portal.profile.email}</div>
            </Card.Body>
          </Card>
        )}

        {portal?.profileComplete && (
          <Card className="employee-objectives-card mb-4">
            <Card.Body>
              <div className="employee-section-heading mb-3">
                <div className="employee-section-icon"><Target size={19} /></div>
                <div className="flex-grow-1">
                  <span className="employee-profile-caption">TU PROPÓSITO</span>
                  <h2>Mi propósito y análisis personal</h2>
                  <p>Tu misión, visión y FODA personales; no modifican la información de la empresa.</p>
                </div>
                <Button variant="outline-primary" onClick={openPersonalStrategyForm}>
                  <Pencil size={15} /><span>Editar mi plan</span>
                </Button>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="employee-personal-strategy-block h-100">
                    <h3>Misión personal</h3>
                    <p>{portal.profile.misionPersonal || 'Aún no has escrito tu misión personal.'}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="employee-personal-strategy-block h-100">
                    <h3>Visión personal</h3>
                    <p>{portal.profile.visionPersonal || 'Aún no has escrito tu visión personal.'}</p>
                  </div>
                </div>
                {[
                  ['Valores', portal.profile.valoresPersonales],
                  ['Estrategias', portal.profile.estrategiasPersonales],
                  ['Metas personales', portal.profile.metasPersonales]
                ].map(([label, entries]) => (
                  <div className="col-md-4" key={label}>
                    <div className="employee-personal-strategy-block h-100">
                      <h3>{label}</h3>
                      {entries?.length
                        ? <ul>{entries.map((entry, index) => <li key={`${label}-${index}`}>{entry}</li>)}</ul>
                        : <p className="mb-0">Aún no agregas información.</p>}
                    </div>
                  </div>
                ))}
                <div className="col-12">
                  <div className="employee-personal-strategy-block">
                    <h3>Mi análisis FODA</h3>
                    <div className="row g-3">
                      {[
                        ['Fortalezas', portal.profile.fodaPersonal?.fortalezas],
                        ['Oportunidades', portal.profile.fodaPersonal?.oportunidades],
                        ['Debilidades', portal.profile.fodaPersonal?.debilidades],
                        ['Amenazas', portal.profile.fodaPersonal?.amenazas]
                      ].map(([label, entries]) => (
                        <div className="col-md-3" key={label}>
                          <h4>{label}</h4>
                          {entries?.length
                            ? <ul>{entries.map((entry, index) => <li key={`${label}-${index}`}>{entry}</li>)}</ul>
                            : <p className="small mb-0">Sin datos todavía.</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {portal.profile.esJefeDepartamento && (
                  <div className="col-12">
                    <div className="employee-personal-strategy-block">
                      <h3>Personas a mi cargo</h3>
                      <p className="mb-0"><strong>{portal.profile.trabajadoresACargo || 0}</strong> personas</p>
                    </div>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        )}

        {error && !profileNeedsCompletion && <Alert variant="danger">{error}</Alert>}

        {!portal ? (
          <div className="employee-login-card">
            <RisingLines className="employee-login-rising" />
            <div className="row g-0 align-items-stretch employee-login-layout">
              <div className="col-lg-5 employee-login-intro">
                <div className="employee-login-intro-content">
                  <div className="employee-login-icon"><Building2 size={22} /></div>
                  <span className="employee-profile-caption">QUORUM · EMPLEADOS</span>
                  <h2>Tu trabajo, tus reuniones, en un solo lugar.</h2>
                  <p>Accede a la información que tu empresa comparte contigo y mantente al día con tus reuniones.</p>
                  <div className="employee-login-benefit"><CalendarDays size={17} /><span>Consulta tus próximas reuniones</span></div>
                  <div className="employee-login-benefit"><BriefcaseBusiness size={17} /><span>Revisa información de tu área</span></div>
                  <div className="employee-login-benefit"><UserRound size={17} /><span>Acceso personal y seguro</span></div>
                </div>
              </div>
              <div className="col-lg-7">
                <Card className="employee-auth-card h-100">
              <Card.Body className="p-4 p-xl-5">
                <h2 className="h5">{accessMode === 'register' ? 'Crear cuenta de empleado' : 'Iniciar sesión'}</h2>
                <p className="text-muted small">Cada empleado ingresa con su propia cuenta para consultar sus reuniones.</p>
                {accessMode === 'login' && <Alert variant="info">Ingresa con el correo y la contraseña de tu cuenta de empleado.</Alert>}
                {accessMode === 'register' && (
                  <Alert variant="info">
                    Crea tu cuenta de empleado con el código de invitación y selecciona tu rol, área y responsabilidad de jefatura. Si ya tienes una cuenta organizadora de esta empresa, usa el mismo correo y contraseña.
                  </Alert>
                )}
                <div className="employee-auth-tabs mb-4" role="group" aria-label="Acceso de empleados">
                  <button type="button" aria-pressed={accessMode === 'login'} className={accessMode === 'login' ? 'is-active' : ''} onClick={() => setAccessMode('login')}>Iniciar sesión</button>
                  <button type="button" aria-pressed={accessMode === 'register'} className={accessMode === 'register' ? 'is-active' : ''} onClick={() => setAccessMode('register')}>Crear cuenta</button>
                </div>
                <Form onSubmit={submitAccount}>
                  <div className="mb-3">
                    <PrivacyNotice audience="employee" />
                  </div>
                  {accessMode === 'register' && (
                    <>
                      <Form.Group className="mb-3">
                        <Form.Label>Código de invitación de la empresa</Form.Label>
                        <div className="d-flex gap-2">
                          <Form.Control
                            value={account.companyCode}
                            disabled={lookingUpCompany}
                            onChange={event => {
                              setAccount(current => ({ ...current, companyCode: event.target.value }));
                              setRegistrationCompany(null);
                              setRegistrationDepartments([]);
                              setProfileForm(current => ({ ...current, area: '' }));
                              setCompanyLookupError('');
                            }}
                            required
                          />
                          <Button type="button" variant="outline-primary" onClick={lookupCompany} disabled={!account.companyCode.trim() || lookingUpCompany}>
                            {lookingUpCompany ? <Spinner size="sm" /> : 'Buscar'}
                          </Button>
                        </div>
                        {registrationCompany && (
                          <Form.Text className="text-success d-block">
                            Empresa encontrada: {registrationCompany.nombre}
                          </Form.Text>
                        )}
                        {companyLookupError && <Form.Text className="text-danger d-block">{companyLookupError}</Form.Text>}
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Nombre completo</Form.Label>
                        <Form.Control value={account.nombre} onChange={event => setAccount(current => ({ ...current, nombre: event.target.value }))} required />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>¿Cuál es tu puesto?</Form.Label>
                        <Form.Select
                          value={profileForm.rol}
                          onChange={event => setProfileForm(current => ({ ...current, rol: event.target.value }))}
                          required
                        >
                          <option value="">Selecciona tu puesto</option>
                          <option value="trabajador">Empleado / trabajador</option>
                          <option value="directivo">Directivo</option>
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Área o departamento</Form.Label>
                        <Form.Select
                          value={profileForm.area}
                          onChange={event => setProfileForm(current => ({ ...current, area: event.target.value, subarea: '' }))}
                          required={profileForm.jefatura !== 'empresa'}
                        >
                          <option value="">
                            {profileForm.jefatura === 'empresa' ? 'Dirección de empresa (sin área específica)' : 'Selecciona tu área'}
                          </option>
                          {employeeDepartments.map(area => <option key={area} value={area}>{area}</option>)}
                        </Form.Select>
                        {!employeeDepartments.length && (
                          <Form.Text className="text-danger">
                            La empresa aún no tiene áreas registradas. El organizador debe agregarlas antes del registro.
                          </Form.Text>
                        )}
                      </Form.Group>
                      {profileForm.jefatura !== 'empresa' && (
                        <Form.Group className="mb-3">
                          <Form.Label>Subárea (si perteneces a una)</Form.Label>
                          <Form.Select
                            value={profileForm.subarea}
                            onChange={event => setProfileForm(current => ({ ...current, subarea: event.target.value }))}
                            disabled={!profileForm.area}
                          >
                            <option value="">No pertenezco a una subárea</option>
                            {subareasForArea(profileForm.area).map(subarea => (
                              <option key={subarea} value={subarea}>{subarea}</option>
                            ))}
                          </Form.Select>
                          {profileForm.area && !subareasForArea(profileForm.area).length && (
                            <Form.Text className="text-muted">
                              Si tu área tiene subáreas, su responsable debe registrarlas primero.
                            </Form.Text>
                          )}
                        </Form.Group>
                      )}
                      <Form.Group className="mb-3">
                        <Form.Label>¿Tienes una responsabilidad de jefatura?</Form.Label>
                        <Form.Select
                          value={profileForm.jefatura}
                          onChange={event => setProfileForm(current => ({
                            ...current,
                            jefatura: event.target.value,
                            rol: event.target.value === 'ninguna' ? current.rol : 'directivo'
                          }))}
                          required
                        >
                          <option value="">Selecciona una opción</option>
                          <option value="ninguna">No soy jefe</option>
                          <option value="departamento">Sí, soy jefe de departamento</option>
                          <option value="empresa">Sí, soy jefe de la empresa</option>
                        </Form.Select>
                      </Form.Group>
                      {profileForm.rol === 'directivo' && (
                        <>
                          <Form.Group className="mb-3">
                            <Form.Label>Teléfono de contacto (opcional)</Form.Label>
                            <Form.Control
                              value={profileForm.telefono}
                              onChange={event => setProfileForm(current => ({ ...current, telefono: event.target.value }))}
                            />
                          </Form.Group>
                          <Form.Group className="mb-3">
                            <Form.Label>Trabajadores a cargo (opcional)</Form.Label>
                            <Form.Control
                              type="number"
                              min="0"
                              value={profileForm.trabajadoresACargo}
                              onChange={event => setProfileForm(current => ({ ...current, trabajadoresACargo: Number(event.target.value) || 0 }))}
                            />
                          </Form.Group>
                          <Form.Check
                            className="mb-3"
                            label="También dirijo subáreas"
                            checked={profileForm.dirigeSubareas}
                            onChange={event => setProfileForm(current => ({ ...current, dirigeSubareas: event.target.checked }))}
                          />
                          {profileForm.dirigeSubareas && (
                            <Form.Group className="mb-3">
                              <Form.Label>Subáreas a mi cargo (una por línea)</Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                value={profileForm.subareas}
                                onChange={event => setProfileForm(current => ({ ...current, subareas: event.target.value }))}
                                required={profileForm.dirigeSubareas}
                              />
                              <Form.Text className="text-muted">
                                Estas subáreas quedarán disponibles para que los empleados indiquen a cuál pertenecen.
                              </Form.Text>
                            </Form.Group>
                          )}
                        </>
                      )}
                    </>
                  )}
                  <Form.Group className="mb-3">
                    <Form.Label>Correo electrónico</Form.Label>
                    <Form.Control type="email" autoComplete="email" value={account.email} onChange={event => setAccount(current => ({ ...current, email: event.target.value }))} required />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Contraseña</Form.Label>
                    <Form.Control type="password" autoComplete={accessMode === 'register' ? 'new-password' : 'current-password'} minLength={8} value={account.password} onChange={event => setAccount(current => ({ ...current, password: event.target.value }))} required />
                  </Form.Group>
                  <Button
                    type="submit"
                    disabled={loading || (accessMode === 'register' && !registrationCompany)}
                    className="w-100"
                  >
                    {loading ? <><Spinner size="sm" className="me-2" />Procesando...</> : accessMode === 'register' ? 'Crear cuenta' : 'Entrar'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
              </div>
            </div>
          </div>
        ) : loading ? (
          <Card className="employee-loading-card">
            <Card.Body className="text-center py-5">
              <Spinner animation="border" role="status" />
              <div className="mt-3 fw-semibold">Preparando tu espacio</div>
              <div className="small text-muted mt-1">Estamos cargando tus reuniones e información.</div>
            </Card.Body>
          </Card>
        ) : (
          <>
            {portal.profile?.rol === 'directivo' && portal.indicadoresArea?.length > 0 && (
              <Card className="employee-objectives-card mb-4">
                <Card.Body>
                  <div className="employee-section-heading mb-3">
                    <div className="employee-section-icon"><BriefcaseBusiness size={19} /></div>
                    <div>
                      <span className="employee-profile-caption">SEGUIMIENTO</span>
                      <h2>{portal.profile.esJefeEmpresa ? 'Indicadores y objetivos de la empresa' : 'Indicadores y objetivos de tus áreas'}</h2>
                    </div>
                  </div>
                  <div className="row g-3">
                    {portal.indicadoresArea.map(objective => (
                      <div className="col-lg-6" key={objective._id || objective.id}>
                        <div className="border rounded p-3 h-100">
                          <div className="d-flex justify-content-between gap-2">
                            <strong>{objective.nombre}</strong>
                            <span className="fw-semibold">{objective.progreso || 0}%</span>
                          </div>
                          <div className="small text-muted mt-1">
                            {(objective.tipoArea === 'general' ? ['Toda la empresa'] : objective.areasInvolucradas || []).join(', ')}
                          </div>
                          <div className="progress mt-2" role="progressbar" aria-valuenow={objective.progreso || 0} aria-valuemin="0" aria-valuemax="100">
                            <div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, Number(objective.progreso) || 0))}%` }} />
                          </div>
                          {objective.descripcion && <p className="small text-muted mb-0 mt-2">{objective.descripcion}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            )}

            {(portal.profile?.esJefeDepartamento || portal.profile?.esJefeEmpresa)
              && (
                <Card className="employee-objectives-card mb-4">
                  <Card.Body>
                    <div className="employee-section-heading mb-3">
                      <div className="employee-section-icon"><BriefcaseBusiness size={19} /></div>
                      <div>
                        <span className="employee-profile-caption">SEGUIMIENTO DEL EQUIPO</span>
                        <h2>{portal.profile.esJefeEmpresa ? 'Indicadores personales de la empresa' : 'Indicadores personales de mi departamento'}</h2>
                        <p className="mb-0">Los indicadores que cada persona agrega a su plan también están disponibles aquí.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline-primary"
                        size="sm"
                        className="ms-auto"
                        onClick={refreshPortal}
                        disabled={refreshingPortal}
                        aria-label="Actualizar indicadores del equipo"
                      >
                        {refreshingPortal
                          ? <><Spinner size="sm" className="me-2" />Actualizando...</>
                          : <><RefreshCw size={15} className="me-2" />Actualizar</>}
                      </Button>
                    </div>
                    {portal.indicadoresEquipo?.length ? (
                      <div className="d-flex flex-column gap-3">
                        {portal.indicadoresEquipo.map(employee => (
                          <div key={employee.empleadoId} className="border rounded p-3">
                            <h3 className="h6 mb-3">
                              {employee.nombre || 'Empleado'}
                              <span className="small text-muted fw-normal ms-2">{employee.area}</span>
                            </h3>
                            <div className="row g-3">
                              {employee.indicadores.map(objective => {
                                const progress = Math.min(100, Math.max(0, Number(objective.progreso) || 0));
                                return (
                                  <div className="col-lg-6" key={objective._id || objective.id}>
                                    <div className="border rounded p-3 h-100">
                                      <div className="d-flex justify-content-between gap-2">
                                        <strong>{objective.nombre}</strong>
                                        <span className="fw-semibold">{progress}%</span>
                                      </div>
                                      <div className="progress mt-2" role="progressbar" aria-label={`Avance de ${objective.nombre}`} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                                        <div className="progress-bar" style={{ width: `${progress}%` }} />
                                      </div>
                                      {objective.descripcion && <p className="small text-muted mb-0 mt-2">{objective.descripcion}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="small text-muted mb-0">Aún no hay indicadores personales de otras personas en tu ámbito.</p>
                    )}
                  </Card.Body>
                </Card>
              )}

            <section id="employee-personal-plan" className="employee-meetings-section mb-4">
              <div className="employee-section-heading mb-3">
                <div className="employee-section-icon employee-section-icon-personal"><Target size={19} /></div>
                <div className="flex-grow-1">
                  <span className="employee-profile-caption">OBJETIVOS Y AVANCE</span>
                  <h2>Mi plan estratégico</h2>
                  <p>Indicadores de tu plan vinculados a {portal.profile.area || 'tu departamento'}.</p>
                </div>
                <Button
                  variant="primary"
                  className="employee-add-meeting-button"
                  onClick={() => openPersonalObjectiveForm()}
                  disabled={savingPersonalObjective}
                >
                  <Plus size={17} /><span>Agregar indicador</span>
                </Button>
              </div>
              {personalObjectiveError && <Alert variant="danger">{personalObjectiveError}</Alert>}
              <ProductivityGraph
                objetivos={personalObjectives}
                scopeLabel={`Mi plan personal · ${portal.profile.area || 'Mi departamento'}`}
              />
              {personalObjectives.length ? (
                <>
                  <div className="employee-plan-stats mb-3" aria-label="Resumen de mi plan estratégico">
                    <div><strong>{personalObjectives.length}</strong><span>Indicadores</span></div>
                    <div><strong>{personalObjectives.filter(objective => Number(objective.progreso) >= 100).length}</strong><span>Completados</span></div>
                    <div>
                      <strong>{Math.round(personalObjectives.reduce((total, objective) => total + (Number(objective.progreso) || 0), 0) / personalObjectives.length)}%</strong>
                      <span>Avance promedio</span>
                    </div>
                  </div>
                  <div className="row g-3">
                    {personalObjectives.map(objective => {
                      const objectiveId = objective._id || objective.id;
                      const progress = Math.min(100, Math.max(0, Number(objective.progreso) || 0));
                      return (
                        <div className="col-lg-6" key={objectiveId}>
                          <Card className="employee-objectives-card h-100">
                            <Card.Body>
                              <div className="d-flex align-items-start justify-content-between gap-3">
                                <div>
                                  <span className="employee-profile-caption">{objective.area || portal.profile.area}</span>
                                  <h3 className="h6 mt-1 mb-1">{objective.nombre}</h3>
                                  <div className="small text-muted">
                                    {`Indicador compartido · Prioridad ${objective.prioridad || 'media'}`}
                                  </div>
                                </div>
                                <div className="d-flex gap-2">
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    aria-label={`Actualizar avance de ${objective.nombre}`}
                                    title="Editar indicador"
                                    onClick={() => openPersonalObjectiveForm(objective)}
                                    disabled={savingPersonalObjective}
                                  >
                                    <Pencil size={15} />
                                  </Button>
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    aria-label={`Eliminar ${objective.nombre}`}
                                    title="Eliminar"
                                    onClick={() => deletePersonalObjective(objective)}
                                    disabled={savingPersonalObjective}
                                  >
                                    <Trash2 size={15} />
                                  </Button>
                                </div>
                              </div>
                              <div className="d-flex justify-content-between small mt-3">
                                <span>Avance</span><strong>{progress}%</strong>
                              </div>
                              <div className="progress mt-2" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                                <div className="progress-bar" style={{ width: `${progress}%` }} />
                              </div>
                              {objective.descripcion && <p className="small text-muted mb-0 mt-3">{objective.descripcion}</p>}
                              {objective.tasks?.length > 0 && (
                                <ul className="small text-muted mt-2 mb-0">
                                  {objective.tasks.map((task, index) => <li key={`${objectiveId}-task-${index}`}>{task}</li>)}
                                </ul>
                              )}
                            </Card.Body>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="employee-empty-state">
                  <div className="employee-empty-icon"><Target size={21} /></div>
                  <div><strong>Tu plan está listo para comenzar</strong><p>Agrega un indicador propio o consulta aquí los que te asigne la organización.</p></div>
                </div>
              )}
            </section>

            <section id="employee-personal-meetings" className="employee-meetings-section mb-4">
              <div className="employee-section-heading mb-3">
                <div className="employee-section-icon employee-section-icon-personal"><CalendarDays size={19} /></div>
                <div className="flex-grow-1">
                  <span className="employee-profile-caption">MI AGENDA PERSONAL</span>
                  <h2>Reuniones personales</h2>
                  <p>Consulta tus registros y las invitaciones personales que recibes.</p>
                </div>
                <Button
                  variant="primary"
                  className="employee-add-meeting-button"
                  onClick={() => openPersonalMeetingForm()}
                  disabled={savingPersonalMeeting}
                >
                  <Plus size={17} /><span>Agregar reunión</span>
                </Button>
                <Badge bg="secondary" className="employee-count-badge">{personalRecords.length + personalMeetings.length}</Badge>
              </div>
              {personalMeetingError && <Alert variant="danger">{personalMeetingError}</Alert>}
              {personalRecords.length || personalMeetings.length ? (
                <div className="row g-3">
                  {personalRecords.map(renderPersonalRecord)}
                  {personalMeetings.map(renderMeeting)}
                </div>
              ) : (
                <div className="employee-empty-state">
                  <div className="employee-empty-icon"><CalendarDays size={21} /></div>
                  <div><strong>Aún no tienes reuniones personales</strong><p>Agrega una a tu registro o aparecerá aquí cuando recibas una invitación personal.</p></div>
                </div>
              )}
            </section>

            <section id="employee-company-meetings" className="employee-meetings-section mb-4">
              <div className="employee-section-heading mb-3">
                <div className="employee-section-icon"><Building2 size={19} /></div>
                <div className="flex-grow-1">
                  <span className="employee-profile-caption">AGENDA</span>
                  <h2>Reuniones de la empresa</h2>
                  <p>Próximas reuniones de tu área y de toda la empresa.</p>
                </div>
                <Badge bg="primary" className="employee-count-badge">{companyMeetings.length}</Badge>
              </div>
              {companyMeetings.length ? (
                <div className="row g-3">{companyMeetings.map(renderMeeting)}</div>
              ) : (
                <div className="employee-empty-state">
                  <div className="employee-empty-icon"><CalendarDays size={21} /></div>
                  <div><strong>Todo al día</strong><p>No tienes reuniones próximas de empresa.</p></div>
                </div>
              )}
            </section>

          </>
        )}

        <Modal
          show={showPersonalMeetingForm}
          onHide={() => {
            if (!savingPersonalMeeting) setShowPersonalMeetingForm(false);
          }}
          centered
          className="employee-personal-meeting-modal"
        >
          <Form onSubmit={savePersonalMeeting}>
            <Modal.Header closeButton>
              <div>
                <span className="employee-profile-caption">MI REGISTRO PERSONAL</span>
                <Modal.Title className="mt-1">{personalMeetingDraft.id ? 'Editar reunión' : 'Agregar reunión'}</Modal.Title>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Alert variant="info" className="small">
                Esta reunión solo aparecerá en tu registro personal. No se enviarán invitaciones ni se agregará al calendario de la empresa.
              </Alert>
              {personalMeetingError && <Alert variant="danger">{personalMeetingError}</Alert>}
              <Form.Group className="mb-3">
                <Form.Label>Nombre de la reunión</Form.Label>
                <Form.Control
                  autoFocus
                  maxLength={160}
                  value={personalMeetingDraft.titulo}
                  onChange={event => setPersonalMeetingDraft(current => ({ ...current, titulo: event.target.value }))}
                  placeholder="Ejemplo: Revisión de pendientes"
                  required
                  minLength={2}
                />
              </Form.Group>
              <div className="row g-3">
                <Form.Group className="col-md-7 mb-3">
                  <Form.Label>Fecha</Form.Label>
                  <Form.Control
                    type="date"
                    value={personalMeetingDraft.fecha}
                    onChange={event => setPersonalMeetingDraft(current => ({ ...current, fecha: event.target.value }))}
                    required
                  />
                </Form.Group>
                <Form.Group className="col-md-5 mb-3">
                  <Form.Label>Hora</Form.Label>
                  <Form.Control
                    type="time"
                    value={personalMeetingDraft.hora}
                    onChange={event => setPersonalMeetingDraft(current => ({ ...current, hora: event.target.value }))}
                    required
                  />
                </Form.Group>
              </div>
              <Form.Group className="mb-3">
                <Form.Label>Lugar <span className="text-muted">(opcional)</span></Form.Label>
                <Form.Control
                  maxLength={200}
                  value={personalMeetingDraft.lugar}
                  onChange={event => setPersonalMeetingDraft(current => ({ ...current, lugar: event.target.value }))}
                  placeholder="Sala, oficina o enlace"
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Notas <span className="text-muted">(opcional)</span></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  maxLength={3000}
                  value={personalMeetingDraft.notas}
                  onChange={event => setPersonalMeetingDraft(current => ({ ...current, notas: event.target.value }))}
                  placeholder="Anota el objetivo, temas o recordatorios"
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                variant="outline-secondary"
                onClick={() => setShowPersonalMeetingForm(false)}
                disabled={savingPersonalMeeting}
              >
                <X size={16} /> Cancelar
              </Button>
              <Button type="submit" disabled={savingPersonalMeeting}>
                {savingPersonalMeeting
                  ? 'Guardando...'
                  : personalMeetingDraft.id ? 'Guardar cambios' : 'Guardar en mi registro'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        <Modal
          show={showPersonalObjectiveForm}
          onHide={() => {
            if (!savingPersonalObjective) setShowPersonalObjectiveForm(false);
          }}
          centered
          className="employee-personal-meeting-modal"
        >
          <Form onSubmit={savePersonalObjective}>
            <Modal.Header closeButton>
              <div>
                <span className="employee-profile-caption">MI PLAN ESTRATÉGICO · {portal?.profile?.area || 'MI DEPARTAMENTO'}</span>
                <Modal.Title className="mt-1">
                  {personalObjectiveDraft.id ? 'Actualizar indicador' : 'Nuevo indicador personal'}
                </Modal.Title>
              </div>
            </Modal.Header>
            <Modal.Body>
              {personalObjectiveError && <Alert variant="danger">{personalObjectiveError}</Alert>}
              <Form.Group className="mb-3">
                <Form.Label>Nombre del indicador</Form.Label>
                <Form.Control
                  autoFocus
                  maxLength={160}
                  minLength={2}
                  required
                  value={personalObjectiveDraft.nombre}
                  onChange={event => setPersonalObjectiveDraft(current => ({ ...current, nombre: event.target.value }))}
                  placeholder="Ejemplo: Completar reportes mensuales"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Descripción <span className="text-muted">(opcional)</span></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  maxLength={1000}
                  value={personalObjectiveDraft.descripcion}
                  onChange={event => setPersonalObjectiveDraft(current => ({ ...current, descripcion: event.target.value }))}
                />
              </Form.Group>
              <div className="row g-3">
                <Form.Group className="col-md-6 mb-3">
                  <Form.Label>Prioridad</Form.Label>
                  <Form.Select
                    value={personalObjectiveDraft.prioridad}
                    onChange={event => setPersonalObjectiveDraft(current => ({ ...current, prioridad: event.target.value }))}
                  >
                    <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="col-md-6 mb-3">
                  <Form.Label>Avance: {personalObjectiveDraft.progreso}%</Form.Label>
                  <Form.Range
                    min="0"
                    max="100"
                    step="5"
                    value={personalObjectiveDraft.progreso}
                    onChange={event => setPersonalObjectiveDraft(current => ({ ...current, progreso: Number(event.target.value) }))}
                  />
                </Form.Group>
              </div>
              <Form.Group>
                <Form.Label>Pasos a seguir <span className="text-muted">(uno por línea, opcional)</span></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  maxLength={6000}
                  value={personalObjectiveDraft.tasks}
                  onChange={event => setPersonalObjectiveDraft(current => ({ ...current, tasks: event.target.value }))}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button type="button" variant="outline-secondary" onClick={() => setShowPersonalObjectiveForm(false)} disabled={savingPersonalObjective}>
                <X size={16} /> Cancelar
              </Button>
              <Button type="submit" disabled={savingPersonalObjective}>
                {savingPersonalObjective ? 'Guardando...' : 'Guardar indicador'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        <Modal
          show={showPersonalStrategyForm}
          onHide={() => {
            if (!savingPersonalStrategy) setShowPersonalStrategyForm(false);
          }}
          centered
          size="lg"
          scrollable
          className="employee-personal-meeting-modal"
        >
          <Form onSubmit={savePersonalStrategy}>
            <Modal.Header closeButton>
              <div>
                <span className="employee-profile-caption">MI PLAN PERSONAL</span>
                <Modal.Title className="mt-1">Misión, visión y FODA</Modal.Title>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Alert variant="info">
                Este plan es tuyo. No cambia la información estratégica de la empresa.
              </Alert>
              {personalStrategyError && <Alert variant="danger">{personalStrategyError}</Alert>}
              <div className="row g-3">
                <Form.Group className="col-md-6">
                  <Form.Label>Mi misión</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    maxLength={3000}
                    value={personalStrategyDraft.misionPersonal}
                    onChange={event => setPersonalStrategyDraft(current => ({ ...current, misionPersonal: event.target.value }))}
                    placeholder="¿Qué propósito guía tu trabajo?"
                  />
                </Form.Group>
                <Form.Group className="col-md-6">
                  <Form.Label>Mi visión</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    maxLength={3000}
                    value={personalStrategyDraft.visionPersonal}
                    onChange={event => setPersonalStrategyDraft(current => ({ ...current, visionPersonal: event.target.value }))}
                    placeholder="¿Qué quieres lograr a futuro?"
                  />
                </Form.Group>
                {[
                  ['valoresPersonales', 'Mis valores'],
                  ['estrategiasPersonales', 'Mis estrategias'],
                  ['metasPersonales', 'Mis metas']
                ].map(([field, label]) => (
                  <Form.Group className="col-md-4" key={field}>
                    <Form.Label>{label} <span className="text-muted">(uno por línea)</span></Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      maxLength={6000}
                      value={personalStrategyDraft[field]}
                      onChange={event => setPersonalStrategyDraft(current => ({ ...current, [field]: event.target.value }))}
                    />
                  </Form.Group>
                ))}
                <div className="col-12"><h3 className="h6 mb-0">Mi análisis FODA</h3></div>
                {[
                  ['fortalezas', 'Fortalezas'],
                  ['debilidades', 'Debilidades'],
                  ['oportunidades', 'Oportunidades'],
                  ['amenazas', 'Amenazas']
                ].map(([field, label]) => (
                  <Form.Group className="col-md-6" key={field}>
                    <Form.Label>{label} <span className="text-muted">(uno por línea)</span></Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      maxLength={6000}
                      value={personalStrategyDraft[field]}
                      onChange={event => setPersonalStrategyDraft(current => ({ ...current, [field]: event.target.value }))}
                    />
                  </Form.Group>
                ))}
                {portal?.profile?.esJefeDepartamento && (
                  <Form.Group className="col-md-6">
                    <Form.Label>Personas a mi cargo</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      value={personalStrategyDraft.trabajadoresACargo}
                      onChange={event => setPersonalStrategyDraft(current => ({
                        ...current,
                        trabajadoresACargo: Number(event.target.value) || 0
                      }))}
                    />
                  </Form.Group>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button type="button" variant="outline-secondary" onClick={() => setShowPersonalStrategyForm(false)} disabled={savingPersonalStrategy}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingPersonalStrategy}>
                {savingPersonalStrategy ? 'Guardando...' : 'Guardar mi plan'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        <Modal
          show={Boolean(portal && showProfileForm)}
          centered
          backdrop={profileNeedsCompletion ? 'static' : true}
          keyboard={!profileNeedsCompletion}
          onHide={() => setEditingProfile(false)}
        >
          <Modal.Header>
            <Modal.Title>{profileNeedsCompletion ? 'Completa tu perfil para continuar' : 'Editar mis datos'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {profileNeedsCompletion ? (
              <Alert variant="warning">
                <strong>Falta completar información de tu cuenta.</strong>
                <div className="mt-1">
                  Para continuar, completa: {missingProfileFields.length
                    ? missingProfileFields.join(', ')
                    : 'los datos de tu puesto, área y responsabilidad de jefatura'}.
                </div>
              </Alert>
            ) : (
              <p className="text-muted">
                Tu cuenta está vinculada a {portal?.empresa?.nombre}. Actualiza los datos que necesites.
              </p>
            )}
            {profileNeedsCompletion && (
              <p className="text-muted">
                Completa los campos pendientes para consultar tus reuniones y la información correspondiente a tu área.
              </p>
            )}
            {error && <Alert variant="danger">{error}</Alert>}
            <Form id="employee-profile-form" onSubmit={saveEmployeeProfile}>
              <Form.Group className="mb-3">
                <Form.Label>Nombre completo</Form.Label>
                <Form.Control value={profileForm.nombre || portal?.profile?.nombre || ''} onChange={event => setProfileForm(current => ({ ...current, nombre: event.target.value }))} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Rol</Form.Label>
                <Form.Select value={profileForm.rol} onChange={event => setProfileForm(current => ({ ...current, rol: event.target.value }))} required>
                  <option value="">Selecciona tu rol</option>
                  <option value="trabajador">Trabajador</option>
                  <option value="directivo">Directivo</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Área o departamento</Form.Label>
                <Form.Select value={profileForm.area} onChange={event => setProfileForm(current => ({ ...current, area: event.target.value, subarea: '' }))} required={profileForm.jefatura !== 'empresa'}>
                  <option value="">{profileForm.jefatura === 'empresa' ? 'Dirección de empresa (sin área específica)' : 'Selecciona tu área'}</option>
                  {employeeDepartments.map(area => <option key={area} value={area}>{area}</option>)}
                </Form.Select>
              </Form.Group>
              {profileForm.jefatura !== 'empresa' && (
                <Form.Group className="mb-3">
                  <Form.Label>Subárea (si perteneces a una)</Form.Label>
                  <Form.Select
                    value={profileForm.subarea}
                    onChange={event => setProfileForm(current => ({ ...current, subarea: event.target.value }))}
                    disabled={!profileForm.area}
                  >
                    <option value="">No pertenezco a una subárea</option>
                    {subareasForArea(profileForm.area).map(subarea => (
                      <option key={subarea} value={subarea}>{subarea}</option>
                    ))}
                  </Form.Select>
                  {profileForm.area && !subareasForArea(profileForm.area).length && (
                    <Form.Text className="text-muted">Si tu área tiene subáreas, su responsable debe registrarlas primero.</Form.Text>
                  )}
                </Form.Group>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Responsabilidad de jefatura</Form.Label>
                <Form.Select
                  value={profileForm.jefatura}
                  onChange={event => setProfileForm(current => ({
                    ...current,
                    jefatura: event.target.value,
                    rol: ['departamento', 'empresa'].includes(event.target.value) ? 'directivo' : current.rol
                  }))}
                  required
                >
                  <option value="">Selecciona una opción</option>
                  <option value="ninguna">No soy jefe</option>
                  <option value="departamento">Soy jefe de un departamento</option>
                  <option value="empresa">Soy jefe de la empresa</option>
                </Form.Select>
              </Form.Group>
              {profileForm.rol === 'directivo' && (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label>Teléfono de contacto (opcional)</Form.Label>
                    <Form.Control value={profileForm.telefono} onChange={event => setProfileForm(current => ({ ...current, telefono: event.target.value }))} />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Trabajadores a cargo (opcional)</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={profileForm.trabajadoresACargo}
                      onChange={event => setProfileForm(current => ({ ...current, trabajadoresACargo: Number(event.target.value) || 0 }))}
                    />
                  </Form.Group>
                  <Form.Check className="mb-3" label="También dirijo subáreas" checked={profileForm.dirigeSubareas} onChange={event => setProfileForm(current => ({ ...current, dirigeSubareas: event.target.checked }))} />
                  {profileForm.dirigeSubareas && (
                    <Form.Group className="mb-3">
                      <Form.Label>Subáreas a mi cargo (una por línea)</Form.Label>
                      <Form.Control as="textarea" rows={3} value={profileForm.subareas} onChange={event => setProfileForm(current => ({ ...current, subareas: event.target.value }))} required />
                    </Form.Group>
                  )}
                </>
              )}
              {!employeeDepartments.length && profileForm.jefatura !== 'empresa' && (
                <div className="small text-danger">La empresa no tiene áreas registradas; solicita al organizador que las agregue.</div>
              )}
            </Form>
          </Modal.Body>
          <Modal.Footer>
            {editingProfile && !profileNeedsCompletion && (
              <Button type="button" variant="secondary" onClick={() => setEditingProfile(false)} disabled={loading}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              form="employee-profile-form"
              disabled={loading || (!employeeDepartments.length && profileForm.jefatura !== 'empresa')}
            >
              {loading ? 'Guardando...' : profileNeedsCompletion ? 'Guardar y continuar' : 'Guardar cambios'}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default EmployeePortal;
