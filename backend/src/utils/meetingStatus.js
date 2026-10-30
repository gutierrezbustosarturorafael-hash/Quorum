const MEETING_STATUSES = ['pendiente', 'en_curso', 'finalizada'];
const normalizeMeetingStatus = (value, fallback = 'pendiente') => {
  const status = String(value ?? '').trim().toLowerCase();
  if (!status) return fallback;
  const aliases = { 'en-progreso': 'en_curso', en_progreso: 'en_curso', 'en curso': 'en_curso', completada: 'finalizada', completado: 'finalizada', finalizado: 'finalizada', cerrada: 'finalizada', completed: 'finalizada' };
  return aliases[status] || status;
};
module.exports = { MEETING_STATUSES, normalizeMeetingStatus };
