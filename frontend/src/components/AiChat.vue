<template>
  <div class="ai-chat-root">
    <el-button
      class="ai-fab"
      type="primary"
      circle
      size="large"
      @click="openChat"
      title="AI 助手"
    >
      <el-icon :size="22"><ChatDotRound /></el-icon>
    </el-button>

    <el-drawer
      v-model="drawerVisible"
      :title="'AI 助手'"
      :size="drawerSize"
      :destroy-on-close="false"
      class="ai-chat-drawer"
    >
      <div class="chat-panel">
        <div class="chat-config-bar">
          <span class="config-label">模型</span>
          <el-select
            v-model="currentConfigId"
            size="small"
            class="config-select"
            placeholder="选择 AI 配置"
          >
            <el-option
              v-for="c in configs"
              :key="c.id"
              :label="c.name + '（' + c.model + '）'"
              :value="c.id"
            >
              <span>{{ c.name }}（{{ c.model }}）</span>
              <el-tag v-if="c.isDefault" size="small" type="success" style="margin-left: 6px;">默认</el-tag>
            </el-option>
          </el-select>
        </div>
        <div class="chat-messages" ref="messagesEl">
          <div v-if="messages.length === 0" class="chat-empty">
            <p>你好，我是随手记 AI 助手。</p>
            <p>可以直接问我事件记录，例如：「我 10 月完成了哪些学习事件？」</p>
          </div>
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="chat-row"
            :class="msg.role === 'user' ? 'chat-row-user' : 'chat-row-assistant'"
          >
            <div class="chat-bubble" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-assistant'">
              <div class="bubble-text">{{ msg.content }}</div>
              <div v-if="msg.events && msg.events.length" class="bubble-events">
                <div class="events-title">命中的事件（{{ msg.events.length }}）</div>
                <div v-for="ev in msg.events" :key="ev.id" class="event-item">
                  <span class="event-title">{{ ev.title }}</span>
                  <span class="event-meta">{{ ev.type }} · {{ ev.status }} · {{ ev.startDate }}<template v-if="ev.endDate"> ~ {{ ev.endDate }}</template></span>
                </div>
              </div>
              <div v-if="msg.error" class="bubble-error">{{ msg.error }}</div>
            </div>
          </div>
          <div v-if="streaming" class="chat-row chat-row-assistant">
            <div class="chat-bubble bubble-assistant">
              <div class="bubble-text">{{ pendingText || '思考中…' }}<span class="cursor">▌</span></div>
            </div>
          </div>
        </div>
        <div class="chat-input">
          <el-input
            v-model="input"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="输入问题，Enter 发送"
            @keydown.enter.exact.prevent="sendMessage"
            :disabled="streaming"
          ></el-input>
          <el-button type="primary" :loading="streaming" @click="sendMessage">发送</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import axios from '../utils/axios'

interface ChatEventItem {
  id: string
  title: string
  type: string
  status: string
  startDate: string
  endDate: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  events?: ChatEventItem[]
  error?: string
}

interface AiConfigItem {
  id: number
  name: string
  model: string
  isDefault: boolean
}

const router = useRouter()
const userStore = useUserStore()

const drawerVisible = ref(false)
const drawerSize = computed(() => (window.innerWidth <= 768 ? '100%' : '420px'))
const input = ref('')
const streaming = ref(false)
const pendingText = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const configs = ref<AiConfigItem[]>([])
const currentConfigId = ref<number | null>(null)

const messages = ref<ChatMessage[]>([])

// 记住本次会话内选择的模型配置
watch(currentConfigId, (val) => {
  if (val) {
    sessionStorage.setItem('aiChatConfigId', String(val))
  }
})

const openChat = () => {
  drawerVisible.value = true
  loadConfigs()
}

