import { useMemo, useState } from 'react'
import ClearableSearchInput from '@/components/shared/ClearableSearchInput'
import vacantItems from '@/data/vacantItems.json'
import styles from './Dashboard.module.css'

export default function VacantItemsAdmin() {
  const [search, setSearch] = useState('')
  const [officeFilter, setOfficeFilter] = useState('')
  const offices = useMemo(() => [...new Set(vacantItems.map(item => item.office).filter(Boolean))].sort(), [])
  const query = search.trim().toLowerCase()
  const visibleItems = vacantItems.filter(item => {
    const searchable = [item.item_number, item.position, item.office].filter(Boolean).join(' ').toLowerCase()
    return (!query || searchable.includes(query)) && (!officeFilter || item.office === officeFilter)
  })

  return <div className={styles.card}>
    <div className={styles.cardHeader}><span className={styles.cardTitle}>Vacant PSIPOP Items</span></div>
    <div className={styles.toolbar}>
      <ClearableSearchInput className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search OSEC no., position, or office…" />
      <select className={styles.schoolSelect} value={officeFilter} onChange={e => setOfficeFilter(e.target.value)}>
        <option value="">All Offices / Schools ({vacantItems.length})</option>
        {offices.map(office => <option key={office} value={office}>{office}</option>)}
      </select>
      <span className={styles.personnelCount} aria-live="polite">({visibleItems.length}) vacant</span>
    </div>
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>OSEC No.</th><th>Position</th><th>Salary Grade</th><th>Office / School</th><th>Source</th></tr></thead>
        <tbody>{visibleItems.length === 0
          ? <tr><td colSpan={5} className={styles.emptyState}>No vacant items found.</td></tr>
          : visibleItems.map(item => <tr key={item.item_number}>
              <td className={styles.nameCell}>{item.item_number}</td>
              <td>{item.position || '—'}</td>
              <td className={styles.creditCell}>{item.salary_grade ? `SG-${item.salary_grade}` : '—'}</td>
              <td>{item.office || '—'}</td>
              <td className={styles.subCell}>{item.source_file || '—'}</td>
            </tr>)}</tbody>
      </table>
    </div>
  </div>
}
