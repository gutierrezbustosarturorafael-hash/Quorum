import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import ApiService from '../services/apiService';

const CompanyInfo = ({ companyData, setCompanyData, fodaData, setFodaData, initialEditing = false }) => {
  const [editing, setEditing] = useState(initialEditing);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState({
    nombre: companyData?.nombre || '',
    mision: companyData?.mision || '',
    vision: companyData?.vision || '',
    valores: companyData?.valores || [],
    estrategias: companyData?.estrategias || [],
    metas: companyData?.metas || [],
    indicadores: companyData?.indicadores || [],
    departamentos: companyData?.departamentos || []
  });

  const [fodaForm, setFodaForm] = useState({
    fortalezas: fodaData?.fortalezas || [],
    debilidades: fodaData?.debilidades || [],
    oportunidades: fodaData?.oportunidades || [],
    amenazas: fodaData?.amenazas || []
  });

  useEffect(() => {
    setFodaForm({
      fortalezas: fodaData?.fortalezas || [],
      debilidades: fodaData?.debilidades || [],
      oportunidades: fodaData?.oportunidades || [],
      amenazas: fodaData?.amenazas || []
    });
  }, [fodaData]);

  useEffect(() => {
    setEditing(initialEditing);
  }, [initialEditing]);

  useEffect(() => {
    if (companyData) {
      setFormData({
        nombre: companyData.nombre || '',
        mision: companyData.mision || '',
        vision: companyData.vision || '',
        valores: companyData.valores || [],
        estrategias: companyData.estrategias || [],
        metas: companyData.metas || [],
        indicadores: companyData.indicadores || [],
        departamentos: companyData.departamentos || []
      });
    }
  }, [companyData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setShowSuccess(false);

    try {
      const updatedCompany = { ...formData, foda: fodaForm };

      const response = await ApiService.updateEmpresa(updatedCompany);

      if (response.success) {
        if (response.empresaCompleta) {
          setCompanyData(current => ({
            ...current,
            ...response.empresaCompleta.empresa,
            empleados: response.empresaCompleta.empleados || current.empleados,
            smtpConvocatorias: current.smtpConvocatorias
          }));
          setFodaData(response.empresaCompleta.foda);
        } else {
          setCompanyData(current => ({
            ...current,
            ...updatedCompany,
            smtpConvocatorias: current.smtpConvocatorias
          }));
        }
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 4000);
        setEditing(false);
      } else {
        alert('No se guardaron los cambios. ' + (response.message || 'Inténtalo de nuevo.'));
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('No se guardaron los datos. ' + (error.message || 'Inténtalo de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFodaChange = (e) => {
    const { name, value } = e.target;
    setFodaForm(prev => ({ ...prev, [name]: value.split('\n').filter(item => item.trim()) }));
  };

  const handleArrayChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value.split('\n').filter(item => item.trim()) }));
  };

  const sections = [
    { key: 'valores', label: 'Valores' },
    { key: 'estrategias', label: 'Estrategias' },
    { key: 'metas', label: 'Metas' },
    { key: 'indicadores', label: 'Indicadores' },
    { key: 'departamentos', label: 'Departamentos' }
  ];

  if (!companyData) {
    return (
      <div className="text-center p-5">
        <p className="text-muted">No hay datos de la empresa registrados</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <h2 className="h4 mb-0">Informacion de la Empresa</h2>
        <div className="d-flex gap-2">
          {!editing && (
            <Button
              variant="primary"
              onClick={() => setEditing(true)}
              disabled={loading}
            >
              Editar
            </Button>
          )}
          {editing && (
            <Button
              variant="outline-secondary"
              onClick={() => {
                setEditing(false);
                setFormData({
                  nombre: companyData.nombre || '',
                  mision: companyData.mision || '',
                  vision: companyData.vision || '',
                  valores: companyData.valores || [],
                  estrategias: companyData.estrategias || [],
                  metas: companyData.metas || [],
                  indicadores: companyData.indicadores || [],
                  departamentos: companyData.departamentos || [],
                });
                setFodaForm({
                  fortalezas: fodaData?.fortalezas || [],
                  debilidades: fodaData?.debilidades || [],
                  oportunidades: fodaData?.oportunidades || [],
                  amenazas: fodaData?.amenazas || []
                });
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {showSuccess && (
        <Alert variant="success" className="mb-3">
          Datos guardados.
        </Alert>
      )}

      {editing ? (
        <Card>
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Nombre de la Empresa *</Form.Label>
                <Form.Control
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Mision *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows="3"
                  name="mision"
                  value={formData.mision}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Vision *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows="3"
                  name="vision"
                  value={formData.vision}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
              <Row>
                {sections.map(section => (
                  <Col key={section.key} md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{section.label} (uno por linea)</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows="4"
                        value={formData[section.key].join('\n')}
                        onChange={(e) => handleArrayChange(section.key, e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                ))}
              </Row>

              <h5 className="mt-3 mb-3">Analisis FODA</h5>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Fortalezas (uno por linea)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows="3"
                      name="fortalezas"
                      value={fodaForm.fortalezas.join('\n')}
                      onChange={handleFodaChange}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Debilidades (uno por linea)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows="3"
                      name="debilidades"
                      value={fodaForm.debilidades.join('\n')}
                      onChange={handleFodaChange}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Oportunidades (uno por linea)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows="3"
                      name="oportunidades"
                      value={fodaForm.oportunidades.join('\n')}
                      onChange={handleFodaChange}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Amenazas (uno por linea)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows="3"
                      name="amenazas"
                      value={fodaForm.amenazas.join('\n')}
                      onChange={handleFodaChange}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="text-end mt-3">
                <Button type="submit" variant="success" disabled={loading} size="lg">
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {[
            { key: 'nombre', label: 'Nombre', value: companyData.nombre },
            { key: 'mision', label: 'Mision', value: companyData.mision },
            { key: 'vision', label: 'Vision', value: companyData.vision }
          ].map(item => (
            <Col key={item.key} md={4} className="mb-3">
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small text-uppercase">{item.label}</div>
                  <div className="fw-semibold mt-1">{item.value}</div>
                </Card.Body>
              </Card>
            </Col>
          ))}
          {sections.map(section => (
            <Col key={section.key} md={4} className="mb-3">
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small text-uppercase">{section.label}</div>
                  <ul className="list-unstyled small mt-1 mb-0">
                    {companyData[section.key]?.map((item, idx) => (
                      <li key={idx} className="border-bottom py-1">{item}</li>
                    )) || <li className="text-muted">Sin datos</li>}
                  </ul>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

    </div>
  );
};

export default CompanyInfo;