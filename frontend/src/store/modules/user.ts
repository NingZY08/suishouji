import { defineStore } from 'pinia'

interface UserState {
  token: string | null
  userInfo: {
    id: number
    username: string
    email: string
    role?: 'user' | 'admin'
  } | null
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: localStorage.getItem('token'),
    userInfo: localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')!) : null
  }),
  getters: {
    isAdmin: (state) => state.userInfo?.role === 'admin'
  },
  actions: {
    setToken(token: string) {
      this.token = token
      localStorage.setItem('token', token)
    },
    setUserInfo(userInfo: any) {
      this.userInfo = userInfo
      localStorage.setItem('userInfo', JSON.stringify(userInfo))
    },
    logout() {
      this.token = null
      this.userInfo = null
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
    }
  }
})