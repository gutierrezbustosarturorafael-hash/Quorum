import React, { useState, useEffect } from 'react';
import { Container, Navbar, Nav, Button, Modal } from 'react-bootstrap';
import './App.css';
import MeetingManager from './components/MeetingManager';
import StrategicPlan from './components/StrategicPlan';
import Dashboard from './components/Dashboard';
import AuthModal from './components/AuthModal';
import LightRays from './components/LightRays/LightRays';
import GooeyNav from './components/GooeyNav/GooeyNav';
import Settings from './components/Settings';
import ApiService from './services/apiService';
import ReviewerPanel from './components/ReviewerPanel';
import EmployeePortal from './components/EmployeePortal';

function App() {
  const employeeRoute = window.location.pathname.match(/^\/empleados(?:\/([^/]+))?\/?$/);
  if (employeeRoute) {
    return <EmployeePortal companyId={employeeRoute[1] || ''} />;
  }
  return <OrganizerApp />;
}

function OrganizerApp() {
  const isReviewerPath = ['/revisiones', '/administracion'].includes(window.location.pathname);
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('quorumHomeTab') || 'inicio';
    return savedTab === 'configuracion' ? 'inicio' : savedTab;
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [interfacePreferences, setInterfacePreferences] = useState(() => ({
    theme: localStorage.getItem('quorumTheme') || 'light',
    homeTab: localStorage.getItem('quorumHomeTab') === 'configuracion'
      ? 'inicio'
      : localStorage.getItem('quorumHomeTab') || 'inicio',
    density: localStorage.getItem('quorumDensity') || 'comfortable',
    animations: localStorage.getItem('quorumAnimations') !== 'false'
  }));
  const [meetingPreferences, setMeetingPreferences] = useState(() => ({
    defaultDuration: localStorage.getItem('quorumDefaultDuration') || '',
    defaultLocation: localStorage.getItem('quorumDefaultLocation') || '',
    confirmDelete: localStorage.getItem('quorumConfirmDelete') !== 'false'
  }));
  const [documentPreferences, setDocumentPreferences] = useState(() => ({
    folioPrefix: localStorage.getItem('quorumFolioPrefix') || 'MIN',
    includeInstitution: localStorage.getItem('quorumIncludeInstitution') !== 'false',
    includeSignatures: localStorage.getItem('quorumIncludeSignatures') !== 'false'
  }));
  
  const [companyData, setCompanyData] = useState(null);
  const [fodaData, setFodaData] = useState(null);
  const [reuniones, setReuniones] = useState([]);
  const [objetivos, setObjetivos] = useState([]);
  const updateInterfacePreferences = changes => {
    const updated = { ...interfacePreferences, ...changes };
    setInterfacePreferences(updated);
    localStorage.setItem('quorumTheme', updated.theme);
    localStorage.setItem('quorumHomeTab', updated.homeTab);
    localStorage.setItem('quorumDensity', updated.density);
    localStorage.setItem('quorumAnimations', String(updated.animations));
    if (changes.homeTab) setActiveTab(changes.homeTab);
  };

  const updateMeetingPreferences = changes => {
    const updated = { ...meetingPreferences, ...changes };
    setMeetingPreferences(updated);
    localStorage.setItem('quorumDefaultDuration', updated.defaultDuration);
    localStorage.setItem('quorumDefaultLocation', updated.defaultLocation);
    localStorage.setItem('quorumConfirmDelete', String(updated.confirmDelete));
  };

  const updateDocumentPreferences = changes => {
    const updated = { ...documentPreferences, ...changes };
    setDocumentPreferences(updated);
    localStorage.setItem('quorumFolioPrefix', updated.folioPrefix);
    localStorage.setItem('quorumIncludeInstitution', String(updated.includeInstitution));
    localStorage.setItem('quorumIncludeSignatures', String(updated.includeSignatures));
  };

  useEffect(() => {
    const nativeAlert = window.alert;
    localStorage.removeItem('quorumEmployeeAccessKey');
    window.alert = message => {
      setNotification({
        message: String(message),
        type: String(message).toLowerCase().includes('error') ? 'error' : 'info'
      });
    };
    const token = localStorage.getItem('token');
    if (!isReviewerPath && token) {
      loadData();
    } else if (isReviewerPath || !token) {
      setIsLoading(false);
    }
    return () => {
      window.alert = nativeAlert;
    };
  }, [isReviewerPath]);

  useEffect(() => {
    document.body.classList.toggle('dark-theme', interfacePreferences.theme === 'dark');
    return () => document.body.classList.remove('dark-theme');
  }, [interfacePreferences.theme]);

  if (isReviewerPath) {
    return <ReviewerPanel />;
  }

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await ApiService.getEmpresa();
      if (response.success && response.data) {
        const { empresa, foda, objetivos, reuniones } = response.data;
        const directivos = (empresa?.directivos || []).map(directivo => ({
          ...directivo,
          id: directivo.id || directivo._id
        }));
        setCompanyData({
          ...empresa,
          directivos,
          empleados: response.data.empleados || [],
          codigoInvitacion: response.data.codigoInvitacion,
          smtpConvocatorias: response.data.smtpConvocatorias || { configured: false },
          planEstrategico: response.data.planEstrategico || empresa.planEstrategico
        });
        setFodaData(foda);
        setObjetivos((objetivos || []).map(objetivo => ({
          ...objetivo,
          id: objetivo.id || objetivo._id
        })));
        setReuniones((reuniones || []).map(reunion => ({
          ...reunion,
          id: reunion.id || reunion._id,
          seguimientos: (reunion.seguimientos || []).map(seguimiento => ({
            ...seguimiento,
            id: seguimiento.id || seguimiento._id
          }))
        })));
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      localStorage.removeItem('token');
      setIsAuthenticated(false);
    }
    setIsLoading(false);
  };

  const handleAuth = async (data) => {
    try {
      let response;
      if (authMode === 'registro') {
        response = await ApiService.register(data);
      } else {
        response = await ApiService.login(data.email, data.password);
      }
      
      if (response.success) {
        localStorage.setItem('token', response.token);
        await loadData();
        setShowAuthModal(false);
      }
    } catch (error) {
      console.error('Auth error:', error);
      const supportMessage = error.supportEmail
        ? `${error.message || 'No se pudo completar el registro'}\n\nSoporte técnico: ${error.supportEmail}`
        : (error.message || 'Error en autenticacion');
      alert(supportMessage);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setShowSettingsModal(false);
    setIsAuthenticated(false);
    setCompanyData(null);
    setReuniones([]);
    setObjetivos([]);
  };

  const tabs = [
    { key: 'inicio', label: 'Inicio' },
    { key: 'reuniones', label: 'Reuniones' },
    { key: 'estrategico', label: 'Plan Estrategico' },
    { key: 'empresa', label: 'Empresa' },
    { key: 'configuracion', label: '⚙', title: 'Configuración', ariaLabel: 'Abrir configuración' }
  ];
  const handleNavigation = index => {
    const selectedTab = tabs[index]?.key;
    if (selectedTab === 'configuracion') {
      setShowSettingsModal(true);
      return;
    }
    if (selectedTab) setActiveTab(selectedTab);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-3 text-muted">Cargando Quorum...</p>
      </div>
    );
  }

  return (
    <div className={`App ${interfacePreferences.theme}-theme density-${interfacePreferences.density} ${interfacePreferences.animations ? '' : 'reduce-motion'}`}>
      <Navbar bg="dark" variant="dark" expand="lg" className="app-navbar">
        <Container fluid>
          <Navbar.Brand className="d-flex align-items-center gap-2">
            <div className="logo-placeholder">Q</div>
            <span className="brand-text">Quorum</span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto align-items-center gap-2">
              {isAuthenticated ? (
                <>
                  <GooeyNav
                    items={tabs}
                    activeIndex={showSettingsModal ? tabs.findIndex(tab => tab.key === 'configuracion') : tabs.findIndex(tab => tab.key === activeTab)}
                    onItemSelect={handleNavigation}
                  />
                </>
              ) : (
                <>
                  <Button variant="outline-light" size="sm" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
                    Iniciar Sesion
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => { setAuthMode('registro'); setShowAuthModal(true); }}>
                    Crear Cuenta
                  </Button>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <div className="app-background-rays" aria-hidden="true">
        <LightRays
          active={interfacePreferences.animations}
          raysOrigin="top-center"
          raysColor="#3b82f6"
          raysSpeed={0.35}
          lightSpread={1.2}
          rayLength={1.4}
          fadeDistance={1.2}
          followMouse
          mouseInfluence={0.06}
          noiseAmount={0.04}
          distortion={0.02}
        />
      </div>

      <Container fluid className="main-content">
        {isAuthenticated ? (
          <>
            {activeTab === 'inicio' && (
              <Dashboard 
                companyData={companyData} 
                setCompanyData={setCompanyData}
                fodaData={fodaData} 
                setFodaData={setFodaData}
                reuniones={reuniones}
                objetivos={objetivos}
              />
            )}
            {activeTab === 'reuniones' && (
              <MeetingManager 
                reuniones={reuniones}
                setReuniones={setReuniones}
                companyData={companyData}
                objetivos={objetivos}
                setObjetivos={setObjetivos}
                meetingPreferences={meetingPreferences}
                documentPreferences={documentPreferences}
              />
            )}
            {activeTab === 'estrategico' && (
              <StrategicPlan 
                objetivos={objetivos}
                setObjetivos={setObjetivos}
                companyData={companyData}
                reuniones={reuniones}
              />
            )}
            {activeTab === 'empresa' && (
              <Settings
                section="empresa"
                companyData={companyData}
                setCompanyData={setCompanyData}
                fodaData={fodaData}
                setFodaData={setFodaData}
                onLogout={handleLogout}
                interfacePreferences={interfacePreferences}
                updateInterfacePreferences={updateInterfacePreferences}
                meetingPreferences={meetingPreferences}
                updateMeetingPreferences={updateMeetingPreferences}
                documentPreferences={documentPreferences}
                updateDocumentPreferences={updateDocumentPreferences}
              />
            )}
          </>
        ) : (
          <div className="text-center p-5">
            <h2>Bienvenido a Quorum</h2>
            <p className="text-muted">Inicia sesion o crea una cuenta para comenzar</p>
            <div className="d-flex gap-3 justify-content-center mt-3">
              <Button variant="primary" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
                Iniciar Sesion
              </Button>
              <Button variant="outline-primary" onClick={() => { setAuthMode('registro'); setShowAuthModal(true); }}>
                Crear Cuenta
              </Button>
            </div>
            <div className="mt-4">
              <p className="text-muted mb-2">¿Eres empleado?</p>
              <Button as="a" href="/empleados" variant="outline-primary">
                Haz clic aquí para entrar
              </Button>
            </div>
            <div className="admin-entry mt-5 pt-4">
              <p className="text-muted small mb-2">¿Eres administrador?</p>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => window.location.assign('/administracion')}
              >
                Acceso administrativo
              </Button>
            </div>
          </div>
        )}
      </Container>

      {notification && (
        <div className={`app-notification app-notification-${notification.type}`} role="status">
          <div className="app-notification-icon" aria-hidden="true">
            {notification.type === 'error' ? '!' : 'i'}
          </div>
          <div className="flex-grow-1">
            <strong>{notification.type === 'error' ? 'Ocurrió un problema' : 'Aviso'}</strong>
            <div>{notification.message}</div>
          </div>
          <button
            type="button"
            className="app-notification-close"
            aria-label="Cerrar notificación"
            onClick={() => setNotification(null)}
          >
            ×
          </button>
        </div>
      )}

      <Modal
        show={showSettingsModal}
        onHide={() => setShowSettingsModal(false)}
        centered
        size="xl"
        scrollable
        className="organizer-settings-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Configuración</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Settings
            companyData={companyData}
            setCompanyData={setCompanyData}
            fodaData={fodaData}
            setFodaData={setFodaData}
            onLogout={handleLogout}
            interfacePreferences={interfacePreferences}
            updateInterfacePreferences={updateInterfacePreferences}
            meetingPreferences={meetingPreferences}
            updateMeetingPreferences={updateMeetingPreferences}
            documentPreferences={documentPreferences}
            updateDocumentPreferences={updateDocumentPreferences}
          />
        </Modal.Body>
      </Modal>

      <AuthModal
        show={showAuthModal}
        mode={authMode}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuth}
      />
    </div>
  );
}

export default App;