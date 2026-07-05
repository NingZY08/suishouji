const { S3Client } = require('@aws-sdk/client-s3');

const requiredEnv = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_DOMAIN',
];

const placeholderValues = new Set([
  'your-r2-account-id',
  'your-r2-access-key-id',
  'your-r2-secret-access-key',
  'your-r2-bucket-name',
  'your-r2-public-domain',
]);

const missing = requiredEnv.filter((key) => {
  const value = process.env[key];
  return !value || placeholderValues.has(value);
});

if (missing.length > 0) {
  throw new Error(`Missing or placeholder R2 environment variables: ${missing.join(', ')}`);
}

const r2Config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  domain: process.env.R2_DOMAIN,
};

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
  },
});

module.exports = {
  r2Client,
  r2Config,
};
