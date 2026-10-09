require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const jwt = require('jsonwebtoken');
const { connectDB } = require('./config/database');
const empresaRoutes = require('./routes/empresaRoutes');
const { startWeeklyMeetingScheduler } = require('./services/weeklyMeetingScheduler');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const httpsKeyPath = process.env.HTTPS_KEY_PATH;
const httpsCertPath = process.env.HTTPS_CERT_PATH;
const forceHttps = process.env.FORCE_HTTPS === 'true';
const configuredHttpsPublicOrigin = process.env.HTTPS_PUBLIC_ORIGIN;
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
let httpsPublicOrigin;

if (process.env.FORCE_HTTPS && !['true', 'false'].includes(process.env.FORCE_HTTPS)) {
  throw new Error('FORCE_HTTPS solo puede tener el valor true o false.');
}
if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS debe ser un número entero mayor o igual a 0.');
}
if (Boolean(httpsKeyPath) !== Boolean(httpsCertPath)) {
  throw new Error('Configura HTTPS_KEY_PATH y HTTPS_CERT_PATH juntos para habilitar TLS directo.');
}
if (forceHttps && trustedProxyHops === 0 && !httpsKeyPath) {
  throw new Error('Para forzar HTTPS, configura TLS directo o define TRUST_PROXY_HOPS para el proxy HTTPS.');
}
if (forceHttps) {
  let publicUrl;
  try {
    publicUrl = new URL(configuredHttpsPublicOrigin);
  } catch {
    throw new Error('Configura HTTPS_PUBLIC_ORIGIN con la dirección HTTPS pública de la API para activar la redirección.');
  }
  if (publicUrl.protocol !== 'https:' || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash || publicUrl.username || publicUrl.password) {
    throw new Error('HTTPS_PUBLIC_ORIGIN debe ser solo el origen público HTTPS de la API, sin rutas adicionales.');
  }
  httpsPublicOrigin = publicUrl.origin;
}

app.set('trust proxy', trustedProxyHops);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET debe estar configurado y tener al menos 32 caracteres');
}

// Orígenes explícitamente permitidos
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL debe estar configurado en producción');
}

// Middleware CORS
app.use(cors({
  origin: (origin, callback) => {
    // Peticiones sin origen (Postman, curl, apps móviles, etc.)
    if (!origin) return callback(null, true);

    // Túneles de VS Code (*.devtunnels.ms)
    if (/^https:\/\/[a-z\d-]+(?:\.[a-z\d-]+)*\.devtunnels\.ms$/i.test(origin)) return callback(null, true);

    // IPs de red local: 192.168.x.x, 10.x.x.x, 172.16-31.x.x (con puerto opcional)
    if (/^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // Orígenes de la lista blanca
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Rechazar cualquier otro origen
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: false
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.secure && isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  } else if (forceHttps) {
    return res.redirect(308, new URL(req.originalUrl, httpsPublicOrigin).toString());
  }

  next();
});

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', (req, res, next) => {
  try {
    const access = jwt.verify(req.query.access, process.env.JWT_SECRET);
    const requestedFile = `/uploads${req.path}`;
    if (!['meeting-file', 'private-file'].includes(access.type) || access.filePath !== requestedFile) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este documento.' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'El enlace del documento venció o no es válido. Vuelve a abrirlo desde Quorum.' });
  }
}, express.static(path.join(__dirname, '..', 'uploads'), {
  etag: true,
  maxAge: '1d'
}));

// Rutas
app.use('/api', empresaRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Quorum API',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.statusCode || error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message = error.code === 'LIMIT_FILE_SIZE'
    ? 'El archivo supera el límite de 15 MB. Reduce su tamaño e inténtalo nuevamente.'
    : error.message === 'Unexpected field'
      ? 'El archivo se recibió con un campo no permitido. Usa el selector de archivos de la reunión.'
      : error.message || 'Error interno del servidor';
  console.error('Request error:', error.message);
  res.status(status).json({
    success: false,
    message
  });
});

// Iniciar servidor
const startServer = async () => {
  try {
    await connectDB();
    startWeeklyMeetingScheduler();
    const server = httpsKeyPath
      ? https.createServer({
        key: fs.readFileSync(path.resolve(httpsKeyPath)),
        cert: fs.readFileSync(path.resolve(httpsCertPath))
      }, app)
      : http.createServer(app);
    server.listen(PORT, () => {
      const protocol = httpsKeyPath ? 'https' : 'http';
      console.log(` Server running on port ${PORT}`);
      console.log(` ${protocol}://localhost:${PORT}`);
    });
    server.on('error', error => {
      if (error.code === 'EADDRINUSE') {
        console.error(`El puerto ${PORT} ya está en uso. Cierra el proceso existente o configura otro puerto en PORT.`);
      } else {
        console.error('Server error:', error.message);
      }
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(' Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();