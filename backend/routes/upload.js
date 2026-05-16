const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const router = express.Router();

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const processFileName = (originalName) => {
  if (!originalName) return `file_${Date.now()}`;

  let fileName = originalName;

  // 修复 UTF-8 被当作 Latin1 解码的问题
  try {
    const asLatin1Bytes = Buffer.from(fileName, 'latin1');
    const tryUtf8 = asLatin1Bytes.toString('utf8');
    if (/[\u4e00-\u9fa5]/.test(tryUtf8)) {
      fileName = tryUtf8;
      return processFileName(fileName);
    }
  } catch (e) {}

  // URL 编码检测
  try {
    if (/%[0-9A-Fa-f]{2}/.test(fileName)) {
      fileName = decodeURIComponent(fileName);
    }
  } catch (e) {}

  // RFC 5987 编码检测
  if (fileName.includes("'")) {
    const match = fileName.match(/^.*?'([^']+)$/);
    if (match) {
      try {
        fileName = decodeURIComponent(match[1]);
      } catch (e) {}
    }
  }

  // 双重编码检测
  if (/%[0-9A-Fa-f]{2}/.test(fileName)) {
    try {
      fileName = decodeURIComponent(fileName);
    } catch (e) {}
  }

  // Buffer 转换
  if (Buffer.isBuffer(fileName)) {
    fileName = fileName.toString('utf8');
  }

  // Unicode 规范化
  fileName = fileName.normalize('NFC');

  // 提取扩展名（不区分大小写）
  const ext = path.extname(fileName).toLowerCase();
  
  // 获取不带扩展名的文件名
  let baseName = fileName.slice(0, fileName.length - ext.length);

  // 替换不允许的字符
  const invalidChars = /[<>:"/\\|?*]/g;
  let safeName = baseName.replace(invalidChars, '_').trim();

  if (!safeName) {
    safeName = `file_${Date.now()}`;
  }

  return safeName;
};

const crypto = require('crypto');
const { File } = require('../models'); // 引入 File 模型

router.post('/', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请选择要上传的文件' });
  }

  // 计算文件哈希（SHA-256）用于去重
  const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  // 检查是否已有相同哈希的文件记录
  const existing = await File.findOne({ where: { hash: fileHash } });
  if (existing) {
    // 已存在，直接返回已有 URL，标记为重复
    return res.json({ url: existing.url, fileId: existing.id, duplicate: true });
  }

  const timestamp = Date.now();
  const ext = path.extname(req.file.originalname).toLowerCase();
  const safeBaseName = processFileName(req.file.originalname);
  const r2Key = `uploads/${safeBaseName}_${timestamp}${ext}`;

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: r2Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await r2Client.send(command);

    const fileUrl = `https://${process.env.R2_DOMAIN}/${r2Key}`;
    // 保存文件元数据到数据库
    const newFile = await File.create({
      userId: req.user.userId,
      hash: fileHash,
      key: r2Key,
      url: fileUrl,
      size: req.file.size,
    });

    res.json({ url: fileUrl, fileId: newFile.id, duplicate: false });
  } catch (error) {
    console.error('R2上传失败:', error);
    res.status(500).json({ message: '文件上传失败' });
  }
});

module.exports = router;
