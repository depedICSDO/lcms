import { lazy, Suspense, useState } from 'react'
import AllowedUsersAdmin from './AllowedUsersAdmin'
import PersonnelAdmin from './PersonnelAdmin'
import styles from './Dashboard.module.css'

const VacantItemsAdmin = lazy(() => import('./VacantItemsAdmin'))

export default function AdminConsole() {
  const [tab, setTab] = useState('personnel')
  return <div className={styles.adminConsole}>
    <div className={styles.adminTabs} role="tablist" aria-label="Administrator sections">
      <button className={tab === 'personnel' ? styles.adminTabActive : styles.adminTab} onClick={() => setTab('personnel')} role="tab" aria-selected={tab === 'personnel'}>Personnel</button>
      <button className={tab === 'vacant-items' ? styles.adminTabActive : styles.adminTab} onClick={() => setTab('vacant-items')} role="tab" aria-selected={tab === 'vacant-items'}>Vacant Items</button>
      <button className={tab === 'allowed-users' ? styles.adminTabActive : styles.adminTab} onClick={() => setTab('allowed-users')} role="tab" aria-selected={tab === 'allowed-users'}>Allowed Users</button>
    </div>
    <div className={styles.adminTabPanel} role="tabpanel">
      {tab === 'personnel'
        ? <PersonnelAdmin />
        : tab === 'vacant-items'
          ? <Suspense fallback={<div className={styles.emptyState}>Loading vacant items…</div>}><VacantItemsAdmin /></Suspense>
          : <AllowedUsersAdmin embedded />}
    </div>
  </div>
}
