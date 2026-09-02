import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import HRMODashboard from './pages/HRMODashboard'
import SchoolDashboard from './pages/SchoolDashboard'
import SplashScreen from './components/shared/SplashScreen'
import Topbar from './components/shared/Topbar'
import DiagnosticRoleChooser from './pages/DiagnosticRoleChooser'

function AppInner() {
  const { user, loading } = useAuth()

  if (loading) return <SplashScreen />
  if (!user) return <LoginPage />
  if (import.meta.env.DEV && user.diagnostic && user.role === 'diagnostic') return <DiagnosticRoleChooser />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {user.role === 'hrmo'
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
