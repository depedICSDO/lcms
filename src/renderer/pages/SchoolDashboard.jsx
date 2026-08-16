import { useState } from 'react'
import { useEmployees } from '@/hooks/useEmployees'
import {
  vlBalance, slBalance, vscBalance, fmt,
  monthsOfService, totalEarned
} from '@/utils/leaveCalc'
import EmployeeDetailModal from '@/components/School/EmployeeDetailModal'
import styles from './Dashboard.module.css'

export default function SchoolDashboard() {
  const { employees, loading } = useEmployees()
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy]         = useState('name')
  const [detail, setDetail]         = useState(null)

  let list = employees.filter(e => {
    const q = search.toLowerCase()
    const name = `${e.last_name} ${e.first_name}`.toLowerCase()
    return (
      (!q || name.includes(q) || (e.employee_no || '').toLowerCase().includes(q)) &&
      (!typeFilter || e.emp_type === typeFilter)
    )
  })

  list = [...list].sort((a, b) => {
    if (sortBy === 'vl') {
      const av = a.emp_type === 'Teaching' ? vscBalance(a) : vlBalance(a)
      const bv = b.emp_type === 'Teaching' ? vscBalance(b) : vlBalance(b)
      return bv - av
    }
    if (sortBy === 'sl') return slBalance(b) - slBalance(a)
    return `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)
  })

  function handlePrint() {
    window.print()
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.infoBox} ${styles.infoBoxBlue}`}>
        <strong>School View — Read Only.</strong> Non-teaching personnel earn 1.25 VL + 1.25 SL per month
        (CSC MC 41, s. 1998). Teaching personnel earn Vacation Service Credits (VSC) per DepEd Order No. 013,
        s. 2024 — encoded by HRMO. Contact your HRMO for corrections.
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Employee Leave Credit Ledger</span>
          <button className={styles.btnOutline} onClick={handlePrint}>
            🖨 Print All
          </button>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by name or employee no…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="Teaching">Teaching</option>
            <option value="Non-Teaching">Non-Teaching</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="name">Sort: Name</option>
            <option value="vl">Sort: VL/VSC Balance</option>
            <option value="sl">Sort: SL Balance</option>
          </select>
        </div>

        {loading
          ? <div className={styles.emptyState}>Loading…</div>
          : <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Date Hired</th>
                    <th>Months Served</th>
                    <th>VL / VSC Balance</th>
                    <th>SL Balance</th>
                    <th>Total Earned (VL)</th>
                    <th>VL/VSC Used</th>
                    <th>SL Used</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0
                    ? <tr><td colSpan={10} className={styles.emptyState}>No employees found.</td></tr>
                    : list.map(emp => {
                        const vl = emp.emp_type === 'Teaching' ? vscBalance(emp) : vlBalance(emp)
                        const sl = emp.emp_type === 'Teaching' ? null : slBalance(emp)
                        const earned = emp.emp_type === 'Non-Teaching' ? totalEarned(emp.hired_date) : null
                        const vu = emp.emp_type === 'Teaching' ? (emp.vsc_used || 0) : (emp.vl_used || 0)
                        const su = emp.emp_type === 'Teaching' ? null : (emp.sl_used || 0)
                        return (
                          <tr key={emp.id}>
                            <td>
                              <div className={styles.nameCell}>
                                {emp.last_name}, {emp.first_name}
                              </div>
                              <div className={styles.subCell}>{emp.position}</div>
                            </td>
                            <td>
                              <span className={`${styles.pill} ${emp.emp_type === 'Teaching' ? styles.pillTeaching : styles.pillNT}`}>
                                {emp.emp_type === 'Teaching' ? 'VSC/PVP' : 'VL+SL'}
                              </span>
                            </td>
                            <td className={styles.subCell}>{emp.hired_date}</td>
                            <td className={styles.subCell}>{monthsOfService(emp.hired_date)} mos</td>
                            <td className={`${styles.creditCell} ${styles.maroon}`}>{fmt(vl)}</td>
                            <td className={styles.creditCell}>{sl !== null ? fmt(sl) : '—'}</td>
                            <td className={styles.subCell}>{earned !== null ? fmt(earned) : '—'}</td>
                            <td className={styles.subCell}>{fmt(vu)}</td>
                            <td className={styles.subCell}>{su !== null ? fmt(su) : '—'}</td>
                            <td>
                              <button className={styles.btnSm} onClick={() => setDetail(emp)}>
                                View
                              </button>
                            </td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            </div>
        }
      </div>

      {detail && (
        <EmployeeDetailModal
          employee={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
