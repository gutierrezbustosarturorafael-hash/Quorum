import React, { useMemo, useState } from 'react';
import { Card } from 'react-bootstrap';
import { getMeetingObjectives } from '../utils/strategicProgress';

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5', '#0f766e'];
const clampProgress = value => Math.min(100, Math.max(0, Number(value) || 0));
const normalize = value => String(value || '').trim().toLocaleLowerCase('es-MX');

const getIndicatorSeries = (objetivos, reuniones) => {
  const history = getMeetingObjectives(reuniones);
  const historyByName = history.reduce((recordsByName, record) => {
    const key = normalize(record.nombre);
    const records = recordsByName.get(key) || [];
    records.push(record);
    recordsByName.set(key, records);
    return recordsByName;
  }, new Map());

  return objetivos.map((objective, index) => {
    const involvedAreas = objective.tipoArea === 'general'
      ? []
      : objective.areasInvolucradas || [];
    const records = (historyByName.get(normalize(objective.nombre)) || [])
      .filter(record => !involvedAreas.length || involvedAreas.some(area => normalize(area) === normalize(record.area)))
      .map(record => ({
        date: record.fechaOrden,
        value: clampProgress(record.progreso)
      }))
      .sort((a, b) => a.date - b.date);

    const updatedAt = new Date(objective.updatedAt || objective.createdAt || Date.now());
    const current = { date: Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt, value: clampProgress(objective.progreso) };
    if (!records.length) {
      records.push(current);
    } else {
      const latest = records[records.length - 1];
      if (current.date > latest.date) {
        records.push(current);
      } else if (current.date.getTime() === latest.date.getTime()) {
        records[records.length - 1] = current;
      }
    }

    return {
      id: objective.id || objective._id || `${objective.nombre}-${index}`,
      name: objective.nombre,
      value: clampProgress(objective.progreso),
      color: COLORS[index % COLORS.length],
      records
    };
  });
};

