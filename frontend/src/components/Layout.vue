<template>
  <div class="layout-container">
    <div v-if="isMobile && sidebarVisible" class="sidebar-overlay" @click="toggleSidebar"></div>
    <aside class="sidebar" :class="{ 'sidebar-hidden': isMobile && !sidebarVisible }">
      <div class="sidebar-header">
        <h2>随手记</h2>
      </div>
      <nav class="sidebar-nav">
        <ul>
          <li>
            <router-link to="/events" class="nav-link" @click="handleNavClick">
              <el-icon><Calendar /></el-icon>
              <span>事件管理</span>
            </router-link>
          </li>
          <li>
            <router-link to="/categories" class="nav-link" @click="handleNavClick">
              <el-icon><List /></el-icon>
              <span>分类管理</span>
            </router-link>
          </li>
          <li>
            <router-link to="/statistics" class="nav-link" @click="handleNavClick">
              <el-icon><DataAnalysis /></el-icon>
              <span>数据统计</span>
            </router-link>
          </li>
          <li>
            <router-link to="/profile" class="nav-link" @click="handleNavClick">
              <el-icon><User /></el-icon>
              <span>个人中心</span>
            </router-link>
          </li>
          <li>
            <router-link to="/ai-settings" class="nav-link" @click="handleNavClick">
              <el-icon><MagicStick /></el-icon>
              <span>AI 设置</span>
            </router-link>
          </li>
          <li v-if="userStore.isAdmin">
            <router-link to="/admin/users" class="nav-link" @click="handleNavClick">
              <el-icon><Setting /></el-icon>
              <span>用户管理</span>
            </router-link>
          </li>
        </ul>
      </nav>
      <div v-if="!isMobile" class="sidebar-footer">
        <button class="logout-btn" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          <span>登出</span>
        </button>
      </div>
    </aside>
    <main class="main-content">
      <header class="main-header">
        <div class="header-left">
          <el-button v-if="isMobile" class="menu-toggle" @click="toggleSidebar">
            <el-icon><Menu /></el-icon>
          </el-button>
        </div>
        <div class="header-right">
          <el-button v-if="isMobile" @click="handleLogout">登出</el-button>
        </div>
      </header>
      <div class="content">
        <slot></slot>
      </div>
    </main>
    <AiChat />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Calendar, List, DataAnalysis, User, Menu, SwitchButton, MagicStick, Setting } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../store/modules/user'
import { ElMessage } from 'element-plus'
import axios from '../utils/axios'
import AiChat from './AiChat.vue'

const router = useRouter()
const userStore = useUserStore()

const isMobile = ref(false)
const sidebarVisible = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) {
    sidebarVisible.value = false
  }
}

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

const handleNavClick = () => {
  if (isMobile.value) {
    sidebarVisible.value = false
  }
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
  ElMessage.success('登出成功')
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  refreshRole()
})

// 同步最新 role/username；兼容旧登录态（localStorage 的 userInfo 缺 role）
const refreshRole = async () => {
  if (!userStore.token) return
  try {
    const { data } = await axios.get('/api/user/profile')
    console.log('[Layout] profile 同步: role =', data.role)
    userStore.setUserInfo({ ...userStore.userInfo, ...data })
  } catch (err: any) {
    console.log('[Layout] profile 同步失败:', err.response?.status, err.message)
  }
}

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.layout-container {
  display: flex;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 998;
}

.sidebar {
  width: 200px;
  background-color: #2c3e50;
  color: white;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

.sidebar-hidden {
  transform: translateX(-100%);
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #34495e;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
}

.sidebar-nav {
  flex: 1;
  padding: 20px 0;
}

.sidebar-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-link {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  color: #ecf0f1;
  text-decoration: none;
  transition: all 0.3s ease;
}

.nav-link:hover {
  background-color: #34495e;
  color: white;
}

.nav-link.router-link-active {
  background-color: #3498db;
  color: white;
}

.nav-link el-icon {
  margin-right: 10px;
  font-size: 16px;
}

.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid #34495e;
}

.logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: transparent;
  border: none;
  color: #ecf0f1;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background-color: #34495e;
  color: white;
}

.logout-btn .el-icon {
  margin-right: 10px;
  font-size: 16px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-header {
  background-color: white;
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
}

.menu-toggle {
  padding: 8px 12px;
}

.content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

@media (max-width: 1000px) {
  .content {
    padding: 10px;
    width: 100%;
    max-width: 100%;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 999;
    transform: translateX(-100%);
  }

  .sidebar:not(.sidebar-hidden) {
    transform: translateX(0);
  }

  .sidebar-header h2 {
    display: block;
    font-size: 20px;
  }

  .nav-link span {
    display: inline;
    font-size: 16px;
  }

  .nav-link {
    padding: 15px 20px;
  }

  .nav-link el-icon {
    margin-right: 12px;
    font-size: 18px;
  }

  .main-header {
    padding: 0 15px;
  }

  .content {
    padding: 15px;
  }
}
</style>