import { useAuth } from '@/hooks/useAuth'
import styles from './DiagnosticRoleChooser.module.css'

export default function DiagnosticRoleChooser() {
  const { chooseDiagnosticRole, logout } = useAuth()

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.mark}>LCMS</div>
        <h1>Choose a Dashboard</h1>
        <p>Select the side you want to inspect using the diagnostic administrator account.</p>
        <div className={styles.choices}>
          <button onClick={() => chooseDiagnosticRole('hrmo')}>
            <strong>HRMO Dashboard</strong>
            <span>Review requests, manage personnel, record leave, and test backup tools.</span>
          </button>
          <button onClick={() => chooseDiagnosticRole('aoii')}>
            <strong>AOII Dashboard</strong>
            <span>View employee ledgers and inspect the school leave-request experience.</span>
          </button>
        </div>
        <button className={styles.signOut} onClick={logout}>Sign Out</button>
      </div>
    </div>
  )
}
