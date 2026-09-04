import { useState } from 'react'
import { useEmployees } from '@/hooks/useEmployees'
import { useLeaveRequests } from '@/hooks/useLeaveRequests'
import { supabase } from '@/utils/supabase'
import { toCsv, parseCsv } from '@/utils/csv'
import { ctoBalance, ctoExpiryWarnings, vlBalance, slBalance, vscBalance, fmt, fmtDate, yearsOfService, totalEarned } from '@/utils/leaveCalc'
import EmployeeDetailModal from '@/components/School/EmployeeDetailModal'
import LeaveRequestModal from '@/components/School/LeaveRequestModal'
import styles from './Dashboard.module.css'

const CSV_COLUMNS = [
  { key: 'last_name', label: 'Family Name' },
  { key: 'first_name', label: 'First Name' },
  { key: 'middle_name', label: 'Middle Name or Initial' },
]

export default function SchoolDashboard() {
  const { employees, loading, fetch: refetchEmployees } = useEmployees()
  const { requests, error: requestError, submitRequest, cancelMandatoryRequest } = useLeaveRequests()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('name_asc')
  const [detail, setDetail] = useState(null)
  const [requestTarget, setRequestTarget] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkMessage, setLinkMessage] = useState('')
  const [linkError, setLinkError] = useState('')

  async function handleDownloadTemplate() {
    setLinkError(''); setLinkMessage('')
    if (!window.electronAPI?.saveTextFile) {
      setLinkError('File saving is unavailable — restart the app (fully quit, not just reload) and try again.')
      return
    }
    try {
      const csv = toCsv([], CSV_COLUMNS)
      const result = await window.electronAPI.saveTextFile({
        defaultFilename: 'Staff Name Template.csv',
        content: csv
      })
      if (result?.canceled) return
      if (!result?.success) { setLinkError('Could not save the file.'); return }
      setLinkMessage(`Template saved to ${result.filePath}. Fill in one row per staff member (Family Name, First Name, Middle Name or Initial), then use "Upload & Link" to submit it.`)
    } catch (err) {
      setLinkError(err.message || 'Something went wrong while downloading the file.')
    }
  }

  async function handleUploadLink() {
    setLinkError(''); setLinkMessage('')
    if (!window.electronAPI?.openTextFile) {
      setLinkError('File opening is unavailable — restart the app (fully quit, not just reload) and try again.')
      return
    }
    try {
      const result = await window.electronAPI.openTextFile({})
      if (!result || result.canceled) return
      const parsed = parseCsv(result.content)
      const rows = parsed
        .map(r => ({
          last_name: r['Family Name'] || '',
          first_name: r['First Name'] || '',
          middle_name: r['Middle Name or Initial'] || '',
        }))
        .filter(r => r.last_name || r.first_name)
      if (!rows.length) {
        setLinkError('No staff rows found in that file. Fill in the Family Name / First Name / Middle Name or Initial columns of the downloaded template, then upload it.')
        return
      }
      setLinkBusy(true)
      const { data, error } = await supabase.rpc('lcms_link_unassigned_employees_by_name', { rows })
      setLinkBusy(false)
      if (error) { setLinkError(error.message); return }
      const linked = (data || []).filter(r => r.linked)
      const skipped = (data || []).filter(r => !r.linked)
      setLinkMessage(
        `${linked.length} of ${rows.length} employee(s) linked to your school.` +
        (skipped.length ? ` Not linked: ${skipped.map(s => `${s.last_name}, ${s.first_name} (${s.reason})`).join('; ')}.` : '')
      )
      if (linked.length) await refetchEmployees()
    } catch (err) {
      setLinkBusy(false)
      setLinkError(err.message || 'Something went wrong while linking employees.')
    }
  }

  const ctoWarnings = employees.flatMap(employee =>
    ctoExpiryWarnings(employee).map(credit => ({ employee, credit })))

  async function cancelMandatory(request) {
    const reason = window.prompt('Document why the signing authority cancelled this scheduled mandatory/forced leave due to exigency of service:')
    if (reason === null) return
    const result = await cancelMandatoryRequest(request.id, reason)
    setActionMessage(result.success
      ? 'Authority cancellation documented. The exact VL deduction was restored and the scheduled days will not be forfeited at year-end.'
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
          `${employee.last_name}, ${employee.first_name}${employee.middle_name ? ` ${employee.middle_name}` : ''}: ${fmt(credit.remaining_days)} day(s), credited ${fmtDate(credit.granted_on)}, expires ${fmtDate(credit.expires_on)}`
        ).join(' • ')}
      </div>}

      <div className={styles.card} style={{ flex: 'none' }}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Link Unassigned Staff</span>
          <div className={styles.headerActions}>
            <button className={styles.btnOutline} onClick={handleDownloadTemplate}>Download CSV Template</button>
            <button className={styles.btnPrimary} onClick={handleUploadLink} disabled={linkBusy}>{linkBusy ? 'Linking…' : 'Upload & Link'}</button>
          </div>
        </div>
        <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
          Some personnel are imported without a specific school on file. Download the template, fill in one row per
          staff member (Family Name, First Name, Middle Name or Initial), and upload it — matches are linked to your
          school automatically. School head, principal, assistant principal, and head teacher positions are assigned
          by HRMO and can't be linked this way.
        </div>
        {linkError && <div className={styles.inlineError}>{linkError}</div>}
        {linkMessage && <div className={styles.inlineSuccess}>{linkMessage}</div>}
      </div>

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
                          <td>{request.employee?.last_name}, {request.employee?.first_name}{request.employee?.middle_name ? ` ${request.employee.middle_name}` : ''}</td>
                          <td>{request.leave_type}</td>
                          <td>{fmtDate(request.date_from)}{request.date_to !== request.date_from ? ` – ${fmtDate(request.date_to)}` : ''}</td>
                          <td>{fmt(request.days)}</td>
                          <td><span className={`${styles.pill} ${request.status === 'approved' ? styles.pillOk : ['rejected', 'cancelled'].includes(request.status) ? styles.pillReject : styles.pillWarn}`}>{request.status}</span></td>
                          <td className={styles.subCell}>{request.cancellation_reason || request.rejection_reason || (request.form6_confirmed ? 'CS Form 6 confirmed' : 'Awaiting review')}</td>
                          <td>{request.status === 'approved' && request.leave_category === 'mandatory_forced'
                            ? <button className={styles.btnDangerSm} onClick={() => cancelMandatory(request)}>Record authority cancellation</button>
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
                            <td><button className={styles.nameButton} onClick={() => setDetail(employee)}>{employee.last_name}, {employee.first_name}{employee.middle_name ? ` ${employee.middle_name}` : ''}</button><div className={styles.subCell}>{employee.position}</div></td>
                            <td><span className={`${styles.pill} ${employee.emp_type === 'Teaching' ? styles.pillTeaching : styles.pillNT}`}>{employee.emp_type === 'Teaching' ? 'VSC/PVP' : 'VL+SL'}</span></td>
                            <td className={styles.subCell}>{fmtDate(employee.hired_date)}</td>
                            <td className={styles.subCell}>{yearsOfService(employee.hired_date)} year(s)</td>
                            <td className={`${styles.creditCell} ${styles.maroon}`}>{fmt(vl)}</td>
                            <td className={styles.creditCell}>{sl === null ? '—' : fmt(sl)}</td>
                            <td className={styles.subCell}>{earned === null ? '—' : fmt(earned)}</td>
                            <td className={styles.subCell}>{fmt(vlUsed)}</td>
                            <td className={styles.subCell}>{slUsed === null ? '—' : fmt(slUsed)}</td>
                            <td><div style={{ display: 'flex', gap: 4 }}><button className={styles.btnInfoSm} onClick={() => setDetail(employee)}>View</button><button className={styles.btnSuccessSm} onClick={() => setRequestTarget(employee)}>Request Leave</button><span className={styles.subCell}>CTO {fmt(ctoBalance(employee))}</span></div></td>
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