// 拉取配置列表并恢复上次选择的模型（失效则回默认配置）
const loadConfigs = async () => {
  try {
    const response = await axios.get('/api/ai/configs')
    configs.value = response.data
    const savedId = Number(sessionStorage.getItem('aiChatConfigId'))
    const savedExists = configs.value.some(c => c.id === savedId)
    if (savedExists) {
      currentConfigId.value = savedId
    } else {
      currentConfigId.value = configs.value.find(c => c.isDefault)?.id ?? configs.value[0]?.id ?? null
    }
  } catch (error) {
    console.error('获取 AI 配置列表失败:', error)
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

const appendNotice = (content: string) => {
  messages.value.push({ role: 'assistant', content })
  scrollToBottom()
}

const sendMessage = async () => {
  const text = input.value.trim()
  if (!text || streaming.value) return
  if (!userStore.token) {
    ElMessage.error('请先登录')
    return
  }

  messages.value.push({ role: 'user', content: text })
  input.value = ''
  scrollToBottom()

  streaming.value = true
  pendingText.value = ''

  const history = messages.value
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }))

  const finalizeAssistant = (patch: Partial<ChatMessage>) => {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant') {
      Object.assign(last, patch)
    } else {
      messages.value.push({ role: 'assistant', content: pendingText.value, ...patch })
    }
  }

  try {
    const resp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userStore.token}`
      },
      body: JSON.stringify({
        messages: history,
        configId: currentConfigId.value ?? undefined
      })
    })

    if (resp.status === 409) {
      streaming.value = false
      appendNotice('尚未配置 AI 服务，请先前往「AI 设置」完成配置。')
      promptAiSetup()
      return
    }
    if (resp.status === 404) {
      streaming.value = false
      appendNotice('所选 AI 配置已被删除，请在对话框顶部重新选择模型。')
      await loadConfigs()
      return
    }
    if (resp.status === 401) {
      streaming.value = false
      appendNotice('登录已过期，请重新登录后再使用 AI 助手。')
      return
    }
    if (!resp.ok || !resp.body) {
      streaming.value = false
      appendNotice(`AI 服务请求失败（HTTP ${resp.status}）。`)
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let toolEvents: ChatEventItem[] = []
    let streamFailed = false
    let failMessage = ''

    const handleSSE = (payload: any) => {
      if (payload.type === 'delta') {
        pendingText.value += payload.content || ''
        scrollToBottom()
      } else if (payload.type === 'tool') {
        toolEvents = payload.events || []
      } else if (payload.type === 'error') {
        streamFailed = true
        failMessage = payload.message || 'AI 服务调用失败'
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue
        try {
          handleSSE(JSON.parse(data))
        } catch (_) {
          // 忽略无法解析的行
        }
      }
    }

    if (pendingText.value || toolEvents.length) {
      finalizeAssistant({
        content: pendingText.value,
        events: toolEvents.length ? toolEvents : undefined,
        error: streamFailed ? failMessage : undefined
      })
    } else {
      appendNotice(streamFailed ? failMessage : 'AI 未返回内容，请重试。')
    }
  } catch (error: any) {
    if (pendingText.value) {
      finalizeAssistant({ error: error?.message || '网络异常，请重试' })
    } else {
      appendNotice(error?.message || '网络异常，请重试')
    }
  } finally {
    streaming.value = false
    pendingText.value = ''
    scrollToBottom()
  }
}

// 未配置 AI 时，在提示后弹确认框引导跳转设置页
const promptAiSetup = () => {
  ElMessageBox.confirm('现在前往 AI 设置页配置 LLM 服务吗？', 'AI 未配置', {
    confirmButtonText: '前往设置',
    cancelButtonText: '稍后',
    type: 'info'
  })
    .then(() => {
      drawerVisible.value = false
      router.push('/ai-settings')
    })
    .catch(() => {})
}
</script>

<style scoped>
.ai-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 999;
  width: 52px;
  height: 52px;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-config-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 4px;
  border-bottom: 1px solid #ebeef5;
}

.config-label {
  font-size: 13px;
  color: #909399;
  flex-shrink: 0;
}

.config-select {
  flex: 1;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.chat-empty {
  text-align: center;
  color: #909399;
  font-size: 13px;
  line-height: 1.8;
  margin-top: 40px;
}

.chat-row {
  display: flex;
  margin-bottom: 12px;
}

.chat-row-user {
  justify-content: flex-end;
}

.chat-row-assistant {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 85%;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.bubble-user {
  background-color: #409eff;
  color: white;
}

.bubble-assistant {
  background-color: #f4f4f5;
  color: #303133;
}

.bubble-text {
  white-space: pre-wrap;
}

.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.bubble-error {
  margin-top: 6px;
  color: #f56c6c;
  font-size: 12px;
}

.bubble-events {
  margin-top: 8px;
  border-top: 1px solid #dcdfe6;
  padding-top: 8px;
}

.events-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.event-item {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  border-bottom: 1px dashed #e4e7ed;
}

.event-item:last-child {
  border-bottom: none;
}

.event-title {
  font-weight: bold;
  font-size: 13px;
}

.event-meta {
  font-size: 12px;
  color: #909399;
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 10px 8px;
  border-top: 1px solid #e4e7ed;
  align-items: flex-end;
}
</style>
