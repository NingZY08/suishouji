// 将后端返回的文件地址转换为可直接用于 <img>/<a> 的地址。
// - 站外对象存储地址：走同源媒体代理 /api/media，规避预览环境的跨域/CSP 限制
// - 相对路径：开发环境交由 Vite 代理处理
export function toMediaUrl(file: string | undefined | null): string {
  if (!file) return ''
  const value = String(file)
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value)
      if (typeof window !== 'undefined' && parsed.host === window.location.host) {
        return value
      }
    } catch (e) {
      // 解析失败则按外部地址处理
    }
    return `/api/media?url=${encodeURIComponent(value)}`
  }
  return value.startsWith('/') ? value : `/${value}`
}

// 是否为站外完整地址
export function isRemoteUrl(file: string | undefined | null): boolean {
  return !!file && /^https?:\/\//i.test(String(file))
}
