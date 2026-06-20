import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const configuredKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isValidHttpUrl(url: string | undefined): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export const isSupabaseConfigured =
  isValidHttpUrl(configuredUrl) &&
  Boolean(configuredKey) &&
  !configuredUrl.includes('your-project') &&
  configuredKey !== 'your-anon-key'

const fallbackUrl = 'https://placeholder.supabase.co'
const fallbackKey = 'placeholder-key'

let client: SupabaseClient

try {
  client = createClient(
    isSupabaseConfigured ? configuredUrl : fallbackUrl,
    isSupabaseConfigured ? configuredKey! : fallbackKey,
  )
} catch (error) {
  console.error('[ShadowNote] Supabase 初始化失败，已回退到占位配置。', error)
  client = createClient(fallbackUrl, fallbackKey)
}

export const supabase = client

export const supabaseConfigHint = !isSupabaseConfigured
  ? configuredUrl && !isValidHttpUrl(configuredUrl)
    ? 'Supabase URL 格式无效，请使用完整的 https://xxx.supabase.co 地址。'
    : '请先配置 Supabase：复制 .env.example 为 .env 并填入项目 URL 与 anon key。'
  : null
