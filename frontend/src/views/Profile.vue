<template>
  <Layout>
    <div class="profile-container">
      <el-card>
        <template #header>
          <div class="profile-header">
            <h2>个人资料</h2>
          </div>
        </template>
        <el-form :model="profileForm" :rules="rules" ref="profileFormRef" label-width="120px">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="profileForm.username" placeholder="请输入用户名"></el-input>
          </el-form-item>
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="profileForm.email" placeholder="请输入邮箱" disabled></el-input>
          </el-form-item>
          <el-form-item label="新密码" prop="password">
            <el-input v-model="profileForm.password" type="password" placeholder="请输入新密码"></el-input>
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input v-model="profileForm.confirmPassword" type="password" placeholder="请确认新密码"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSubmit" :loading="loading">保存</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import { useUserStore } from '../store/modules/user'
import axios from '../utils/axios'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const profileFormRef = ref()
const loading = ref(false)

const profileForm = reactive({
  username: '',
  email: '',
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
        if (value && value !== profileForm.password) {
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
    profileForm.username = response.data.username
    profileForm.email = response.data.email
  } catch (error) {
    console.error('获取用户信息失败:', error)
    ElMessage.error('获取用户信息失败')
  }
}

const handleSubmit = async () => {
  if (!profileFormRef.value) return
  await profileFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true
      try {
        const updateData = {
          username: profileForm.username
        }
        if (profileForm.password) {
          ;(updateData as any).password = profileForm.password
        }
        const response = await axios.put('/api/user/profile', updateData)
        ElMessage.success('保存成功')
        userStore.setUserInfo(response.data)
      } catch (error) {
        console.error('保存失败:', error)
        ElMessage.error('保存失败，请稍后重试')
      } finally {
        loading.value = false
      }
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
  text-align: center;
}

.profile-header h2 {
  margin: 0;
  color: #303133;
}

.el-form-item {
  margin-bottom: 20px;
}
</style>