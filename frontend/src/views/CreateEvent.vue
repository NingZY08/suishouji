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
          <el-date-picker v-model="eventForm.startDate" type="date" placeholder="选择开始日期"></el-date-picker>
        </el-form-item>
        <el-form-item label="结束日期" prop="endDate">
          <el-date-picker v-model="eventForm.endDate" type="date" placeholder="选择结束日期"></el-date-picker>
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
          <el-button @click="$router.push('/events')">取消</el-button>
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
import { useUserStore } from '../store/modules/user'
import axios from '../utils/axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

interface Category {
  id: number
  name: string
  level: number
  children?: Category[]
}

const userStore = useUserStore()

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
    { required: true, message: '请选择开始日期', trigger: 'change' }
  ],
  status: [
    { required: true, message: '请选择事件状态', trigger: 'change' }
  ]
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

const handleFileChange = (file: any, files: any) => {
  fileList.value = files.map((f: any) => {
    const existing = fileList.value.find(item => item.uid === f.uid)
    return {
      name: f.name,
      url: f.url || '',
      raw: f.raw,
      uid: f.uid,
      id: existing?.id
    }
  })
}

const handleUploadSuccess = (response: any, file: any) => {
  console.log('上传成功，响应:', response)
  console.log('上传成功，文件:', file)

  if (response && response.url) {
    // 将文件信息加入列表，包含文件 ID（用于后续删除）以及 uid
    fileList.value.push({
      name: file.name,
      url: response.url,
      id: response.fileId,
      uid: file.uid
    })
    eventForm.files.push(response.url)
    // 根据是否重复给出不同提示
    if (response.duplicate) {
      ElMessage.warning(`文件 ${file.name} 已存在，使用已有文件`)
    } else {
      ElMessage.success(`文件 ${file.name} 上传成功`)
    }
  } else {
    console.error('上传响应格式错误:', response)
    ElMessage.error('上传响应格式错误')
  }
}

const handleRemove = (file: any) => {
  const index = fileList.value.findIndex(item => {
    if (file.url && item.url === file.url) return true
    if (file.uid && item.uid === file.uid) return true
    if (file.id && item.id === file.id) return true
    return false
  })
  if (index === -1) return
  const removed = fileList.value[index]

  if (removed.id) {
    ElMessageBox.confirm('确定要删除该文件吗？此操作不可恢复。', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      try {
        const resp = await axios.delete(`/api/file/${removed.id}`)
        const { referenced } = resp.data
        if (referenced) {
          fileList.value.splice(index, 1)
          const urlIdx = eventForm.files.indexOf(removed.url)
          if (urlIdx !== -1) eventForm.files.splice(urlIdx, 1)
          ElMessage.warning('文件被其他事件引用，仅在当前编辑中移除')
        } else {
          fileList.value.splice(index, 1)
          const urlIdx = eventForm.files.indexOf(removed.url)
          if (urlIdx !== -1) eventForm.files.splice(urlIdx, 1)
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
  }
}

const submitUpload = async () => {
  const uploadFiles = fileList.value.filter(f => !f.url || !f.url.startsWith('https://'))

  if (uploadFiles.length === 0) {
    ElMessage.info('没有需要上传的文件')
    return
  }

  uploading.value = true

  try {
    const uploadPromises = uploadFiles.map(async (file) => {
      const formData = new FormData()
      formData.append('file', file.raw)

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      return { file, response }
    })

    const results = await Promise.all(uploadPromises)

    for (const { file, response } of results) {
      if (response.data && response.data.url) {
        const index = fileList.value.findIndex(f => f.name === file.name)
        if (index !== -1) {
          fileList.value[index].url = response.data.url
          fileList.value[index].id = response.data.fileId
        }
        if (!eventForm.files.includes(response.data.url)) {
          eventForm.files.push(response.data.url)
        }
        if (response.data.duplicate) {
          ElMessage.warning(`文件 ${file.name} 已存在，使用已有文件`)
        } else {
          ElMessage.success(`文件 ${file.name} 上传成功`)
        }
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
  const url = file.url || (file.response && file.response.url)
  if (url) {
    const ext = '.' + (url.split('?')[0].split('.').pop() || '').toLowerCase()
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    if (imageExts.includes(ext)) {
      previewUrl.value = url
      previewVisible.value = true
    } else {
      window.open(url, '_blank')
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
      return {
        name: decodeURIComponent(url.split('/').pop() || 'file'),
        url,
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
        router.push('/events')
      } catch (error) {
        console.error('保存失败:', error)
        ElMessage.error('保存失败，请稍后重试')
      } finally {
        loading.value = false
      }
    }
  })
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要登出吗？', '登出确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    })
    userStore.logout()
    ElMessage.success('登出成功')
    router.push('/login')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('登出失败:', error)
      ElMessage.error('登出失败')
    }
  }
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