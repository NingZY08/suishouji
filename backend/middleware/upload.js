const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
      '.pdf', '.doc', '.docx', '.txt', '.md',
      '.xls', '.xlsx', '.csv',
      '.ppt', '.pptx'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片、文档、表格、演示文稿格式的文件'));
    }
  }
});

module.exports = upload;
