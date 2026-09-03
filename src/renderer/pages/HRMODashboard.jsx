import { useState } from 'react'
import { useEmployees } from '@/hooks/useEmployees'
import { useLeaveRequests } from '@/hooks/useLeaveRequests'
import {
  ctoBalance, ctoExpiryWarnings, vlBalance, slBalance, vscBalance, fmt,
  yearsOfService, requiresForcedLeave
} from '@/utils/leaveCalc'
import EmployeeModal from '@/components/HRMO/EmployeeModal'
import LeaveTransactionModal from '@/components/HRMO/LeaveTransactionModal'
import EmployeeDetailModal from '@/components/School/EmployeeDetailModal'
import styles from './Dashboard.module.css'

export default function HRMODashboard() {
  const { employees, loading, fetch, addEmployee, updateEmployee } = useEmployees()
  const { requests, loading: requestsLoading, error: requestsError, approveRequest, rejectRequest } = useLeaveRequests()
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('')
  const [sortBy, setSortBy]           = useState('name_asc')
  const [showAdd, setShowAdd]         = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [txnTarget, setTxnTarget]     = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [reviewingId, setReviewingId] = useState(null)
  const [reviewMessage, setReviewMessage] = useState('')

  const pendingRequests = requests.filter(request => request.status === 'pending')
  const ctoWarnings = employees.flatMap(employee =>
    ctoExpiryWarnings(employee).map(credit => ({ employee, credit })))

  async function handleApprove(request) {
    const confirmed = window.confirm(
      `Approve ${request.leave_type} for ${request.employee?.first_name} ${request.employee?.last_name}?\n\n` +
      'Click OK only if the employee and authorizing official have signed and approved CS Form 6. ' +
      'Approval will immediately deduct applicable leave credits.'
    )
    if (!confirmed) return
    setReviewingId(request.id)
    setReviewMessage('')
    const result = await approveRequest(request.id)
    if (result.success) {
      setReviewMessage('Request approved and documented. Applicable leave credits were deducted; special leave stayed outside VL/SL.')
      await fetch()
    } else {
      setReviewMessage(`Approval failed: ${result.error}`)
    }
    setReviewingId(null)
  }

  async function handleReject(request) {
    const reason = window.prompt('Reason for rejecting this leave request:')
    if (reason === null) return
    setReviewingId(request.id)
    setReviewMessage('')
    const result = await rejectRequest(request.id, reason)
    setReviewMessage(result.success ? 'Request rejected. No leave credits were deducted.' : `Rejection failed: ${result.error}`)
    setReviewingId(null)
  }

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    const name = `${e.last_name} ${e.first_name}`.toLowerCase()
    return (
      (!q || name.includes(q) || (e.employee_no || '').toLowerCase().includes(q)) &&
      (!typeFilter || e.emp_type === typeFilter)
    )
  }).sort((a, b) => {
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

  const teaching    = employees.filter(e => e.emp_type === 'Teaching').length
  const nonTeaching = employees.filter(e => e.emp_type === 'Non-Teaching').length
  const lowLeave    = employees.filter(e => {
    if (e.emp_type === 'Non-Teaching') return vlBalance(e) < 5
    return (e.vsc_balance || 0) < 5
  }).length
  const forcedLeave = employees.filter(e => requiresForcedLeave(e)).length

  return (
    <div className={styles.page}>
      {ctoWarnings.length > 0 && <div className={`${styles.infoBox} ${styles.infoBoxDanger}`} role="alert">
        <strong>CTO expires within 14 days:</strong> {ctoWarnings.map(({ employee, credit }) =>
          `${employee.last_name}, ${employee.first_name}: ${fmt(credit.remaining_days)} day(s), credited ${credit.granted_on}, expires ${credit.expires_on}`
        ).join(' • ')}
      </div>}
      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Personnel</div>
          <div className={styles.statValue}>{employees.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Teaching</div>
          <div className={styles.statValue} style={{ color: 'var(--sdo-blue)' }}>{teaching}</div>
          <div className={styles.statSub}>VSC / PVP basis</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Non-Teaching</div>
          <div className={styles.statValue} style={{ color: '#185FA5' }}>{nonTeaching}</div>
          <div className={styles.statSub}>VL + SL auto-accrual</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Low Balance (&lt;5 days)</div>
          <div className={styles.statValue} style={{ color: '#A32D2D' }}>{lowLeave}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Forced Leave Required</div>
          <div className={styles.statValue} style={{ color: '#854F0B' }}>{forcedLeave}</div>
          <div className={styles.statSub}>≥10 VL days (CSC rule)</div>
        </div>
      </div>

      <div className={styles.card} style={{ flex: 'none', maxHeight: 280 }}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Pending Leave Requests</span>
          <span className={`${styles.pill} ${pendingRequests.length ? styles.pillWarn : styles.pillOk}`}>{pendingRequests.length} pending</span>
        </div>
        {reviewMessage && <div className={reviewMessage.startsWith('Approval failed') || reviewMessage.startsWith('Rejection failed') ? styles.inlineError : styles.inlineSuccess}>{reviewMessage}</div>}
        {requestsError
          ? <div className={styles.inlineError}>Could not load requests: {requestsError}</div>
          : requestsLoading
            ? <div className={styles.emptyState}>Loading requests…</div>
            : <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Employee / School</th><th>Requested By</th><th>Leave</th><th>Dates</th><th>Days</th><th>Reason</th><th>Action</th></tr></thead>
                  <tbody>
                    {pendingRequests.length === 0
                      ? <tr><td colSpan={7} className={styles.emptyState}>No pending leave requests.</td></tr>
                      : pendingRequests.map(request => (
                          <tr key={request.id}>
                            <td><div className={styles.nameCell}>{request.employee?.last_name}, {request.employee?.first_name}</div><div className={styles.subCell}>{request.school_id}</div></td>
                            <td>{request.requested_by}</td>
                            <td><div>{request.leave_type}</div>{request.monetization_option && <div className={styles.subCell}>{request.monetization_option.replace('VL', '')} VL days</div>}</td>
                            <td>{request.date_from}{request.date_to !== request.date_from ? ` – ${request.date_to}` : ''}</td>
                            <td>{fmt(request.days)}</td>
                            <td>{request.reason || '—'}</td>
                            <td><div style={{ display: 'flex', gap: 4 }}><button className={styles.btnPrimarySm} disabled={reviewingId === request.id} onClick={() => handleApprove(request)}>Approve</button><button className={styles.btnDangerSm} disabled={reviewingId === request.id} onClick={() => handleReject(request)}>Reject</button></div></td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>}
      </div>

      {/* Table card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Personnel Leave Records</span>
          <div className={styles.headerActions}>
            <button className={styles.btnPrimary} onClick={() => { setEditTarget(null); setShowAdd(true) }}>
              + Add Employee
            </button>
          </div>
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
                <thead>
                  <tr>
                    <th>Name / Position</th>
                    <th>Type</th>
                    <th>Date Hired</th>
                    <th>Years in Service</th>
                    <th>VL / VSC Balance</th>
                    <th>SL Balance</th>
                    <th>Used VL/VSC</th>
                    <th>Used SL</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={10} className={styles.emptyState}>No employees found.</td></tr>
                    : filtered.map(emp => {
                        const vl = emp.emp_type === 'Teaching' ? vscBalance(emp) : vlBalance(emp)
                        const sl = emp.emp_type === 'Teaching' ? null : slBalance(emp)
                        const vu = emp.emp_type === 'Teaching' ? (emp.vsc_used || 0) : (emp.vl_used || 0)
                        const su = emp.emp_type === 'Teaching' ? null : (emp.sl_used || 0)
                        const low = vl < 5
                        const forced = requiresForcedLeave(emp)
                        return (
                          <tr key={emp.id}>
                            <td>
                              <button className={styles.nameButton} onClick={() => setDetailTarget(emp)}>
                                {emp.last_name}, {emp.first_name} {emp.middle_name ? emp.middle_name[0] + '.' : ''}
                              </button>
                              <div className={styles.subCell}>{emp.employee_no} · {emp.position}</div>
                            </td>
                            <td>
                              <span className={`${styles.pill} ${emp.emp_type === 'Teaching' ? styles.pillTeaching : styles.pillNT}`}>
                                {emp.emp_type === 'Teaching' ? 'Teaching' : 'Non-Teaching'}
                              </span>
                            </td>
                            <td className={styles.subCell}>{emp.hired_date}</td>
                            <td className={styles.subCell}>{yearsOfService(emp.hired_date)} year(s)</td>
                            <td className={styles.creditCell}>{fmt(vl)}</td>
                            <td className={styles.creditCell}>{sl !== null ? fmt(sl) : '—'}</td>
                            <td className={styles.subCell}>{fmt(vu)}</td>
                            <td className={styles.subCell}>{su !== null ? fmt(su) : '—'}</td>
                            <td>
                              {low && <span className={`${styles.pill} ${styles.pillWarn}`}>Low</span>}
                              {forced && <span className={`${styles.pill} ${styles.pillInfo}`}>Forced Leave</span>}
                              {!low && !forced && <span className={`${styles.pill} ${styles.pillOk}`}>OK</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                <button className={styles.btnSm} onClick={() => setDetailTarget(emp)}>View</button>
                                <button className={styles.btnSm} onClick={() => { setEditTarget(emp); setShowAdd(true) }}>Edit</button>
                                <button className={styles.btnSm} onClick={() => setTxnTarget(emp)}>+ Leave</button>
                              </div>
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

      {showAdd && (
        <EmployeeModal
          employee={editTarget}
          onSave={async (data) => {
            const result = editTarget
              ? await updateEmployee(editTarget.id, data)
              : await addEmployee(data)
            if (result.success) setShowAdd(false)
            return result
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {txnTarget && (
        <LeaveTransactionModal
          employee={txnTarget}
          onSaved={fetch}
          onClose={() => setTxnTarget(null)}
        />
      )}
      {detailTarget && <EmployeeDetailModal employee={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  )
}
