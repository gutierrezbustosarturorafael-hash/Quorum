const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  static getValidationDetails(data) {
    if (!Array.isArray(data?.errors)) return '';
    return data.errors
      .map(error => `${error.field ? `${error.field}: ` : ''}${error.message}`)
      .filter(Boolean)
      .join(' | ');
  }

  static async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token && !headers.Authorization) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const responseBody = isJson ? await response.json() : await response.text();
      const data = isJson ? responseBody : { message: responseBody };

      if (!response.ok) {
        const isHtmlResponse = !isJson && /<(?:!doctype|html|body|pre)\b/i.test(responseBody);
        if (response.status === 404 && isHtmlResponse) {
          const error = new Error(
            'No fue posible completar esta acción. Recarga la página e inténtalo de nuevo; si el problema continúa, pide ayuda al responsable de Quorum.'
          );
          error.status = response.status;
          error.code = 'API_ROUTE_NOT_FOUND';
          throw error;
        }

        const details = this.getValidationDetails(data);
        const statusHint = response.status === 401
          ? 'Verifica que tu sesión siga activa e inicia sesión nuevamente.'
          : response.status === 403
            ? 'No tienes permisos para realizar esta acción.'
            : response.status === 404
              ? 'No encontramos la información solicitada. Recarga la página e inténtalo de nuevo.'
              : response.status >= 500
                ? 'Ocurrió un problema al completar la operación. Inténtalo de nuevo más tarde o pide ayuda al responsable de Quorum.'
                : '';
        const message = [data.message, details, statusHint].filter(Boolean).join(' ');
        const error = new Error(message || `La solicitud no pudo completarse (HTTP ${response.status}).`);
        error.supportEmail = data.supportEmail;
        error.status = response.status;
        error.code = data.code;
        throw error;
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      if (error instanceof TypeError) {
        throw new Error('No pudimos conectar con Quorum. Comprueba tu conexión e inténtalo de nuevo; si continúa, pide ayuda al responsable del sistema.');
      }
      throw error;
    }
  }

  static async register(data) {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async login(email, password) {
    return this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  static async reviewerLogin(email, password) {
    return this.request('/reviewer/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  static async getReviewerCompanies(token) {
    return this.request('/reviewer/empresas', {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  static async reviewCompany(id, estado, notas, token) {
    return this.request(`/reviewer/empresas/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ estado, notas })
    });
  }

  static async getEmpresa() {
    return this.request('/empresa');
  }

  static async generateCompanyInviteCode() {
    return this.request('/empresa/codigo-invitacion', { method: 'POST' });
  }

  static async saveCompanySmtp(data) {
    return this.request('/empresa/convocatorias/smtp', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async deleteCompanySmtp() {
    return this.request('/empresa/convocatorias/smtp', { method: 'DELETE' });
  }

  static async registerEmployeeAccount(data) {
    return this.request('/employee/account/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async getEmployeeCompanyByCode(companyCode) {
    return this.request('/employee/company-lookup', {
      method: 'POST',
      body: JSON.stringify({ companyCode })
    });
  }

  static async employeeAccountLogin(email, password) {
    return this.request('/employee/account/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  static async getEmployeePortal(token) {
    return this.request('/employee/portal', {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  static async uploadEmployeeMeetingSpreadsheet(token, meetingId, file) {
    const formData = new FormData();
    formData.append('archivo', file);
    const response = await fetch(`${API_URL}/employee/meetings/${meetingId}/spreadsheets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };
    if (!response.ok) {
      const error = new Error(data.message || `No se pudo subir el Excel (HTTP ${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  static async getEmployeeMeetingSpreadsheetInsights(token, meetingId, documentId) {
    return this.request(`/employee/meetings/${meetingId}/spreadsheets/${documentId}/indicators`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  static async completeEmployeeProfile(token, profile) {
    return this.request('/employee/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(profile)
    });
  }

  static async updateEmployeePersonalStrategy(token, strategy) {
    return this.request('/employee/personal-strategy', {
      method: 'PUT',
      headers: { Authorization: ['Bearer', token].join(' ') },
      body: JSON.stringify(strategy)
    });
  }

  static async createEmployeePersonalMeeting(token, meeting) {
    return this.request('/employee/personal-meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(meeting)
    });
  }

  static async updateEmployeePersonalMeeting(token, meetingId, meeting) {
    return this.request(`/employee/personal-meetings/${meetingId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(meeting)
    });
  }

  static async deleteEmployeePersonalMeeting(token, meetingId) {
    return this.request(`/employee/personal-meetings/${meetingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  static async createEmployeePersonalObjective(token, objective) {
    return this.request('/employee/personal-objectives', {
      method: 'POST',
      headers: { Authorization: ['Bearer', token].join(' ') },
      body: JSON.stringify(objective)
    });
  }

  static async updateEmployeePersonalObjective(token, objectiveId, objective) {
    return this.request(`/employee/personal-objectives/${objectiveId}`, {
      method: 'PUT',
      headers: { Authorization: ['Bearer', token].join(' ') },
      body: JSON.stringify(objective)
    });
  }

  static async deleteEmployeePersonalObjective(token, objectiveId) {
    return this.request(`/employee/personal-objectives/${objectiveId}`, {
      method: 'DELETE',
      headers: { Authorization: ['Bearer', token].join(' ') }
    });
  }

  static async getManagedEmployeeObjectives(employeeId) {
    return this.request(`/empresa/empleados/${employeeId}/indicadores-personales`);
  }

  static async createManagedEmployeeObjective(employeeId, objective) {
    return this.request(`/empresa/empleados/${employeeId}/indicadores-personales`, {
      method: 'POST',
      body: JSON.stringify(objective)
    });
  }

  static async updateManagedEmployeeObjective(employeeId, objectiveId, objective) {
    return this.request(`/empresa/empleados/${employeeId}/indicadores-personales/${objectiveId}`, {
      method: 'PUT',
      body: JSON.stringify(objective)
    });
  }

  static async deleteManagedEmployeeObjective(employeeId, objectiveId) {
    return this.request(`/empresa/empleados/${employeeId}/indicadores-personales/${objectiveId}`, {
      method: 'DELETE'
    });
  }

  static async updateEmployeeProfile(employeeId, profile) {
    return this.request(`/empresa/empleados/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(profile)
    });
  }

  static async createEmployee(profile) {
    return this.request('/empresa/empleados', {
      method: 'POST',
      body: JSON.stringify(profile)
    });
  }

  static async deleteEmployee(employeeId) {
    return this.request(`/empresa/empleados/${employeeId}`, { method: 'DELETE' });
  }

  static async updateEmpresa(data) {
    return this.request('/empresa', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async uploadStrategicPlan(file) {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('archivo', file);
    const response = await fetch(`${API_URL}/empresa/plan-estrategico`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };
    if (!response.ok) {
      throw new Error(data.message || `No se pudo guardar el plan estratégico (HTTP ${response.status}).`);
    }
    return data;
  }

  static async updateFODA(data) {
    return this.request('/foda', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async createReunion(data) {
    return this.request('/reuniones', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async stopWeeklyReunion(id) {
    return this.request(`/reuniones/${id}/repeticion/detener`, { method: 'PUT' });
  }

  static async completeReunion(id, data) {
    return this.request(`/reuniones/${id}/completar`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async updateReunion(id, data) {
    return this.request(`/reuniones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async deleteReunion(id) {
    return this.request(`/reuniones/${id}`, {
      method: 'DELETE'
    });
  }

  static async updateMinuta(id, minuta) {
    return this.request(`/reuniones/${id}/minuta`, {
      method: 'PUT',
      body: JSON.stringify({ minuta })
    });
  }

  static async uploadReunionDocumento(id, area, file, options = {}) {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('area', area);
    if (options.esPresentacionPrincipal) {
      formData.append('esPresentacionPrincipal', 'true');
    }
    const files = Array.isArray(file) ? file : [file];
    files.forEach(currentFile => formData.append('archivo', currentFile));

    const response = await fetch(`${API_URL}/reuniones/${id}/documentos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };
    if (!response.ok) {
      const error = new Error(data.message || `No se pudo subir el documento (HTTP ${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  static async updatePresentationAreaRanges(id, documentId, rangosAreas) {
    return this.request(`/reuniones/${id}/presentacion/${documentId}/rangos`, {
      method: 'PUT',
      body: JSON.stringify({ rangosAreas })
    });
  }

  static async deleteReunionDocumento(id, documentoId) {
    return this.request(`/reuniones/${id}/documentos/${documentoId}`, {
      method: 'DELETE'
    });
  }

  static async previewReunionDocumento(id, documentoId) {
    return this.request(`/reuniones/${id}/documentos/${documentoId}/vista-previa`);
  }

  static async replaceReunionDocumento(id, documentoId, file) {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('archivo', file);
    const response = await fetch(`${API_URL}/reuniones/${id}/documentos/${documentoId}`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };
    if (!response.ok) {
      throw new Error(data.message || 'No se pudo reemplazar el documento.');
    }
    return data;
  }

  static async createSeguimiento(reunionId, data) {
    return this.request(`/reuniones/${reunionId}/seguimientos`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async updateSeguimiento(reunionId, id, data) {
    return this.request(`/reuniones/${reunionId}/seguimientos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async createObjetivo(data) {
    return this.request('/objetivos', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async updateObjetivo(id, data) {
    return this.request(`/objetivos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async deleteObjetivo(id) {
    return this.request(`/objetivos/${id}`, {
      method: 'DELETE'
    });
  }

  static async healthCheck() {
    return this.request('/health');
  }
}

export default ApiService;
