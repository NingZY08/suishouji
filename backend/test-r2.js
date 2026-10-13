require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, r2Config } = require('./config/r2');

async function testR2Upload() {
  console.log('测试 R2 上传...');

  try {
    const testContent = 'Hello R2 Test!';
    const r2Key = `uploads/test_${Date.now()}.txt`;

    const command = new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: r2Key,
      Body: testContent,
      ContentType: 'text/plain',
    });

    const result = await r2Client.send(command);
    console.log('上传成功！');
    console.log('文件 URL:', `https://${r2Config.domain}/${r2Key}`);
    console.log('ETag:', result.ETag);
  } catch (error) {
    console.error('上传失败:', error.message);
    console.error('错误代码:', error.Code);
    console.error('状态码:', error.$metadata?.httpStatusCode);
  }
}

testR2Upload();
