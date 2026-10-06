const EmpresaModel = require('../models/empresaModel');
const EmpresaController = require('../controllers/empresaController');

let schedulerRunning = false;

const processWeeklyMeetings = async () => {
  if (schedulerRunning) return;
  schedulerRunning = true;
  try {
    const meetings = await EmpresaModel.createNextWeeklyReunions();
    for (const meeting of meetings) {
      const invitation = await EmpresaController.sendMeetingInvitation(meeting.empresaId, meeting);
      if (!invitation.success) {
        console.warn(`La reunión semanal "${meeting.titulo}" se creó, pero no se envió su convocatoria: ${invitation.message}`);
      }
    }
  } catch (error) {
    console.error('No se pudieron generar las reuniones semanales:', error.message);
  } finally {
    schedulerRunning = false;
  }
};

const startWeeklyMeetingScheduler = () => {
  processWeeklyMeetings();
  const interval = setInterval(processWeeklyMeetings, 60 * 1000);
  interval.unref();
  return interval;
};

module.exports = { startWeeklyMeetingScheduler };
