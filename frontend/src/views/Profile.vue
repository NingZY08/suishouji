<template>
  <Layout>
    <div class="profile-container">
      <el-card>
        <template #header>
          <div class="profile-header">
            <h2>个人资料</h2>
          </div>
        </template>
        <el-table :data="tableRows" style="width: 100%">
          <el-table-column prop="field" label="资料项" width="180"></el-table-column>
          <el-table-column prop="value" label="资料内容" min-width="200"></el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="scope">
              <div class="table-actions">
                <el-button size="small" @click="openShowDialog">显示</el-button>
                <el-tooltip v-if="!scope.row.editable" content="暂不支持修改" placement="top">
                  <span>
                    <el-button size="small" type="primary" disabled>编辑</el-button>
                  </span>
                </el-tooltip>
                <el-button v-else size="small" type="primary" @click="openEditDialog">编辑</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 显示对话框 -->
        <el-dialog v-model="showDialogVisible" title="个人资料详情" width="420px">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户ID">{{ profileData.id }}</el-descriptions-item>
            <el-descriptions-item label="用户名">{{ profileData.username }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ profileData.email }}</el-descriptions-item>
          </el-descriptions>
          <template #footer>
            <el-button @click="showDialogVisible = false">关闭</el-button>
          </template>
        </el-dialog>

        <!-- 编辑对话框 -->
        <el-dialog
          v-model="editDialogVisible"
          title="编辑个人资料"
          width="460px"
          :close-on-click-modal="false"
        >
          <el-form :model="editForm" :rules="rules" ref="editFormRef" label-width="100px">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="editForm.username" placeholder="请输入用户名"></el-input>
            </el-form-item>
            <el-form-item label="新密码" prop="password">
              <el-input
                v-model="editForm.password"
                type="password"
                placeholder="留空表示不修改密码"
                show-password
              ></el-input>
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="editForm.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                show-password
              ></el-input>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="handleCancelEdit">取消</el-button>
            <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
          </template>
        </el-dialog>
      </el-card>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import { useUserStore } from '../store/modules/user'
import axios from '../utils/axios'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const editFormRef = ref()
const saving = ref(false)
const showDialogVisible = ref(false)
const editDialogVisible = ref(false)

const profileData = reactive({
  id: '' as number | string,
  username: '',
  email: ''
})

const tableRows = computed(() => [
  { field: '用户名', value: profileData.username, editable: true },
  { field: '邮箱', value: profileData.email, editable: false },
  { field: '用户ID', value: String(profileData.id), editable: false }
])

const editForm = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度在2到20个字符之间', trigger: 'blur' }
  ],
  password: [
    { min: 6, message: '密码长度不能少于6个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    {
      validator: (_rule: any, value: any, callback: any) => {
        if (value && value !== editForm.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const fetchUserInfo = async () => {
  try {
    const response = await axios.get('/api/user/profile')
    profileData.id = response.data.id
    profileData.username = response.data.username
    profileData.email = response.data.email
  } catch (error) {
    console.error('获取用户信息失败:', error)
    ElMessage.error('获取用户信息失败')
  }
}

const openShowDialog = () => {
  showDialogVisible.value = true
}

const openEditDialog = () => {
  editForm.username = profileData.username
  editForm.password = ''
  editForm.confirmPassword = ''
  editDialogVisible.value = true
  nextTick(() => editFormRef.value?.clearValidate())
}

const handleCancelEdit = () => {
  editDialogVisible.value = false
}

const handleSave = async () => {
  if (!editFormRef.value) return
  await editFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      const updateData: Record<string, string> = { username: editForm.username }
      if (editForm.password) {
        updateData.password = editForm.password
      }
      const response = await axios.put('/api/user/profile', updateData)
      profileData.id = response.data.id
      profileData.username = response.data.username
      profileData.email = response.data.email
      userStore.setUserInfo(response.data)
      ElMessage.success('保存成功')
      editDialogVisible.value = false
    } catch (error) {
      console.error('保存失败:', error)
      ElMessage.error('保存失败，请稍后重试')
    } finally {
      saving.value = false
    }
  })
}

onMounted(() => {
  fetchUserInfo()
})
</script>

<style scoped>
.profile-container {
  padding: 20px;
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profile-header h2 {
  margin: 0;
  color: #303133;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-actions :deep(.el-button) {
  margin-left: 0;
}
</style>
