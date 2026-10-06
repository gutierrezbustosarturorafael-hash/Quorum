import React, { useEffect, useRef, useState } from 'react';
import { Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import ApiService from '../services/apiService';
import RisingLines from './RisingLines';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SERVER_URL = API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');

const Dashboard = ({ companyData, setCompanyData, fodaData, setFodaData, reuniones, objetivos = [] }) => {
  const [showFodaEditor, setShowFodaEditor] = useState(false);
  const [editingFoda, setEditingFoda] = useState(fodaData);
  const [savingFoda, setSavingFoda] = useState(false);
  const [fodaMessage, setFodaMessage] = useState('');
  const [planFile, setPlanFile] = useState(null);
  const [planMessage, setPlanMessage] = useState('');
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const planInput = useRef(null);

  useEffect(() => {
    setEditingFoda(fodaData);
  }, [fodaData]);

  const fodaSections = [
    { key: 'fortalezas', label: 'Fortalezas', color: '#2f80ed' },
    { key: 'debilidades', label: 'Debilidades', color: '#145fc0' },
    { key: 'oportunidades', label: 'Oportunidades', color: '#67c7f5' },
    { key: 'amenazas', label: 'Amenazas', color: '#0b477d' }
  ];

  const handleFodaChange = (section, value) => {
    setEditingFoda(prev => ({ ...prev, [section]: value }));
  };

  const saveFoda = async () => {
    setSavingFoda(true);
    setFodaMessage('');
    try {
      const response = await ApiService.updateFODA(editingFoda || {});
      if (!response.success) {
        throw new Error(response.message || 'No se pudo guardar el FODA');
      }
      setFodaData(editingFoda);
      setShowFodaEditor(false);
      setFodaMessage('FODA guardado.');
    } catch (error) {
      console.error('Error al guardar FODA:', error);
      setFodaMessage(`No se guardó el FODA. ${error.message || 'Inténtalo de nuevo.'}`);
    } finally {
      setSavingFoda(false);
    }
  };

  const proximasReuniones = [...(reuniones || [])]
    .filter(reunion => {
      if (!reunion.fecha) return false;
      const status = String(reunion.status || reunion.estado || '').toLowerCase();
      const meetingTime = new Date(`${reunion.fecha}T${reunion.hora || '00:00'}`).getTime();
      return !['completada', 'finalizada', 'completed'].includes(status)
        && Number.isFinite(meetingTime)
        && meetingTime >= Date.now();
    })
    .sort((a, b) => new Date(`${a.fecha}T${a.hora || '00:00'}`) - new Date(`${b.fecha}T${b.hora || '00:00'}`))
    .slice(0, 3);
  const totalObjetivos = objetivos.length;

  const saveStrategicPlan = async () => {
    if (!planFile) return;
    setUploadingPlan(true);
    setPlanMessage('');
    try {
      const response = await ApiService.uploadStrategicPlan(planFile);
      setCompanyData(current => ({ ...current, planEstrategico: response.data }));
      setPlanFile(null);
      if (planInput.current) planInput.current.value = '';
      setPlanMessage('Plan estratégico guardado correctamente.');
    } catch (error) {
      setPlanMessage(error.message || 'No se pudo guardar el plan estratégico.');
    } finally {
      setUploadingPlan(false);
    }
  };

  const planUrl = companyData?.planEstrategico?.url
    ? (companyData.planEstrategico.url.startsWith('http')
      ? companyData.planEstrategico.url
      : `${SERVER_URL}${companyData.planEstrategico.url}`)
    : '';

  return (
    <div>
      <section className="dashboard-hero mb-4">
        <RisingLines className="dashboard-rising-lines" />
        <div>
          <span className="dashboard-eyebrow">Panel de control</span>
          <h1 className="dashboard-title">Hola, bienvenido a tu gestión estratégica</h1>
          <p className="dashboard-subtitle mb-0">
            Consulta la información de tu organización, revisa próximas reuniones y gestiona tu plan estratégico.
          </p>
        </div>
        <div className="dashboard-hero-mark" aria-hidden="true">
          <span>Q</span>
        </div>
      </section>
      {companyData?.verificacion?.estado === 'pendiente' && (
        <Alert variant="info" className="mb-4">
          <strong>Verificación pendiente.</strong> Puedes crear y gestionar reuniones, pero las convocatorias por correo a las áreas permanecerán bloqueadas hasta que un administrador revise y compruebe los datos de la empresa.
        </Alert>
      )}
      {companyData?.verificacion?.estado === 'rechazada' && (
        <Alert variant="danger" className="mb-4">
          <strong>Verificación rechazada.</strong> Revisa las observaciones del administrador antes de solicitar una nueva revisión.
          {companyData?.verificacion?.notas && <div className="mt-1">Observaciones: {companyData.verificacion.notas}</div>}
        </Alert>
      )}
      {companyData?.verificacion?.estado === 'suspendida' && (
        <Alert variant="warning" className="mb-4">
          <strong>Cuenta suspendida para revisión.</strong> Consulta las observaciones del equipo revisor.
        </Alert>
      )}
      <Row className="g-3 mb-4">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <h6 className="mb-3">Próximas reuniones</h6>
              {proximasReuniones.length ? (
                proximasReuniones.map(reunion => (
                  <div key={reunion.id || reunion._id} className="dashboard-meeting-item">
                    <strong>{reunion.titulo}</strong>
                    <span>{reunion.fecha} · {reunion.hora || 'Sin hora'}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted small mb-0">No hay reuniones pendientes.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100 dashboard-plan-card">
            <Card.Body>
              <h6 className="mb-2">Plan estratégico</h6>
              <p className="text-muted small mb-3">¿Tienes un plan estratégico? Súbelo aquí para mantenerlo disponible para la organización.</p>
              <Form.Control
                ref={planInput}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="mb-3"
                onChange={event => setPlanFile(event.target.files?.[0] || null)}
                disabled={uploadingPlan}
              />
              <div className="d-flex flex-wrap align-items-center gap-2">
                <Button onClick={saveStrategicPlan} disabled={!planFile || uploadingPlan}>
                  {uploadingPlan ? 'Subiendo...' : companyData?.planEstrategico?.url ? 'Reemplazar plan' : 'Subir plan'}
                </Button>
                {planUrl && (
                  <Button as="a" href={planUrl} target="_blank" rel="noreferrer" variant="outline-primary">
                    Ver {companyData.planEstrategico.nombreArchivo || 'plan actual'}
                  </Button>
                )}
              </div>
              {planMessage && <div className={`small mt-2 ${planMessage.startsWith('No se') ? 'text-danger' : 'text-success'}`} role="status">{planMessage}</div>}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-4 border-primary">
        <Card.Body>
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div>
              <div className="text-uppercase small text-muted fw-semibold">Información institucional</div>
              <h5 className="mb-0">{companyData?.nombre || 'Empresa sin registrar'}</h5>
            </div>
            <span className="dashboard-edit-note">La información se puede editar desde Configuración.</span>
          </div>
          <Row>
            <Col md={3} sm={6} className="mb-2">
              <div className="d-flex align-items-center gap-2">
                <div className="context-icon bg-primary text-white rounded-circle d-flex align-items-center justify-content-center">E</div>
                <div>
                  <div className="small text-muted text-uppercase">Empresa</div>
                  <div className="fw-semibold small">{companyData?.nombre || 'Sin registrar'}</div>
                </div>
              </div>
            </Col>
            <Col md={3} sm={6} className="mb-2">
              <div className="d-flex align-items-center gap-2">
                <div className="context-icon bg-success text-white rounded-circle d-flex align-items-center justify-content-center">M</div>
                <div>
                  <div className="small text-muted text-uppercase">Mision</div>
                  <div className="fw-semibold small">{companyData?.mision?.slice(0, 40) || 'Sin definir'}...</div>
                </div>
              </div>
            </Col>
            <Col md={3} sm={6} className="mb-2">
              <div className="d-flex align-items-center gap-2">
                <div className="context-icon bg-info text-white rounded-circle d-flex align-items-center justify-content-center">V</div>
                <div>
                  <div className="small text-muted text-uppercase">Vision</div>
                  <div className="fw-semibold small">{companyData?.vision?.slice(0, 40) || 'Sin definir'}...</div>
                </div>
              </div>
            </Col>
            <Col md={3} sm={6} className="mb-2">
              <div className="d-flex align-items-center gap-2">
                <div className="context-icon bg-warning text-white rounded-circle d-flex align-items-center justify-content-center">O</div>
                <div>
                  <div className="small text-muted text-uppercase">Objetivos</div>
                  <div className="fw-semibold small">{totalObjetivos} definidos</div>
                </div>
              </div>
            </Col>
          </Row>
          <Row className="g-3 mt-2">
            <Col lg={6}>
              <div className="dashboard-info-panel h-100">
                <div className="small text-uppercase text-muted mb-2">Misión</div>
                <p className="mb-0">{companyData?.mision || 'Sin definir'}</p>
              </div>
            </Col>
            <Col lg={6}>
              <div className="dashboard-info-panel h-100">
                <div className="small text-uppercase text-muted mb-2">Visión</div>
                <p className="mb-0">{companyData?.vision || 'Sin definir'}</p>
              </div>
            </Col>
          </Row>
          <Row className="g-3 mt-1">
            {[
              { key: 'valores', label: 'Valores' },
              { key: 'estrategias', label: 'Estrategias' },
              { key: 'metas', label: 'Metas' },
              { key: 'indicadores', label: 'Indicadores' },
              { key: 'departamentos', label: 'Departamentos' }
            ].map(section => (
              <Col key={section.key} md={6} lg={4}>
                <div className="dashboard-list-panel h-100">
                  <div className="small text-uppercase text-muted mb-2">{section.label}</div>
                  {(companyData?.[section.key] || []).length > 0 ? (
                    <ul className="list-unstyled mb-0 small">
                      {companyData[section.key].map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  ) : <span className="text-muted small">Sin datos registrados</span>}
                </div>
              </Col>
            ))}
            <Col md={6} lg={4}>
              <div className="dashboard-list-panel h-100">
                <div className="small text-uppercase text-muted mb-2">Directivos</div>
                {(companyData?.directivos || []).length > 0 ? (
                  <ul className="list-unstyled mb-0 small">
                    {companyData.directivos.map(directivo => (
                      <li key={directivo.id || directivo._id} className="mb-1">
                        <strong>{directivo.nombre}</strong><span className="text-muted"> · {directivo.cargo || directivo.area}</span>
                      </li>
                    ))}
                  </ul>
                ) : <span className="text-muted small">Sin directivos registrados</span>}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Analisis FODA</span>
          <span className="dashboard-edit-note">El análisis se puede editar desde Configuración.</span>
        </Card.Header>
        <Card.Body>
          {fodaMessage && <Alert variant={fodaMessage.startsWith('Error') ? 'danger' : 'primary'}>{fodaMessage}</Alert>}
          {showFodaEditor ? (
            <Row className="g-3">
              {fodaSections.map(section => (
                <Col key={section.key} md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">{section.label}</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows="4"
                      value={editingFoda?.[section.key]?.join('\n') || ''}
                      onChange={(e) => handleFodaChange(section.key, e.target.value.split('\n').filter(item => item.trim()))}
                    />
                  </Form.Group>
                </Col>
              ))}
              <Col xs={12} className="text-end">
                <Button variant="primary" onClick={saveFoda} disabled={savingFoda}>
                  {savingFoda ? 'Guardando...' : 'Guardar FODA'}
                </Button>
              </Col>
            </Row>
          ) : (
            <Row className="g-3">
              {fodaSections.map(section => (
                <Col key={section.key} md={3} sm={6}>
                  <div className="p-3 rounded-3 h-100" style={{ background: `${section.color}15`, borderLeft: `4px solid ${section.color}` }}>
                    <h6 className="mb-2" style={{ color: section.color }}>{section.label}</h6>
                    <ul className="list-unstyled small mb-0">
                      {(fodaData?.[section.key] || []).map((item, idx) => (
                        <li key={idx} className="py-1 border-bottom border-light">{item}</li>
                      ))}
                    </ul>
                  </div>
                </Col>
              ))}
            </Row>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default Dashboard;