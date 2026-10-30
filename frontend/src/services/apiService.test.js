import { afterEach, describe, expect, it, vi } from 'vitest';
import ApiService from './apiService';
afterEach(() => vi.unstubAllGlobals());
describe('cookie session API', () => {
  it('uses cookies and the CSRF header for all role workflows', async () => {
    const fetch = vi.fn(async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetch);
    await ApiService.getEmpresa();
    await ApiService.getReviewerCompanies();
    await ApiService.reviewCompany('company-id', 'aprobada', 'ok');
    await ApiService.getEmployeePortal();
    await ApiService.completeEmployeeProfile({ nombre: 'Persona' });
    await ApiService.createEmployeePersonalMeeting({ titulo: 'Revision' });
    await ApiService.logout('employee');
    for (const [, options] of fetch.mock.calls) {
      expect(options.credentials).toBe('include');
      expect(options.headers['X-Quorum-Request']).toBe('1');
      expect(Object.keys(options.headers).map(key => key.toLowerCase())).not.toContain('authorization');
    }
    expect(JSON.parse(fetch.mock.calls[4][1].body)).toEqual({ nombre: 'Persona' });
    expect(JSON.parse(fetch.mock.calls[6][1].body)).toEqual({ type: 'employee' });
  });
  it('uploads employee spreadsheets with cookie session and correct resource ids', async () => {
    const fetch = vi.fn(async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetch);
    const file = new File(['dummy'], 'indicadores.xlsx');
    await ApiService.uploadEmployeeMeetingSpreadsheet('meeting-id', file);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/employee/meetings/meeting-id/spreadsheets');
    expect(options.credentials).toBe('include');
    expect(options.body.get('archivo')).toBe(file);
  });
});
