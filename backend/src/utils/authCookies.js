const COOKIE_NAMES = {
  company: 'quorum_company_session',
  employee: 'quorum_employee_session',
  reviewer: 'quorum_reviewer_session'
};

const getCookieToken = (req, name) => {
  const cookies = String(req.headers.cookie || '').split(';');
  const value = cookies.find(cookie => cookie.trim().startsWith(`${name}=`));
  if (!value) return null;
  try {
    return decodeURIComponent(value.trim().slice(name.length + 1));
  } catch {
    return null;
  }
};

const cookieOptions = req => {
  const secure = process.env.NODE_ENV === 'production' || req.secure;
  return [
    'Path=/',
    'HttpOnly',
    `SameSite=${secure ? 'None' : 'Lax'}`,
    secure ? 'Secure' : ''
  ].filter(Boolean).join('; ');
};

const setSessionCookie = (req, res, type, token, maxAgeSeconds) => {
  const name = COOKIE_NAMES[type];
  if (!name) throw new Error('Tipo de sesión no válido.');
  res.append('Set-Cookie', `${name}=${encodeURIComponent(token)}; ${cookieOptions(req)}; Max-Age=${maxAgeSeconds}`);
};

const clearSessionCookies = (req, res, type) => {
  const options = cookieOptions(req);
  const names = type && COOKIE_NAMES[type] ? [COOKIE_NAMES[type]] : Object.values(COOKIE_NAMES);
  names.forEach(name => {
    res.append('Set-Cookie', `${name}=; ${options}; Max-Age=0`);
  });
};

module.exports = { COOKIE_NAMES, getCookieToken, setSessionCookie, clearSessionCookies };
