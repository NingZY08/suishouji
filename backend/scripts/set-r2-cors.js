/**
 * 为 R2 存储桶配置 CORS 规则（浏览器预签名直传必需）。
 * 在能访问 R2 S3 API 的环境（如本地 Windows）执行一次：
 *   npm run r2:cors
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), override: false });

const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('缺少 R2 相关环境变量（R2_ACCOUNT_ID/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY）');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: { accessKeyId, secretAccessKey },
});

async function main() {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ['*'],
            AllowedMethods: ['GET', 'HEAD', 'PUT'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  console.log(`R2 CORS 配置成功: bucket = ${bucket}`);
}

main().catch((err) => {
  console.error('R2 CORS 配置失败:', err.message);
  process.exit(1);
});
