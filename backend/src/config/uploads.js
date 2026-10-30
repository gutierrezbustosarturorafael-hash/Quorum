const path = require('path');
const fs = require('fs');
const uploadsRoot = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'));
const initializeUploads = async () => {
  if (process.env.RAILWAY_ENVIRONMENT_ID) {
    if (process.env.TRUST_PROXY_HOPS !== '1') throw new Error('Railway requiere TRUST_PROXY_HOPS=1; verifica la topologia del proxy.');
    if (!process.env.RAILWAY_VOLUME_MOUNT_PATH || path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH) !== uploadsRoot) {
      throw new Error('Monta un volumen persistente en UPLOADS_DIR (por defecto /app/uploads).');
    }
  }
  await fs.promises.mkdir(uploadsRoot, { recursive: true });
  await fs.promises.access(uploadsRoot, fs.constants.R_OK | fs.constants.W_OK);
};
module.exports = { uploadsRoot, initializeUploads };
