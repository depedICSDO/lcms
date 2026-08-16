import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '@/utils/supabase'

// Roles:
//   'hrmo'   → HRMO / administrator — full access (input, edit, delete)
//   'aoii'   → Administrative Officer II / School-based — view, search, print only

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)      // { id, username, full_name, role, school_id }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Check for persisted session on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('leave_session')
    if (saved) {
      try { setUser(JSON.parse(saved)) } catch {}
    }
  }, [])

  async function login(username, password) {
    setLoading(true)
    setError(null)
    try {
      // 1. Look up email from profiles table via username
      const { data: profile, error: profileErr } = await supabase
        .from('leave_profiles')
        .select('id, username, full_name, role, school_id, school_name, email')
        .eq('username', username)
        .single()

      if (profileErr || !profile) throw new Error('Username not found.')

      // 2. Authenticate before querying tables restricted to authenticated users.
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password
      })
      if (authErr) throw new Error('Incorrect password.')

      // 3. Check allowed_users whitelist
      const { data: allowed, error: allowedErr } = await supabase
        .from('leave_allowed_users')
        .select('username')
        .eq('username', username)
        .single()

      if (allowedErr || !allowed) {
        await supabase.auth.signOut()
        throw new Error('Access not authorized. Contact HRMO.')
      }

      const sessionUser = {
        id: authData.user.id,
        username: profile.username,
        full_name: profile.full_name,
        role: profile.role,          // 'hrmo' | 'aoii'
        school_id: profile.school_id,
        school_name: profile.school_name
      }

      setUser(sessionUser)
      sessionStorage.setItem('leave_session', JSON.stringify(sessionUser))
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  async function register({ username, email, password, fullName }) {
    setLoading(true)
    setError(null)
    try {
      const normalizedUsername = username.trim()
      const normalizedEmail = email.trim().toLowerCase()
      const { data: allowed, error: allowedErr } = await supabase.rpc('can_register_leave_user', {
        uname: normalizedUsername,
        user_email: normalizedEmail
      })

      if (allowedErr) throw new Error('Unable to verify registration access. Contact the dashboard manager.')
      if (!allowed) throw new Error('You are not approved to register. Contact the IECES dashboard manager.')

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            username: normalizedUsername,
            full_name: fullName.trim()
          }
        }
      })

      if (signUpErr) throw signUpErr
      if (data.session) await supabase.auth.signOut()

      return {
        success: true,
        requiresEmailConfirmation: !data.session
      }
    } catch (err) {
      const message = err.message || 'Registration failed.'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    supabase.auth.signOut()
    setUser(null)
    sessionStorage.removeItem('leave_session')
  }

  function clearError() {
    setError(null)
  }

  const isHRMO = user?.role === 'hrmo'
  const isAOII = user?.role === 'aoii'
  const canEdit = isHRMO

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, clearError, isHRMO, isAOII, canEdit }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
