import { useState } from 'react'
import { useEmployees } from '@/hooks/useEmployees'
import { useLeaveRequests } from '@/hooks/useLeaveRequests'
import { ctoBalance, ctoExpiryWarnings, vlBalance, slBalance, vscBalance, fmt, yearsOfService, totalEarned } from '@/utils/leaveCalc'
import EmployeeDetailModal from '@/components/School/EmployeeDetailModal'
import LeaveRequestModal from '@/components/School/LeaveRequestModal'
import styles from './Dashboard.module.css'

export default function SchoolDashboard() {
  const { employees, loading } = useEmployees()
  const { requests, error: requestError, submitRequest, cancelMandatoryRequest } = useLeaveRequests()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('name_asc')
  const [detail, setDetail] = useState(null)
  const [requestTarget, setRequestTarget] = useState(null)
  const [actionMessage, setActionMessage] = useState('')

  const ctoWarnings = employees.flatMap(employee =>
    ctoExpiryWarnings(employee).map(credit => ({ employee, credit })))

  async function cancelMandatory(request) {
    const reason = window.prompt('Reason the employee cancelled this mandatory/forced leave:')
    if (reason === null) return
    const result = await cancelMandatoryRequest(request.id, reason)
    setActionMessage(result.success
      ? 'Mandatory leave cancelled. The days were restored as protected, non-monetizable VL.'
      : `Cancellation failed: ${result.error}`)
  }

  let list = employees.filter(employee => {
    const query = search.toLowerCase()
    const name = `${employee.last_name} ${employee.first_name}`.toLowerCase()
    return (!query || name.includes(query) || (employee.employee_no || '').toLowerCase().includes(query)) &&
      (!typeFilter || employee.emp_type === typeFilter)
  })

  list = [...list].sort((a, b) => {
    const nameA = `${a.last_name}, ${a.first_name}`
    const nameB = `${b.last_name}, ${b.first_name}`
    const leaveA = a.emp_type === 'Teaching' ? vscBalance(a) : vlBalance(a)
    const leaveB = b.emp_type === 'Teaching' ? vscBalance(b) : vlBalance(b)
    if (sortBy === 'name_desc') return nameB.localeCompare(nameA, 'en', { sensitivity: 'base' })
    if (sortBy === 'service_desc') return yearsOfService(b.hired_date) - yearsOfService(a.hired_date) || nameA.localeCompare(nameB)
    if (sortBy === 'service_asc') return yearsOfService(a.hired_date) - yearsOfService(b.hired_date) || nameA.localeCompare(nameB)
    if (sortBy === 'leave_desc') return leaveB - leaveA || nameA.localeCompare(nameB)
    if (sortBy === 'leave_asc') return leaveA - leaveB || nameA.localeCompare(nameB)
    if (sortBy === 'sl_desc') return slBalance(b) - slBalance(a) || nameA.localeCompare(nameB)
    if (sortBy === 'cto_desc') return ctoBalance(b) - ctoBalance(a) || nameA.localeCompare(nameB)
    if (sortBy === 'type') return a.emp_type.localeCompare(b.emp_type) || nameA.localeCompare(nameB)
    return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' })
  })

  return (
    <div className={styles.page}>
      <div className={`${styles.infoBox} ${styles.infoBoxBlue}`}>
        <strong>School AOII View.</strong> Submit an employee leave request here. Credits are not deducted until
        HRMO confirms that the signed CS Form 6 is approved and approves the request.
      </div>

      {ctoWarnings.length > 0 && <div className={`${styles.infoBox} ${styles.infoBoxDanger}`} role="alert">
        <strong>CTO expires within 14 days:</strong> {ctoWarnings.map(({ employee, credit }) =>
          `${employee.last_name}, ${employee.first_name}: ${fmt(credit.remaining_days)} day(s), credited ${credit.granted_on}, expires ${credit.expires_on}`
        ).join(' • ')}
      </div>}

      <div className={styles.card} style={{ flex: 'none', maxHeight: 230 }}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Leave Requests</span>
          <span className={`${styles.pill} ${styles.pillWarn}`}>{requests.filter(request => request.status === 'pending').length} pending</span>
        </div>
        {requestError
          ? <div className={styles.inlineError}>Requests require an online Supabase connection: {requestError}</div>
          : <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Employee</th><th>Leave</th><th>Dates</th><th>Days</th><th>Status</th><th>HRMO Note</th><th>Action</th></tr></thead>
                <tbody>
                  {requests.length === 0
                    ? <tr><td colSpan={7} className={styles.emptyState}>No leave requests submitted.</td></tr>
                    : requests.slice(0, 20).map(request => (
                        <tr key={request.id}>
                          <td>{request.employee?.last_name}, {request.employee?.first_name}</td>
                          <td>{request.leave_type}</td>
                          <td>{request.date_from}{request.date_to !== request.date_from ? ` – ${request.date_to}` : ''}</td>
                          <td>{fmt(request.days)}</td>
                          <td><span className={`${styles.pill} ${request.status === 'approved' ? styles.pillOk : ['rejected', 'cancelled'].includes(request.status) ? styles.pillReject : styles.pillWarn}`}>{request.status}</span></td>
                          <td className={styles.subCell}>{request.cancellation_reason || request.rejection_reason || (request.form6_confirmed ? 'CS Form 6 confirmed' : 'Awaiting review')}</td>
                          <td>{request.status === 'approved' && request.leave_category === 'mandatory_forced'
                            ? <button className={styles.btnDangerSm} onClick={() => cancelMandatory(request)}>Cancel mandatory leave</button>
                            : '—'}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>}
      </div>

      {actionMessage && <div className={actionMessage.startsWith('Cancellation failed') ? styles.inlineError : styles.inlineSuccess}>{actionMessage}</div>}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Employee Leave Credit Ledger</span>
        </div>
        <div className={styles.toolbar}>
          <input className={styles.searchInput} type="text" placeholder="Search by name or employee no…" value={search} onChange={event => setSearch(event.target.value)} />
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
            <option value="">All types</option><option value="Teaching">Teaching</option><option value="Non-Teaching">Non-Teaching</option>
          </select>
          <select value={sortBy} onChange={event => setSortBy(event.target.value)}>
            <option value="name_asc">Name: A–Z</option>
            <option value="name_desc">Name: Z–A</option>
            <option value="service_desc">Service: Longest First</option>
            <option value="service_asc">Service: Newest First</option>
            <option value="leave_desc">VL/VSC: Highest First</option>
            <option value="leave_asc">VL/VSC: Lowest First</option>
            <option value="sl_desc">SL: Highest First</option>
            <option value="cto_desc">CTO: Highest First</option>
            <option value="type">Employee Type</option>
          </select>
        </div>

        {loading
          ? <div className={styles.emptyState}>Loading…</div>
          : <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Employee</th><th>Type</th><th>Date Hired</th><th>Years in Service</th><th>VL / VSC Balance</th><th>SL Balance</th><th>Total Earned (VL)</th><th>VL/VSC Used</th><th>SL Used</th><th>Actions</th></tr></thead>
                <tbody>
                  {list.length === 0
                    ? <tr><td colSpan={10} className={styles.emptyState}>No employees found.</td></tr>
                    : list.map(employee => {
                        const vl = employee.emp_type === 'Teaching' ? vscBalance(employee) : vlBalance(employee)
                        const sl = employee.emp_type === 'Teaching' ? null : slBalance(employee)
                        const earned = employee.emp_type === 'Non-Teaching' ? totalEarned(employee.hired_date) : null
                        const vlUsed = employee.emp_type === 'Teaching' ? employee.vsc_used || 0 : employee.vl_used || 0
                        const slUsed = employee.emp_type === 'Teaching' ? null : employee.sl_used || 0
                        return (
                          <tr key={employee.id}>
                            <td><button className={styles.nameButton} onClick={() => setDetail(employee)}>{employee.last_name}, {employee.first_name}</button><div className={styles.subCell}>{employee.position}</div></td>
                            <td><span className={`${styles.pill} ${employee.emp_type === 'Teaching' ? styles.pillTeaching : styles.pillNT}`}>{employee.emp_type === 'Teaching' ? 'VSC/PVP' : 'VL+SL'}</span></td>
                            <td className={styles.subCell}>{employee.hired_date}</td>
                            <td className={styles.subCell}>{yearsOfService(employee.hired_date)} year(s)</td>
                            <td className={`${styles.creditCell} ${styles.maroon}`}>{fmt(vl)}</td>
                            <td className={styles.creditCell}>{sl === null ? '—' : fmt(sl)}</td>
                            <td className={styles.subCell}>{earned === null ? '—' : fmt(earned)}</td>
                            <td className={styles.subCell}>{fmt(vlUsed)}</td>
                            <td className={styles.subCell}>{slUsed === null ? '—' : fmt(slUsed)}</td>
                            <td><div style={{ display: 'flex', gap: 4 }}><button className={styles.btnSm} onClick={() => setDetail(employee)}>View</button><button className={styles.btnPrimarySm} onClick={() => setRequestTarget(employee)}>Request Leave</button><span className={styles.subCell}>CTO {fmt(ctoBalance(employee))}</span></div></td>
                          </tr>
                        )
                      })}
                </tbody>
              </table>
            </div>}
      </div>

      {detail && <EmployeeDetailModal employee={detail} onClose={() => setDetail(null)} />}
      {requestTarget && <LeaveRequestModal employee={requestTarget} onSubmit={submitRequest} onClose={() => setRequestTarget(null)} />}
    </div>
  )
}
