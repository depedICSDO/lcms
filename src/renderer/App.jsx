import { useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import AdminLoginPage from './pages/AdminLoginPage'
import HRMODashboard from './pages/HRMODashboard'
import SchoolDashboard from './pages/SchoolDashboard'
import AdminConsole from './pages/AdminConsole'
import SplashScreen from './components/shared/SplashScreen'
import Topbar from './components/shared/Topbar'
import DiagnosticRoleChooser from './pages/DiagnosticRoleChooser'

function AppInner() {
  const { user, showSplash } = useAuth()
  // Reached only via 5 clicks on the login logo — not linked from anywhere
  // in the normal UI. Lands directly on the allowed-users admin screen.
  const [secretAccess, setSecretAccess] = useState(false)
  const [showManageUsers, setShowManageUsers] = useState(false)
  const wasSignedIn = useRef(false)

  useEffect(() => {
    // Only clear the secret entry when a signed-in session actually ends
    // (logout), not on the initial render where user is still null.
    if (wasSignedIn.current && !user) {
      setSecretAccess(false)
      setShowManageUsers(false)
    }
    wasSignedIn.current = Boolean(user)
  }, [user])

  if (showSplash) return <SplashScreen />
  if (!user) {
    return secretAccess
      ? <AdminLoginPage onBack={() => setSecretAccess(false)} onAdminLoggedIn={() => setShowManageUsers(true)} />
      : <LoginPage onSecretAccess={() => setSecretAccess(true)} />
  }
  if (import.meta.env.DEV && user.diagnostic && user.role === 'diagnostic') return <DiagnosticRoleChooser />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar roleOverride={showManageUsers && user.role === 'hrmo' ? 'ADMIN' : undefined} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {showManageUsers && user.role === 'hrmo'
          ? <AdminConsole />
          : user.role === 'hrmo'
            ? <HRMODashboard />
            : <SchoolDashboard />
        }
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