const ProductivityGraph = ({ objetivos = [], reuniones = [], scopeLabel = 'Toda la empresa' }) => {
  const indicators = useMemo(() => getIndicatorSeries(objetivos, reuniones), [objetivos, reuniones]);
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(null);
  const [activePoint, setActivePoint] = useState(null);
  const activeIndicatorId = indicators.some(indicator => indicator.id === selectedIndicatorId)
    ? selectedIndicatorId
    : null;
  const width = 1000;
  const padding = { top: 18, right: 24, bottom: 34, left: 58 };
  const laneHeight = 84;
  const height = padding.top + indicators.length * laneHeight + padding.bottom;
  const chartWidth = width - padding.left - padding.right;
  const dateBounds = indicators.reduce((bounds, indicator) => indicator.records.reduce((current, record) => {
    const time = record.date.getTime();
    return {
      first: Math.min(current.first, time),
      last: Math.max(current.last, time)
    };
  }, bounds), { first: Infinity, last: -Infinity });
  const firstDate = Number.isFinite(dateBounds.first) ? dateBounds.first : 0;
  const lastDate = Number.isFinite(dateBounds.last) ? dateBounds.last : 0;
  const dateDuration = lastDate - firstDate;
  const chartIndicators = indicators.map((indicator, index) => {
    const domainMin = 0;
    const domainMax = 100;
    const domainRange = domainMax - domainMin;
    const laneTop = padding.top + index * laneHeight;
    const plotTop = laneTop + 22;
    const plotHeight = 48;
    const points = indicator.records.map(record => ({
      ...record,
      x: dateDuration > 0
        ? padding.left + ((record.date.getTime() - firstDate) / dateDuration) * chartWidth
        : padding.left + chartWidth / 2,
      y: plotTop + plotHeight - ((record.value - domainMin) / domainRange) * plotHeight
    }));
    return {
      ...indicator,
      domainMin,
      domainMax,
      laneTop,
      plotTop,
      plotHeight,
      points
    };
  });

  return (
    <Card className="mb-4 productivity-card">
      <Card.Body>
        <div className="mb-3">
          <h5 className="mb-1">Progreso de indicadores</h5>
          <p className="text-muted small mb-0">
            {scopeLabel} · evolución del avance en una escala común de 0 a 100%.
          </p>
        </div>
        {indicators.length ? (
          <>
            <div
              className={`productivity-chart-tooltip${activePoint ? '' : ' is-empty'}`}
              role="status"
              aria-live="polite"
              aria-hidden={!activePoint}
            >
              {activePoint && (
                <>
                  <span className="indicator-chart-swatch" style={{ background: activePoint.color }} aria-hidden="true" />
                  <strong>{activePoint.name}</strong>
                  <span>{activePoint.value}%</span>
                  <time dateTime={activePoint.date.toISOString()}>
                    {activePoint.date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </time>
                </>
              )}
            </div>
            <div className="productivity-chart-wrapper">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                role="group"
                aria-label={`Evolución del progreso de ${indicators.length} indicadores en escala de 0 a 100 por ciento`}
              >
                {chartIndicators.map((indicator, indicatorIndex) => {
                  const points = indicator.points;
                  const line = points.map(point => `${point.x},${point.y}`).join(' ');
                  const separatorY = indicator.laneTop + laneHeight;
                  const isSelected = activeIndicatorId === null || activeIndicatorId === indicator.id;
                  return (
                    <g
                      key={indicator.id}
                      className={isSelected ? 'productivity-series' : 'productivity-series productivity-series-muted'}
                    >
                      <text
                        x={padding.left - 10}
                        y={indicator.plotTop + 5}
                        textAnchor="end"
                        className="productivity-axis"
                      >
                        {Math.round(indicator.domainMax)}%
                      </text>
                      <text
                        x={padding.left - 10}
                        y={indicator.plotTop + indicator.plotHeight + 4}
                        textAnchor="end"
                        className="productivity-axis"
                      >
                        {Math.round(indicator.domainMin)}%
                      </text>
                      <line
                        x1={padding.left}
                        x2={width - padding.right}
                        y1={indicator.plotTop}
                        y2={indicator.plotTop}
                        className="productivity-grid"
                      />
                      <line
                        x1={padding.left}
                        x2={width - padding.right}
                        y1={indicator.plotTop + indicator.plotHeight}
                        y2={indicator.plotTop + indicator.plotHeight}
                        className="productivity-grid"
                      />
                      {points.length > 1 && (
                        <polyline
                          points={line}
                          fill="none"
                          stroke={indicator.color}
                          strokeWidth="3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          pathLength="1"
                          className="productivity-line"
                          style={{ animationDelay: `${Math.min(indicatorIndex * 90, 810)}ms` }}
                        />
                      )}
                      {points.map((point, pointIndex) => (
                        <g
                          key={`${point.date.toISOString()}-${pointIndex}`}
                          className="productivity-point"
                          role="img"
                          tabIndex="0"
                          aria-label={`${indicator.name}: ${point.value}% el ${point.date.toLocaleDateString('es-MX')}`}
                          onMouseEnter={() => setActivePoint({ ...point, name: indicator.name, color: indicator.color, seriesId: indicator.id })}
                          onMouseLeave={() => setActivePoint(current => current?.seriesId === indicator.id && current?.date === point.date ? null : current)}
                          onFocus={() => setActivePoint({ ...point, name: indicator.name, color: indicator.color, seriesId: indicator.id })}
                          onBlur={() => setActivePoint(current => current?.seriesId === indicator.id && current?.date === point.date ? null : current)}
                        >
                          <circle cx={point.x} cy={point.y} r="4" fill={indicator.color} />
                        </g>
                      ))}
                      {indicator !== chartIndicators[chartIndicators.length - 1] && (
                        <line
                          x1={padding.left}
                          x2={width - padding.right}
                          y1={separatorY}
                          y2={separatorY}
                          className="productivity-separator"
                        />
                      )}
                    </g>
                  );
                })}
                <text x={padding.left} y={height - 8} textAnchor="start" className="productivity-axis">
                  {new Date(firstDate).toLocaleDateString('es-MX')}
                </text>
                <text x={width - padding.right} y={height - 8} textAnchor="end" className="productivity-axis">
                  {new Date(lastDate).toLocaleDateString('es-MX')}
                </text>
              </svg>
            </div>
            <div className="productivity-indicator-legend" aria-label="Filtrar indicadores de la gráfica">
              {chartIndicators.map(indicator => (
                <button
                  key={indicator.id}
                  type="button"
                  className={`productivity-indicator-legend-item${activeIndicatorId === indicator.id ? ' is-selected' : ''}`}
                  aria-pressed={activeIndicatorId === indicator.id}
                  onClick={() => setSelectedIndicatorId(current => current === indicator.id ? null : indicator.id)}
                >
                  <span className="indicator-chart-swatch" style={{ background: indicator.color }} aria-hidden="true" />
                  <span className="text-truncate">{indicator.name}</span>
                  <strong style={{ color: indicator.color }}>{indicator.value}%</strong>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-muted small">Agrega indicadores para consultar su progreso.</div>
        )}
      </Card.Body>
    </Card>
  );
};

export default ProductivityGraph;
