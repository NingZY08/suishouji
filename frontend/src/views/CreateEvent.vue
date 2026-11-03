<template>
  <Layout>
    <div class="create-event-container">
      <el-card>
        <template #header>
          <div class="create-event-header">
            <h2>{{ isEdit ? '编辑事件' : '创建事件' }}</h2>
          </div>
        </template>
      <el-form :model="eventForm" :rules="rules" ref="eventFormRef" label-position="top">
        <el-form-item label="事件标题" prop="title">
          <el-input v-model="eventForm.title" placeholder="请输入事件标题" maxlength="100"></el-input>
        </el-form-item>
        <el-form-item label="事件类型">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-select v-model="eventForm.type.level1" placeholder="一级分类" @change="handleLevel1Change">
                <el-option v-for="item in level1Options" :key="item.id" :label="item.name" :value="item.name"></el-option>
              </el-select>
            </el-col>
            <el-col :span="8">
              <el-select v-model="eventForm.type.level2" placeholder="二级分类" @change="handleLevel2Change">
                <el-option v-for="item in level2Options" :key="item.id" :label="item.name" :value="item.name"></el-option>
              </el-select>
            </el-col>
            <el-col :span="8">
              <el-select v-model="eventForm.type.level3" placeholder="三级分类" @change="updateCategoryId">
                <el-option v-for="item in level3Options" :key="item.id" :label="item.name" :value="item.name"></el-option>
              </el-select>
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item label="开始日期" prop="startDate">
          <el-date-picker
            v-model="eventForm.startDate"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledStartDate"
            placeholder="选择开始日期"
          ></el-date-picker>
        </el-form-item>
        <el-form-item label="结束日期" prop="endDate">
          <el-date-picker
            v-model="eventForm.endDate"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledEndDate"
            placeholder="选择结束日期"
          ></el-date-picker>
        </el-form-item>
        <el-form-item label="事件状态" prop="status">
          <el-select v-model="eventForm.status" placeholder="选择状态">
            <el-option label="进行中" value="进行中"></el-option>
            <el-option label="已完成" value="已完成"></el-option>
            <el-option label="已取消" value="已取消"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="事件内容" prop="content">
          <el-input v-model="eventForm.content" type="textarea" rows="5" placeholder="请输入事件内容"></el-input>
        </el-form-item>
        <el-form-item label="事件结果" prop="result">
          <el-input v-model="eventForm.result" type="textarea" rows="3" placeholder="请输入事件结果" maxlength="500"></el-input>
        </el-form-item>
        <el-form-item label="相关插图、文件">
          <div v-if="eventForm.files.length > 0" style="margin-bottom: 10px; color: #67c23a;">
            已上传 {{ eventForm.files.length }} 个文件
          </div>
          <el-upload
            :auto-upload="false"
            :on-change="handleFileChange"
            :on-preview="handlePreview"
            :on-remove="handleRemove"
            :file-list="fileList"
            list-type="picture-card"
            ref="uploadRef"
            multiple
            :limit="5"
            :on-exceed="handleExceed"
            accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.csv,.ppt,.pptx"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
          <el-button type="primary" size="small" @click="submitUpload" style="margin-top: 10px;" :loading="uploading">
            {{ uploading ? '上传中...' : '上传文件' }}
          </el-button>
          <el-dialog v-model="previewVisible" title="图片预览" width="800px" append-to-body>
            <img :src="previewUrl" alt="预览图片" style="width: 100%" />
          </el-dialog>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="loading">保存</el-button>
          <el-button @click="goBackToList">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Layout from '../components/Layout.vue'
import { useEventStore } from '../store/modules/event'
import axios from '../utils/axios'
import { toMediaUrl } from '../utils/fileUrl'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

interface Category {
  id: number
  name: string
  level: number
  children?: Category[]
}

const router = useRouter()
const route = useRoute()
const eventStore = useEventStore()
const eventFormRef = ref()
const loading = ref(false)
const isEdit = ref(false)
const eventId = ref('')
const categoryTree = ref<Category[]>([])

const eventForm = reactive({
  title: '',
  content: '',
  startDate: '',
  endDate: '',
  result: '',
  status: '进行中',
  categoryId: null as number | null,
  type: {
    level1: '',
    level2: '',
    level3: ''
  },
  files: [] as string[]
})

