import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import styles from './Topbar.module.css'
import ThemeSelector from './ThemeSelector'

export default function Topbar() {
  const { user, logout, isHRMO, isDiagnostic, resetDiagnosticRole } = useAuth()
  const [databaseBusy, setDatabaseBusy] = useState(false)
  const [updateStatus, setUpdateStatus] = useState({ state: 'idle', message: 'Check for updates' })

  useEffect(() => {
    const updater = window.electronAPI
    if (!updater?.getUpdateStatus) return
    updater.getUpdateStatus().then(status => status && setUpdateStatus(status))
    updater.onUpdateStatus?.(setUpdateStatus)
    return () => updater.removeUpdateListeners?.()
  }, [])

  async function handleUpdate() {
    if (updateStatus.state === 'downloaded') {
      await window.electronAPI?.installUpdate()
      return
    }
    if (updateStatus.state === 'available') {
      await window.electronAPI?.openUpdateRelease()
      return
    }
    const status = await window.electronAPI?.checkForUpdates()
    if (status) setUpdateStatus(status)
  }

  const updateBusy = ['checking', 'downloading'].includes(updateStatus.state)
  const updateLabel = updateStatus.state === 'downloaded'
    ? 'Restart & Install'
    : updateStatus.state === 'available'
      ? 'View Update'
    : updateStatus.state === 'downloading'
      ? `Updating ${updateStatus.percent || 0}%`
      : updateStatus.state === 'checking'
        ? 'Checking…'
        : 'Check Updates'

  async function handleBackup() {
    setDatabaseBusy(true)
    try {
      const result = await window.electronAPI?.backupDatabase()
      if (result?.success) window.alert(`Backup created successfully:\n${result.filePath}`)
    } catch (error) {
      window.alert(`Backup failed: ${error.message}`)
    } finally {
      setDatabaseBusy(false)
    }
  }

  async function handleRestore() {
    const confirmed = window.confirm(
      'Restore a database backup? The current local database will be saved automatically, then the app will restart.'
    )
    if (!confirmed) return

    setDatabaseBusy(true)
    try {
      const result = await window.electronAPI?.restoreDatabase()
      if (result?.success) window.alert('Database restored successfully. The application will now restart.')
    } catch (error) {
      window.alert(`Restore failed: ${error.message}`)
      setDatabaseBusy(false)
    }
  }

  return (
    <div className={styles.bar}>
      <div className={styles.brand}>
        <div className={styles.seal}>DepEd</div>
        <div>
          <div className={styles.title}>Leave Credits Management System (LCMS)</div>
          <div className={styles.sub}>Personnel Leave Management</div>
        </div>
      </div>

      <div className={styles.right}>
        <ThemeSelector compact />
        {window.electronAPI?.checkForUpdates && (
          <button className={updateStatus.state === 'downloaded' ? styles.updateReadyBtn : styles.dataBtn} onClick={handleUpdate} disabled={updateBusy} title={updateStatus.message}>
            {updateLabel}
          </button>
        )}
        {import.meta.env.DEV && isDiagnostic && (
          <button className={styles.switchBtn} onClick={resetDiagnosticRole}>Switch Dashboard</button>
        )}
        {isHRMO && window.electronAPI?.backupDatabase && (
          <div className={styles.databaseActions}>
            <button className={styles.dataBtn} onClick={handleBackup} disabled={databaseBusy}>Backup</button>
            <button className={styles.dataBtn} onClick={handleRestore} disabled={databaseBusy}>Restore</button>
          </div>
        )}
        <div className={styles.userInfo}>
          <span
            className={styles.roleBadge}
            style={isHRMO
              ? { background: 'var(--sdo-blue)', color: '#fff' }
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
