import React, { useState } from 'react';
import { Row, Col, Card, Button, Form, Badge, Modal } from 'react-bootstrap';
import ApiService from '../services/apiService';
import ProductivityGraph from './ProductivityGraph';
import { getRecentMeetingObjectives, getStrategicProgress } from '../utils/strategicProgress';

const normalizeArea = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('es-MX');

const StrategicPlan = ({ objetivos, setObjetivos, companyData, reuniones }) => {
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [priorityFilter, setPriorityFilter] = useState('todas');
  const [scopeArea, setScopeArea] = useState('empresa');
  const [newObjective, setNewObjective] = useState({
    nombre: '',
    prioridad: 'media',
    descripcion: '',
    tasks: '',
    progreso: 0,
    status: 'pendiente',
    tipoArea: 'general', // 'general' o 'especifico'
    areasInvolucradas: []
  });

  const priorities = [
    { value: 'alta', label: 'Alta', color: '#0b2342', bg: '#b8e7fb' },
    { value: 'media', label: 'Media', color: '#0b477d', bg: '#dff5ff' },
    { value: 'baja', label: 'Baja', color: '#1677c8', bg: '#edf8ff' }
  ];

  const getPriorityInfo = (priority) => {
    return priorities.find(p => p.value === priority) || priorities[1];
  };

  const getStatusInfo = (status) => {
    const map = {
      'pendiente': { label: 'Pendiente', color: '#0b477d', bg: '#dff5ff' },
      'en-progreso': { label: 'En Progreso', color: '#0b3c69', bg: '#b8e7fb' },
      'completado': { label: 'Completado', color: '#06152b', bg: '#67c7f5' }
    };
    return map[status] || map['pendiente'];
  };

  const handleAddObjective = async (e) => {
    e.preventDefault();
    if (!newObjective.nombre.trim()) return;

    const objectiveData = {
      nombre: newObjective.nombre.trim(),
      prioridad: newObjective.prioridad,
      descripcion: newObjective.descripcion || '',
      progreso: parseInt(newObjective.progreso) || 0,
      status: newObjective.status || 'pendiente',
      tasks: newObjective.tasks.split('\n').filter(item => item.trim()),
      tipoArea: newObjective.tipoArea,
      areasInvolucradas: newObjective.tipoArea === 'especifico' ? newObjective.areasInvolucradas : ['General']
    };

    try {
      const response = await ApiService.createObjetivo(objectiveData);
      if (!response.success) {
        throw new Error(response.message || 'No se pudo guardar el objetivo');
      }
      const savedObjective = {
        ...response.data,
        id: response.data._id || response.data.id
      };
      setObjetivos([...objetivos, savedObjective]);
      setNewObjective({
        nombre: '', prioridad: 'media', descripcion: '',
        tasks: '', progreso: 0, status: 'pendiente',
        tipoArea: 'general', areasInvolucradas: []
      });
      setShowObjectiveModal(false);
    } catch (error) {
      console.error('Error al guardar objetivo:', error);
      alert(`No se guardó el objetivo. ${error.message || 'Inténtalo de nuevo.'}`);
    }
  };

  const updateObjective = async (id, data) => {
    try {
      const response = await ApiService.updateObjetivo(id, data);
      if (!response.success) {
        throw new Error(response.message || 'No se pudo actualizar el objetivo');
      }
      setObjetivos(current => current.map(obj =>
        String(obj.id || obj._id) === String(id) ? { ...obj, ...data } : obj
      ));
      return true;
    } catch (error) {
      console.error('Error al actualizar objetivo:', error);
      alert(`No se actualizó el objetivo. ${error.message || 'Inténtalo de nuevo.'}`);
      return false;
    }
  };

  const saveEditedObjective = async event => {
    event.preventDefault();
    if (!editingObjective?.nombre?.trim()) return;
    if (editingObjective.tipoArea === 'especifico' && !editingObjective.areasInvolucradas.length) return;
    const { id, _id, ...data } = editingObjective;
    const saved = await updateObjective(id || _id, {
      ...data,
      nombre: data.nombre.trim(),
      status: Number(data.progreso) >= 100
        ? 'completado'
        : Number(data.progreso) > 0 ? 'en-progreso' : 'pendiente',
      tasks: typeof data.tasks === 'string'
        ? data.tasks.split('\n').map(task => task.trim()).filter(Boolean)
        : data.tasks
    });
    if (saved) setEditingObjective(null);
  };

  const deleteObjective = async (id) => {
    if (window.confirm('¿Eliminar este objetivo?')) {
      try {
        const response = await ApiService.deleteObjetivo(id);
        if (!response.success) {
          throw new Error(response.message || 'No se pudo eliminar el objetivo');
        }
        setObjetivos(objetivos.filter(obj => obj.id !== id));
      } catch (error) {
        console.error('Error al eliminar objetivo:', error);
        alert(`No se eliminó el objetivo. ${error.message || 'Inténtalo de nuevo.'}`);
      }
    }
  };

  const completeAndDeleteObjective = async (id) => {
    if (!window.confirm('¿Marcar como completado y eliminar este objetivo?')) return;

    try {
      const updateResponse = await ApiService.updateObjetivo(id, {
        progreso: 100,
        status: 'completado'
      });
      if (!updateResponse.success) {
        throw new Error(updateResponse.message || 'No se pudo marcar el objetivo como completado');
      }
      setObjetivos(objetivos.map(obj =>
        obj.id === id ? { ...obj, progreso: 100, status: 'completado' } : obj
      ));

      const deleteResponse = await ApiService.deleteObjetivo(id);
      if (!deleteResponse.success) {
        throw new Error(deleteResponse.message || 'El objetivo se completó, pero no se pudo eliminar');
      }

      setObjetivos(objetivos.filter(obj => obj.id !== id));
    } catch (error) {
      console.error('Error al completar y eliminar objetivo:', error);
      alert(`No se completó el objetivo. ${error.message || 'Inténtalo de nuevo.'}`);
    }
  };

  const updateProgress = (id, progreso) => {
    const p = Math.min(100, Math.max(0, parseInt(progreso)));
    const status = p >= 100 ? 'completado' : p > 0 ? 'en-progreso' : 'pendiente';
    updateObjective(id, { progreso: p, status });
  };

  const addTask = (id, task) => {
    if (task.trim()) {
      const obj = objetivos.find(o => o.id === id);
      if (obj) {
        updateObjective(id, { tasks: [...(obj.tasks || []), task.trim()] });
      }
    }
  };

  const handleAreaToggle = (area) => {
    setNewObjective(prev => {
      const areas = prev.areasInvolucradas.includes(area)
        ? prev.areasInvolucradas.filter(a => a !== area)
        : [...prev.areasInvolucradas, area];
      return { ...prev, areasInvolucradas: areas };
    });
  };

  const recentMeetingObjectives = getRecentMeetingObjectives(reuniones);

  const subareaNames = new Set(
    [
      ...(companyData?.directivos || []),
      ...(companyData?.empleados || []).filter(employee => employee.dirigeSubareas)
    ]
      .flatMap(directivo => directivo.subareas || [])
      .map(area => String(area).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase())
  );
  const companyVisibleObjectives = objetivos.filter(objective =>
    objective.tipoArea === 'general' || !(objective.areasInvolucradas || []).some(area =>
      subareaNames.has(String(area).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase())
    )
  );

  const departments = companyData?.departamentos || [];
  const scopedObjectives = (scopeArea === 'empresa'
    ? companyVisibleObjectives
    : companyVisibleObjectives.filter(objective => objective.tipoArea !== 'general'
      && (objective.areasInvolucradas || []).some(area => normalizeArea(area) === normalizeArea(scopeArea))))
    .sort((a, b) => {
      const order = { alta: 0, media: 1, baja: 2 };
      return (order[a.prioridad] ?? 1) - (order[b.prioridad] ?? 1);
    });
  const scopedMeetings = scopeArea === 'empresa'
    ? reuniones
    : reuniones.filter(meeting => (meeting.departamentos || [])
      .some(area => normalizeArea(area) === normalizeArea(scopeArea)));
  const scopeLabel = scopeArea === 'empresa' ? 'Toda la empresa' : scopeArea;
  const meetingObjectives = scopeArea === 'empresa'
    ? recentMeetingObjectives
    : recentMeetingObjectives.filter(objective => normalizeArea(objective.area) === normalizeArea(scopeArea));
  const stats = {
    total: scopedObjectives.length,
    completados: scopedObjectives.filter(objective => objective.status === 'completado').length,
    enProgreso: scopedObjectives.filter(objective => objective.status === 'en-progreso').length,
    pendientes: scopedObjectives.filter(objective => objective.status === 'pendiente').length,
    progresoPromedio: getStrategicProgress(scopedObjectives, scopedMeetings)
  };
  const visibleObjectives = scopedObjectives.filter(obj => {
    const search = searchTerm.trim().toLocaleLowerCase('es-MX');
    const matchesSearch = !search
      || obj.nombre?.toLocaleLowerCase('es-MX').includes(search)
      || obj.descripcion?.toLocaleLowerCase('es-MX').includes(search)
      || (obj.areasInvolucradas || []).some(area => area.toLocaleLowerCase('es-MX').includes(search));
    const matchesStatus = statusFilter === 'todos' || obj.status === statusFilter;
    const matchesPriority = priorityFilter === 'todas' || obj.prioridad === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <h2 className="h4 mb-0">Plan Estrategico</h2>
      </div>

      <Card className="mb-3 productivity-scope-card">
        <Card.Body>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <strong>Vista de productividad</strong>
              <div className="small text-muted">Consulta el avance general o el de un departamento.</div>
            </div>
            <Form.Select
              aria-label="Seleccionar alcance de productividad"
              value={scopeArea}
              onChange={event => setScopeArea(event.target.value)}
              style={{ maxWidth: '280px' }}
            >
              <option value="empresa">Toda la empresa</option>
              {[...departments].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })).map(department => (
                <option key={department} value={department}>{department}</option>
              ))}
            </Form.Select>
          </div>
        </Card.Body>
      </Card>

      <ProductivityGraph objetivos={scopedObjectives} reuniones={scopedMeetings} scopeLabel={scopeLabel} />

      <Card className="strategic-summary-card mb-4">
        <Card.Body>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <div className="text-uppercase small text-muted fw-semibold">Resumen del plan</div>
              <h5 className="mb-1">
                {scopeArea === 'empresa' ? 'Avance estratégico global' : `Avance estratégico de ${scopeArea}`}
              </h5>
              <p className="text-muted small mb-0">
                Seguimiento de indicadores, prioridades y áreas involucradas para esta vista.
              </p>
            </div>
            <div className="text-end">
              <div className="strategic-summary-value">{stats.progresoPromedio}%</div>
              <div className="text-muted small">avance de las últimas 5 semanas</div>
            </div>
          </div>
          <div className="strategic-progress mt-3" aria-label={`Avance global ${stats.progresoPromedio}%`}>
            <div style={{ width: `${stats.progresoPromedio}%` }} />
          </div>
          <div className="d-flex flex-wrap gap-3 mt-3 small text-muted">
            <span><strong>{stats.total}</strong> indicadores en esta vista</span>
            <span><strong>{stats.completados}</strong> completados</span>
            <span><strong>{scopedMeetings.length}</strong> reuniones relacionadas</span>
          </div>
        </Card.Body>
      </Card>

      {meetingObjectives.length > 0 && (
        <Card className="mb-4">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="mb-1">Indicadores definidos en reuniones</h5>
                <p className="text-muted small mb-0">
                  Solo se consideran objetivos registrados durante las cinco semanas más recientes.
                </p>
              </div>
              <Badge bg="primary">{meetingObjectives.length}</Badge>
            </div>
            <Row className="g-3">
              {meetingObjectives.map((objective, index) => (
                <Col md={6} key={objective._id || `${objective.reunionId}-${index}`}>
                  <div className="border rounded p-3 h-100">
                    <div className="d-flex justify-content-between gap-2">
                      <strong>{objective.nombre}</strong>
                      <span className="small fw-semibold">{Number(objective.progreso) || 0}%</span>
                    </div>
                    <div className="small text-muted mt-1">
                      {objective.reunionTitulo} · {objective.fechaReunion}
                      {objective.area ? ` · ${objective.area}` : ''}
                    </div>
                    <div className="progress mt-2" role="progressbar" aria-valuenow={Number(objective.progreso) || 0} aria-valuemin="0" aria-valuemax="100">
                      <div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, Number(objective.progreso) || 0))}%` }} />
                    </div>
                    {objective.descripcion && <p className="small text-muted mb-0 mt-2">{objective.descripcion}</p>}
                  </div>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      )}
      <div className="d-flex justify-content-end mb-4">
        <Button className="strategic-add-button" onClick={() => setShowObjectiveModal(true)}>
          <span aria-hidden="true">+</span> Añadir indicador
        </Button>
      </div>

      <Row className="g-3 mb-4">
        {[
          { label: 'Total', value: stats.total, color: 'primary', hint: 'Indicadores activos' },
          { label: 'Completados', value: stats.completados, color: 'primary', hint: 'Listos para cerrar' },
          { label: 'En progreso', value: stats.enProgreso, color: 'primary', hint: 'Con actividad' },
          { label: 'Pendientes', value: stats.pendientes, color: 'primary', hint: 'Requieren atención' }
        ].map((stat, idx) => (
          <Col key={idx} md={3} sm={6}>
            <Card className="text-center h-100 strategic-stat-card">
              <Card.Body>
                <div className={`display-6 fw-bold text-${stat.color}`}>{stat.value}</div>
                <div className="text-muted small">{stat.label}</div>
                <div className="strategic-stat-hint">{stat.hint}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {scopedObjectives.length > 0 && (
        <Card className="mb-4 strategic-filters">
          <Card.Body>
            <Row className="g-2 align-items-end">
              <Col lg={6}>
                <Form.Label className="small text-muted mb-1">Buscar indicador</Form.Label>
                <Form.Control
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre, descripción o área..."
                />
              </Col>
              <Col sm={6} lg={3}>
                <Form.Label className="small text-muted mb-1">Estado</Form.Label>
                <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="todos">Todos los estados</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="en-progreso">En progreso</option>
                  <option value="completado">Completados</option>
                </Form.Select>
              </Col>
              <Col sm={6} lg={3}>
                <Form.Label className="small text-muted mb-1">Prioridad</Form.Label>
                <Form.Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                  <option value="todas">Todas las prioridades</option>
                  {priorities.map(priority => (
                    <option key={priority.value} value={priority.value}>{priority.label}</option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {scopedObjectives.length === 0 ? (
        <Card className="text-center p-5">
          <div className="text-muted">
            {scopeArea === 'empresa'
              ? 'No hay indicadores definidos'
              : `No hay indicadores definidos para ${scopeArea}.`}
          </div>
        </Card>
      ) : visibleObjectives.length === 0 ? (
        <Card className="text-center p-5">
          <div className="text-muted">No hay objetivos que coincidan con los filtros.</div>
          <Button
            variant="outline-primary"
            className="mt-3"
            onClick={() => { setSearchTerm(''); setStatusFilter('todos'); setPriorityFilter('todas'); }}
          >
            Limpiar filtros
          </Button>
        </Card>
      ) : (
        <Row className="g-3">
          {visibleObjectives.map(obj => {
            const priorityInfo = getPriorityInfo(obj.prioridad);
            const statusInfo = getStatusInfo(obj.status);
            const areasMostrar = obj.areasInvolucradas || ['General'];
            
            return (
              <Col key={obj.id} md={6} lg={4}>
                <Card className="h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h6 className="mb-0 fw-semibold">{obj.nombre}</h6>
                      <div className="d-flex gap-1">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => setEditingObjective({
                            ...obj,
                            areasInvolucradas: [...(obj.areasInvolucradas || [])],
                            tasks: (obj.tasks || []).join('\n')
                          })}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => completeAndDeleteObjective(obj.id)}
                        >
                          Completar
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="p-1"
                          onClick={() => deleteObjective(obj.id)}
                          aria-label={`Eliminar objetivo ${obj.nombre}`}
                        >
                          X
                        </Button>
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <Badge style={{ background: priorityInfo.bg, color: priorityInfo.color }}>
                        {priorityInfo.label}
                      </Badge>
                      <Badge style={{ background: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </Badge>
                      <Badge bg="secondary">
                        {obj.tipoArea === 'general' ? 'General' : areasMostrar.join(', ')}
                      </Badge>
                    </div>

                    {obj.descripcion && (
                      <p className="small text-muted mb-2">{obj.descripcion}</p>
                    )}

                    <div className="mb-2">
                      <div className="d-flex justify-content-between small">
                        <span>Progreso</span>
                        <span className="fw-semibold">{obj.progreso || 0}%</span>
                      </div>
                      <div className="progress" style={{ height: '6px' }}>
                        <div 
                          className="progress-bar" 
                          style={{ 
                            width: `${obj.progreso || 0}%`,
                            background: obj.progreso >= 70 ? '#2f80ed' : obj.progreso >= 30 ? '#67c7f5' : '#8bd3ff'
                          }}
                        />
                      </div>
                    </div>

                    <Form.Range
                      min="0"
                      max="100"
                      value={obj.progreso || 0}
                      onChange={(e) => updateProgress(obj.id, e.target.value)}
                      className="mb-2"
                      style={{ height: '4px' }}
                    />

                    <div className="d-flex gap-1">
                      <Form.Control
                        type="text"
                        size="sm"
                        placeholder="Agregar tarea..."
                        className="flex-grow-1"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTask(obj.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button 
                        variant="primary" 
                        size="sm" 
                        className="px-3"
                        onClick={(e) => {
                          const input = e.target.previousElementSibling;
                          if (input.value.trim()) {
                            addTask(obj.id, input.value);
                            input.value = '';
                          }
                        }}
                      >
                        +
                      </Button>
                    </div>

                    {obj.tasks && obj.tasks.length > 0 && (
                      <ul className="list-unstyled small mt-2 mb-0">
                        {obj.tasks.map((task, idx) => (
                          <li key={idx} className="border-bottom py-1">- {task}</li>
                        ))}
                      </ul>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal show={Boolean(editingObjective)} onHide={() => setEditingObjective(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Editar indicador estratégico</Modal.Title>
        </Modal.Header>
        {editingObjective && (
          <>
            <Modal.Body>
              <Form id="edit-indicator-form" onSubmit={saveEditedObjective}>
                <Form.Group className="mb-3">
                  <Form.Label>Nombre del indicador *</Form.Label>
                  <Form.Control
                    value={editingObjective.nombre}
                    onChange={event => setEditingObjective(current => ({ ...current, nombre: event.target.value }))}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Prioridad</Form.Label>
                  <Form.Select
                    value={editingObjective.prioridad}
                    onChange={event => setEditingObjective(current => ({ ...current, prioridad: event.target.value }))}
                  >
                    {priorities.map(priority => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Alcance</Form.Label>
                  <Form.Select
                    value={editingObjective.tipoArea}
                    onChange={event => setEditingObjective(current => ({
                      ...current,
                      tipoArea: event.target.value,
                      areasInvolucradas: event.target.value === 'general' ? [] : current.areasInvolucradas
                    }))}
                  >
                    <option value="general">Toda la empresa</option>
                    <option value="especifico">Departamentos específicos</option>
                  </Form.Select>
                </Form.Group>
                {editingObjective.tipoArea === 'especifico' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Departamentos involucrados</Form.Label>
                    <div className="d-flex flex-wrap gap-3">
                      {departments.map(department => (
                        <Form.Check
                          key={department}
                          type="checkbox"
                          label={department}
                          checked={editingObjective.areasInvolucradas.includes(department)}
                          onChange={() => setEditingObjective(current => ({
                            ...current,
                            areasInvolucradas: current.areasInvolucradas.includes(department)
                              ? current.areasInvolucradas.filter(area => area !== department)
                              : [...current.areasInvolucradas, department]
                          }))}
                        />
                      ))}
                    </div>
                  </Form.Group>
                )}
                <Form.Group className="mb-3">
                  <Form.Label>Descripción</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={editingObjective.descripcion || ''}
                    onChange={event => setEditingObjective(current => ({ ...current, descripcion: event.target.value }))}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Progreso (%)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    max="100"
                    value={editingObjective.progreso ?? 0}
                    onChange={event => setEditingObjective(current => ({ ...current, progreso: Number(event.target.value) }))}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Tareas (una por línea)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={editingObjective.tasks}
                    onChange={event => setEditingObjective(current => ({ ...current, tasks: event.target.value }))}
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditingObjective(null)}>Cancelar</Button>
              <Button
                type="submit"
                form="edit-indicator-form"
                disabled={!editingObjective.nombre.trim()
                  || (editingObjective.tipoArea === 'especifico' && !editingObjective.areasInvolucradas.length)}
              >
                Guardar cambios
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      <Modal show={showObjectiveModal} onHide={() => setShowObjectiveModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Nuevo indicador estratégico</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Nombre del indicador *</Form.Label>
              <Form.Control
                type="text"
                value={newObjective.nombre}
                onChange={(e) => setNewObjective({...newObjective, nombre: e.target.value})}
                required
                placeholder="Ejemplo: Incrementar ventas en 20%"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Prioridad *</Form.Label>
              <Form.Select
                value={newObjective.prioridad}
                onChange={(e) => setNewObjective({...newObjective, prioridad: e.target.value})}
                required
              >
                {priorities.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Areas Involucradas</Form.Label>
              <div className="mb-2">
                <Form.Check
                  type="radio"
                  label="General (Toda la empresa)"
                  name="tipoArea"
                  value="general"
                  checked={newObjective.tipoArea === 'general'}
                  onChange={() => setNewObjective({...newObjective, tipoArea: 'general', areasInvolucradas: []})}
                />
                <Form.Check
                  type="radio"
                  label="Departamento especifico"
                  name="tipoArea"
                  value="especifico"
                  checked={newObjective.tipoArea === 'especifico'}
                  onChange={() => setNewObjective({...newObjective, tipoArea: 'especifico'})}
                />
              </div>
            </Form.Group>

            {newObjective.tipoArea === 'especifico' && departments.length > 0 && (
              <Form.Group className="mb-3">
                <Form.Label>Selecciona los departamentos involucrados</Form.Label>
                <div className="d-flex flex-wrap gap-2">
                  {departments.map(dept => (
                    <Form.Check
                      key={dept}
                      type="checkbox"
                      label={dept}
                      checked={newObjective.areasInvolucradas.includes(dept)}
                      onChange={() => handleAreaToggle(dept)}
                    />
                  ))}
                </div>
                {newObjective.areasInvolucradas.length === 0 && (
                  <div className="text-muted small mt-1">Selecciona al menos un departamento</div>
                )}
              </Form.Group>
            )}

            {newObjective.tipoArea === 'especifico' && departments.length === 0 && (
              <Form.Group className="mb-3">
                <Form.Label className="text-warning">
                  No hay departamentos registrados. Crea departamentos en la seccion "Empresa" primero.
                </Form.Label>
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Descripcion</Form.Label>
              <Form.Control
                as="textarea"
                rows="2"
                value={newObjective.descripcion}
                onChange={(e) => setNewObjective({...newObjective, descripcion: e.target.value})}
                placeholder="Describe el indicador brevemente"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Progreso Inicial (%)</Form.Label>
              <Form.Control
                type="number"
                min="0"
                max="100"
                value={newObjective.progreso}
                onChange={(e) => setNewObjective({...newObjective, progreso: e.target.value})}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Tareas (una por linea)</Form.Label>
              <Form.Control
                as="textarea"
                rows="3"
                value={newObjective.tasks}
                onChange={(e) => setNewObjective({...newObjective, tasks: e.target.value})}
                placeholder="Tarea 1&#10;Tarea 2&#10;Tarea 3"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowObjectiveModal(false)}>Cancelar</Button>
          <Button 
            variant="primary" 
            onClick={handleAddObjective}
            disabled={newObjective.tipoArea === 'especifico' && newObjective.areasInvolucradas.length === 0}
          >
            Agregar indicador
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StrategicPlan;