const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    // 保留原始文件名，添加时间戳避免重名
    cb(null, `${baseName}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      // 图片
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
      // 文档
      '.pdf', '.doc', '.docx', '.txt', '.md',
      // 表格
      '.xls', '.xlsx', '.csv',
      // 演示文稿
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