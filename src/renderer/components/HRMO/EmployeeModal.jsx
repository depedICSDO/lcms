import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { POSITIONS_TEACHING, POSITIONS_NONTEACHING, vscMaxDays } from '@/utils/leaveCalc'
import styles from './Modal.module.css'

const BLANK = {
  last_name: '', first_name: '', middle_name: '', employee_no: '',
  emp_type: 'Teaching', position: '', emp_status: 'Permanent',
  hired_date: '', salary_grade: '', monthly_salary: '',
  // Teaching
  vsc_balance: '', vsc_used: '', vsc_earned_this_sy: '', vsc_max: 15,
  // Non-Teaching
  vl_used: '', sl_used: '', vl_override: '', sl_override: '',
  notes: ''
}

export default function EmployeeModal({ employee, onSave, onClose }) {
  const { user } = useAuth()
  const isEdit = !!employee
  const [form, setForm] = useState(employee ? {
    ...employee,
    vl_override: employee.vl_override ?? '',
    sl_override: employee.sl_override ?? '',
  } : { ...BLANK })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSave() {
    if (!form.last_name.trim()) { setErr('Last name is required.'); return }
    if (!form.first_name.trim()) { setErr('First name is required.'); return }
    if (!form.hired_date) { setErr('Date hired is required.'); return }
    if (!form.position.trim()) { setErr('Position is required.'); return }
    setSaving(true)
    setErr('')
    const payload = {
      ...form,
      vl_override: form.vl_override !== '' ? parseFloat(form.vl_override) : null,
      sl_override: form.sl_override !== '' ? parseFloat(form.sl_override) : null,
      vsc_balance: parseFloat(form.vsc_balance) || 0,
      vsc_used: parseFloat(form.vsc_used) || 0,
      vsc_earned_this_sy: parseFloat(form.vsc_earned_this_sy) || 0,
      vsc_max: parseInt(form.vsc_max) || 15,
      vl_used: parseFloat(form.vl_used) || 0,
      sl_used: parseFloat(form.sl_used) || 0,
      monthly_salary: parseFloat(form.monthly_salary) || null,
      created_by: !isEdit ? user?.username : undefined,
      updated_by: isEdit ? user?.username : undefined,
    }
    const res = await onSave(payload)
    setSaving(false)
    if (res?.error) setErr(res.error)
  }

  const positions = form.emp_type === 'Teaching' ? POSITIONS_TEACHING : POSITIONS_NONTEACHING
  const autoVscMax = form.hired_date ? vscMaxDays(form.hired_date) : 15

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>{isEdit ? `Edit — ${employee.last_name}, ${employee.first_name}` : 'Add Employee'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {/* Type toggle */}
          <div className={styles.typeTabs}>
            {['Teaching', 'Non-Teaching'].map(t => (
              <button
                key={t}
                className={`${styles.typeTab} ${form.emp_type === t ? styles.typeTabActive : ''}`}
                onClick={() => set('emp_type', t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className={styles.dividerLabel}>Personal Information</div>
          <div className={styles.grid3}>
            <div className={styles.field}>
              <label>Last Name *</label>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Dela Cruz" />
            </div>
            <div className={styles.field}>
              <label>First Name *</label>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Juan" />
            </div>
            <div className={styles.field}>
              <label>Middle Name</label>
              <input value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Santos" />
            </div>
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label>Employee No.</label>
              <input value={form.employee_no} onChange={e => set('employee_no', e.target.value)} placeholder="EMP-001" />
            </div>
            <div className={styles.field}>
              <label>Status</label>
              <select value={form.emp_status} onChange={e => set('emp_status', e.target.value)}>
                {['Permanent','Temporary','Casual','Substitute','Co-terminus'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Position *</label>
              <input
                list="plantilla-positions"
                value={form.position}
                onChange={e => set('position', e.target.value)}
                placeholder="Select or type a plantilla position"
              />
              <datalist id="plantilla-positions">
                {positions.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className={styles.field}>
              <label>Salary Grade</label>
              <input value={form.salary_grade} onChange={e => set('salary_grade', e.target.value)} placeholder="e.g. SG-11" />
            </div>
            <div className={styles.field}>
              <label>Date Hired / Appointment *</label>
              <input type="date" value={form.hired_date} onChange={e => set('hired_date', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Monthly Salary (₱)</label>
              <input type="number" value={form.monthly_salary} onChange={e => set('monthly_salary', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {/* Teaching section */}
          {form.emp_type === 'Teaching' && (
            <>
              <div className={styles.dividerLabel}>Vacation Service Credits (VSC) — DepEd Order 013, s. 2024</div>
              <div className={styles.infoBox}>
                Teaching personnel are <strong>not entitled to VL/SL</strong>. They earn VSC for authorized activities
                during school breaks. HRMO encodes VSC manually. Max allowed: <strong>{autoVscMax} days</strong> based on years of service.
              </div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label>VSC Balance (days)</label>
                  <input type="number" min="0" step="0.5" value={form.vsc_balance} onChange={e => set('vsc_balance', e.target.value)} placeholder="0.00" />
                </div>
                <div className={styles.field}>
                  <label>VSC Used (days)</label>
                  <input type="number" min="0" step="0.5" value={form.vsc_used} onChange={e => set('vsc_used', e.target.value)} placeholder="0.00" />
                </div>
                <div className={styles.field}>
                  <label>VSC Earned This SY</label>
                  <input type="number" min="0" step="0.5" value={form.vsc_earned_this_sy} onChange={e => set('vsc_earned_this_sy', e.target.value)} placeholder="0.00" />
                </div>
                <div className={styles.field}>
                  <label>Max VSC Allowed</label>
                  <select value={form.vsc_max} onChange={e => set('vsc_max', e.target.value)}>
                    <option value={15}>15 days (below 10 years)</option>
                    <option value={30}>30 days (10–19 years)</option>
                    <option value={45}>45 days (20+ years)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Non-Teaching section */}
          {form.emp_type === 'Non-Teaching' && (
            <>
              <div className={styles.dividerLabel}>VL & SL — Auto Accrual (1.25 days/month each)</div>
              <div className={`${styles.infoBox} ${styles.infoBoxBlue}`}>
                VL and SL auto-accrue at <strong>1.25 days/month</strong> from date hired (CSC MC 41, s. 1998).
                Override fields are optional — leave blank to use auto-computed balance.
              </div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label>VL Used (cumulative)</label>
                  <input type="number" min="0" step="0.25" value={form.vl_used} onChange={e => set('vl_used', e.target.value)} placeholder="0.00" />
                </div>
                <div className={styles.field}>
                  <label>SL Used (cumulative)</label>
                  <input type="number" min="0" step="0.25" value={form.sl_used} onChange={e => set('sl_used', e.target.value)} placeholder="0.00" />
                </div>
                <div className={styles.field}>
                  <label>VL Balance Override (optional)</label>
                  <input type="number" min="0" step="0.25" value={form.vl_override} onChange={e => set('vl_override', e.target.value)} placeholder="Leave blank to auto-compute" />
                </div>
                <div className={styles.field}>
                  <label>SL Balance Override (optional)</label>
                  <input type="number" min="0" step="0.25" value={form.sl_override} onChange={e => set('sl_override', e.target.value)} placeholder="Leave blank to auto-compute" />
                </div>
              </div>
            </>
          )}

          <div className={styles.field} style={{ marginTop: 8 }}>
            <label>Notes / Remarks</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" />
          </div>

          {err && <div className={styles.errorBox}>{err}</div>}
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
  )
}
