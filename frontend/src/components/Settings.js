import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Card, Form, Button, Row, Col, Spinner, Modal } from 'react-bootstrap';
import CompanyInfo from './CompanyInfo';
import ApiService from '../services/apiService';

const getDepartmentSubareas = (directivos = [], department = '', currentSubarea = '') => {
  const normalizedDepartment = String(department).trim().toLowerCase();
  const subareas = directivos
    .filter(directivo => String(directivo.area || '').trim().toLowerCase() === normalizedDepartment)
    .flatMap(directivo => directivo.subareas || []);
  const choices = [...new Set(subareas.map(area => String(area).trim()).filter(Boolean))];
  if (!choices.length && currentSubarea) {
    choices.push(currentSubarea);
  }
  return choices;
};

const getDirectorAssignedAreas = (directivos = [], excludedEmail = '') => {
  const excluded = String(excludedEmail || '').trim().toLowerCase();
  return new Set(directivos
    .filter(directivo => String(directivo.email || '').trim().toLowerCase() !== excluded)
    .flatMap(directivo => [directivo.area, ...(directivo.areasACargo || [])])
    .map(area => String(area || '').trim().toLowerCase())
    .filter(Boolean));
};

const Settings = ({
  companyData,
  setCompanyData,
  fodaData,
  setFodaData,
  onLogout,
  interfacePreferences,
  updateInterfacePreferences,
  meetingPreferences,
  updateMeetingPreferences,
  documentPreferences,
  updateDocumentPreferences,
  section = 'configuracion'
}) => {
  const [editingEmployeeId, setEditingEmployeeId] = useState('');
  const [employeeDraft, setEmployeeDraft] = useState(null);
  const [employeeMessage, setEmployeeMessage] = useState('');
  const [employeeMessageIsError, setEmployeeMessageIsError] = useState(false);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState('');
  const [managingObjectivesEmployee, setManagingObjectivesEmployee] = useState(null);
  const [managedObjectives, setManagedObjectives] = useState([]);
  const [managedObjectiveDraft, setManagedObjectiveDraft] = useState({
    id: '', nombre: '', descripcion: '', prioridad: 'media', progreso: 0, tasks: ''
  });
  const [managedObjectiveError, setManagedObjectiveError] = useState('');
  const [loadingManagedObjectives, setLoadingManagedObjectives] = useState(false);
  const [savingManagedObjective, setSavingManagedObjective] = useState(false);
  const [deletingManagedObjectiveId, setDeletingManagedObjectiveId] = useState('');
  const [newEmployee, setNewEmployee] = useState({
    nombre: '', email: '', rol: 'trabajador', area: '', subarea: '',
    areasACargo: [],
    password: '', telefono: '', trabajadoresACargo: 0, esJefeEmpresa: false,
    dirigeSubareas: false, subareas: []
  });
  const [inviteCodeError, setInviteCodeError] = useState('');
  const [inviteCodeMessage, setInviteCodeMessage] = useState('');
  const [generatingInviteCode, setGeneratingInviteCode] = useState(false);
  const inviteCodeAttemptedFor = useRef('');
  const [smtpForm, setSmtpForm] = useState({ provider: 'gmail', email: '', password: '' });
  const [smtpError, setSmtpError] = useState('');
  const [smtpMessage, setSmtpMessage] = useState('');
  const [savingSmtp, setSavingSmtp] = useState(false);

  useEffect(() => {
    setSmtpForm(current => ({
      ...current,
      provider: companyData?.smtpConvocatorias?.provider || current.provider || 'gmail',
      email: companyData?.smtpConvocatorias?.email || current.email || '',
      password: ''
    }));
  }, [companyData?.smtpConvocatorias?.email, companyData?.smtpConvocatorias?.provider]);

  const generateInviteCode = useCallback(async () => {
    setInviteCodeError('');
    setInviteCodeMessage('');
    setGeneratingInviteCode(true);
    try {
      const response = await ApiService.generateCompanyInviteCode();
      setCompanyData(current => ({
        ...current,
        codigoInvitacion: response.data.codigoInvitacion
      }));
    } catch (error) {
      setInviteCodeError(error.message || 'No se pudo generar el código de invitación.');
    } finally {
      setGeneratingInviteCode(false);
    }
  }, [setCompanyData]);

  const companyId = companyData?._id || companyData?.id;
  const isCompanySection = section === 'empresa';
  const areasAssignedToOtherDirectors = getDirectorAssignedAreas(companyData?.directivos || []);

  useEffect(() => {
    if (!companyId || companyData?.codigoInvitacion || inviteCodeAttemptedFor.current === String(companyId)) return;
    inviteCodeAttemptedFor.current = String(companyId);
    generateInviteCode();
  }, [companyData?.codigoInvitacion, companyId, generateInviteCode]);

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(companyData.codigoInvitacion);
      setInviteCodeError('');
      setInviteCodeMessage('Código de invitación copiado.');
    } catch (error) {
      setInviteCodeError('');
      setInviteCodeMessage('No se pudo copiar automáticamente. Selecciona el código y cópialo manualmente.');
    }
  };

  const saveSmtpSettings = async event => {
    event.preventDefault();
    setSmtpError('');
    setSmtpMessage('');
    setSavingSmtp(true);
    try {
      const response = await ApiService.saveCompanySmtp(smtpForm);
      setCompanyData(current => ({
        ...current,
        smtpConvocatorias: response.data.smtpConvocatorias
      }));
      setSmtpForm(current => ({ ...current, password: '' }));
      setSmtpMessage(response.message || 'El correo quedó verificado y guardado.');
    } catch (error) {
      setSmtpError(error.message || 'No se pudo verificar el correo. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setSavingSmtp(false);
    }
  };

  const deleteSmtpSettings = async () => {
    if (!window.confirm('¿Eliminar el correo guardado para enviar convocatorias?')) return;
    setSmtpError('');
    setSmtpMessage('');
    setSavingSmtp(true);
    try {
      await ApiService.deleteCompanySmtp();
      setCompanyData(current => ({
        ...current,
        smtpConvocatorias: { configured: false }
      }));
      setSmtpForm(current => ({ ...current, email: '', password: '' }));
      setSmtpMessage('Se eliminó el correo guardado.');
    } catch (error) {
      setSmtpError(error.message || 'No se pudo eliminar el correo guardado.');
    } finally {
      setSavingSmtp(false);
    }
  };

  const openManagedObjectives = async employee => {
    const employeeId = String(employee._id || employee.id);
    setManagingObjectivesEmployee({ ...employee, employeeId });
    setManagedObjectives([]);
    setManagedObjectiveError('');
    setLoadingManagedObjectives(true);
    try {
      const response = await ApiService.getManagedEmployeeObjectives(employeeId);
      setManagedObjectives(response.data || []);
    } catch (error) {
      setManagedObjectiveError(error.message || 'No se pudo cargar el plan personal.');
    } finally {
      setLoadingManagedObjectives(false);
    }
  };

  const openManagedObjectiveForm = objective => {
    setManagedObjectiveError('');
    setManagedObjectiveDraft(objective
      ? {
        id: objective._id || objective.id,
        nombre: objective.nombre || '',
        descripcion: objective.descripcion || '',
        prioridad: objective.prioridad || 'media',
        progreso: Number(objective.progreso) || 0,
        tasks: (objective.tasks || []).join('\n')
      }
      : { id: '', nombre: '', descripcion: '', prioridad: 'media', progreso: 0, tasks: '' });
  };

  const saveManagedObjective = async event => {
    event.preventDefault();
    if (!managingObjectivesEmployee) return;
    setSavingManagedObjective(true);
    setManagedObjectiveError('');
    const { id, ...draft } = managedObjectiveDraft;
    const progreso = Math.min(100, Math.max(0, Number(draft.progreso) || 0));
    const data = {
      ...draft,
      progreso,
      status: progreso >= 100 ? 'completado' : progreso > 0 ? 'en-progreso' : 'pendiente',
      tasks: draft.tasks.split('\n').map(task => task.trim()).filter(Boolean)
    };
    try {
      const response = id
        ? await ApiService.updateManagedEmployeeObjective(managingObjectivesEmployee.employeeId, id, data)
        : await ApiService.createManagedEmployeeObjective(managingObjectivesEmployee.employeeId, data);
      setManagedObjectives(current => id
        ? current.map(objective => String(objective._id || objective.id) === String(id) ? response.data : objective)
        : [response.data, ...current]);
      setManagedObjectiveDraft({ id: '', nombre: '', descripcion: '', prioridad: 'media', progreso: 0, tasks: '' });
    } catch (error) {
      setManagedObjectiveError(error.message || 'No se pudo guardar el indicador asignado.');
    } finally {
      setSavingManagedObjective(false);
    }
  };

  const deleteManagedObjective = async objective => {
    const objectiveId = String(objective._id || objective.id);
    if (!window.confirm(`¿Quitar "${objective.nombre}" del plan personal de ${managingObjectivesEmployee?.nombre || 'esta persona'}?`)) return;
    setDeletingManagedObjectiveId(objectiveId);
    setManagedObjectiveError('');
    try {
      await ApiService.deleteManagedEmployeeObjective(managingObjectivesEmployee.employeeId, objectiveId);
      setManagedObjectives(current => current.filter(item => String(item._id || item.id) !== objectiveId));
    } catch (error) {
      setManagedObjectiveError(error.message || 'No se pudo quitar el indicador asignado.');
    } finally {
      setDeletingManagedObjectiveId('');
    }
  };

  const saveEmployeeProfile = async employeeId => {
    setEmployeeMessage('');
    setEmployeeMessageIsError(false);
    const passwordChanged = Boolean(employeeDraft.password);
    try {
      const response = await ApiService.updateEmployeeProfile(employeeId, employeeDraft);
      setCompanyData(current => ({
        ...current,
        directivos: [
          ...(current.directivos || []).filter(directivo =>
            String(directivo.empleadoId || '') !== employeeId
            && String(directivo.email || '').toLowerCase() !== String(response.data.email || '').toLowerCase()
          ),
          ...(response.data.rol === 'directivo' ? [{
            ...current.directivos?.find(directivo =>
              String(directivo.empleadoId || '') === employeeId
              || String(directivo.email || '').toLowerCase() === String(response.data.email || '').toLowerCase()
            ),
            empleadoId: employeeId,
            nombre: response.data.nombre,
            email: response.data.email,
            area: response.data.area,
            areasACargo: response.data.areasACargo || [],
            telefono: response.data.telefono || '',
            trabajadoresACargo: response.data.trabajadoresACargo || 0,
            subareas: response.data.dirigeSubareas ? response.data.subareas || [] : [],
            esJefeEmpresa: Boolean(response.data.esJefeEmpresa),
            tieneCuenta: Boolean(response.data.tieneCuenta),
            cargo: response.data.esJefeEmpresa ? 'Dirección de empresa' : 'Dirección de departamento'
          }] : [])
        ],
        empleados: (current.empleados || []).map(employee =>
          String(employee._id || employee.id) === employeeId ? { ...employee, ...response.data } : employee
        )
      }));
      setEditingEmployeeId('');
      setEmployeeDraft(null);
      setEmployeeMessage(passwordChanged
        ? 'Los datos se actualizaron y la nueva contraseña ya está lista para compartir con la persona.'
        : 'Perfil de empleado actualizado.');
    } catch (error) {
      setEmployeeMessageIsError(true);
      setEmployeeMessage(error.message || 'No se pudo actualizar el perfil.');
    }
  };

  const addEmployee = async event => {
    event.preventDefault();
    setEmployeeMessage('');
    setEmployeeMessageIsError(false);
    setCreatingEmployee(true);
    try {
      const response = await ApiService.createEmployee(newEmployee);
      const employee = response.data;
      setCompanyData(current => ({
        ...current,
        empleados: [...(current.empleados || []), employee],
        directivos: employee.rol === 'directivo'
          ? [...(current.directivos || []).filter(item => item.email.toLowerCase() !== employee.email.toLowerCase()), {
            empleadoId: employee._id || employee.id,
          tieneCuenta: true,
            nombre: employee.nombre,
            email: employee.email,
            area: employee.area,
            areasACargo: employee.areasACargo || [],
            cargo: employee.esJefeEmpresa ? 'Dirección de empresa' : 'Dirección de departamento',
            telefono: employee.telefono || '',
            trabajadoresACargo: employee.trabajadoresACargo || 0,
            subareas: employee.dirigeSubareas ? employee.subareas || [] : [],
            esJefeEmpresa: Boolean(employee.esJefeEmpresa)
          }]
          : current.directivos || []
      }));
      setNewEmployee({
        nombre: '', email: '', rol: 'trabajador', area: '', subarea: '',
        areasACargo: [],
        password: '', telefono: '', trabajadoresACargo: 0, esJefeEmpresa: false,
        dirigeSubareas: false, subareas: []
      });
      setEmployeeMessage('La cuenta está lista. Comparte con la persona el correo y la contraseña inicial para que pueda entrar.');
    } catch (error) {
      setEmployeeMessageIsError(true);
      setEmployeeMessage(error.message || 'No se pudo agregar a la persona al directorio.');
    } finally {
      setCreatingEmployee(false);
    }
  };

  const removeEmployee = async employee => {
    const employeeId = String(employee._id || employee.id);
    if (!window.confirm(`¿Eliminar a ${employee.nombre || employee.email} del directorio? También se quitará de las convocatorias pendientes y se borrarán su registro de reuniones personales y su plan estratégico personal.`)) return;
    setEmployeeMessage('');
    setEmployeeMessageIsError(false);
    setDeletingEmployeeId(employeeId);
    try {
      await ApiService.deleteEmployee(employeeId);
      setCompanyData(current => ({
        ...current,
        empleados: (current.empleados || []).filter(item => String(item._id || item.id) !== employeeId),
        directivos: (current.directivos || []).filter(item =>
          String(item.empleadoId || '') !== employeeId
          && String(item.email || '').toLowerCase() !== String(employee.email || '').toLowerCase()
        )
      }));
      setEmployeeMessage('La persona se eliminó del directorio.');
    } catch (error) {
      setEmployeeMessageIsError(true);
      setEmployeeMessage(error.message || 'No se pudo eliminar a la persona.');
    } finally {
      setDeletingEmployeeId('');
    }
  };

  return (
  <div className="settings-page">
    <div className="settings-page-header mb-4">
      <div>
        <div className="text-uppercase small text-muted fw-semibold">Administración de Quorum</div>
        <h2 className="h4 mb-1">{isCompanySection ? 'Empresa' : 'Configuración'}</h2>
        <p className="text-muted mb-0">
          {isCompanySection
            ? 'Consulta la información de la empresa y administra a las personas de tu equipo.'
            : 'Personaliza Quorum y tus preferencias de reuniones y documentos.'}
        </p>
      </div>
    </div>
    <Card className={`mt-4 settings-section-card ${isCompanySection ? 'd-none' : ''}`}>
      <Card.Body>
        <div className="settings-section-heading mb-3">
          <div className="settings-section-icon">I</div>
          <div>
            <h5 className="mb-1">Preferencias de interfaz</h5>
            <p className="text-muted small mb-0">Personaliza cómo se muestra Quorum en este dispositivo.</p>
          </div>
        </div>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Tema</Form.Label>
              <Form.Select value={interfacePreferences.theme} onChange={event => updateInterfacePreferences({ theme: event.target.value })}>
                <option value="dark">Oscuro</option>
                <option value="light">Claro</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Página inicial</Form.Label>
              <Form.Select value={interfacePreferences.homeTab} onChange={event => updateInterfacePreferences({ homeTab: event.target.value })}>
                <option value="inicio">Dashboard</option>
                <option value="reuniones">Reuniones</option>
                <option value="estrategico">Plan estratégico</option>
                <option value="empresa">Empresa</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Densidad de contenido</Form.Label>
              <Form.Select value={interfacePreferences.density} onChange={event => updateInterfacePreferences({ density: event.target.value })}>
                <option value="comfortable">Cómoda</option>
                <option value="compact">Compacta</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6} className="d-flex align-items-center">
            <Form.Check type="switch" label="Activar animaciones y efectos visuales" checked={interfacePreferences.animations} onChange={event => updateInterfacePreferences({ animations: event.target.checked })} />
          </Col>
        </Row>
      </Card.Body>
    </Card>
    <Card className={`mt-4 settings-section-card ${isCompanySection ? '' : 'd-none'}`}>
      <Card.Body>
        <div className="settings-section-heading mb-3">
          <div className="settings-section-icon">@</div>
          <div>
            <h5 className="mb-1">Correo para convocatorias</h5>
            <p className="text-muted small mb-0">
              Destinatarios: los directivos de las áreas elegidas y los empleados invitados. Este será el correo del organizador desde el que se envíen las convocatorias.
            </p>
          </div>
        </div>
        <Alert variant="info">
          <strong>Antes de empezar:</strong> selecciona tu servicio de correo, escribe la dirección que usarás para enviar las convocatorias y su contraseña especial de aplicación. No uses la contraseña normal.
          <ul className="mb-0 mt-2">
            <li>Gmail: activa la verificación en dos pasos y crea una contraseña de aplicación en <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">tu cuenta de Google</a>.</li>
            <li>Outlook: usa la contraseña especial de aplicación de tu cuenta.</li>
            <li>Si no es posible guardar el correo, inténtalo más tarde o pide ayuda al responsable de Quorum.</li>
          </ul>
        </Alert>
        {companyData?.smtpConvocatorias?.configured && (
          <Alert variant="success">
            Correo verificado: <strong>{companyData.smtpConvocatorias.email}</strong> ({companyData.smtpConvocatorias.provider === 'gmail' ? 'Gmail' : 'Outlook'}).
          </Alert>
        )}
        {smtpError && <Alert variant="danger">{smtpError}</Alert>}
        {smtpMessage && <Alert variant="success">{smtpMessage}</Alert>}
        <Form onSubmit={saveSmtpSettings}>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Proveedor</Form.Label>
                <Form.Select
                  value={smtpForm.provider}
                  onChange={event => setSmtpForm(current => ({ ...current, provider: event.target.value }))}
                  disabled={savingSmtp}
                >
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook / Microsoft</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label>Correo del organizador</Form.Label>
                <Form.Control
                  type="email"
                  autoComplete="email"
                  value={smtpForm.email}
                  onChange={event => setSmtpForm(current => ({ ...current, email: event.target.value }))}
                  placeholder="organizador@dominio.com"
                  required
                  disabled={savingSmtp}
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label>Contraseña especial de aplicación</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              value={smtpForm.password}
              onChange={event => setSmtpForm(current => ({ ...current, password: event.target.value }))}
              placeholder={companyData?.smtpConvocatorias?.configured ? 'Escribe una nueva para cambiarla' : 'No uses la contraseña normal del correo'}
              minLength={8}
              required
              disabled={savingSmtp}
            />
            <Form.Text className="text-muted">
              Se comprobará al guardar. En Gmail normalmente debes activar la verificación en dos pasos y crear una contraseña especial de aplicación.
            </Form.Text>
          </Form.Group>
          <div className="d-flex flex-wrap gap-2">
            <Button type="submit" disabled={savingSmtp}>
              {savingSmtp ? <><Spinner size="sm" className="me-2" />Verificando correo...</> : 'Verificar y guardar correo'}
            </Button>
            {companyData?.smtpConvocatorias?.configured && (
              <Button type="button" variant="outline-danger" onClick={deleteSmtpSettings} disabled={savingSmtp}>
                Eliminar correo guardado
              </Button>
            )}
          </div>
        </Form>
      </Card.Body>
    </Card>
    <Card className={`mt-4 settings-section-card ${isCompanySection ? 'd-none' : ''}`}>
      <Card.Body>
        <div className="settings-section-heading mb-3">
          <div className="settings-section-icon">D</div>
          <div>
            <h5 className="mb-1">Preferencias de documentos y minutas</h5>
            <p className="text-muted small mb-0">Configura la información que aparecerá al descargar una minuta en PDF.</p>
          </div>
        </div>
        <Row>
          <Col md={4}>
            <Form.Group className="mb-3">
              <Form.Label>Prefijo de folio</Form.Label>
              <Form.Control
                value={documentPreferences.folioPrefix}
                maxLength={12}
                placeholder="MIN"
                onChange={event => updateDocumentPreferences({ folioPrefix: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
              />
              <Form.Text>Ejemplo: MIN-2026-0922.</Form.Text>
            </Form.Group>
          </Col>
          <Col md={8} className="d-flex flex-column justify-content-center">
            <Form.Check
              type="switch"
              className="mb-3"
              label="Incluir nombre de la empresa en el encabezado"
              checked={documentPreferences.includeInstitution}
              onChange={event => updateDocumentPreferences({ includeInstitution: event.target.checked })}
            />
            <Form.Check
              type="switch"
              label="Incluir sección de firmas"
              checked={documentPreferences.includeSignatures}
              onChange={event => updateDocumentPreferences({ includeSignatures: event.target.checked })}
            />
          </Col>
        </Row>
      </Card.Body>
    </Card>
    <Card className={`mt-4 settings-section-card ${isCompanySection ? 'd-none' : ''}`}>
      <Card.Body>
        <div className="settings-section-heading mb-3">
          <div className="settings-section-icon">R</div>
          <div>
            <h5 className="mb-1">Preferencias de reuniones</h5>
            <p className="text-muted small mb-0">Valores que se usarán al crear nuevas reuniones.</p>
          </div>
        </div>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Duración predeterminada</Form.Label>
              <Form.Control value={meetingPreferences.defaultDuration} placeholder="Ejemplo: 1 h" onChange={event => updateMeetingPreferences({ defaultDuration: event.target.value })} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Lugar habitual</Form.Label>
              <Form.Control value={meetingPreferences.defaultLocation} placeholder="Ejemplo: Sala de juntas" onChange={event => updateMeetingPreferences({ defaultLocation: event.target.value })} />
            </Form.Group>
          </Col>
        </Row>
        <Form.Check type="switch" label="Pedir confirmación antes de eliminar reuniones" checked={meetingPreferences.confirmDelete} onChange={event => updateMeetingPreferences({ confirmDelete: event.target.checked })} />
      </Card.Body>
    </Card>
    <div className={isCompanySection ? '' : 'd-none'}>
      <CompanyInfo
        companyData={companyData}
        setCompanyData={setCompanyData}
        fodaData={fodaData}
        setFodaData={setFodaData}
      />
    </div>
    <Card className={`mt-4 settings-section-card ${isCompanySection ? '' : 'd-none'}`}>
      <Card.Body>
        <div className="settings-section-heading mb-3">
          <div className="settings-section-icon">A</div>
          <div>
            <h5 className="mb-1">Acceso de empleados</h5>
            <p className="text-muted small mb-0">Comparte el código para que cada empleado cree su cuenta e ingrese al sistema con acceso individual.</p>
          </div>
        </div>
        <Form.Group className="mb-3">
          <Form.Label>Código de invitación de la empresa</Form.Label>
          <Form.Control
            value={companyData?.codigoInvitacion || (generatingInviteCode ? 'Generando código…' : 'Código pendiente de generar')}
            readOnly
            aria-live="polite"
          />
          <Form.Text className="text-muted d-block mb-3">
            Compártelo solo con empleados que deban vincular su cuenta a esta empresa.
          </Form.Text>
          {inviteCodeError && <Alert variant="danger">{inviteCodeError}</Alert>}
          {inviteCodeMessage && <Alert variant={inviteCodeMessage.startsWith('No se pudo') ? 'warning' : 'success'}>{inviteCodeMessage}</Alert>}
          <div className="d-flex flex-wrap gap-2">
            {companyData?.codigoInvitacion && (
              <Button variant="outline-primary" onClick={copyInviteCode}>
                Copiar código
              </Button>
            )}
            {!companyData?.codigoInvitacion && (
              <Button variant="outline-primary" onClick={generateInviteCode} disabled={generatingInviteCode}>
                {generatingInviteCode
                  ? <><Spinner size="sm" className="me-2" />Generando código...</>
                  : inviteCodeError ? 'Reintentar generación' : 'Generar código de invitación'}
              </Button>
            )}
          </div>
        </Form.Group>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {companyId ? (
            <>
              <Button
                as="a"
                href={`/empleados/${companyId}`}
                target="_blank"
                rel="noreferrer"
                variant="outline-primary"
              >
                Abrir portal de empleados
              </Button>
              <span className="small text-muted">
                Enlace para compartir: {window.location.origin}/empleados/{companyId}
              </span>
            </>
          ) : (
            <div className="small text-muted">El enlace aparecerá después de cargar la empresa.</div>
          )}
        </div>
      </Card.Body>
    </Card>
    <Card className={`mt-4 settings-section-card ${isCompanySection ? '' : 'd-none'}`}>
      <Card.Body>
        <div className="settings-section-heading mb-3">
          <div className="settings-section-icon">E</div>
          <div>
            <h5 className="mb-1">Empleados y directivos</h5>
            <p className="text-muted small mb-0">Las personas agregadas aquí y las que se registran con el código de empresa comparten este directorio. Al agregarlas, se crea una cuenta con una contraseña inicial que podrás compartirles.</p>
          </div>
        </div>
        <Form onSubmit={addEmployee} className="border rounded p-3 mb-4">
          <h6>Agregar una persona</h6>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nombre completo</Form.Label>
                <Form.Control
                  value={newEmployee.nombre}
                  onChange={event => setNewEmployee(current => ({ ...current, nombre: event.target.value }))}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Correo electrónico</Form.Label>
                <Form.Control
                  type="email"
                  value={newEmployee.email}
                  onChange={event => setNewEmployee(current => ({ ...current, email: event.target.value }))}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Contraseña inicial</Form.Label>
                <Form.Control
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newEmployee.password}
                  onChange={event => setNewEmployee(current => ({ ...current, password: event.target.value }))}
                  required
                />
                <Form.Text>Debe tener al menos 8 caracteres. Comparte esta contraseña con la persona para que pueda entrar.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Puesto</Form.Label>
                <Form.Select
                  value={newEmployee.rol}
                  onChange={event => setNewEmployee(current => ({
                    ...current,
                    rol: event.target.value,
                    esJefeEmpresa: event.target.value === 'directivo' ? current.esJefeEmpresa : false,
                    dirigeSubareas: event.target.value === 'directivo' ? current.dirigeSubareas : false,
                    subareas: event.target.value === 'directivo' ? current.subareas : []
                  }))}
                >
                  <option value="trabajador">Empleado</option>
                  <option value="directivo">Directivo</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Departamento</Form.Label>
                <Form.Select
                  value={newEmployee.area}
                  onChange={event => setNewEmployee(current => ({ ...current, area: event.target.value, subarea: '' }))}
                  required={!newEmployee.esJefeEmpresa}
                  disabled={newEmployee.esJefeEmpresa}
                >
                  <option value="">Selecciona un departamento</option>
                  {(companyData?.departamentos || [])
                    .filter(area => newEmployee.rol !== 'directivo'
                      || !areasAssignedToOtherDirectors.has(String(area).trim().toLowerCase())
                      || String(area).trim().toLowerCase() === String(newEmployee.area).trim().toLowerCase())
                    .map(area => <option key={area} value={area}>{area}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Subárea (opcional)</Form.Label>
                <Form.Select
                  value={newEmployee.subarea}
                  onChange={event => setNewEmployee(current => ({ ...current, subarea: event.target.value }))}
                  disabled={!newEmployee.area}
                >
                  <option value="">Sin subárea</option>
                  {getDepartmentSubareas(companyData?.directivos, newEmployee.area).map(subarea => (
                    <option key={subarea} value={subarea}>{subarea}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            {newEmployee.rol === 'directivo' && !newEmployee.esJefeEmpresa && (
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Otras áreas principales a su cargo (opcional)</Form.Label>
                  <Form.Select
                    multiple
                    value={(newEmployee.areasACargo || []).filter(area => area !== newEmployee.area)}
                    onChange={event => setNewEmployee(current => ({
                      ...current,
                      areasACargo: Array.from(event.target.selectedOptions, option => option.value)
                    }))}
                  >
                    {(companyData?.departamentos || [])
                      .filter(area => area !== newEmployee.area)
                      .filter(area => !areasAssignedToOtherDirectors.has(String(area).trim().toLowerCase()))
                      .map(area => <option key={area} value={area}>{area}</option>)}
                  </Form.Select>
                  <Form.Text>Selecciona una o más áreas principales sin directivo asignado. Mantén Ctrl para elegir varias.</Form.Text>
                </Form.Group>
              </Col>
            )}
            {newEmployee.rol === 'directivo' && (
              <>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Teléfono (opcional)</Form.Label>
                    <Form.Control value={newEmployee.telefono} onChange={event => setNewEmployee(current => ({ ...current, telefono: event.target.value }))} />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Personas a cargo (opcional)</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={newEmployee.trabajadoresACargo}
                      onChange={event => setNewEmployee(current => ({ ...current, trabajadoresACargo: Number(event.target.value) || 0 }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={4} className="d-flex align-items-center">
                  <Form.Check
                    className="mb-3"
                    label="Es responsable de la empresa"
                    checked={newEmployee.esJefeEmpresa}
                    onChange={event => setNewEmployee(current => ({
                      ...current,
                      esJefeEmpresa: event.target.checked,
                      area: event.target.checked ? '' : current.area
                    }))}
                  />
                </Col>
                {!newEmployee.esJefeEmpresa && (
                  <Col md={12}>
                    <Form.Check
                      className="mb-2"
                      label="Dirige subáreas"
                      checked={newEmployee.dirigeSubareas}
                      onChange={event => setNewEmployee(current => ({ ...current, dirigeSubareas: event.target.checked, subareas: event.target.checked ? current.subareas : [] }))}
                    />
                    {newEmployee.dirigeSubareas && (
                      <Form.Group className="mb-3">
                        <Form.Label>Subáreas a su cargo (una por línea)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={newEmployee.subareas.join('\n')}
                          onChange={event => setNewEmployee(current => ({
                            ...current,
                            subareas: [...new Set(event.target.value.split('\n').map(item => item.trim()).filter(Boolean))]
                          }))}
                          required
                        />
                      </Form.Group>
                    )}
                  </Col>
                )}
              </>
            )}
          </Row>
          <div className="d-flex flex-wrap align-items-center gap-3">
            <Button type="submit" disabled={creatingEmployee}>
              {creatingEmployee ? <><Spinner size="sm" className="me-2" />Agregando...</> : 'Agregar al directorio'}
            </Button>
            <span className="small text-muted">La persona podrá entrar con su correo y esta contraseña inicial.</span>
          </div>
        </Form>
        {(companyData?.empleados || []).length ? (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Cuenta</th><th>Rol</th><th>Área</th><th>Subárea</th><th>Jefatura</th><th>Acciones</th></tr></thead>
              <tbody>
                {companyData.empleados.map(empleado => {
                  const employeeId = String(empleado._id || empleado.id);
                  const isEditing = editingEmployeeId === employeeId;
                  const otherDirectorAreas = getDirectorAssignedAreas(companyData.directivos, empleado.email);
                  return (
                    <tr key={employeeId}>
                      <td>{isEditing
                        ? <Form.Control aria-label="Nombre del empleado" value={employeeDraft.nombre} onChange={event => setEmployeeDraft(current => ({ ...current, nombre: event.target.value }))} />
                        : empleado.nombre || 'Perfil pendiente'}</td>
                      <td>{empleado.email}</td>
                      <td>{empleado.tieneCuenta ? 'Activa' : 'Pendiente de registro'}</td>
                      <td>{isEditing ? (
                        <Form.Select aria-label="Rol del empleado" value={employeeDraft.rol} onChange={event => setEmployeeDraft(current => ({ ...current, rol: event.target.value }))}>
                          <option value="">Seleccionar</option><option value="trabajador">Trabajador</option><option value="directivo">Directivo</option>
                        </Form.Select>
                      ) : empleado.rol || 'Pendiente'}</td>
                      <td>{isEditing ? (
                        <Form.Select aria-label="Área del empleado" value={employeeDraft.area} onChange={event => setEmployeeDraft(current => ({ ...current, area: event.target.value, subarea: '' }))}>
                          <option value="">Seleccionar</option>
                          {(companyData.departamentos || [])
                            .filter(area => employeeDraft.rol !== 'directivo'
                              || !otherDirectorAreas.has(String(area).trim().toLowerCase())
                              || String(area).trim().toLowerCase() === String(employeeDraft.area).trim().toLowerCase())
                            .map(area => <option key={area} value={area}>{area}</option>)}
                        </Form.Select>
                      ) : empleado.area || 'Pendiente'}</td>
                      <td>{isEditing
                        ? (
                          <Form.Select aria-label="Subárea del empleado" value={employeeDraft.subarea} onChange={event => setEmployeeDraft(current => ({ ...current, subarea: event.target.value }))}>
                            <option value="">Sin subárea</option>
                            {getDepartmentSubareas(companyData.directivos, employeeDraft.area, employeeDraft.subarea).map(subarea => <option key={subarea} value={subarea}>{subarea}</option>)}
                          </Form.Select>
                        )
                        : empleado.subarea || '—'}</td>
                      <td>
                        {isEditing ? (
                          <>
                            <Form.Check
                              label="Departamento"
                              checked={employeeDraft.esJefeDepartamento}
                              onChange={event => setEmployeeDraft(current => ({ ...current, esJefeDepartamento: event.target.checked, rol: event.target.checked || current.esJefeEmpresa ? 'directivo' : current.rol }))}
                            />
                            <Form.Check
                              label="Empresa"
                              checked={employeeDraft.esJefeEmpresa}
                              onChange={event => setEmployeeDraft(current => ({ ...current, esJefeEmpresa: event.target.checked, rol: event.target.checked || current.esJefeDepartamento ? 'directivo' : current.rol }))}
                            />
                            <Form.Check
                              label="Dirige subáreas"
                              checked={employeeDraft.dirigeSubareas}
                              onChange={event => setEmployeeDraft(current => ({ ...current, dirigeSubareas: event.target.checked, rol: event.target.checked ? 'directivo' : current.rol }))}
                            />
                            {employeeDraft.rol === 'directivo' && !employeeDraft.esJefeEmpresa && (
                              <Form.Group className="mt-2">
                                <Form.Label className="small mb-1">Otras áreas principales a su cargo</Form.Label>
                                <Form.Select
                                  multiple
                                  aria-label="Otras áreas principales a cargo"
                                  value={(employeeDraft.areasACargo || []).filter(area => area !== employeeDraft.area)}
                                  onChange={event => setEmployeeDraft(current => ({
                                    ...current,
                                    areasACargo: Array.from(event.target.selectedOptions, option => option.value)
                                  }))}
                                >
                                  {(companyData.departamentos || [])
                                    .filter(area => area !== employeeDraft.area)
                                    .filter(area => !otherDirectorAreas.has(String(area).trim().toLowerCase()))
                                    .map(area => <option key={area} value={area}>{area}</option>)}
                                </Form.Select>
                                <Form.Text>Áreas sin directivo asignado. Mantén Ctrl para elegir varias.</Form.Text>
                              </Form.Group>
                            )}
                            {employeeDraft.dirigeSubareas && (
                              <>
                                <Form.Control
                                  as="textarea"
                                  rows={2}
                                  aria-label="Subáreas a cargo"
                                  value={(employeeDraft.subareas || []).join('\n')}
                                  onChange={event => setEmployeeDraft(current => ({ ...current, subareas: event.target.value.split('\n').map(item => item.trim()).filter(Boolean) }))}
                                />
                                <Form.Text>Una por línea; los empleados del área podrán elegirlas en su perfil.</Form.Text>
                              </>
                            )}
                            {employeeDraft.rol === 'directivo' && (
                              <>
                                <Form.Control
                                  className="mt-2"
                                  aria-label="Teléfono de contacto"
                                  placeholder="Teléfono de contacto"
                                  value={employeeDraft.telefono}
                                  onChange={event => setEmployeeDraft(current => ({ ...current, telefono: event.target.value }))}
                                />
                                <Form.Control
                                  className="mt-2"
                                  type="number"
                                  min="0"
                                  aria-label="Trabajadores a cargo"
                                  placeholder="Trabajadores a cargo"
                                  value={employeeDraft.trabajadoresACargo}
                                  onChange={event => setEmployeeDraft(current => ({ ...current, trabajadoresACargo: Number(event.target.value) || 0 }))}
                                />
                              </>
                            )}
                            <Form.Group className="mt-2">
                              <Form.Label className="small mb-1">Cambiar contraseña (opcional)</Form.Label>
                              <Form.Control
                                type="password"
                                autoComplete="new-password"
                                aria-label="Nueva contraseña del empleado"
                                placeholder="Deja vacío para conservarla"
                                minLength={8}
                                value={employeeDraft.password}
                                onChange={event => setEmployeeDraft(current => ({ ...current, password: event.target.value }))}
                              />
                            </Form.Group>
                          </>
                        ) : (
                          [
                              !empleado.liderazgoConfirmado && 'Pendiente de confirmar',
                              empleado.esJefeEmpresa && 'Jefe de empresa',
                              empleado.esJefeDepartamento && 'Jefe de departamento',
                              empleado.dirigeSubareas && 'Jefe de subáreas'
                          ].filter(Boolean).join(', ') || 'Sin jefatura'
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="d-flex gap-2">
                            <Button size="sm" onClick={() => saveEmployeeProfile(employeeId)} disabled={!employeeDraft?.rol || (!employeeDraft?.area && !employeeDraft?.esJefeEmpresa)}>Guardar</Button>
                            <Button size="sm" variant="outline-secondary" onClick={() => { setEditingEmployeeId(''); setEmployeeDraft(null); }}>Cancelar</Button>
                          </div>
                        ) : (
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-info"
                              onClick={() => openManagedObjectives(empleado)}
                              title="Ver y asignar indicadores del plan personal"
                            >
                              Plan personal
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => {
                                setEmployeeMessage('');
                                setEditingEmployeeId(employeeId);
                                setEmployeeDraft({
                                  nombre: empleado.nombre || '',
                                  rol: empleado.rol || '',
                                  area: empleado.area || '',
                                  areasACargo: (empleado.areasACargo || []).filter(area => area !== empleado.area),
                                  subarea: empleado.subarea || '',
                                  telefono: empleado.telefono || '',
                                  password: '',
                                  trabajadoresACargo: empleado.trabajadoresACargo || 0,
                                  dirigeSubareas: empleado.dirigeSubareas || false,
                                  subareas: empleado.subareas || [],
                                  esJefeDepartamento: Boolean(empleado.esJefeDepartamento),
                                  esJefeEmpresa: Boolean(empleado.esJefeEmpresa)
                                });
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => removeEmployee(empleado)}
                              disabled={Boolean(deletingEmployeeId)}
                            >
                              {deletingEmployeeId === employeeId ? 'Eliminando...' : 'Eliminar'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-muted small mb-0">Aún no hay personas en el directorio.</p>}
        {employeeMessage && <div className={`small mt-2 ${employeeMessageIsError ? 'text-danger' : 'text-success'}`} role="status">{employeeMessage}</div>}
      </Card.Body>
    </Card>
    <Modal
      show={Boolean(managingObjectivesEmployee)}
      onHide={() => {
        if (!savingManagedObjective) setManagingObjectivesEmployee(null);
      }}
      centered
      size="lg"
    >
      <Form onSubmit={saveManagedObjective}>
        <Modal.Header closeButton>
          <div>
            <div className="small text-uppercase text-muted">Plan estratégico personal</div>
            <Modal.Title>{managingObjectivesEmployee?.nombre || managingObjectivesEmployee?.email}</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body>
          {managingObjectivesEmployee && (
            <p className="small text-muted">
              Los indicadores se vinculan al departamento actual: <strong>{managingObjectivesEmployee.area || 'Sin departamento asignado'}</strong>.
              Tú y esta persona los verán y podrán editarlos desde sus respectivos portales.
            </p>
          )}
          {managedObjectiveError && <Alert variant="danger">{managedObjectiveError}</Alert>}
          {loadingManagedObjectives ? (
            <div className="text-center py-3"><Spinner size="sm" className="me-2" />Cargando indicadores...</div>
          ) : (
            <>
              <div className="d-flex flex-column gap-2 mb-4">
                {managedObjectives.length ? managedObjectives.map(objective => (
                  <div key={objective._id || objective.id} className="border rounded p-3 d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div className="flex-grow-1">
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <strong>{objective.nombre}</strong>
                        <Badge bg="primary">Indicador compartido</Badge>
                      </div>
                      <div className="small text-muted">{objective.area} · {objective.progreso || 0}% de avance</div>
                      {objective.descripcion && <div className="small mt-1">{objective.descripcion}</div>}
                    </div>
                    <div className="d-flex gap-2">
                      <Button type="button" size="sm" variant="outline-primary" onClick={() => openManagedObjectiveForm(objective)}>Editar</Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline-danger"
                        onClick={() => deleteManagedObjective(objective)}
                        disabled={Boolean(deletingManagedObjectiveId)}
                      >
                        {deletingManagedObjectiveId === String(objective._id || objective.id) ? 'Quitando...' : 'Quitar'}
                      </Button>
                    </div>
                  </div>
                )) : <p className="small text-muted mb-0">Esta persona todavía no tiene indicadores personales.</p>}
              </div>
              <hr />
              <h6>{managedObjectiveDraft.id ? 'Editar indicador compartido' : 'Agregar indicador personal'}</h6>
              {!managingObjectivesEmployee?.area && (
                <Alert variant="warning">Asigna primero un departamento a esta persona en el directorio.</Alert>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Nombre del indicador</Form.Label>
                <Form.Control
                  autoFocus
                  required
                  minLength={2}
                  maxLength={160}
                  value={managedObjectiveDraft.nombre}
                  onChange={event => setManagedObjectiveDraft(current => ({ ...current, nombre: event.target.value }))}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Descripción</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  maxLength={1000}
                  value={managedObjectiveDraft.descripcion}
                  onChange={event => setManagedObjectiveDraft(current => ({ ...current, descripcion: event.target.value }))}
                />
              </Form.Group>
              <div className="row g-3">
                <Form.Group className="col-md-6">
                  <Form.Label>Prioridad</Form.Label>
                  <Form.Select
                    value={managedObjectiveDraft.prioridad}
                    onChange={event => setManagedObjectiveDraft(current => ({ ...current, prioridad: event.target.value }))}
                  >
                    <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="col-md-6">
                  <Form.Label>Avance: {managedObjectiveDraft.progreso}%</Form.Label>
                  <Form.Range
                    min="0"
                    max="100"
                    step="5"
                    value={managedObjectiveDraft.progreso}
                    onChange={event => setManagedObjectiveDraft(current => ({ ...current, progreso: Number(event.target.value) }))}
                  />
                </Form.Group>
              </div>
              <Form.Group className="mt-3">
                <Form.Label>Pasos a seguir <span className="text-muted">(uno por línea)</span></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  maxLength={6000}
                  value={managedObjectiveDraft.tasks}
                  onChange={event => setManagedObjectiveDraft(current => ({ ...current, tasks: event.target.value }))}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline-secondary" onClick={() => setManagingObjectivesEmployee(null)} disabled={savingManagedObjective}>
            Cerrar
          </Button>
          <Button
            type="submit"
            disabled={loadingManagedObjectives || savingManagedObjective || !managingObjectivesEmployee?.area}
          >
            {savingManagedObjective ? 'Guardando...' : managedObjectiveDraft.id ? 'Guardar cambios' : 'Asignar indicador'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
    <Card className={`mt-4 settings-section-card settings-session-card ${isCompanySection ? 'd-none' : ''}`}>
      <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h5 className="mb-1">Sesión y acceso</h5>
          <p className="text-muted small mb-0">Cierra la sesión actual de forma segura en este dispositivo.</p>
        </div>
        <Button variant="outline-danger" onClick={onLogout}>
          Cerrar sesión
        </Button>
      </Card.Body>
    </Card>
  </div>
  );
};

export default Settings;
