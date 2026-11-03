<template>
  <Layout>
    <div class="ai-settings-container">
      <el-card>
        <template #header>
          <div class="ai-settings-header">
            <h2>AI 设置</h2>
            <el-button type="primary" @click="openCreateDialog">新增配置</el-button>
          </div>
        </template>

        <el-table :data="configs" style="width: 100%">
          <el-table-column prop="name" label="配置名称" min-width="120">
            <template #default="scope">
              <span>{{ scope.row.name }}</span>
              <el-tag v-if="scope.row.isDefault" size="small" type="success" style="margin-left: 6px;">默认</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="baseUrl" label="Base URL" min-width="200" show-overflow-tooltip></el-table-column>
          <el-table-column prop="model" label="模型" min-width="140"></el-table-column>
          <el-table-column prop="apiKeyMasked" label="API Key" width="140"></el-table-column>
          <el-table-column label="操作" width="240">
            <template #default="scope">
              <div class="table-actions">
                <el-button size="small" type="primary" @click="openEditDialog(scope.row)">编辑</el-button>
                <el-button
                  size="small"
                  :disabled="scope.row.isDefault"
                  @click="setDefault(scope.row)"
                >设为默认</el-button>
                <el-button size="small" type="danger" @click="deleteConfig(scope.row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="configs.length === 0" class="empty-tip">
          还没有 AI 配置，点击右上角「新增配置」接入你的 LLM 服务。
        </div>
      </el-card>

      <!-- 新建/编辑对话框 -->
      <el-dialog
        v-model="dialogVisible"
        :title="editingId ? '编辑配置' : '新增配置'"
        width="480px"
        :close-on-click-modal="false"
      >
        <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
          <el-form-item label="配置名称" prop="name">
            <el-input v-model="form.name" placeholder="例如：DeepSeek、通义千问" maxlength="50"></el-input>
          </el-form-item>
          <el-form-item label="Base URL" prop="baseUrl">
            <el-input v-model="form.baseUrl" placeholder="https://api.deepseek.com/v1"></el-input>
          </el-form-item>
          <el-form-item label="API Key" prop="apiKey">
            <el-input
              v-model="form.apiKey"
              type="password"
              show-password
              :placeholder="editingId ? '留空表示不修改' : '请输入 API Key'"
            ></el-input>
          </el-form-item>
          <el-form-item label="模型名称" prop="model">
            <el-input v-model="form.model" placeholder="例如 deepseek-chat"></el-input>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button :loading="testing" @click="handleTest">测试连接</el-button>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </template>
      </el-dialog>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import axios from '../utils/axios'
import { ElMessage, ElMessageBox } from 'element-plus'

interface AiConfigItem {
  id: number
  name: string
  baseUrl: string
  model: string
  isDefault: boolean
  apiKeyMasked: string
}

const formRef = ref()
const saving = ref(false)
const testing = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const configs = ref<AiConfigItem[]>([])

const form = reactive({
  name: '',
  baseUrl: '',
  apiKey: '',
  model: ''
})

const rules = {
  name: [
    { required: true, message: '请输入配置名称', trigger: 'blur' },
    { min: 1, max: 50, message: '配置名称长度需在1到50个字符之间', trigger: 'blur' }
  ],
  baseUrl: [
    { required: true, message: '请输入 Base URL', trigger: 'blur' },
    { type: 'url', message: 'Base URL 必须是合法的 URL', trigger: 'blur' }
  ],
  apiKey: [
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (!editingId.value && !value) {
          callback(new Error('请输入 API Key'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  model: [
    { required: true, message: '请输入模型名称', trigger: 'blur' }
  ]
}

const fetchConfigs = async () => {
  try {
    const response = await axios.get('/api/ai/configs')
    configs.value = response.data
  } catch (error) {
    console.error('获取 AI 配置失败:', error)
    ElMessage.error('获取 AI 配置失败')
  }
}

const openCreateDialog = () => {
  editingId.value = null
  form.name = ''
  form.baseUrl = ''
  form.apiKey = ''
  form.model = ''
  dialogVisible.value = true
  clearValidateSoon()
}

const openEditDialog = (row: AiConfigItem) => {
  editingId.value = row.id
  form.name = row.name
  form.baseUrl = row.baseUrl
  form.apiKey = ''
  form.model = row.model
  dialogVisible.value = true
  clearValidateSoon()
}

const clearValidateSoon = () => {
  setTimeout(() => formRef.value?.clearValidate(), 0)
}

const handleSave = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (editingId.value) {
        await axios.put(`/api/ai/configs/${editingId.value}`, { ...form })
      } else {
        await axios.post('/api/ai/configs', { ...form })
      }
      ElMessage.success('保存成功')
      dialogVisible.value = false
      await fetchConfigs()
    } catch (error: any) {
      const errors = error?.response?.data?.errors
      ElMessage.error(errors?.[0]?.msg || '保存失败，请稍后重试')
    } finally {
      saving.value = false
    }
  })
}

const handleTest = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    testing.value = true
    try {
      const payload: Record<string, any> = { ...form }
      if (editingId.value) {
        payload.configId = editingId.value
      }
      const response = await axios.post('/api/ai/config/test', payload)
      ElMessage.success(response.data.message || '连接成功')
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || '连接失败')
    } finally {
      testing.value = false
    }
  })
}

const setDefault = async (row: AiConfigItem) => {
  try {
    await axios.put(`/api/ai/configs/${row.id}/default`)
    ElMessage.success(`已将「${row.name}」设为默认`)
    await fetchConfigs()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '设置失败')
  }
}

const deleteConfig = async (row: AiConfigItem) => {
  try {
    await ElMessageBox.confirm(`确定删除配置「${row.name}」吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch (_) {
    return
  }
  try {
    await axios.delete(`/api/ai/configs/${row.id}`)
    ElMessage.success('删除成功')
    await fetchConfigs()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '删除失败')
  }
}

onMounted(() => {
  fetchConfigs()
})
</script>

<style scoped>
.ai-settings-container {
  padding: 20px;
}

.ai-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ai-settings-header h2 {
  margin: 0;
  color: #303133;
}

.table-actions {
  display: flex;
  gap: 8px;
}

.table-actions :deep(.el-button) {
  margin-left: 0;
}

.empty-tip {
  padding: 24px 0;
  text-align: center;
  color: #909399;
  font-size: 14px;
}
</style>