const fileList = ref<any[]>([])
const previewVisible = ref(false)
const previewUrl = ref('')
const uploading = ref(false)
const uploadRef = ref()

const rules = {
  title: [
    { required: true, message: '请输入事件标题', trigger: 'blur' },
    { max: 100, message: '标题长度不能超过100个字符', trigger: 'blur' }
  ],
  startDate: [
    { required: true, message: '请选择开始日期', trigger: 'change' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (value && eventForm.endDate && value > eventForm.endDate) {
          callback(new Error('开始日期不能晚于结束日期'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ],
  endDate: [
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (value && eventForm.startDate && value < eventForm.startDate) {
          callback(new Error('结束日期不能早于开始日期'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ],
  status: [
    { required: true, message: '请选择事件状态', trigger: 'change' }
  ]
}

// 日期联动禁选：已选结束日期后，开始日期面板中晚于结束日期的日期置灰；
// 已选开始日期后，结束日期面板中早于开始日期的日期置灰。
const disabledStartDate = (date: Date) => {
  if (!eventForm.endDate) return false
  return date.getTime() > new Date(`${eventForm.endDate}T23:59:59`).getTime()
}

const disabledEndDate = (date: Date) => {
  if (!eventForm.startDate) return false
  return date.getTime() < new Date(`${eventForm.startDate}T00:00:00`).getTime()
}

const level1Options = computed(() => {
  return categoryTree.value
})

const level2Options = computed(() => {
  if (!eventForm.type.level1) return []
  const level1 = categoryTree.value.find(c => c.name === eventForm.type.level1)
  return level1?.children || []
})

const level3Options = computed(() => {
  if (!eventForm.type.level2) return []
  const level1 = categoryTree.value.find(c => c.name === eventForm.type.level1)
  const level2 = level1?.children?.find(c => c.name === eventForm.type.level2)
  return level2?.children || []
})

const fetchCategories = async () => {
  try {
    const response = await axios.get('/api/events/categories')
    categoryTree.value = response.data
  } catch (error) {
    console.error('获取分类失败:', error)
    ElMessage.error('获取分类失败')
  }
}

const handleLevel1Change = () => {
  eventForm.type.level2 = ''
  eventForm.type.level3 = ''
  eventForm.categoryId = null
}

const handleLevel2Change = () => {
  eventForm.type.level3 = ''
  updateCategoryId()
}

const updateCategoryId = () => {
  if (eventForm.type.level3) {
    const level1 = categoryTree.value.find(c => c.name === eventForm.type.level1)
    const level2 = level1?.children?.find(c => c.name === eventForm.type.level2)
    const level3 = level2?.children?.find(c => c.name === eventForm.type.level3)
    eventForm.categoryId = level3?.id || null
  } else {
    eventForm.categoryId = null
  }
}

const handleFileChange = (_file: any, files: any) => {
  fileList.value = files.map((f: any) => {
    const existing = fileList.value.find(item => item.uid === f.uid)
    return {
      name: f.name,
      url: f.url || '',
      remoteUrl: existing?.remoteUrl || '',
      raw: f.raw,
      uid: f.uid,
      id: existing?.id
    }
  })
}

const handleRemove = (file: any) => {
  const index = fileList.value.findIndex(item => {
    if (file.remoteUrl && item.remoteUrl === file.remoteUrl) return true
    if (file.url && item.url === file.url) return true
    if (file.uid && item.uid === file.uid) return true
    if (file.id && item.id === file.id) return true
    return false
  })
  if (index === -1) return
  const removed = fileList.value[index]
  const canonicalUrl = removed.remoteUrl || removed.url

  const removeFromForm = () => {
    const urlIdx = eventForm.files.indexOf(canonicalUrl)
    if (urlIdx !== -1) eventForm.files.splice(urlIdx, 1)
  }

  if (removed.id) {
    ElMessageBox.confirm('确定要删除该文件吗？此操作不可恢复。', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      try {
        const resp = await axios.delete(`/api/file/${removed.id}`)
        const { referenced } = resp.data
        fileList.value.splice(index, 1)
        removeFromForm()
        if (referenced) {
          ElMessage.warning('文件被其他事件引用，仅在当前编辑中移除')
        } else {
          ElMessage.success('文件已删除')
        }
      } catch (e: any) {
        console.error('删除失败:', e)
        const msg = e?.response?.data?.message || '文件删除失败'
        ElMessage.error(msg)
      }
    }).catch(() => {
      // 用户取消
    })
  } else {
    fileList.value.splice(index, 1)
    removeFromForm()
  }
}

// 计算文件 SHA-256（用于去重，失败时忽略）
const sha256Hex = async (raw: File): Promise<string | undefined> => {
  try {
    if (!window.crypto?.subtle) return undefined
    const buffer = await raw.arrayBuffer()
    const digest = await window.crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch (e) {
    return undefined
  }
}

const submitUpload = async () => {
  const uploadFiles = fileList.value.filter(f => f.raw && !f.remoteUrl)

  if (uploadFiles.length === 0) {
    ElMessage.info('没有需要上传的文件')
    return
  }

  uploading.value = true

  try {
    for (const file of uploadFiles) {
      const raw: File = file.raw
      const hash = await sha256Hex(raw)
      let uploadedUrl = ''
      let fileId: number | undefined
      let duplicate = false

      try {
        // 优先走服务端上传（本地/服务器部署，后端可直连 R2）
        const formData = new FormData()
        formData.append('file', raw)

        const response = await axios.post('/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })

        uploadedUrl = response.data.url
        fileId = response.data.fileId
        duplicate = !!response.data.duplicate
      } catch (err: any) {
        // 后端无法访问 R2 S3 API 时（如云端沙箱），降级为浏览器预签名直传
        const fallback = err?.response?.data
        if (fallback?.fallback !== 'direct' || !fallback?.uploadUrl) {
          throw err
        }
        const putRes = await fetch(fallback.uploadUrl, {
          method: 'PUT',
          body: raw,
          headers: { 'Content-Type': fallback.contentType }
        }).catch(() => undefined)
        if (!putRes || !putRes.ok) {
          throw new Error(`浏览器直传 R2 失败：请在可访问 R2 的环境中执行 npm run r2:cors 配置存储桶 CORS 后重试`)
        }
        const completeRes = await axios.post('/api/upload/complete', {
          key: fallback.key,
          size: raw.size,
          hash
        })
        uploadedUrl = completeRes.data.url || fallback.publicUrl
        fileId = completeRes.data.fileId
        duplicate = !!completeRes.data.duplicate
      }

      if (!uploadedUrl) continue

      const index = fileList.value.findIndex(f => f.uid === file.uid)
      if (index !== -1) {
        fileList.value[index].url = toMediaUrl(uploadedUrl)
        fileList.value[index].remoteUrl = uploadedUrl
        if (fileId) {
          fileList.value[index].id = fileId
        }
      }
      if (!eventForm.files.includes(uploadedUrl)) {
        eventForm.files.push(uploadedUrl)
      }
      if (duplicate) {
        ElMessage.warning(`文件 ${file.name} 已存在，使用已有文件`)
      } else {
        ElMessage.success(`文件 ${file.name} 上传成功`)
      }
    }

    ElMessage.success(`成功上传 ${uploadFiles.length} 个文件`)
  } catch (error: any) {
    console.error('上传失败:', error)
    ElMessage.error('上传失败: ' + (error?.response?.data?.message || error.message || '未知错误'))
  } finally {
    uploading.value = false
  }
}

const handleExceed = () => {
  ElMessage.warning('最多只能上传5个文件')
}

const handlePreview = (file: any) => {
  const remote = file.remoteUrl || file.url || ''
  const displayUrl = file.url || ''
  if (remote) {
    const ext = '.' + (remote.split('?')[0].split('.').pop() || '').toLowerCase()
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    if (imageExts.includes(ext)) {
      previewUrl.value = displayUrl
      previewVisible.value = true
    } else {
      window.open(displayUrl, '_blank')
    }
  }
}

const fetchEventDetail = async (id: string) => {
  try {
    const response = await axios.get(`/api/events/${id}`)
    const event = response.data
    eventForm.title = event.title
    eventForm.content = event.content
    eventForm.startDate = event.startDate
    eventForm.endDate = event.endDate
    eventForm.result = event.result
    eventForm.status = event.status
    eventForm.categoryId = event.categoryId
    eventForm.type = event.type
    eventForm.files = event.files || []
    // 构造 url -> id 的映射表（用于删除操作）
    const metaMap = new Map((response.data.fileMeta || []).map((item: any) => [item.url, item.id]));
    fileList.value = (event.files || []).map((url: string) => {
      const id = metaMap.get(url);
      let name = url.split('/').pop() || 'file';
      try {
        name = decodeURIComponent(name);
      } catch (e) {
        // 文件名含非法编码时保留原样
      }
      return {
        name,
        url: toMediaUrl(url),
        remoteUrl: url,
        id // 可能为 undefined
      };
    });
  } catch (error) {
    console.error('获取事件详情失败:', error)
    ElMessage.error('获取事件详情失败')
  }
}

const handleSubmit = async () => {
  if (!eventFormRef.value) return
  await eventFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true
      try {
        const submitData = {
          ...eventForm,
          startDate: eventForm.startDate || '',
          endDate: eventForm.endDate && eventForm.endDate !== 'Invalid date' ? eventForm.endDate : '',
          result: eventForm.result || '',
          content: eventForm.content || '',
          type: {
            level1: eventForm.type.level1 || '',
            level2: eventForm.type.level2 || '',
            level3: eventForm.type.level3 || ''
          }
        }
        console.log('提交数据:', JSON.stringify(submitData, null, 2))

        if (isEdit.value) {
          await axios.put(`/api/events/${eventId.value}`, submitData)
          ElMessage.success('编辑成功')
          eventStore.updateEvent({ ...eventForm, id: eventId.value, status: eventForm.status as '进行中' | '已完成' | '已取消', categoryId: eventForm.categoryId })
        } else {
          const response = await axios.post('/api/events', submitData)
          ElMessage.success('创建成功')
          eventStore.addEvent(response.data)
        }
        // 返回列表，保持之前的分页位置
        goBackToList()
      } catch (error) {
        console.error('保存失败:', error)
        ElMessage.error('保存失败，请稍后重试')
      } finally {
        loading.value = false
      }
    }
  })
}

// 返回列表时带上之前浏览的页码，保持分页位置
const goBackToList = () => {
  const savedPage = sessionStorage.getItem('eventsPage')
  router.push({ path: '/events', query: savedPage && savedPage !== '1' ? { page: savedPage } : {} })
}

onMounted(() => {
  fetchCategories()
  eventId.value = route.query.id as string
  if (eventId.value) {
    isEdit.value = true
    fetchEventDetail(eventId.value)
  }
})
</script>

<style scoped>
.create-event-container {
  padding: 20px;
}

.create-event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.create-event-header h2 {
  margin: 0;
  color: #303133;
}

.el-form-item {
  margin-bottom: 20px;
}

.el-select {
  min-width: 120px;
}

@media (max-width: 768px) {
  .create-event-container :deep(.el-form-item) {
    display: block;
    margin-bottom: 15px;
  }

  .create-event-container :deep(.el-select) {
    width: 100%;
  }
  
  .create-event-container :deep(.el-col) {
    width: 100% !important;
    margin-bottom: 10px;
  }
}

@media (max-width: 480px) {
  .create-event-container :deep(.el-row) {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .create-event-container :deep(.el-col) {
    width: 100% !important;
    margin-bottom: 0;
  }

  .create-event-container :deep(.el-select) {
    width: 100%;
  }
}

/* 标签样式：加粗并加大一号字 */
.create-event-container :deep(.el-form-item__label) {
  font-weight: 600 !important;
  font-size: 15px !important;
}

.el-upload {
  width: 100%;
}

.create-event-container :deep(.el-upload-list--picture-card .el-upload-list__item) {
  width: 100px;
  height: 100px;
}

.create-event-container :deep(.el-upload--picture-card) {
  width: 100px;
  height: 100px;
}

@media (max-width: 768px) {
  .create-event-container :deep(.el-upload-list--picture-card .el-upload-list__item) {
    width: 80px;
    height: 80px;
  }

  .create-event-container :deep(.el-upload--picture-card) {
    width: 80px;
    height: 80px;
  }
}
</style>