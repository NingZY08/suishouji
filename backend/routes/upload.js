const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// 上传文件
router.post('/', auth, upload.single('file'), (req, res) => {
  console.log('Upload request received:', req.file ? req.file.originalname : 'No file');
  if (!req.file) {
    return res.status(400).json({ message: '请选择要上传的文件' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

module.exports = router;