import { useAuth } from '@/hooks/useAuth'
import styles from './Topbar.module.css'

export default function Topbar() {
  const { user, logout, isHRMO } = useAuth()

  return (
    <div className={styles.bar}>
      <div className={styles.brand}>
        <div className={styles.seal}>DepEd</div>
        <div>
          <div className={styles.title}>Leave Credits System</div>
          <div className={styles.sub}>Personnel Leave Management</div>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.userInfo}>
          <span
            className={styles.roleBadge}
            style={isHRMO
              ? { background: '#7B1C1C', color: '#fff' }
              : { background: '#EBF3FC', color: '#0c447c' }}
          >
            {isHRMO ? 'HRMO' : 'AOII'}
          </span>
          <span className={styles.username}>{user?.full_name || user?.username}</span>
        </div>
        <button className={styles.logoutBtn} onClick={logout}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
