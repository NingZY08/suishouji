const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const crypto = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { r2Client, r2Config, buildPublicUrl } = require('../config/r2');
const { File } = require('../models');

const router = express.Router();

// 扩展名 -> Content-Type 映射，预签名直传时浏览器必须携带完全一致的头部
const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const getContentType = (filename, fallback) => {
  const ext = path.extname(filename || '').toLowerCase();
  return MIME_TYPES[ext] || fallback || 'application/octet-stream';
};

const processFileName = (originalName) => {
  if (!originalName) return `file_${Date.now()}`;

  let fileName = originalName;

  // 修复 UTF-8 被当作 Latin1 解码的问题
  try {
    const asLatin1Bytes = Buffer.from(fileName, 'latin1');
    const tryUtf8 = asLatin1Bytes.toString('utf8');
    if (/[\u4e00-\u9fa5]/.test(tryUtf8)) {
      fileName = tryUtf8;
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

  if (Buffer.isBuffer(fileName)) {
    fileName = fileName.toString('utf8');
  }

  fileName = fileName.normalize('NFC');

  const ext = path.extname(fileName).toLowerCase();
  let baseName = fileName.slice(0, fileName.length - ext.length);

  // 替换不允许的字符（含空格），避免生成无法访问的 URL
  const invalidChars = /[<>:"/\\|?*\s]+/g;
  let safeName = baseName.replace(invalidChars, '_').trim().replace(/^_+|_+$/g, '');

  if (!safeName) {
    safeName = `file_${Date.now()}`;
  }

  return { safeName, ext };
};

const buildObjectKey = (originalName) => {
  const { safeName, ext } = processFileName(originalName);
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const key = `uploads/${safeName}_${timestamp}${random ? '_' + random : ''}${ext}`;
  return { key, contentType: getContentType(originalName) };
};

const normalizeHash = (hash) => {
  if (typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash.trim())) {
    return hash.trim().toLowerCase();
  }
  return crypto.randomBytes(32).toString('hex');
};

// 预签名直传：后端只做本地签名，浏览器直接 PUT 到 R2，
// 避免后端网络无法访问 R2 S3 API 时上传超时。
router.post('/sign', auth, async (req, res) => {
  try {
    const { filename, size, hash } = req.body || {};

    if (size && Number(size) > 10 * 1024 * 1024) {
      return res.status(400).json({ message: '文件大小不能超过 10MB' });
    }

    const normalizedHash = typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash.trim())
      ? hash.trim().toLowerCase()
      : null;

    if (normalizedHash) {
      const existing = await File.findOne({ where: { hash: normalizedHash } });
      if (existing) {
        return res.json({ duplicate: true, url: existing.url, fileId: existing.id });
      }
    }

    const { key, contentType } = buildObjectKey(filename);
    const command = new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 });

    res.json({
      duplicate: false,
      key,
      uploadUrl,
      publicUrl: buildPublicUrl(key),
      contentType,
      expiresIn: 600,
    });
  } catch (error) {
    console.error('生成上传签名失败:', error);
    res.status(500).json({ message: '生成上传签名失败' });
  }
});

// 直传完成后登记文件记录
router.post('/complete', auth, async (req, res) => {
  try {
    const { key, size, hash } = req.body || {};

    if (!key || !String(key).startsWith('uploads/')) {
      return res.status(400).json({ message: '无效的文件标识' });
    }

    const url = buildPublicUrl(key);

    const existingByKey = await File.findOne({ where: { key } });
    if (existingByKey) {
      return res.json({ url: existingByKey.url, fileId: existingByKey.id, duplicate: true });
    }

    const newFile = await File.create({
      userId: req.user.userId,
      hash: normalizeHash(hash),
      key,
      url,
      size: Number(size) || 0,
    });

    res.json({ url: newFile.url, fileId: newFile.id, duplicate: false });
  } catch (error) {
    console.error('登记文件失败:', error);
    res.status(500).json({ message: '登记文件失败' });
  }
});

// 服务端上传（兼容路径，浏览器/服务器可访问 R2 S3 API 时使用）
router.post('/', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请选择要上传的文件' });
  }

  const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  try {
    const existing = await File.findOne({ where: { hash: fileHash } });
    if (existing) {
      return res.json({ url: existing.url, fileId: existing.id, duplicate: true });
    }

    const { key, contentType } = buildObjectKey(req.file.originalname);

    const command = new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype || contentType,
    });

    await r2Client.send(command);

    const fileUrl = buildPublicUrl(key);
    const newFile = await File.create({
      userId: req.user.userId,
      hash: fileHash,
      key,
      url: fileUrl,
      size: req.file.size,
    });

    res.json({ url: fileUrl, fileId: newFile.id, duplicate: false });
  } catch (error) {
    console.error('R2上传失败:', error);
    // 返回可直传的预签名信息，前端可据此降级为浏览器直传
    try {
      const { key, contentType } = buildObjectKey(req.file.originalname);
      const command = new PutObjectCommand({
        Bucket: r2Config.bucket,
        Key: key,
        ContentType: contentType,
      });
      const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 });
      return res.status(503).json({
        message: '服务端上传失败，请改用直传',
        fallback: 'direct',
        key,
        uploadUrl,
        publicUrl: buildPublicUrl(key),
        contentType,
      });
    } catch (signError) {
      console.error('生成降级签名失败:', signError);
      return res.status(500).json({ message: '文件上传失败' });
    }
  }
});

module.exports = router;
