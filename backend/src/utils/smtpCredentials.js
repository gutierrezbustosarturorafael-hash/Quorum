const crypto = require('crypto');

const getEncryptionKey = () => {
  const configuredKey = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY || '';
  const key = /^[a-f\d]{64}$/i.test(configuredKey)
    ? Buffer.from(configuredKey, 'hex')
    : Buffer.from(configuredKey, 'base64');

  if (key.length !== 32) {
    const error = new Error('EMAIL_CREDENTIALS_ENCRYPTION_KEY debe contener una clave aleatoria de 32 bytes en hexadecimal o Base64.');
    error.statusCode = 503;
    throw error;
  }

  return key;
};

const validateEncryptionKey = () => {
  getEncryptionKey();
};

const encryptPassword = password => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);

  return {
    encryptedPassword: encrypted.toString('base64'),
    encryptionIv: iv.toString('base64'),
    encryptionTag: cipher.getAuthTag().toString('base64')
  };
};

const decryptPassword = ({ encryptedPassword, encryptionIv, encryptionTag }) => {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(encryptionIv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(encryptionTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPassword, 'base64')),
    decipher.final()
  ]).toString('utf8');
};

module.exports = { encryptPassword, decryptPassword, validateEncryptionKey };
