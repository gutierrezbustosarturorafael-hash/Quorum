import React, { useState } from 'react';

const NewCompanyModal = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    mission: '',
    vision: '',
    values: '',
    objectives: '',
    strategies: '',
    goals: '',
    indicators: '',
    departments: '',
    fortalezas: '', 
    debilidades: '',
    oportunidades: '',
    amenazas: ''
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      mission: formData.mission,
      vision: formData.vision,
      values: formData.values.split('\n').filter(item => item.trim()),
      objectives: formData.objectives.split('\n').filter(item => item.trim()),
      strategies: formData.strategies.split('\n').filter(item => item.trim()),
      goals: formData.goals.split('\n').filter(item => item.trim()),
      indicators: formData.indicators.split('\n').filter(item => item.trim()),
      departments: formData.departments.split('\n').filter(item => item.trim()),
      fortalezas: formData.fortalezas.split('\n').filter(item => item.trim()),
      debilidades: formData.debilidades.split('\n').filter(item => item.trim()),
      oportunidades: formData.oportunidades.split('\n').filter(item => item.trim()),
      amenazas: formData.amenazas.split('\n').filter(item => item.trim())
    };
    onSave(data);
  };

  return (
    <div className="modal active">
      <div className="modal-content wide-modal">
        <span className="close" onClick={onClose}>&times;</span>
        <h3>Registrar Nueva Empresa</h3>
        <p className="modal-subtitle">Fecha de registro: {new Date().toISOString().split('T')[0]}</p>
        <form onSubmit={handleSubmit} className="company-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nombre de la Empresa *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Misión *</label>
              <textarea
                name="mission"
                value={formData.mission}
                onChange={handleChange}
                rows="3"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Visión *</label>
              <textarea
                name="vision"
                value={formData.vision}
                onChange={handleChange}
                rows="3"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Valores (uno por línea)</label>
              <textarea
                name="values"
                value={formData.values}
                onChange={handleChange}
                rows="3"
                placeholder="Calidad&#10;Innovación&#10;Compromiso"
              />
            </div>
            <div className="form-group">
              <label>Departamentos (uno por línea)</label>
              <textarea
                name="departments"
                value={formData.departments}
                onChange={handleChange}
                rows="3"
                placeholder="Producción&#10;Ventas&#10;Marketing"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Objetivos (uno por línea)</label>
              <textarea
                name="objectives"
                value={formData.objectives}
                onChange={handleChange}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Estrategias (uno por línea)</label>
              <textarea
                name="strategies"
                value={formData.strategies}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Metas (uno por línea)</label>
              <textarea
                name="goals"
                value={formData.goals}
                onChange={handleChange}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Indicadores (uno por línea)</label>
              <textarea
                name="indicators"
                value={formData.indicators}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>

          <h4 className="section-subtitle">Análisis FODA Inicial</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Fortalezas (uno por línea)</label>
              <textarea
                name="fortalezas"
                value={formData.fortalezas}
                onChange={handleChange}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Debilidades (uno por línea)</label>
              <textarea
                name="debilidades"
                value={formData.debilidades}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Oportunidades (uno por línea)</label>
              <textarea
                name="oportunidades"
                value={formData.oportunidades}
                onChange={handleChange}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Amenazas (uno por línea)</label>
              <textarea
                name="amenazas"
                value={formData.amenazas}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">Registrar Empresa</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCompanyModal;