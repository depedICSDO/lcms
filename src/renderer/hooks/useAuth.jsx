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
      try {
        const savedUser = JSON.parse(saved)
        if (savedUser.diagnostic && !import.meta.env.DEV) {
          sessionStorage.removeItem('leave_session')
          return
        }
        if (savedUser.diagnostic) savedUser.role = 'diagnostic'
        setUser(savedUser)
      } catch {}
    }
  }, [])

  async function login(username, password) {
    setLoading(true)
    setError(null)
    try {
      const normalizedUsername = username.trim()

      // Local diagnostic account for UI/offline debugging. Vite replaces DEV
      // with false in production builds, so this cannot unlock a packaged app.
      if (import.meta.env.DEV && normalizedUsername === 'admin' && password === 'admin') {
        const diagnosticUser = {
          id: 'local-diagnostic-admin',
          username: 'admin',
          full_name: 'Diagnostic Administrator',
          role: 'diagnostic',
          school_id: 'SDO-ISABELA-CITY',
          school_name: 'SDO Isabela City',
          diagnostic: true
        }

        setUser(diagnosticUser)
        sessionStorage.setItem('leave_session', JSON.stringify(diagnosticUser))
        return { success: true, role: diagnosticUser.role }
      }

      // Resolve only the login email through a restricted RPC. The profiles
      // table itself is never exposed to anonymous users.
      const { data: email, error: emailErr } = await supabase.rpc('lcms_get_login_email', {
        uname: normalizedUsername
      })

      if (emailErr || !email) throw new Error('Username not found or access is not approved.')

      // 2. Authenticate before querying tables restricted to authenticated users.
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      if (authErr) throw new Error('Incorrect password.')

      // Confirm that the signed-in account is still active in the LCMS
      // allowlist, then load its own profile through RLS.
      const { data: allowed, error: allowedErr } = await supabase.rpc('lcms_is_current_user_allowed')

      if (allowedErr || !allowed) {
        await supabase.auth.signOut()
        throw new Error('Access not authorized. Contact the dashboard manager.')
      }

      const { data: profile, error: profileErr } = await supabase
        .from('LCMS-profiles')
        .select('id, username, full_name, role, school_id, school_name')
        .eq('id', authData.user.id)
        .single()

      if (profileErr || !profile) {
        await supabase.auth.signOut()
        throw new Error('LCMS profile is missing or inactive. Contact the dashboard manager.')
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
      return { success: true, role: sessionUser.role }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  // Eligibility is matched on email + name (not username — nobody pre-assigns
  // that anymore, the registrant picks their own). Returns which part failed
  // so the caller can show a specific reason instead of a generic rejection.
  async function checkRegistration({ email, lastName, firstName, middleName }) {
    const normalizedEmail = (email || '').trim().toLowerCase()
    if (!normalizedEmail || !lastName?.trim() || !firstName?.trim()) return null
    const { data, error: checkErr } = await supabase.rpc('lcms_check_registration', {
      user_email: normalizedEmail,
      family_name: lastName.trim(),
      given_name: firstName.trim(),
      middle_name: middleName?.trim() || null
    })
    if (checkErr || !data || data.length === 0) return null
    return data[0] // { email_matched, name_matched, already_registered, role, school_name }
  }

  async function register({ username, email, password, lastName, firstName, middleName }) {
    setLoading(true)
    setError(null)
    try {
      const normalizedUsername = username.trim()
      const normalizedEmail = email.trim().toLowerCase()

      const check = await checkRegistration({ email: normalizedEmail, lastName, firstName, middleName })
      if (!check || !check.email_matched) {
        throw new Error('This email is not on the approved list. Contact the dashboard manager.')
      }
      if (check.already_registered) {
        throw new Error('This email has already been registered. Please sign in instead.')
      }
      if (!check.name_matched) {
        throw new Error('Your name does not match our records for this email. Check the spelling of your family, first, and middle name, or contact the dashboard manager to correct it.')
      }

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            app_id: 'LCMS',
            username: normalizedUsername,
            last_name: lastName.trim(),
            first_name: firstName.trim(),
            middle_name: middleName?.trim() || ''
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

  // Desktop app, no web page to land a reset link on — so this sends a
  // 6-digit code by email instead of a link, and the whole reset happens
  // inside the login screen. Accepts a username (resolved to its email via
  // the same lookup login uses) or an email address directly.
  async function requestPasswordReset(usernameOrEmail) {
    setLoading(true)
    setError(null)
    try {
      const raw = usernameOrEmail.trim()
      let targetEmail = raw
      if (!raw.includes('@')) {
        const { data: resolvedEmail, error: resolveErr } = await supabase.rpc('lcms_get_login_email', { uname: raw })
        if (resolveErr || !resolvedEmail) throw new Error('Username not found or access is not approved.')
        targetEmail = resolvedEmail
      }
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail.trim().toLowerCase())
      if (resetErr) throw resetErr
      return { success: true, email: targetEmail }
    } catch (err) {
      const message = err.message || 'Unable to send a reset code.'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  async function confirmPasswordReset({ email, code, newPassword }) {
    setLoading(true)
    setError(null)
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'recovery'
      })
      if (verifyErr) throw new Error('That code is invalid or has expired. Request a new one.')

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) throw updateErr

      await supabase.auth.signOut()
      return { success: true }
    } catch (err) {
      const message = err.message || 'Unable to reset the password.'
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

  function chooseDiagnosticRole(role) {
    if (!user?.diagnostic || !['hrmo', 'aoii'].includes(role)) return
    const diagnosticUser = { ...user, role }
    setUser(diagnosticUser)
    sessionStorage.setItem('leave_session', JSON.stringify(diagnosticUser))
  }

  function resetDiagnosticRole() {
    if (!user?.diagnostic) return
    const diagnosticUser = { ...user, role: 'diagnostic' }
    setUser(diagnosticUser)
    sessionStorage.setItem('leave_session', JSON.stringify(diagnosticUser))
  }

  const isHRMO = user?.role === 'hrmo'
  const isAOII = user?.role === 'aoii'
  const isDiagnostic = Boolean(user?.diagnostic)
  const canEdit = isHRMO

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, checkRegistration, requestPasswordReset, confirmPasswordReset, logout, clearError, chooseDiagnosticRole, resetDiagnosticRole, isHRMO, isAOII, isDiagnostic, canEdit }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
