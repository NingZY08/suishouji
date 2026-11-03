const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

const getKey = () => {
  const key = process.env.AI_ENCRYPT_KEY;
  if (!key) {
    throw new Error('AI_ENCRYPT_KEY is not set');
  }
  return Buffer.from(key, 'hex');
};

const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (payload) => {
  const [ivHex, tagHex, dataHex] = String(payload).split(':');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
};

module.exports = { encrypt, decrypt };
