const getMeetingDate = meeting => {
  const date = new Date(`${meeting?.fecha || ''}T${meeting?.hora || '00:00'}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getWeekKey = date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay() || 7;
  normalized.setDate(normalized.getDate() - day + 1);
  return normalized.toISOString().slice(0, 10);
};

export const getMeetingObjectives = reuniones => {
  return (reuniones || [])
    .flatMap(reunion => {
      const date = getMeetingDate(reunion);
      return (reunion.objetivosDefinidos || []).map(objective => ({
        ...objective,
        reunionId: reunion.id || reunion._id,
        reunionTitulo: reunion.titulo,
        fechaReunion: reunion.fecha,
        fechaOrden: date
      }));
    })
    .filter(objective => objective.nombre && objective.fechaOrden);
};

export const getRecentMeetingObjectives = reuniones => {
  const objectives = getMeetingObjectives(reuniones)
    .sort((a, b) => b.fechaOrden - a.fechaOrden);
  const weeks = [];
  objectives.forEach(objective => {
    const week = getWeekKey(objective.fechaOrden);
    if (!weeks.includes(week) && weeks.length < 5) weeks.push(week);
  });
  return objectives.filter(objective => weeks.includes(getWeekKey(objective.fechaOrden)));
};

export const getStrategicProgress = (objetivos, reuniones) => {
  const meetingObjectives = getRecentMeetingObjectives(reuniones);
  if (meetingObjectives.length) {
    return Math.round(
      meetingObjectives.reduce((total, objective) => total + (Number(objective.progreso) || 0), 0)
      / meetingObjectives.length
    );
  }
  return objetivos?.length
    ? Math.round(objetivos.reduce((total, objective) => total + (Number(objective.progreso) || 0), 0) / objetivos.length)
    : 0;
};
