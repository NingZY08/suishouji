<template>
  <Layout>
    <div class="admin-users">
      <el-card>
        <template #header>
          <div class="page-header">
            <h2>用户管理</h2>
            <el-input
              v-model="keyword"
              placeholder="搜索用户名或邮箱"
              clearable
              style="width: 240px"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            >
              <template #append>
                <el-button :icon="Search" @click="handleSearch"></el-button>
              </template>
            </el-input>
          </div>
        </template>

        <el-table :data="users" v-loading="loading" style="width: 100%">
      <el-table-column prop="username" label="用户名" min-width="140"></el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="200"></el-table-column>
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">
            {{ row.role === 'admin' ? '管理员' : '用户' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="注册时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" class-name="table-actions">
        <template #default="{ row }">
          <el-button
            size="small"
            type="primary"
            :disabled="row.role === 'admin'"
            @click="openEdit(row)"
          >编辑</el-button>
          <el-button
            size="small"
            type="warning"
            :disabled="row.role === 'admin'"
            @click="openReset(row)"
          >重置密码</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="fetchUsers"
        @size-change="handleSizeChange"
      ></el-pagination>
    </div>

    <el-dialog v-model="editVisible" title="编辑用户资料" width="440px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="editForm.username" maxlength="20" show-word-limit></el-input>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="editForm.email"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resetVisible" title="重置用户密码" width="440px">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="重置后该用户所有已登录设备将被强制下线，需使用新密码重新登录"
        style="margin-bottom: 16px"
      ></el-alert>
      <el-form ref="resetFormRef" :model="resetForm" :rules="resetRules" label-width="90px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="resetForm.newPassword" type="password" show-password></el-input>
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="resetForm.confirmPassword" type="password" show-password></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitReset">确认重置</el-button>
      </template>
    </el-dialog>
      </el-card>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import axios from '../utils/axios'
import Layout from '../components/Layout.vue'

interface AdminUser {
  id: number
  username: string
  email: string
  role: 'user' | 'admin'
  createdAt: string
}

const users = ref<AdminUser[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)

const editVisible = ref(false)
const resetVisible = ref(false)
const editFormRef = ref<FormInstance>()
const resetFormRef = ref<FormInstance>()
const editForm = ref({ id: 0, username: '', email: '' })
const resetForm = ref({ id: 0, username: '', newPassword: '', confirmPassword: '' })

const editRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度在2到20个字符之间', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ]
}

const resetRules: FormRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (value !== resetForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const formatDateTime = (v: string) => {
  if (!v) return ''
  return new Date(v).toLocaleString('zh-CN', { hour12: false })
}

const fetchUsers = async () => {
  loading.value = true
  try {
    const { data } = await axios.get('/api/admin/users', {
      params: { page: page.value, pageSize: pageSize.value, keyword: keyword.value || undefined }
    })
    users.value = data.users
    total.value = data.total
  } catch (err: any) {
    const status = err.response?.status
    if (status === 403) {
      ElMessage.error('无权限访问用户管理')
      users.value = []
    } else {
      ElMessage.error(err.response?.data?.message || '获取用户列表失败')
    }
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  fetchUsers()
}

const handleSizeChange = () => {
  page.value = 1
  fetchUsers()
}

const openEdit = (row: AdminUser) => {
  editForm.value = { id: row.id, username: row.username, email: row.email }
  editVisible.value = true
  editFormRef.value?.clearValidate()
}

const submitEdit = async () => {
  const valid = await editFormRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await axios.put(`/api/admin/users/${editForm.value.id}`, {
      username: editForm.value.username,
      email: editForm.value.email
    })
    ElMessage.success('资料已更新')
    editVisible.value = false
    fetchUsers()
  } catch (err: any) {
    const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || '更新失败'
    ElMessage.error(msg)
  } finally {
    saving.value = false
  }
}

const openReset = (row: AdminUser) => {
  resetForm.value = { id: row.id, username: row.username, newPassword: '', confirmPassword: '' }
  resetVisible.value = true
  resetFormRef.value?.clearValidate()
}

const submitReset = async () => {
  const valid = await resetFormRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await axios.put(`/api/admin/users/${resetForm.value.id}/password`, {
      newPassword: resetForm.value.newPassword
    })
    ElMessage.success(`已重置「${resetForm.value.username}」的密码，该用户需重新登录`)
    resetVisible.value = false
  } catch (err: any) {
    const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || '重置失败'
    ElMessage.error(msg)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.admin-users {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.admin-users :deep(.table-actions .el-button) {
  margin-left: 0;
  margin-right: 8px;
}
</style>
