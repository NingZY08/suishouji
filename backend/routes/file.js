const express = require('express');
const auth = require('../middleware/auth');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, r2Config } = require('../config/r2');
const { File, Event, sequelize } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// 删除文件（根据文件 ID）
router.delete('/:id', auth, async (req, res) => {
  const fileId = req.params.id;
  const transaction = await sequelize.transaction();
  let fileRecord;
  try {
    fileRecord = await File.findByPk(fileId, { transaction });
    if (!fileRecord) {
      await transaction.rollback();
      return res.status(404).json({ message: '文件未找到' });
    }
    // 权限检查：仅文件拥有者可删除
    if (fileRecord.userId !== req.user.userId) {
      await transaction.rollback();
      return res.status(403).json({ message: '没有删除权限' });
    }

    // 检查是否有其它事件引用该文件
    const referencingEvents = await Event.findAll({
      where: { files: { [Op.like]: `%${fileRecord.url}%` } },
      transaction,
    });
    if (referencingEvents.length > 0) {
      // 有引用，仅返回标记，不执行删除
      await transaction.commit();
      return res.json({ success: true, referenced: true, message: '文件被其他事件引用，未删除' });
    }

    // 1️⃣ 删除 R2 对象（先执行，失败则回滚）
    const command = new DeleteObjectCommand({
      Bucket: r2Config.bucket,
      Key: fileRecord.key,
    });
    await r2Client.send(command);

    // 2️⃣ 同步移除所有事件中的引用（已确认无引用，这一步是防御性清理）
    const events = await Event.findAll({
      where: { files: { [Op.like]: `%${fileRecord.url}%` } },
      transaction,
    });
    for (const ev of events) {
      ev.files = ev.files.filter(u => u !== fileRecord.url);
      await ev.save({ transaction });
    }

    // 3️⃣ 删除文件记录
    await fileRecord.destroy({ transaction });
    await transaction.commit();
    res.json({ success: true, referenced: false });
  } catch (error) {
    await transaction.rollback();
    console.error('文件删除失败:', error);
    // 若 R2 已不存在，该错误会抛出 NotFound，仍视为成功删除 DB 记录
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      if (fileRecord) await fileRecord.destroy();
      return res.json({ success: true, referenced: false, warning: 'R2 中文件已不存在' });
    }
    res.status(500).json({ message: '文件删除失败' });
  }
});

module.exports = router;
