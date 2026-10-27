const nodemailer = require('nodemailer');

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

class EmailService {
  createTransporter(smtpConfig) {
    const providers = {
      gmail: { host: 'smtp.gmail.com', port: 465, secure: true },
      outlook: { host: 'smtp-mail.outlook.com', port: 587, secure: false }
    };
    const provider = providers[smtpConfig?.provider];
    if (!provider || !smtpConfig.email || !smtpConfig.password) {
      const error = new Error('Configura y verifica un correo de Gmail u Outlook para esta empresa.');
      error.statusCode = 400;
      throw error;
    }
    return nodemailer.createTransport({
      ...provider,
      requireTLS: !provider.secure,
      auth: {
        user: smtpConfig.email,
        pass: smtpConfig.password.replace(/\s+/g, '')
      },
      tls: { rejectUnauthorized: true },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
  }

  async verifySmtpCredentials(smtpConfig) {
    const transporter = this.createTransporter(smtpConfig);
    try {
      await transporter.verify();
    } finally {
      transporter.close();
    }
  }

  getVerificationError(error) {
    const code = String(error?.code || '').toUpperCase();
    const responseCode = Number(error?.responseCode);
    if (code === 'EAUTH' || [530, 534, 535].includes(responseCode)) {
      return 'Gmail u Outlook no aceptó el acceso. Comprueba que la dirección esté escrita correctamente y usa la contraseña especial de aplicación, no la contraseña normal. En Gmail debes activar la verificación en dos pasos para crearla.';
    }
    if (code === 'ENOTFOUND') {
      return 'No se pudo localizar el servicio de correo. Comprueba la conexión a Internet e inténtalo de nuevo.';
    }
    if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNREFUSED'].includes(code)) {
      return 'No se pudo conectar con Gmail u Outlook. Comprueba la conexión a Internet e inténtalo de nuevo más tarde.';
    }
    if (responseCode >= 500) {
      return 'El servicio de correo rechazó la solicitud. Revisa la dirección y la contraseña especial de aplicación e inténtalo de nuevo.';
    }
    return 'No se pudo verificar el correo. Comprueba el servicio, la dirección y la contraseña especial de aplicación.';
  }

  async sendEmail(to, subject, html, text, smtpConfig, senderName) {
    let transporter;
    try {
      const recipients = to.split(',').map(email => email.trim()).filter(Boolean);
      if (!recipients.length) {
        return { success: false, message: 'No hay correos válidos para enviar la convocatoria.' };
      }
      transporter = this.createTransporter(smtpConfig);
      const mailOptions = {
        from: {
          name: `${senderName} · Quorum`,
          address: smtpConfig.email
        },
        replyTo: smtpConfig.email,
        to: recipients.join(', '),
        subject,
        html: html || text || '',
        text: text || html || ''
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Correo enviado a:', recipients.length, 'destinatarios');
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error enviando correo:', error.message);
      return {
        success: false,
        message: 'No se pudo enviar el correo. Comprueba que la cuenta siga activa y autorizada para enviar mensajes.'
      };
    } finally {
      transporter?.close();
    }
  }

  generateConvocatoria(meeting, empresaNombre, directivos) {
    const fecha = new Date(meeting.fecha);
    const fechaFormateada = fecha.toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const tipos = {
      general: 'Reunión',
      'check-in': 'Check-in Meeting',
      'exco': 'Exco Meeting (Comite Ejecutivo)',
      'wrap-up': 'Wrap-up Meeting',
      'one-to-one': 'One-to-One Meeting',
      'strategic': 'Strategic Meeting',
      'operational': 'Operational Meeting',
      'review': 'Review Meeting',
      'planning': 'Planning Meeting',
      'all-hands': 'All-Hands Meeting',
      'board': 'Board Meeting (Junta Directiva)',
      'emergency': 'Emergency Meeting',
      'training': 'Training Meeting'
    };

    const tipoLabel = tipos[meeting.tipoReunion] || meeting.tipoReunion;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><style>
        body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #1a3a5c; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
        .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
        .info-label { font-weight: bold; width: 120px; color: #1a3a5c; }
        .info-value { flex: 1; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center; }
        .badge { background: #2a7aba; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px; display: inline-block; }
        .directivos-list { margin: 10px 0; padding-left: 20px; }
        .directivos-list li { padding: 4px 0; }
      </style></head>
      <body>
        <div class="header">
          <h2 style="margin:0;">Convocatoria de Reunion</h2>
          <p style="margin:5px 0 0; opacity:0.8;">${escapeHtml(empresaNombre)}</p>
        </div>
        <div class="content">
          <h3 style="color:#1a3a5c;">${escapeHtml(meeting.titulo)}</h3>
          <p><span class="badge">${escapeHtml(tipoLabel)}</span></p>
          <div class="info-row"><span class="info-label">Fecha</span><span class="info-value">${escapeHtml(fechaFormateada)}</span></div>
          <div class="info-row"><span class="info-label">Hora</span><span class="info-value">${escapeHtml(meeting.hora)}</span></div>
          <div class="info-row"><span class="info-label">Duracion</span><span class="info-value">${escapeHtml(meeting.duracion || 'No especificada')}</span></div>
          <div class="info-row"><span class="info-label">Lugar</span><span class="info-value">${escapeHtml(meeting.lugar || 'No especificado')}</span></div>
          <div class="info-row"><span class="info-label">Coordinador</span><span class="info-value">${escapeHtml(meeting.coordinador || 'No especificado')}</span></div>
          ${meeting.objetivo ? `<div style="margin:15px 0;padding:15px;background:#f0f4f8;border-radius:6px;"><strong>Objetivo</strong><p style="margin:5px 0 0;">${escapeHtml(meeting.objetivo)}</p></div>` : ''}
          ${meeting.agenda && meeting.agenda.length > 0 ? `<div style="margin:15px 0;"><strong>Agenda</strong><ul style="margin:5px 0 0;padding-left:20px;">${meeting.agenda.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}
          ${directivos && directivos.length > 0 ? `<div style="margin:15px 0;"><strong>Personas convocadas</strong><ul class="directivos-list">${directivos.map(d => `<li>${escapeHtml(d.nombre)}${d.area ? ` (${escapeHtml(d.area)})` : ''}${d.email ? ` · ${escapeHtml(d.email)}` : ''}</li>`).join('')}</ul></div>` : ''}
          <div style="margin-top:20px;text-align:center;"><p style="font-size:14px;color:#666;">Por favor confirmar asistencia a la brevedad.</p></div>
          <div class="footer"><p>Este es un correo automatico generado por Quorum.</p><p>${new Date().toLocaleString()}</p></div>
        </div>
      </body>
      </html>
    `;

    const text = `CONVOCATORIA DE REUNION\n=======================\n\nEmpresa: ${empresaNombre}\nTitulo: ${meeting.titulo}\nTipo: ${tipoLabel}\n\nFecha: ${fechaFormateada}\nHora: ${meeting.hora}\nDuracion: ${meeting.duracion || 'No especificada'}\nLugar: ${meeting.lugar || 'No especificado'}\nCoordinador: ${meeting.coordinador || 'No especificado'}\n\n${meeting.objetivo ? 'Objetivo: ' + meeting.objetivo + '\n' : ''}${meeting.agenda && meeting.agenda.length > 0 ? 'Agenda:\n' + meeting.agenda.map(item => '  - ' + item).join('\n') + '\n' : ''}    ${directivos && directivos.length > 0 ? 'Personas convocadas:\n' + directivos.map(d => '  - ' + d.nombre + (d.area ? ' (' + d.area + ')' : '') + (d.email ? ' <' + d.email + '>' : '')).join('\n') + '\n' : ''}---\nEste es un correo automatico generado por Quorum.\n${new Date().toLocaleString()}`;

    return { html, text };
  }

  async sendConvocatoria(meeting, empresaNombre, directivos, smtpConfig) {
    if (!directivos || directivos.length === 0) {
      return { success: false, message: 'No hay directivos para convocar' };
    }
    const emails = directivos.map(d => d.email).filter(Boolean);
    if (emails.length === 0) {
      return { success: false, message: 'No hay correos validos' };
    }
    const subject = `[SGE] Convocatoria: ${meeting.titulo}`;
    const { html, text } = this.generateConvocatoria(meeting, empresaNombre, directivos);
    return this.sendEmail(emails.join(','), subject, html, text, smtpConfig, empresaNombre);
  }
}

module.exports = new EmailService();