const https = require('https');
const dns = require('dns');
const { S3Client } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');

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

// 去掉可能配置进来的协议前缀/结尾斜杠，统一成纯域名
const normalizeDomain = (value) =>
  String(value || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');

const r2Config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  domain: normalizeDomain(process.env.R2_DOMAIN),
};

// 部分网络环境（含云开发沙箱）会在 IP 层拦截 Cloudflare 部分 anycast 地址，
// 且 DNS 会在可用/被拦的 IP 间轮换，导致上传与图片访问时好时坏。
// 通过 R2_PIN_IPS 把 S3 API 域名与 R2 公共域名固定解析到可达的边缘 IP；
// 该配置仅在受限网络需要，本地/服务器正常网络无需配置，走系统默认 DNS。
const S3_HOST_SUFFIX = '.r2.cloudflarestorage.com';
const pinnedIPs = String(process.env.R2_PIN_IPS || process.env.R2_S3_PIN_IPS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
let pinnedIndex = 0;

const shouldPin = (hostname) =>
  hostname.endsWith(S3_HOST_SUFFIX) || hostname === r2Config.domain;

const customLookup = (hostname, options, callback) => {
  if (pinnedIPs.length > 0 && shouldPin(hostname)) {
    const address = pinnedIPs[pinnedIndex % pinnedIPs.length];
    pinnedIndex += 1;
    if (options && options.all) {
      process.nextTick(() => callback(null, [{ address, family: 4 }]));
    } else {
      process.nextTick(() => callback(null, address, 4));
    }
    return;
  }
  dns.lookup(hostname, options, callback);
};

// 同一网络环境下，Node 默认的 TLS1.3 握手可能被中间设备拦截，
// 强制 TLS1.2 + IPv4 + HTTP/1.1 可显著提升与 Cloudflare R2 的连通性。
const r2HttpsAgent = new https.Agent({
  keepAlive: true,
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.2',
  family: 4,
  ALPNProtocols: ['http/1.1'],
  lookup: customLookup,
});

const requestHandler = new NodeHttpHandler({
  httpsAgent: r2HttpsAgent,
  connectionTimeout: 10000,
  requestTimeout: 20000,
});

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  // R2 对 AWS SDK v3.729+ 默认附加的 CRC32 校验头兼容性较差，可能导致请求挂起，
  // 改为仅在服务端明确要求时才计算/校验。
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
  },
  requestHandler,
});

// 对对象键按路径分段编码，避免中文/空格文件名生成非法 URL
const encodeKey = (key) =>
  String(key)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const buildPublicUrl = (key) => `https://${r2Config.domain}/${encodeKey(key)}`;

module.exports = {
  r2Client,
  r2Config,
  r2HttpsAgent,
  encodeKey,
  buildPublicUrl,
};
