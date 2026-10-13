<template>
  <Layout>
    <div class="event-detail-container">
      <el-card>
        <template #header>
          <div class="event-detail-header">
            <h2>事件详情</h2>
            <div class="header-actions">
              <el-button type="primary" @click="$router.push(`/create?id=${eventId}`)">编辑</el-button>
            </div>
          </div>
        </template>
      <div class="event-detail-content">
        <div class="detail-card">
          <div class="detail-row">
            <div class="detail-label">事件标题</div>
            <div class="detail-value">{{ eventDetail.title }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">事件类型</div>
            <div class="detail-value">{{ eventDetail.type.level1 }} / {{ eventDetail.type.level2 }} / {{ eventDetail.type.level3 }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">开始日期</div>
            <div class="detail-value">{{ eventDetail.startDate }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">结束日期</div>
            <div class="detail-value">{{ eventDetail.endDate || '未设置' }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">事件状态</div>
            <div class="detail-value">
              <el-tag :type="eventDetail.status === '进行中' ? 'warning' : eventDetail.status === '已完成' ? 'success' : 'danger'">
                {{ eventDetail.status }}
              </el-tag>
            </div>
          </div>
          <div class="detail-row">
            <div class="detail-label">事件内容</div>
            <div class="detail-value event-content">{{ eventDetail.content }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">事件结果</div>
            <div class="detail-value event-result">{{ eventDetail.result || '未填写' }}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">相关插图</div>
            <div class="detail-value">
              <div class="event-files">
                <!-- 图片文件：显示预览 -->
                <el-image
                  v-for="(file, index) in imageFiles"
                  :key="'img-' + index"
                  :src="file.url"
                  :preview-src-list="imageFileUrls"
                  fit="cover"
                  class="event-file-item"
                ></el-image>
                <!-- 非图片文件：显示图标和下载链接 -->
                <div
                  v-for="(file, index) in otherFiles"
                  :key="'other-' + index"
                  class="event-file-other"
                >
                  <el-icon class="file-icon" :size="40">
                    <component :is="getFileIcon(file.ext)" />
                  </el-icon>
                  <div class="file-info">
                    <div class="file-name" :title="file.name">{{ file.name }}</div>
                    <el-button
                      type="primary"
                      link
                      size="small"
                      @click="downloadFile(file.url)"
                    >
                      下载
                    </el-button>
                  </div>
                </div>
                <div v-if="eventDetail.files.length === 0" class="no-files">无相关文件</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="event-detail-actions">
        <el-button @click="$router.push('/events')">返回列表</el-button>
      </div>
    </el-card>
  </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Document, Picture, Grid, Files } from '@element-plus/icons-vue'
import Layout from '../components/Layout.vue'
import axios from '../utils/axios'
import { ElMessage } from 'element-plus'

const route = useRoute()
const eventId = ref(route.params.id as string)

const eventDetail = ref({
  id: '',
  title: '',
  content: '',
  startDate: '',
  endDate: '',
  result: '',
  status: '',
  type: {
    level1: '',
    level2: '',
    level3: ''
  },
  files: []
})

const fetchEventDetail = async () => {
  try {
    const response = await axios.get(`/api/events/${eventId.value}`)
    eventDetail.value = response.data
  } catch (error) {
    console.error('获取事件详情失败:', error)
    ElMessage.error('获取事件详情失败')
  }
}

const getFileUrl = (file: string) => {
  // 如果已经是完整 URL，直接返回
  if (file.startsWith('http://') || file.startsWith('https://')) {
    return file
  }
  // 开发环境：使用相对路径，通过 Vite 代理访问
  // 生产环境：根据环境变量决定是否拼接完整 URL
  const isDev = (import.meta as any).env.DEV
  if (isDev) {
    return file // 开发环境使用相对路径，走代理
  }
  // 生产环境使用完整 URL
  const baseUrl = (import.meta as any).env.VITE_API_BASE_URL || ''
  return baseUrl ? `${baseUrl}${file}` : file
}

// 图片格式列表
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']

// 判断是否为图片文件
const isImageFile = (file: string) => {
  const ext = '.' + file.split('.').pop()?.toLowerCase()
  return imageExts.includes(ext)
}

// 获取文件扩展名
const getFileExt = (file: string) => {
  return '.' + file.split('.').pop()?.toLowerCase()
}

// 获取文件名
const getFileName = (file: string) => {
  return file.split('/').pop() || file
}

// 图片文件列表（带完整 URL）
const imageFiles = computed(() => {
  return eventDetail.value.files
    .filter(isImageFile)
    .map(file => ({
      url: getFileUrl(file),
      name: getFileName(file)
    }))
})

// 图片文件 URL 列表（用于预览）
const imageFileUrls = computed(() => {
  return imageFiles.value.map(f => f.url)
})

// 非图片文件列表（带完整 URL）
const otherFiles = computed(() => {
  return eventDetail.value.files
    .filter(f => !isImageFile(f))
    .map(file => ({
      url: getFileUrl(file),
      name: getFileName(file),
      ext: getFileExt(file)
    }))
})

// 获取文件图标
const getFileIcon = (ext: string) => {
  const iconMap: Record<string, any> = {
    '.doc': Document,
    '.docx': Document,
    '.xls': Grid,
    '.xlsx': Grid,
    '.csv': Grid,
    '.ppt': Picture,
    '.pptx': Picture,
    '.pdf': Files,
    '.txt': Document,
    '.md': Document
  }
  return iconMap[ext] || Document
}

// 下载文件
const downloadFile = (url: string) => {
  const link = document.createElement('a')
  link.href = url
  link.download = url.split('/').pop() || 'file'
  link.click()
}

onMounted(() => {
  fetchEventDetail()
})
</script>

<style>
/* 全局样式 - 移除 el-descriptions 相关样式 */
</style>

<style scoped>
.event-detail-container {
  padding: 20px;
}

.event-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.event-detail-header h2 {
  margin: 0;
  color: #303133;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
}

.event-detail-content {
  margin: 20px 0;
}

/* 卡片式详情布局 */
.detail-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.detail-row {
  display: flex;
  flex-direction: column;
  padding: 12px 15px;
  border-bottom: 1px solid #ebeef5;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-card .detail-row .detail-label {
  font-weight: 900 !important;
  color: #302f2f;
  font-size: 16px !important;
  margin-bottom: 8px;
}

.detail-card .detail-row .detail-value {
  color: #303133;
  font-size: 15px !important;
  line-height: 1.5;
  word-break: break-word;
}

.event-content,
.event-result {
  white-space: pre-wrap;
  line-height: 1.5;
}

.event-files {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.event-file-item {
  width: 100px;
  height: 100px;
  cursor: pointer;
  border-radius: 4px;
}

.event-file-other {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  min-width: 200px;
  max-width: 300px;
}

.file-icon {
  color: #409eff;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8px;
}

.no-files {
  color: #909399;
  padding: 10px 0;
}

.event-detail-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 手机端样式 */
@media (max-width: 1000px) {
  .event-detail-container {
    padding: 10px;
  }
  
  .event-detail-header {
    display: flex !important;
    flex-direction: row !important;
    justify-content: flex-start !important;
    align-items: center !important;
    gap: 15px;
  }
  
  .event-detail-header h2 {
    font-size: 16px;
    white-space: nowrap;
    margin: 0;
    flex-shrink: 0;
  }
  
  .header-actions {
    display: flex !important;
    gap: 10px;
    flex-shrink: 0;
  }
  
  .detail-row {
    padding: 10px 12px;
  }
  
  .detail-card .detail-row .detail-label {
    font-size: 14px !important;
    font-weight: 700 !important;
  }
  
  .detail-card .detail-row .detail-value {
    font-size: 14px !important;
  }
  
  .event-file-item {
    width: 80px;
    height: 80px;
  }
}
</style>