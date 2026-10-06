import React from 'react';

const PrivacyNotice = ({ audience = 'employee' }) => (
  <details className="terms-details">
    <summary>
      Leer aviso de privacidad {audience === 'company' ? 'para cuentas organizadoras' : 'para empleados'}
    </summary>
    <div className="terms-content">
      <p>
        <strong>Quién administra la información.</strong> La empresa que crea o vincula la cuenta
        administra la información de su organización y decide quién puede consultarla. Para dudas
        o solicitudes sobre tus datos, contacta a la persona organizadora o responsable de tu empresa.
        Este aviso describe el uso de la plataforma y no sustituye la información legal que la empresa
        deba proporcionarte.
      </p>
      <p>
        <strong>Qué información se registra.</strong>{' '}
        {audience === 'company'
          ? 'La cuenta organizadora puede incluir nombre y datos de contacto, correo, contraseña protegida, información fiscal y de representación, misión, visión, departamentos, estrategias, metas e indicadores.'
          : 'La cuenta de empleado puede incluir nombre, correo, contraseña protegida, empresa, puesto, departamento, subárea, responsabilidades de jefatura y, si se proporciona, teléfono y personas a cargo. También puede incluir tu misión, visión, valores, metas, estrategias y análisis FODA personales, además de indicadores vinculados a tu departamento y su avance.'}
        En ambos casos, la plataforma también puede guardar reuniones, invitaciones, documentos,
        acuerdos y avances que se agreguen al sistema.
      </p>
      <p>
        <strong>Para qué se utiliza.</strong> Para crear y administrar cuentas, mostrar información
        de la empresa, asignar permisos según el puesto y área, organizar reuniones, compartir
        documentos e indicadores y enviar convocatorias a los correos seleccionados por la empresa.
        La información estratégica personal y sus indicadores se vinculan al departamento y se muestran
        a la persona y a la organización que administra la cuenta.
        Las contraseñas se guardan protegidas y no se muestran en el directorio.
      </p>
      <p>
        <strong>Quién puede verla y dónde se procesa.</strong> La información puede ser consultada
        por las personas autorizadas de la empresa según su acceso. También puede procesarse en los
        servicios de alojamiento y correo que estén configurados para operar la plataforma. La empresa
        organizadora puede confirmar qué proveedores utiliza y cómo contactar a quien administra esos
        servicios.
      </p>
      <p>
        <strong>Conservación y solicitudes.</strong> Los datos permanecen mientras la empresa utilice
        la cuenta y los registros asociados, salvo que la empresa los elimine o deba conservarlos por
        otro motivo. Puedes pedir a la persona organizadora que revise, corrija o elimine información
        que te corresponda. Cerrar sesión no elimina la cuenta ni sus datos.
      </p>
      <p>
        Comparte solo información necesaria y autorizada. Antes de publicar este aviso como documento
        legal definitivo, la empresa debe completar sus datos de contacto y confirmar sus proveedores,
        plazos de conservación y obligaciones aplicables.
      </p>
    </div>
  </details>
);

export default PrivacyNotice;
