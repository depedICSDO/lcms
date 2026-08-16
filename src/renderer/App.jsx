import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import HRMODashboard from './pages/HRMODashboard'
import SchoolDashboard from './pages/SchoolDashboard'
import SplashScreen from './components/shared/SplashScreen'
import Topbar from './components/shared/Topbar'

function AppInner() {
  const { user, loading } = useAuth()

  if (loading) return <SplashScreen />
  if (!user) return <LoginPage />

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
