const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, r2Config } = require('./config/r2');

async function testUpload() {
  const testFile = path.join(__dirname, 'uploads/file-1777193168785-759873024.jpg');

  if (!fs.existsSync(testFile)) {
    console.error('测试文件不存在');
    return;
  }

  const buffer = fs.readFileSync(testFile);
  const r2Key = `uploads/test_upload_${Date.now()}.jpg`;

  console.log('开始测试 R2 上传...');
  console.log('Bucket:', r2Config.bucket);
  console.log('Domain:', r2Config.domain);
  console.log('文件大小:', buffer.length);

  try {
    const command = new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: r2Key,
      Body: buffer,
      ContentType: 'image/jpeg',
    });

    await r2Client.send(command);

    const fileUrl = `https://${r2Config.domain}/${r2Key}`;
    console.log('上传成功!');
    console.log('返回的 URL:', fileUrl);
  } catch (error) {
    console.error('上传失败:', error);
  }
}

testUpload();
