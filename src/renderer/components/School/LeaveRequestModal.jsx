import { useState } from 'react'
import { LEAVE_TYPES_TEACHING, LEAVE_TYPES_NONTEACHING, MONETIZATION_OPTIONS, ctoBalance, fmt, leaveAvailability, monetizationEligibility, slBalance, vlBalance, vscBalance } from '@/utils/leaveCalc'
import styles from '@/components/HRMO/Modal.module.css'

function transactionType(category, isTeaching) {
  if (category === 'cto') return 'CTO_DEBIT'
  if (isTeaching) return category === 'vsc' || category === 'terminal' ? 'VSC_DEBIT' : 'SPECIAL'
  if (category === 'sick') return 'SL_DEBIT'
  if (category === 'monetization') return 'MONETIZE'
  if (['vacation', 'mandatory_forced', 'terminal'].includes(category)) return 'VL_DEBIT'
  return 'SPECIAL'
}

export default function LeaveRequestModal({ employee, onSubmit, onClose }) {
  const isTeaching = employee.emp_type === 'Teaching'
  const leaveTypes = isTeaching ? LEAVE_TYPES_TEACHING : LEAVE_TYPES_NONTEACHING
  const [form, setForm] = useState({
    leave_category: isTeaching ? 'vsc' : 'vacation',
    days: '', date_from: '', date_to: '', reason: '', remarks: '', with_pay: true,
    monetization_option: 'VL10'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const selectedLeave = leaveTypes.find(type => type.key === form.leave_category)
  const availability = leaveAvailability(selectedLeave, employee, form.date_from ? new Date(`${form.date_from}T00:00:00`) : new Date())

  function set(field, value) { setForm(current => ({ ...current, [field]: value })) }

  async function handleSubmit() {
    const isMonetization = form.leave_category === 'monetization'
    const days = isMonetization ? MONETIZATION_OPTIONS[form.monetization_option].vl : Number(form.days)
    if (!Number.isFinite(days) || days <= 0) return setError('Enter a valid number of days.')
    if (!form.date_from) return setError('Date from is required.')
    if (form.date_to && form.date_to < form.date_from) return setError('Date to cannot be before date from.')
    if (isMonetization) {
      const eligibility = monetizationEligibility(employee, form.monetization_option)
      if (!eligibility.eligible) return setError(eligibility.reason)
    }
    if (form.leave_category === 'cto' && days > ctoBalance(employee)) return setError('Insufficient unexpired CTO balance.')
    if (availability.remaining !== null && days > availability.remaining) {
      return setError(`Only ${fmt(availability.remaining)} day(s) of ${selectedLeave.label} remain for this calendar year.`)
    }

    setSaving(true)
    setError('')
    const result = await onSubmit({
      employee_id: employee.id,
      school_id: employee.school_id,
      txn_type: transactionType(form.leave_category, isTeaching),
      leave_category: form.leave_category,
      leave_type: selectedLeave?.label || form.leave_category,
      days,
      date_from: form.date_from,
      date_to: form.date_to || form.date_from,
      reason: form.reason,
      remarks: form.remarks,
      with_pay: form.with_pay,
      monetization_option: isMonetization ? form.monetization_option : null
    })
    setSaving(false)
    if (!result.success) return setError(result.error)
    setSuccess(true)
  }

  return (
    <div className={styles.overlay} onClick={event => event.target === event.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 500 }}>
        <div className={styles.modalHeader}>
          <h2>Request Leave — {employee.last_name}, {employee.first_name}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.body}>
          <div className={styles.infoBox}>
            Submitting does not deduct leave credits. HRMO can approve only after confirming that the signed CS Form 6 has been approved.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isTeaching ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {isTeaching
              ? <div className={styles.balCard}><div className={styles.balLabel}>VSC Balance</div><div className={styles.balVal}>{fmt(vscBalance(employee))} days</div></div>
              : <>
                  <div className={styles.balCard}><div className={styles.balLabel}>VL Balance</div><div className={styles.balVal}>{fmt(vlBalance(employee))} days</div></div>
                  <div className={styles.balCard}><div className={styles.balLabel}>SL Balance</div><div className={styles.balVal}>{fmt(slBalance(employee))} days</div></div>
                </>}
          </div>
          {success
            ? <div className={styles.successBox}>Request submitted to HRMO. No credits have been deducted yet.</div>
            : <div className={styles.grid2}>
                <div className={styles.field} style={{ gridColumn: '1/-1' }}>
                  <label>Leave Type *</label>
                  <select value={form.leave_category} onChange={event => set('leave_category', event.target.value)}>
                    {leaveTypes.map(type => <option key={type.key} value={type.key}>{type.label} — {type.basis}</option>)}
                  </select>
                </div>
                {selectedLeave?.deduction && <div className={styles.infoBox} style={{ gridColumn: '1/-1', margin: 0 }}>
                  <strong>Credit treatment:</strong> {selectedLeave.deduction}
                  {availability.remaining !== null && <>. Remaining this calendar year: <strong>{fmt(availability.remaining)} of {fmt(selectedLeave.annualEntitlement)} days</strong>.</>}
                  {availability.requirementRemaining !== undefined && <>. Mandatory requirement remaining: <strong>{fmt(availability.requirementRemaining)} day(s)</strong>.</>}
                </div>}
                <div className={styles.field}>
                  <label>Number of Days *</label>
                  <input type="number" min="0.5" step="0.5" value={form.leave_category === 'monetization' ? MONETIZATION_OPTIONS[form.monetization_option].vl : form.days} disabled={form.leave_category === 'monetization'} onChange={event => set('days', event.target.value)} />
                </div>
                {form.leave_category === 'monetization' && <div className={styles.field}>
                  <label>VL Days to Monetize *</label>
                  <select value={form.monetization_option} onChange={event => set('monetization_option', event.target.value)}>
                    {Object.entries(MONETIZATION_OPTIONS).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
                  </select>
                </div>}
                <div className={styles.field}>
                  <label>With Pay?</label>
                  <select value={form.with_pay} onChange={event => set('with_pay', event.target.value === 'true')}>
                    <option value="true">Yes</option><option value="false">No (LWOP)</option>
                  </select>
                </div>
                <div className={styles.field}><label>Date From *</label><input type="date" value={form.date_from} onChange={event => set('date_from', event.target.value)} /></div>
                <div className={styles.field}><label>Date To</label><input type="date" value={form.date_to} onChange={event => set('date_to', event.target.value)} /></div>
                <div className={styles.field} style={{ gridColumn: '1/-1' }}><label>Reason</label><textarea rows="3" value={form.reason} onChange={event => set('reason', event.target.value)} /></div>
                <div className={styles.field} style={{ gridColumn: '1/-1' }}><label>Remarks</label><input value={form.remarks} onChange={event => set('remarks', event.target.value)} /></div>
              </div>}
          {error && <div className={styles.errorBox}>{error}</div>}
        </div>
        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onClose}>{success ? 'Close' : 'Cancel'}</button>
          {!success && <button className={styles.btnSave} onClick={handleSubmit} disabled={saving}>{saving ? 'Submitting…' : 'Submit Request'}</button>}
        </div>
      </div>
    </div>
  )
}
