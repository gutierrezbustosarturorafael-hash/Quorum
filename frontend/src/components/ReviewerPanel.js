import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, InputGroup, Modal, Table } from 'react-bootstrap';
import ApiService from '../services/apiService';

const ReviewerPanel = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [token, setToken] = useState(sessionStorage.getItem('reviewerToken'));
  const [companies, setCompanies] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [loadingCompanies, setLoadingCompanies] = useState(Boolean(token));
  const [showPassword, setShowPassword] = useState(false);

  const loadCompanies = async currentToken => {
    setLoadingCompanies(true);
    try {
      const response = await ApiService.getReviewerCompanies(currentToken);
      setCompanies(response.data || []);
      setMessage('');
    } catch (error) {
      sessionStorage.removeItem('reviewerToken');
      setToken(null);
      setMessage(error.message || 'No se pudo cargar la información. Recarga la página e inténtalo de nuevo.');
      throw error;
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    if (token) loadCompanies(token).catch(() => {});
  }, [token]);

  const login = async event => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await ApiService.reviewerLogin(credentials.email, credentials.password);
      sessionStorage.setItem('reviewerToken', response.token);
      setLoadingCompanies(true);
      setToken(response.token);
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'No se pudo iniciar sesión. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  const review = async (company, estado) => {
    const actionLabels = {
      aprobada: 'aprobar',
      rechazada: 'rechazar',
      suspendida: 'suspender'
    };
    if (!window.confirm(`¿Confirmas ${actionLabels[estado]} la solicitud de "${company.razonSocial}"?`)) return;
    const notas = window.prompt('Notas de la revisión (opcional):', company.verificacion?.notas || '');
    if (notas === null) return;
    setReviewingId(company._id);
    setMessage('');
    try {
      await ApiService.reviewCompany(company._id, estado, notas, token);
      await loadCompanies(token);
      setSelectedCompany(null);
    } catch (error) {
      setMessage(error.message || 'No se pudo actualizar la solicitud. Inténtalo de nuevo.');
    } finally {
      setReviewingId(null);
    }
  };

  const filteredCompanies = companies.filter(company => {
    const companyStatus = company.verificacion?.estado || 'pendiente';
    const normalizedSearch = search.trim().toLowerCase();
    const matchesStatus = statusFilter === 'todos' || companyStatus === statusFilter;
    const matchesSearch = !normalizedSearch || [
      company.nombre,
      company.razonSocial,
      company.rfc,
      company.representanteLegal
    ].some(value => String(value || '').toLowerCase().includes(normalizedSearch));
    return matchesStatus && matchesSearch;
  });

  const statusVariant = status => ({
    aprobada: 'success',
    rechazada: 'danger',
    suspendida: 'secondary',
    pendiente: 'warning'
  }[status] || 'warning');

  if (!token) {
    if (loadingCompanies) {
      return (
        <div className="reviewer-shell">
          <Card className="reviewer-login-card">
            <Card.Body className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando</span>
              </div>
              <p className="text-muted mt-3 mb-0">Cargando solicitudes empresariales...</p>
            </Card.Body>
          </Card>
        </div>
      );
    }

    return (
      <div className="reviewer-shell">
        <Card className="reviewer-login-card">
          <Card.Body>
            <span className="dashboard-eyebrow">Acceso administrativo</span>
            <h1 className="h4 mt-2">Administración y revisión</h1>
            <p className="text-muted small">Solo el administrador autorizado puede revisar solicitudes.</p>
            {message && <Alert variant="danger">{message}</Alert>}
            <Form onSubmit={login}>
              <Form.Control className="mb-3" type="email" placeholder="Correo del revisor" value={credentials.email} onChange={e => setCredentials({ ...credentials, email: e.target.value })} required />
              <InputGroup className="mb-3">
                <Form.Control
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={credentials.password}
                  onChange={e => setCredentials({ ...credentials, password: e.target.value })}
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
              <Button className="w-100" type="submit" disabled={loading}>{loading ? 'Validando...' : 'Entrar al panel'}</Button>
            </Form>
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div className="reviewer-shell">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <span className="dashboard-eyebrow">Panel administrativo</span>
          <h1 className="h3 mb-1">Administración y revisión de empresas</h1>
          <p className="text-muted mb-0">Revisa los datos fiscales y actualiza el estado de cada empresa.</p>
        </div>
        <Button variant="outline-secondary" onClick={() => { sessionStorage.removeItem('reviewerToken'); setToken(null); }}>Salir</Button>
      </div>
      {message && <Alert variant="danger">{message}</Alert>}
      <div className="reviewer-stats mb-4">
        {['pendiente', 'aprobada', 'rechazada', 'suspendida'].map(status => (
          <Card key={status}>
            <Card.Body>
              <span className="small text-muted text-capitalize">{status}</span>
              <strong>{companies.filter(company => (company.verificacion?.estado || 'pendiente') === status).length}</strong>
            </Card.Body>
          </Card>
        ))}
      </div>
      <Card>
        <Card.Body>
          <div className="reviewer-filters mb-3">
            <Form.Control
              type="search"
              placeholder="Buscar por empresa, razón social, RFC o representante..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <Form.Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobada">Aprobadas</option>
              <option value="rechazada">Rechazadas</option>
              <option value="suspendida">Suspendidas</option>
            </Form.Select>
          </div>
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead><tr><th>Empresa</th><th>Datos fiscales</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {filteredCompanies.map(company => (
                  <tr key={company._id}>
                    <td><button type="button" className="reviewer-company-link" onClick={() => setSelectedCompany(company)}><strong>{company.nombre}</strong></button><div className="small text-muted">{company.razonSocial}</div><div className="small text-muted">{company.tipoPersona === 'fisica' ? 'Persona física' : 'Persona moral'}</div></td>
                    <td><div className="small"><strong>RFC:</strong> {company.rfc}</div><div className="small text-muted">{company.regimenFiscal}</div><div className="small text-muted">{company.representanteLegal}</div></td>
                    <td><Badge bg={statusVariant(company.verificacion?.estado || 'pendiente')}>{company.verificacion?.estado || 'pendiente'}</Badge></td>
                    <td className="d-flex gap-2">
                      <Button size="sm" variant="success" disabled={reviewingId === company._id} onClick={() => review(company, 'aprobada')}>Aprobar</Button>
                      <Button size="sm" variant="outline-danger" disabled={reviewingId === company._id} onClick={() => review(company, 'rechazada')}>Rechazar</Button>
                      <Button size="sm" variant="outline-warning" disabled={reviewingId === company._id} onClick={() => review(company, 'suspendida')}>Suspender</Button>
                    </td>
                  </tr>
                ))}
                {!filteredCompanies.length && <tr><td colSpan={4} className="text-center text-muted py-4">No hay empresas que coincidan con los filtros.</td></tr>}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
      <Modal show={Boolean(selectedCompany)} onHide={() => setSelectedCompany(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Detalle de empresa</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedCompany && (
            <div className="reviewer-detail-grid">
              <div><span>Nombre comercial</span><strong>{selectedCompany.nombre}</strong></div>
              <div><span>Tipo de persona</span><strong>{selectedCompany.tipoPersona === 'fisica' ? 'Persona física' : 'Persona moral'}</strong></div>
              <div><span>Razón social</span><strong>{selectedCompany.razonSocial}</strong></div>
              <div><span>RFC</span><strong>{selectedCompany.rfc}</strong></div>
              <div><span>Régimen fiscal</span><strong>{selectedCompany.regimenFiscal}</strong></div>
              <div><span>Representante legal</span><strong>{selectedCompany.representanteLegal}</strong></div>
              <div><span>Teléfono</span><strong>{selectedCompany.telefonoContacto}</strong></div>
              <div className="reviewer-detail-wide"><span>Domicilio fiscal</span><strong>{selectedCompany.domicilioFiscal}</strong></div>
              <div className="reviewer-detail-wide"><span>Notas actuales</span><strong>{selectedCompany.verificacion?.notas || 'Sin notas registradas'}</strong></div>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ReviewerPanel;
