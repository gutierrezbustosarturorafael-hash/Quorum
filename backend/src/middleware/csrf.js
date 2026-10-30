module.exports = allowedOrigins => (req, res, next) => {
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const origin = req.get('Origin');
  if (isMutation && (req.get('X-Quorum-Request') !== '1' || (origin && !allowedOrigins.includes(origin)))) {
    return res.status(403).json({ success: false, message: 'La solicitud no paso la verificacion de origen.' });
  }
  next();
};
