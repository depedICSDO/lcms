import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/utils/supabase'
import { createLocalId, hasLocalDatabase, recordLocalLeave, syncPendingChanges } from '@/utils/dataStore'
import { LEAVE_TYPES_TEACHING, LEAVE_TYPES_NONTEACHING, MONETIZATION_OPTIONS, ctoBalance, fmt, leaveAvailability, monetizationEligibility, protectedVlBalance, regularVlBalance, slBalance, vlBalance, vscBalance } from '@/utils/leaveCalc'
import styles from './Modal.module.css'

export default function LeaveTransactionModal({ employee, onClose, onSaved }) {
  const { user } = useAuth()
  const isTeaching = employee.emp_type === 'Teaching'
  const leaveTypes = isTeaching ? LEAVE_TYPES_TEACHING : LEAVE_TYPES_NONTEACHING

  const [form, setForm] = useState({
    txn_type: isTeaching ? 'VSC_DEBIT' : 'VL_DEBIT',
    leave_category: isTeaching ? 'vsc' : 'vacation',
    days: '',
    date_from: '',
    date_to: '',
    reason: '',
    remarks: '',
    with_pay: true,
    order_no: '',
    approved_by: '',
    monetization_option: 'VL25_SL5',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const selectedLeave = leaveTypes.find(type => type.key === form.leave_category)
  const availability = leaveAvailability(selectedLeave, employee, form.date_from ? new Date(`${form.date_from}T00:00:00`) : new Date())

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  function selectLeaveCategory(category) {
    let txnType = 'SPECIAL'
    if (category === 'vsc') txnType = 'VSC_DEBIT'
    else if (category === 'vacation' || category === 'mandatory_forced') txnType = 'VL_DEBIT'
    else if (category === 'sick') txnType = 'SL_DEBIT'
    else if (category === 'monetization') txnType = 'MONETIZE'
    else if (category === 'cto') txnType = 'CTO_DEBIT'

    setForm(current => ({ ...current, leave_category: category, txn_type: txnType }))
  }

  async function handleSave() {
    const days = form.txn_type === 'MONETIZE' ? 30 : +form.days
    if (!days || isNaN(days) || days <= 0) { setErr('Enter a valid number of days.'); return }
    if (!form.date_from) { setErr('Date from is required.'); return }
    if (form.txn_type === 'MONETIZE') {
      const eligibility = monetizationEligibility(employee, form.monetization_option)
      if (!eligibility.eligible) { setErr(eligibility.reason); return }
    }
    if (form.txn_type === 'CTO_DEBIT' && days > ctoBalance(employee)) { setErr('Insufficient unexpired CTO balance.'); return }
    if (form.txn_type === 'VL_DEBIT' && days > vlBalance(employee)) { setErr('Insufficient vacation leave balance.'); return }
    if (form.txn_type === 'SL_DEBIT' && days > slBalance(employee)) { setErr('Insufficient sick leave balance.'); return }
    if (form.txn_type === 'VSC_DEBIT' && days > vscBalance(employee)) { setErr('Insufficient VSC balance.'); return }
    if (availability.remaining !== null && days > availability.remaining) {
      setErr(`Only ${fmt(availability.remaining)} day(s) of ${selectedLeave.label} remain for this calendar year.`); return
    }
    setSaving(true); setErr('')
    try {
      const isDebit = ['VL_DEBIT','SL_DEBIT','VSC_DEBIT','CTO_DEBIT','MONETIZE','SPECIAL'].includes(form.txn_type)
      const successMessage = form.txn_type === 'SPECIAL'
        ? `Special leave recorded: ${days} day(s) used outside VL/SL credits.`
        : `Leave recorded: ${days} days ${isDebit ? 'deducted' : 'credited'} successfully.`
      if (form.txn_type === 'CTO_CREDIT' || form.txn_type === 'CTO_DEBIT') {
        const rpcName = form.txn_type === 'CTO_CREDIT' ? 'lcms_grant_cto' : 'lcms_use_cto'
        const rpcArgs = form.txn_type === 'CTO_CREDIT'
          ? { employee_uuid: employee.id, credit_days: days, granted_date: form.date_from, grant_note: form.remarks || form.reason || null }
          : { employee_uuid: employee.id, used_days: days, used_date: form.date_from, use_note: form.remarks || form.reason || null }
        const { error: ctoError } = await supabase.rpc(rpcName, rpcArgs)
        if (ctoError) throw ctoError
        setSuccess(form.txn_type === 'CTO_CREDIT'
          ? `${days} CTO days granted. They expire one year after ${form.date_from}.`
          : `${days} CTO days deducted from the earliest-expiring credits.`)
        await onSaved?.()
        return
      }

      if (form.txn_type === 'MONETIZE') {
        const { error: monetizationError } = await supabase.rpc('lcms_record_monetization', {
          employee_uuid: employee.id,
          deduction_option: form.monetization_option,
          monetization_date: form.date_from,
          monetization_note: form.remarks || form.reason || null
        })
        if (monetizationError) throw monetizationError
        setSuccess(`30 days monetized using ${MONETIZATION_OPTIONS[form.monetization_option].label}.`)
        await onSaved?.()
        return
      }
      const transaction = {
        id: createLocalId(),
        employee_id: employee.id,
        school_id: employee.school_id,
        txn_type: form.txn_type,
        leave_type: selectedLeave?.label || form.leave_category,
        days: isDebit ? -days : days,
        date_from: form.date_from,
        date_to: form.date_to || form.date_from,
        reason: form.reason,
        remarks: form.remarks,
        with_pay: form.with_pay,
        order_no: form.order_no,
        approved_by: form.approved_by,
        recorded_by: user?.username || 'hrmo',
        created_at: new Date().toISOString()
      }

      const updates = { updated_at: new Date().toISOString() }
      if (form.txn_type === 'VL_DEBIT') {
        const regularUsed = Math.min(days, regularVlBalance(employee))
        const protectedUsed = days - regularUsed
        updates.vl_used = (employee.vl_used || 0) + regularUsed
        updates.protected_vl_balance = protectedVlBalance(employee) - protectedUsed
        if (employee.vl_override !== null && employee.vl_override !== undefined) updates.vl_override = employee.vl_override - regularUsed
      } else if (form.txn_type === 'SL_DEBIT') {
        updates.sl_used = (employee.sl_used || 0) + days
        if (employee.sl_override !== null && employee.sl_override !== undefined) updates.sl_override = employee.sl_override - days
      } else if (form.txn_type === 'VSC_DEBIT') {
        updates.vsc_used = (employee.vsc_used || 0) + days
        updates.vsc_balance = Math.max(0, (employee.vsc_balance || 0) - days)
      } else if (form.txn_type === 'VSC_CREDIT') {
        updates.vsc_balance = (employee.vsc_balance || 0) + days
        updates.vsc_earned_this_sy = (employee.vsc_earned_this_sy || 0) + days
      }

      if (hasLocalDatabase()) {
        await recordLocalLeave(transaction, { ...employee, ...updates })
        const sync = await syncPendingChanges()
        setSuccess(sync.pending > 0
          ? `Leave recorded locally. ${sync.pending} change(s) will sync when online.`
          : successMessage)
      } else {
        const { error: transactionError } = await supabase.from('leave_transactions').insert([transaction])
        if (transactionError) throw transactionError
        const { error: employeeError } = await supabase.from('leave_employees').update(updates).eq('id', employee.id)
        if (employeeError) throw employeeError
        setSuccess(successMessage)
      }
      await onSaved?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const txnOptions = isTeaching
    ? [
        { value: 'VSC_DEBIT',  label: '− VSC Used / Offset' },
      { value: 'VSC_CREDIT', label: '+ VSC Credit (HRMO Input)' },
        { value: 'CTO_CREDIT', label: '+ CTO Credit (expires in 1 year)' },
        { value: 'CTO_DEBIT', label: '− CTO Used' },
      ]
    : [
        { value: 'VL_DEBIT',   label: '− VL Used' },
        { value: 'SL_DEBIT',   label: '− SL Used' },
        { value: 'VL_ADJUST',  label: '± VL Adjustment' },
        { value: 'SL_ADJUST',  label: '± SL Adjustment' },
        { value: 'MONETIZE',   label: 'Monetization' },
        { value: 'CTO_CREDIT', label: '+ CTO Credit (expires in 1 year)' },
        { value: 'CTO_DEBIT',  label: '− CTO Used' },
        { value: 'SPECIAL',    label: 'Special Leave' },
      ]

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 480 }}>
        <div className={styles.modalHeader}>
          <h2>Record Leave — {employee.last_name}, {employee.first_name}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {/* Current balances */}
          <div style={{ display: 'grid', gridTemplateColumns: isTeaching ? '1fr 1fr' : '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            {isTeaching
              ? <div className={styles.balCard}><div className={styles.balLabel}>VSC Balance</div><div className={styles.balVal}>{fmt(vscBalance(employee))} days</div></div>
              : <>
                  <div className={styles.balCard}><div className={styles.balLabel}>VL Balance</div><div className={styles.balVal}>{fmt(vlBalance(employee))} days</div></div>
                  <div className={styles.balCard}><div className={styles.balLabel}>SL Balance</div><div className={styles.balVal}>{fmt(slBalance(employee))} days</div></div>
                </>
            }
            <div className={styles.balCard}><div className={styles.balLabel}>Active CTO</div><div className={styles.balVal}>{fmt(ctoBalance(employee))} days</div></div>
          </div>

          {success
            ? <div className={styles.successBox}>{success}<br /><button className={styles.btnCancel} style={{ marginTop: 10 }} onClick={onClose}>Close</button></div>
            : <>
                <div className={styles.grid2}>
                  <div className={styles.field} style={{ gridColumn: '1/-1' }}>
                    <label>Balance Action / Transaction</label>
                    <select value={form.txn_type} onChange={e => set('txn_type', e.target.value)}>
                      {txnOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className={styles.field} style={{ gridColumn: '1/-1' }}>
                    <label>Leave Type *</label>
                    <select value={form.leave_category} onChange={e => selectLeaveCategory(e.target.value)}>
                      {leaveTypes.map(type => (
                        <option key={type.key} value={type.key}>
                          {type.label} — {type.basis}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedLeave?.deduction && <div className={styles.infoBox} style={{ gridColumn: '1/-1', margin: 0 }}>
                    <strong>Credit treatment:</strong> {selectedLeave.deduction}
                    {availability.remaining !== null && <>. Remaining this calendar year: <strong>{fmt(availability.remaining)} of {fmt(selectedLeave.annualEntitlement)} days</strong>.</>}
                  </div>}
                  <div className={styles.field}>
                    <label>Number of Days *</label>
                    <input type="number" min="0.5" step="0.5" value={form.txn_type === 'MONETIZE' ? 30 : form.days} disabled={form.txn_type === 'MONETIZE'} onChange={e => set('days', e.target.value)} placeholder="0.00" />
                  </div>
                  {form.txn_type === 'MONETIZE' && <div className={styles.field}>
                    <label>30-Day Deduction *</label>
                    <select value={form.monetization_option} onChange={e => set('monetization_option', e.target.value)}>
                      {Object.entries(MONETIZATION_OPTIONS).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
                    </select>
                  </div>}
                  <div className={styles.field}>
                    <label>With Pay?</label>
                    <select value={form.with_pay} onChange={e => set('with_pay', e.target.value === 'true')}>
                      <option value="true">Yes</option>
                      <option value="false">No (LWOP)</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Date From *</label>
                    <input type="date" value={form.date_from} onChange={e => set('date_from', e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label>Date To</label>
                    <input type="date" value={form.date_to} onChange={e => set('date_to', e.target.value)} />
                  </div>
                  <div className={styles.field} style={{ gridColumn: '1/-1' }}>
                    <label>Reason</label>
                    <input value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="illness / personal / official business…" />
                  </div>
                  <div className={styles.field}>
                    <label>Approved By</label>
                    <input value={form.approved_by} onChange={e => set('approved_by', e.target.value)} placeholder="School Head / HRMO" />
                  </div>
                  <div className={styles.field}>
                    <label>Special Order No. (if VSC)</label>
                    <input value={form.order_no} onChange={e => set('order_no', e.target.value)} placeholder="SO No." />
                  </div>
                  <div className={styles.field} style={{ gridColumn: '1/-1' }}>
                    <label>Remarks</label>
                    <input value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="VSC applied / offset VSC deduction…" />
                  </div>
                </div>
                {err && <div className={styles.errorBox}>{err}</div>}
              </>
          }
        </div>

        {!success && (
          <div className={styles.footer}>
            <button className={styles.btnCancel} onClick={onClose}>Cancel</button>
            <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Record Leave'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
