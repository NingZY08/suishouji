const http = require('http');
const fs = require('fs');
const path = require('path');

async function loginAndUpload() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: 'test@test.com',
      password: '123456'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('1. 尝试登录...');

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.token) {
          console.log('登录成功!');
          uploadFile(result.token).then(resolve).catch(reject);
        } else {
          console.log('登录失败:', result);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error('登录请求错误:', e.message);
      resolve(null);
    });
    req.write(postData);
    req.end();
  });
}

async function uploadFile(token) {
  return new Promise((resolve, reject) => {
    const testFile = path.join(__dirname, 'uploads/file-1777193168785-759873024.jpg');
    const fileContent = fs.readFileSync(testFile);
    const boundary = '----FormBoundary' + Date.now();
    const fileName = 'test.jpg';

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`),
      Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
      fileContent,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Authorization': `Bearer ${token}`
      }
    };

    console.log('\n2. 尝试上传文件到 /api/upload...');
    console.log('请求路径:', `/api/upload`);
    console.log('文件大小:', fileContent.length, '字节');

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('响应状态:', res.statusCode);
        console.log('响应内容:', data);
        resolve(data);
      });
    });

    req.on('error', (e) => {
      console.error('上传请求错误:', e.message);
      reject(e);
    });
    req.write(body);
    req.end();
  });
}

console.log('开始测试通过 Vite 代理的上传流程...\n');
loginAndUpload();
