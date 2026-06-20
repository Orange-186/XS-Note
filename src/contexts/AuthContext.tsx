import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': '邮箱或密码错误',
    'Email not confirmed': '邮箱尚未验证，请查收验证邮件后再登录',
    'User already registered': '该邮箱已注册，请直接登录',
    'Signup is disabled': '注册功能未开启，请在 Supabase 控制台启用 Email 登录',
    'Password should be at least 6 characters': '密码至少需要 6 位',
    'Unable to validate email address: invalid format': '邮箱格式不正确',
  }
  return map[message] ?? message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!mounted) return
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setLoading(false)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : '认证服务连接失败')
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    if (signUpError) throw new Error(translateAuthError(signUpError.message))
    return { needsEmailConfirm: Boolean(data.user && !data.session) }
  }

  const signIn = async (email: string, password: string) => {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw new Error(translateAuthError(signInError.message))
  }

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw new Error(translateAuthError(signOutError.message))
  }

  const value = useMemo(
    () => ({ user, session, loading, error, signUp, signIn, signOut }),
    [user, session, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
