import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import axios from '../utils/axios'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/events'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue')
  },
  {
    path: '/events',
    name: 'Events',
    component: () => import('../views/Events.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/event/:id',
    name: 'EventDetail',
    component: () => import('../views/EventDetail.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/create',
    name: 'CreateEvent',
    component: () => import('../views/CreateEvent.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('../views/Statistics.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/categories',
    name: 'Categories',
    component: () => import('../views/Categories.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/ai-settings',
    name: 'AiSettings',
    component: () => import('../views/AiSettings.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: () => import('../views/AdminUsers.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach(async (to, _from, next) => {
  const token = localStorage.getItem('token')
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!token) {
      next({ name: 'Login' })
      return
    }
  }

  if (to.meta.requiresAdmin) {
    const stored = localStorage.getItem('userInfo')
    let role: string | undefined = stored ? JSON.parse(stored)?.role : undefined
    // 存量登录缺 role 时补拉一次 profile 再判定
    if (!role && token) {
      try {
        const { data } = await axios.get('/api/user/profile')
        role = data.role
        localStorage.setItem('userInfo', JSON.stringify({ ...(stored ? JSON.parse(stored) : {}), ...data }))
      } catch (_) {
        next('/events')
        return
      }
    }
    if (role !== 'admin') {
      next('/events')
      return
    }
  }

  next()
})

export default router