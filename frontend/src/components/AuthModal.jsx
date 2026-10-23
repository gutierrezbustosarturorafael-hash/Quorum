import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Row, Col, ProgressBar, InputGroup } from 'react-bootstrap';
import PrivacyNotice from './PrivacyNotice';

const INITIAL_FORM = {
  email: '',
  password: '',
  nombre: '',
  tipoPersona: '',
  representanteLegal: '',
  telefonoContacto: '',
  razonSocial: '',
  rfc: '',
  domicilioFiscal: '',
  regimenFiscal: '',
  mision: '',
  vision: '',
  valores: '',
  objetivos: '',
  estrategias: '',
  metas: '',
  indicadores: '',
  departamentos: '',
  fortalezas: '',
  debilidades: '',
  oportunidades: '',
  amenazas: '',
  termsAccepted: false
};

const TERMS_VERSION = '2026-09-23';

const AuthModal = ({ show, mode, onModeChange, onClose, onSuccess }) => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = nextMode => {
    setStep(1);
    setShowPassword(false);
    onModeChange(nextMode);
  };

  useEffect(() => {
    if (show) {
      setStep(1);
      setShowPassword(false);
    }
  }, [show]);

  const handleChange = event => {
    const { name, value } = event.target;
    setFormData(current => ({ ...current, [name]: name === 'rfc' ? value.toUpperCase() : value }));
  };

  const lines = value => value.split('\n').filter(item => item.trim());

  const validateStep = event => {
    const fields = Array.from(event.currentTarget.querySelectorAll('input, select, textarea'));
    const invalid = fields.find(field => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  };

  const nextStep = event => {
    event.preventDefault();
    if (validateStep(event)) setStep(current => current + 1);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!validateStep(event)) return;
    setLoading(true);
    const data = {
      nombre: formData.nombre,
      tipoPersona: formData.tipoPersona,
      representanteLegal: formData.representanteLegal,
      telefonoContacto: formData.telefonoContacto,
      razonSocial: formData.razonSocial,
      rfc: formData.rfc,
      domicilioFiscal: formData.domicilioFiscal,
      regimenFiscal: formData.regimenFiscal,
      mision: formData.mision,
      vision: formData.vision,
      valores: lines(formData.valores),
      objetivos: lines(formData.objetivos),
      estrategias: lines(formData.estrategias),
      metas: lines(formData.metas),
      indicadores: lines(formData.indicadores),
      departamentos: lines(formData.departamentos),
      fortalezas: lines(formData.fortalezas),
      debilidades: lines(formData.debilidades),
      oportunidades: lines(formData.oportunidades),
      amenazas: lines(formData.amenazas),
      email: formData.email,
      password: formData.password,
      termsAccepted: formData.termsAccepted,
      termsVersion: TERMS_VERSION
    };
    try {
      await onSuccess(data);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    try {
      await onSuccess({ email: formData.email, password: formData.password });
    } finally {
      setLoading(false);
    }
  };

  const renderTextArea = (name, label, placeholder = '') => (
    <Form.Group className="mb-3">
      <Form.Label>{label}</Form.Label>
      <Form.Control
        as="textarea"
        rows={2}
        name={name}
        value={formData[name]}
        onChange={handleChange}
        placeholder={placeholder}
        required={label.includes('*')}
      />
    </Form.Group>
  );

  return (
    <Modal show={show} onHide={onClose} size={mode === 'registro' ? 'xl' : 'sm'} centered dialogClassName="auth-modal-dialog">
      <Modal.Header closeButton>
        <Modal.Title>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta empresarial'}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="auth-modal-body">
        <div className="auth-modal-content">
        {mode === 'login' ? (
          <Form onSubmit={handleLoginSubmit}>
            <p className="text-muted small">Ingresa tus credenciales para acceder a Quorum.</p>
            <Form.Group className="mb-3">
              <Form.Label>Correo electrónico</Form.Label>
              <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Contraseña</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setShowPassword(current => !current)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </Button>
              </InputGroup>
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </Button>
            </div>
            <p className="text-center small mt-3 mb-0">
              ¿Aún no tienes cuenta?{' '}
              <Button variant="link" className="p-0 align-baseline" type="button" onClick={() => switchMode('registro')}>
                Crear cuenta empresarial
              </Button>
            </p>
          </Form>
        ) : (
          <Form onSubmit={step === 3 ? handleSubmit : nextStep}>
            <div className="registration-progress mb-4">
              <div className="d-flex justify-content-between small mb-2">
                <strong>Paso {step} de 3</strong>
                <span>{step === 1 ? 'Identidad fiscal' : step === 2 ? 'Información institucional' : 'Acceso y estrategia'}</span>
              </div>
              <ProgressBar now={(step / 3) * 100} />
            </div>

            {step === 1 && (
              <div className="registration-block">
                <div className="registration-block-title">Identidad y datos fiscales</div>
                <p className="text-muted small">Indica si se trata de una persona física o moral. Estos datos se revisarán primero de forma local y después por una persona.</p>
                <Row>
                  <Col md={6}>{renderTextArea('nombre', 'Nombre comercial *', 'Nombre con el que se conoce la empresa')}</Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Tipo de persona *</Form.Label>
                      <Form.Select name="tipoPersona" value={formData.tipoPersona} onChange={handleChange} required>
                        <option value="">Selecciona una opción</option>
                        <option value="fisica">Persona física con actividad empresarial</option>
                        <option value="moral">Persona moral</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>{renderTextArea('razonSocial', 'Razón social *', 'Nombre legal registrado')}</Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>RFC *</Form.Label>
                      <Form.Control type="text" name="rfc" value={formData.rfc} onChange={handleChange} maxLength={13} pattern="[A-Za-zÑñ&]{3,4}[0-9]{6}[A-Za-z0-9]{3}" required />
                      <Form.Text>Usa 12 caracteres para persona moral o 13 para persona física.</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>{renderTextArea('domicilioFiscal', 'Domicilio fiscal *', 'Calle, número, colonia, ciudad y estado')}</Col>
                  <Col md={6}>{renderTextArea('regimenFiscal', 'Régimen fiscal *', 'Régimen registrado ante el SAT')}</Col>
                </Row>
                <Row>
                  <Col md={6}>{renderTextArea('representanteLegal', 'Representante legal *', 'Nombre completo de la persona responsable')}</Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Teléfono de contacto *</Form.Label>
                      <Form.Control type="tel" name="telefonoContacto" value={formData.telefonoContacto} onChange={handleChange} pattern="[0-9+() -]{8,20}" required />
                    </Form.Group>
                  </Col>
                </Row>
              </div>
            )}

            {step === 2 && (
              <div className="registration-block">
                <div className="registration-block-title">Información institucional</div>
                <Row>
                  <Col md={6}>{renderTextArea('mision', 'Misión *', '¿Cuál es el propósito de la organización?')}</Col>
                  <Col md={6}>{renderTextArea('vision', 'Visión *', '¿Qué busca lograr la organización?')}</Col>
                </Row>
                <Row>
                  <Col md={6}>{renderTextArea('valores', 'Valores (uno por línea)')}</Col>
                  <Col md={6}>{renderTextArea('departamentos', 'Departamentos (uno por línea)')}</Col>
                </Row>
                <Row>
                  <Col md={6}>{renderTextArea('objetivos', 'Objetivos iniciales (uno por línea)')}</Col>
                  <Col md={6}>{renderTextArea('estrategias', 'Estrategias (uno por línea)')}</Col>
                </Row>
              </div>
            )}

            {step === 3 && (
              <div className="registration-block">
                <div className="registration-block-title">Acceso y planeación inicial</div>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Correo electrónico *</Form.Label>
                      <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} required />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Contraseña *</Form.Label>
                      <InputGroup>
                        <Form.Control
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          minLength={8}
                          required
                        />
                        <Button
                          variant="outline-secondary"
                          type="button"
                          onClick={() => setShowPassword(current => !current)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassword ? 'Ocultar' : 'Mostrar'}
                        </Button>
                      </InputGroup>
                      <Form.Text>Debe tener al menos 8 caracteres.</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>{renderTextArea('metas', 'Metas (una por línea)')}</Col>
                  <Col md={6}>{renderTextArea('indicadores', 'Indicadores (uno por línea)')}</Col>
                </Row>
                <div className="registration-subheading">Análisis FODA inicial</div>
                <Row>
                  <Col md={6}>{renderTextArea('fortalezas', 'Fortalezas (una por línea)')}</Col>
                  <Col md={6}>{renderTextArea('debilidades', 'Debilidades (una por línea)')}</Col>
                  <Col md={6}>{renderTextArea('oportunidades', 'Oportunidades (una por línea)')}</Col>
                  <Col md={6}>{renderTextArea('amenazas', 'Amenazas (una por línea)')}</Col>
                </Row>
                <div className="terms-consent">
                  <PrivacyNotice audience="company" />
                  <div className="registration-subheading">Términos y condiciones</div>
                  <details className="terms-details">
                    <summary>Leer términos y condiciones de Quorum</summary>
                    <div className="terms-content">
                      <p><strong>1. Objeto y alcance.</strong> Quorum es una plataforma de gestión empresarial para organizar información institucional, planeación estratégica, reuniones, indicadores, minutas, documentos, seguimientos y convocatorias. Estos términos regulan el registro, acceso y uso de las funciones disponibles para la empresa y las personas autorizadas por ella.</p>
                      <p><strong>2. Definiciones.</strong> “Empresa” es la organización registrada en Quorum; “usuario” es la persona que utiliza sus credenciales; “administrador” es la persona autorizada para revisar solicitudes empresariales; “contenido” incluye datos, textos, archivos, minutas, acuerdos, indicadores y cualquier información cargada o generada dentro de la plataforma.</p>
                      <p><strong>3. Requisitos de registro.</strong> Debes proporcionar información verdadera, completa y actualizada. La persona que registra una empresa declara que está autorizada para proporcionar sus datos y crear el acceso correspondiente. No debes registrar una empresa en nombre de otra persona sin autorización. Quorum puede rechazar, suspender o solicitar aclaraciones sobre registros incompletos, inconsistentes o que no puedan verificarse.</p>
                      <p><strong>4. Datos empresariales y fiscales.</strong> El registro puede incluir nombre comercial, tipo de persona, razón social, RFC, domicilio y régimen fiscal, representante legal, teléfono, correo, misión, visión, valores, departamentos, estrategias, metas, indicadores y análisis FODA. Estos datos se utilizan para identificar la cuenta, mostrar la información institucional y operar las funciones de gestión. La validación local del formato del RFC no constituye certificación, opinión ni validación fiscal ante una autoridad.</p>
                      <p><strong>5. Cuenta, contraseña y sesiones.</strong> El usuario debe proteger su correo y contraseña, no compartirlos y cerrar sesión en equipos compartidos. La sesión se mantiene mediante un token almacenado en el navegador durante su vigencia. Debes informar de inmediato a la persona responsable de la empresa si sospechas de un uso no autorizado. Quorum no solicitará tu contraseña por correo ni debe recibirla por medios distintos al formulario de acceso.</p>
                      <p><strong>6. Roles y autorización interna.</strong> La cuenta empresarial controla la información de su organización. La empresa es responsable de decidir quién puede acceder al sistema, qué datos puede registrar y qué documentos puede cargar. Las personas que agregues como directivos, participantes, responsables o coordinadores deben ser personas relacionadas con la operación de la empresa y deben tener autorización para que sus datos sean utilizados en ese contexto.</p>
                      <p><strong>7. Reuniones, acuerdos e indicadores.</strong> La empresa es responsable de la exactitud de las fechas, horarios, áreas, participantes, acuerdos, minutas, seguimientos e indicadores registrados. Los indicadores creados durante una reunión pueden asociarse a un departamento y reflejarse en el plan estratégico. Las marcas de avance son registros de gestión y no constituyen auditorías, certificaciones, resultados financieros ni garantías de cumplimiento.</p>
                      <p><strong>8. Documentos y archivos.</strong> Quorum permite cargar documentos PDF, Excel y Word asociados a reuniones, sujetos a los límites técnicos mostrados en la plataforma. Solo debes cargar archivos que tengas derecho y autorización para usar. No cargues malware, archivos dañados deliberadamente, información obtenida ilícitamente ni contenido que infrinja derechos de autor, secretos empresariales, obligaciones de confidencialidad o derechos de terceros. Debes conservar copias de respaldo de los archivos importantes.</p>
                      <p><strong>9. Contenido confidencial y datos de terceros.</strong> Antes de cargar información personal, financiera, fiscal, laboral, comercial o confidencial de otra persona, la empresa debe contar con una base legal, autorización o instrucción válida para hacerlo. Quorum no decide qué información está autorizada para ser compartida dentro de tu organización. Debes limitar el contenido a lo necesario para la finalidad de la reunión o gestión y evitar cargar datos sensibles que no sean necesarios.</p>
                      <p><strong>10. Convocatorias y correos.</strong> Cuando configures una convocatoria, Quorum puede enviar correos a los directivos registrados con correo válido de las áreas seleccionadas. La entrega depende de la configuración del servicio de correo, la conectividad, la validez de las direcciones y la aprobación administrativa de la empresa cuando aplique. La plataforma no garantiza que un correo llegue, sea leído o genere asistencia. La empresa debe verificar destinatarios, horarios y contenido antes de enviar.</p>
                      <p><strong>11. Verificación y revisión administrativa.</strong> Una empresa puede quedar pendiente, aprobada, rechazada o suspendida. La revisión administrativa sirve para controlar el acceso a determinadas funciones, especialmente el envío de convocatorias. Una aprobación no constituye certificación legal, fiscal, financiera, comercial ni de identidad. La empresa puede recibir observaciones y debe corregir la información cuando se le solicite.</p>
                      <p><strong>12. Usos prohibidos.</strong> Está prohibido utilizar Quorum para suplantar identidades, intentar acceder a otras cuentas, evadir controles, introducir código malicioso, interferir con el servicio, automatizar solicitudes abusivas, distribuir spam, almacenar contenido ilegal, vulnerar derechos de terceros o utilizar la información de la plataforma para una finalidad distinta de la gestión autorizada de la organización.</p>
                      <p><strong>13. Seguridad y reportes.</strong> Quorum aplica controles técnicos razonables según la implementación disponible, pero ningún sistema conectado a internet es absolutamente invulnerable. La empresa debe aplicar medidas internas de seguridad, limitar el acceso, mantener sus equipos protegidos y reportar errores, accesos sospechosos o exposición accidental de información. No intentes probar vulnerabilidades sobre cuentas o datos ajenos sin autorización expresa.</p>
                      <p><strong>14. Disponibilidad, cambios y mantenimiento.</strong> El servicio puede presentar interrupciones por mantenimiento, fallas de infraestructura, conectividad, configuración del correo u otras causas fuera del control inmediato de la plataforma. Las funciones, límites y estos términos pueden actualizarse para reflejar cambios técnicos, operativos o legales. Cuando se modifique la versión de los términos, se solicitará una nueva aceptación cuando sea necesario.</p>
                      <p><strong>15. Conservación y eliminación.</strong> La empresa debe revisar y mantener actualizada su información, eliminar contenido que ya no necesite y conservar respaldos propios. El cierre de sesión no elimina la cuenta ni los datos. La eliminación de reuniones, objetivos, documentos u otros registros puede ser permanente según la función utilizada. Antes de eliminar información, verifica que no sea necesaria para la operación, cumplimiento o respaldo de la empresa.</p>
                      <p><strong>16. Suspensión y terminación.</strong> Quorum puede limitar temporalmente el acceso o solicitar correcciones cuando exista un riesgo de seguridad, uso prohibido, información falsa, incumplimiento de estos términos o requerimiento legal. La empresa puede dejar de utilizar el servicio. La suspensión no elimina automáticamente las obligaciones de confidencialidad, autorización y responsabilidad sobre el contenido previamente cargado.</p>
                      <p><strong>17. Responsabilidad de la empresa.</strong> La empresa responde por la información que registra, las instrucciones que proporciona, los destinatarios de sus convocatorias, los archivos que carga, los permisos otorgados a sus usuarios y las decisiones que tome con base en los registros de Quorum. La plataforma es una herramienta de apoyo y no sustituye asesoría legal, fiscal, contable, laboral, financiera, de protección de datos ni de seguridad informática.</p>
                      <p><strong>18. Aceptación y constancia.</strong> Al marcar la casilla confirmas que leíste, comprendiste y aceptas estos términos, que cuentas con autorización para registrar la empresa y que la información proporcionada es correcta según tu conocimiento. La aceptación se registra junto con la versión y la fecha de aceptación asociadas al usuario que crea la cuenta.</p>
                      <p className="small text-muted mb-0">Versión: {TERMS_VERSION}. Estos términos describen el funcionamiento actual de Quorum. No sustituyen asesoría legal ni constituyen por sí mismos un aviso de privacidad completo, contrato de prestación de servicios o certificación de cumplimiento normativo.</p>
                    </div>
                  </details>
                  <Form.Check
                    type="checkbox"
                    id="termsAccepted"
                    name="termsAccepted"
                    checked={formData.termsAccepted}
                    onChange={event => setFormData(current => ({ ...current, termsAccepted: event.target.checked }))}
                    required
                    label="He leído y acepto los términos y condiciones de Quorum."
                  />
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between gap-2 mt-4">
              <Button variant="secondary" onClick={step === 1 ? onClose : () => setStep(current => current - 1)} disabled={loading}>
                {step === 1 ? 'Cancelar' : 'Anterior'}
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {step < 3 ? 'Continuar' : (loading ? 'Creando cuenta...' : 'Crear cuenta')}
              </Button>
            </div>
          </Form>
        )}
        {mode === 'registro' && (
          <p className="text-center small mt-3 mb-0">
            ¿Ya tienes cuenta?{' '}
            <Button variant="link" className="p-0 align-baseline" type="button" onClick={() => switchMode('login')}>
              Iniciar sesión
            </Button>
          </p>
        )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default AuthModal;
