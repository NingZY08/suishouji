/**
 * 迁移脚本：清理已在 R2 中不存在的文件记录，并同步从 Event 表的 files 数组中移除对应 URL。
 * 运行方式：`node scripts/migrate_orphan_files.js`
 */
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { File, Event, sequelize } = require('../models');
const { Op } = require('sequelize');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// R2 客户端配置（与后端保持一致）
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

(async () => {
  console.log('=== 开始迁移清理 orphan 文件 ===');
  const files = await File.findAll();
  let processed = 0, deleted = 0;

  for (const file of files) {
    processed++;
    // 检查对象是否仍然存在 R2 中
    const headCmd = new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: file.key });
    let exists = true;
    try {
      await r2Client.send(headCmd);
    } catch (e) {
      // 404 等被视为不存在
      exists = false;
    }

    if (!exists) {
      console.log(`文件 ${file.id} (${file.url}) 在 R2 中不存在，准备删除 DB 记录`);
      const transaction = await sequelize.transaction();
      try {
        // 移除所有事件对该 URL 的引用
        const events = await Event.findAll({
          where: { files: { [Op.like]: `%${file.url}%` } },
          transaction,
        });
        for (const ev of events) {
          ev.files = ev.files.filter(u => u !== file.url);
          await ev.save({ transaction });
        }
        // 删除文件记录
        await file.destroy({ transaction });
        await transaction.commit();
        deleted++;
        console.log(` → 已删除 DB 记录 id=${file.id}`);
      } catch (err) {
        await transaction.rollback();
        console.error(`删除记录时出错 id=${file.id}:`, err);
      }
    }
  }

  console.log(`迁移完成：共处理 ${processed} 条，实际删除 ${deleted} 条 orphan 文件记录。`);
  process.exit(0);
})();
