import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, supabaseConfigHint } from '../lib/supabase'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!isSupabaseConfigured) {
      setError('请先完成 Supabase 配置后再登录或注册。')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        const { needsEmailConfirm } = await signUp(email.trim(), password)
        if (needsEmailConfirm) {
          setMessage('注册成功，请查收邮箱验证链接。验证通过后即可登录。')
          setMode('login')
        } else {
          setMessage('注册成功，已自动登录。')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const submitLabel = !isSupabaseConfigured
    ? '请先配置 Supabase'
    : loading
      ? '处理中…'
      : mode === 'login'
        ? '登录'
        : '注册'

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <h1>XS Note</h1>
          <p>简约笔记，随心记录</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="alert alert--warning">
            <p className="alert__title">Supabase 尚未配置</p>
            <p>{supabaseConfigHint}</p>
            <ol className="setup-steps">
              <li>在 Supabase 创建项目，执行 <code>supabase/schema.sql</code></li>
              <li>复制 <code>.env.example</code> 为 <code>.env</code></li>
              <li>填入 Project URL 与 anon key，保存后重启 <code>npm run dev</code></li>
            </ol>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">邮箱</span>
            <input
              type="email"
              className="field__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
              disabled={!isSupabaseConfigured}
            />
          </label>

          <label className="field">
            <span className="field__label">密码</span>
            <input
              type="password"
              className="field__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={!isSupabaseConfigured}
            />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}

          <button
            type="submit"
            className={`btn btn--primary btn--block${!isSupabaseConfigured ? ' btn--disabled' : ''}`}
            disabled={loading || !isSupabaseConfigured}
          >
            {submitLabel}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              还没有账号？
              <button type="button" className="link-btn" onClick={() => setMode('register')}>
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button type="button" className="link-btn" onClick={() => setMode('login')}>
                去登录
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, error } = useAuth()

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" aria-label="加载中" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="alert alert--error" role="alert">{error}</div>
          <button type="button" className="btn btn--primary btn--block" onClick={() => window.location.reload()}>
            刷新重试
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return <>{children}</>
}
