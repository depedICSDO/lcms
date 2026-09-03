import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { POSITIONS_TEACHING, POSITIONS_NONTEACHING_SDO, POSITIONS_NONTEACHING_SCHOOL, vscMaxDays } from '@/utils/leaveCalc'
import {
  CURRENT_SALARY_SCHEDULE,
  SALARY_GRADES,
  automaticSalaryStep,
  findSalaryStep,
  formatPeso,
  formatSalaryGrade,
  monthlySalaryFor,
  parseSalaryGrade,
  parseSalaryStep,
  salaryGradeForPosition,
  salaryStepsForGrade,
} from '@/utils/salarySchedule'
import styles from './Modal.module.css'

const CUSTOM_POSITIONS_KEY = 'lcms_custom_positions'

function loadCustomPositions() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_POSITIONS_KEY) || '{}')
    const legacy = saved['Non-Teaching'] || []
    return {
      Teaching: saved.Teaching || [],
      'SDO-Based': saved['SDO-Based'] || legacy,
      'School-Based': saved['School-Based'] || legacy,
    }
  } catch {
    return { Teaching: [], 'SDO-Based': [], 'School-Based': [] }
  }
}

function inferWorkAssignment(employee) {
  if (employee?.emp_type !== 'Non-Teaching') return ''
  if (employee.work_assignment) return employee.work_assignment
  const schoolOnly = POSITIONS_NONTEACHING_SCHOOL.includes(employee.position) && !POSITIONS_NONTEACHING_SDO.includes(employee.position)
  const sdoOnly = POSITIONS_NONTEACHING_SDO.includes(employee.position) && !POSITIONS_NONTEACHING_SCHOOL.includes(employee.position)
  if (schoolOnly) return 'School-Based'
  if (sdoOnly) return 'SDO-Based'
  return ''
}

function customPositionGroup(empType, workAssignment) {
  return empType === 'Teaching' ? 'Teaching' : workAssignment
}

const BLANK = {
  last_name: '', first_name: '', middle_name: '', employee_no: '',
  emp_type: '', work_assignment: '', position: '', emp_status: 'Permanent',
  hired_date: '', salary_grade: '', salary_step: 1, salary_step_mode: 'automatic',
  salary_step_basis_date: '', monthly_salary: '', retirement_date: '', retirement_notes: '',
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
    work_assignment: inferWorkAssignment(employee),
    salary_step: employee.salary_step || parseSalaryStep(employee.salary_grade) || findSalaryStep(parseSalaryGrade(employee.salary_grade), employee.monthly_salary) || 1,
    salary_step_mode: employee.salary_step_mode || 'manual',
    salary_step_basis_date: employee.salary_step_basis_date || employee.hired_date || '',
    vl_override: employee.vl_override ?? '',
    sl_override: employee.sl_override ?? '',
  } : { ...BLANK })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [salaryGuidance, setSalaryGuidance] = useState(null)
  const [customPositions, setCustomPositions] = useState(loadCustomPositions)
  const initialGroup = customPositionGroup(employee?.emp_type, inferWorkAssignment(employee))
  const initialBuiltInPositions = employee?.emp_type === 'Teaching'
    ? POSITIONS_TEACHING
    : inferWorkAssignment(employee) === 'School-Based' ? POSITIONS_NONTEACHING_SCHOOL : POSITIONS_NONTEACHING_SDO
  const initialKnownPositions = [...initialBuiltInPositions, ...(customPositions[initialGroup] || [])]
  const [isCustomPosition, setIsCustomPosition] = useState(
    Boolean(employee?.position && !initialKnownPositions.includes(employee.position))
  )

  useEffect(() => {
    let active = true
    window.electronAPI?.checkDbmSalaryGuidance?.().then(result => {
      if (active) setSalaryGuidance(result)
    })
    return () => { active = false }
  }, [])

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  function selectEmployeeType(empType) {
    setForm(current => ({
      ...current,
      emp_type: empType,
      work_assignment: empType === 'Teaching' ? '' : (current.emp_type === empType ? current.work_assignment : ''),
      position: current.emp_type === empType ? current.position : '',
      salary_grade: current.emp_type === empType ? current.salary_grade : '',
      salary_step: current.emp_type === empType ? current.salary_step : 1,
      monthly_salary: current.emp_type === empType ? current.monthly_salary : '',
    }))
    if (form.emp_type !== empType) setIsCustomPosition(false)
  }

  function selectWorkAssignment(workAssignment) {
    setForm(current => ({
      ...current,
      work_assignment: workAssignment,
      position: current.work_assignment === workAssignment ? current.position : '',
      salary_grade: current.work_assignment === workAssignment ? current.salary_grade : '',
      salary_step: current.work_assignment === workAssignment ? current.salary_step : 1,
      monthly_salary: current.work_assignment === workAssignment ? current.monthly_salary : '',
    }))
    if (form.work_assignment !== workAssignment) setIsCustomPosition(false)
  }

  function selectPosition(value) {
    if (value === '__custom__') {
      setIsCustomPosition(true)
      setForm(current => ({ ...current, position: '', salary_grade: '', salary_step: 1, monthly_salary: '' }))
    } else {
      setIsCustomPosition(false)
      setForm(current => {
        const grade = salaryGradeForPosition(value)
        const currentStep = parseSalaryStep(current.salary_grade)
          || findSalaryStep(parseSalaryGrade(current.salary_grade), current.monthly_salary)
          || 1
        const step = grade && salaryStepsForGrade(grade).includes(currentStep) ? currentStep : 1
        return {
          ...current,
          position: value,
          salary_grade: grade ? formatSalaryGrade(grade, step) : '',
          salary_step: step,
          monthly_salary: grade ? monthlySalaryFor(grade, step) : '',
        }
      })
    }
  }

  function selectSalaryGrade(value) {
    const grade = Number(value)
    if (!grade) {
      setForm(current => ({ ...current, salary_grade: '', monthly_salary: '' }))
      return
    }
    const currentStep = Number(form.salary_step)
      || parseSalaryStep(form.salary_grade)
      || findSalaryStep(grade, form.monthly_salary)
      || 1
    const validSteps = salaryStepsForGrade(grade)
    const step = validSteps.includes(currentStep) ? currentStep : 1
    setForm(current => ({
      ...current,
      salary_grade: formatSalaryGrade(grade, step),
      salary_step: step,
      monthly_salary: monthlySalaryFor(grade, step),
    }))
  }

  function selectSalaryStep(value) {
    if (form.salary_step_mode === 'automatic') return
    const grade = parseSalaryGrade(form.salary_grade)
    const step = Number(value)
    if (!grade || !salaryStepsForGrade(grade).includes(step)) return
    setForm(current => ({
      ...current,
      salary_grade: formatSalaryGrade(grade, step),
      salary_step: step,
      monthly_salary: monthlySalaryFor(grade, step),
    }))
  }

  function selectSalaryStepMode(mode) {
    setForm(current => ({
      ...current,
      salary_step_mode: mode,
      salary_step_basis_date: current.salary_step_basis_date || current.hired_date || '',
    }))
  }

  async function handleSave() {
    if (!form.emp_type) { setErr('Select Teaching or Non-Teaching first.'); return }
    if (!form.last_name.trim()) { setErr('Last name is required.'); return }
    if (!form.first_name.trim()) { setErr('First name is required.'); return }
    if (!form.hired_date) { setErr('Date hired is required.'); return }
    if (form.salary_step_mode === 'automatic' && !(form.salary_step_basis_date || form.hired_date)) {
      setErr('Current position start date is required for automatic step calculation.'); return
    }
    if (form.salary_step_basis_date && form.hired_date && form.salary_step_basis_date < form.hired_date) {
      setErr('Current position start date cannot be earlier than the date hired.'); return
    }
    if (form.emp_type === 'Non-Teaching' && !form.work_assignment) { setErr('Select SDO-Based or School-Based.'); return }
    if (!form.position.trim()) { setErr('Position is required.'); return }
    setSaving(true)
    setErr('')
    const normalizedPosition = form.position.trim()
    const normalizedGrade = parseSalaryGrade(form.salary_grade)
    const normalizedStep = form.salary_step_mode === 'automatic'
      ? automaticSalaryStep(
          form.salary_step_basis_date || form.hired_date,
          new Date(),
          salaryStepsForGrade(normalizedGrade).length || 8
        )
      : selectedSalaryStep
    const payload = {
      ...form,
      position: normalizedPosition,
      work_assignment: form.emp_type === 'Non-Teaching' ? form.work_assignment : null,
      vl_override: form.vl_override !== '' ? parseFloat(form.vl_override) : null,
      sl_override: form.sl_override !== '' ? parseFloat(form.sl_override) : null,
      vsc_balance: parseFloat(form.vsc_balance) || 0,
      vsc_used: parseFloat(form.vsc_used) || 0,
      vsc_earned_this_sy: parseFloat(form.vsc_earned_this_sy) || 0,
      vsc_max: parseInt(form.vsc_max) || 15,
      vl_used: parseFloat(form.vl_used) || 0,
      sl_used: parseFloat(form.sl_used) || 0,
      salary_grade: formatSalaryGrade(normalizedGrade, normalizedStep),
      salary_step: normalizedStep,
      salary_step_mode: form.salary_step_mode,
      salary_step_basis_date: form.salary_step_basis_date || form.hired_date || null,
      monthly_salary: monthlySalaryFor(normalizedGrade, normalizedStep),
      retirement_date: form.retirement_date || null,
      retirement_notes: form.retirement_notes?.trim() || null,
      created_by: !isEdit ? user?.username : undefined,
      updated_by: isEdit ? user?.username : undefined,
    }
    const res = await onSave(payload)
    setSaving(false)
    if (res?.error) {
      setErr(res.error)
    } else {
      const group = customPositionGroup(form.emp_type, form.work_assignment)
      if (!isCustomPosition || customPositions[group].includes(normalizedPosition)) return
      const updated = {
        ...customPositions,
        [group]: [...customPositions[group], normalizedPosition].sort((a, b) => a.localeCompare(b))
      }
      setCustomPositions(updated)
      localStorage.setItem(CUSTOM_POSITIONS_KEY, JSON.stringify(updated))
    }
  }

  const positionGroup = customPositionGroup(form.emp_type, form.work_assignment)
  const builtInPositions = form.emp_type === 'Teaching'
    ? POSITIONS_TEACHING
    : form.work_assignment === 'School-Based' ? POSITIONS_NONTEACHING_SCHOOL
      : form.work_assignment === 'SDO-Based' ? POSITIONS_NONTEACHING_SDO : []
  const positions = [...new Set([...builtInPositions, ...(customPositions[positionGroup] || [])])]
  const autoVscMax = form.hired_date ? vscMaxDays(form.hired_date) : 15
  const selectedSalaryGrade = parseSalaryGrade(form.salary_grade)
  const salarySteps = salaryStepsForGrade(selectedSalaryGrade)
  const manualSalaryStep = Number(form.salary_step)
    || parseSalaryStep(form.salary_grade)
    || findSalaryStep(selectedSalaryGrade, form.monthly_salary)
    || 1
  const selectedSalaryStep = form.salary_step_mode === 'automatic'
    ? automaticSalaryStep(
        form.salary_step_basis_date || form.hired_date,
        new Date(),
        salarySteps.length || 8
      )
    : manualSalaryStep
  const displayedMonthlySalary = monthlySalaryFor(selectedSalaryGrade, selectedSalaryStep)

  if (!isEdit && !form.emp_type) {
    return (
      <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className={styles.modal} style={{ maxWidth: 480 }}>
          <div className={styles.modalHeader}>
            <h2>Add Employee — Select Employee Type</h2>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>
          <div className={styles.body}>
            <div className={styles.employeeTypeGrid}>
              <button type="button" className={styles.employeeTypeCard} onClick={() => selectEmployeeType('Teaching')}>
                <span className={styles.employeeTypeIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12.3V17c2.8 2.1 7.2 2.1 10 0v-4.7"/><path d="M21 10v6"/></svg>
                </span>
                <span>Teaching</span>
              </button>
              <button type="button" className={styles.employeeTypeCard} onClick={() => selectEmployeeType('Non-Teaching')}>
                <span className={styles.employeeTypeIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18M10 12v2h4v-2"/></svg>
                </span>
                <span>Non-Teaching</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${styles.employeeModal}`}>
        <div className={styles.modalHeader}>
          <h2>{isEdit ? `Edit — ${employee.last_name}, ${employee.first_name}` : 'Add Employee'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {/* The employee type is selected before this form opens and stays fixed. */}
          <div className={styles.typeTabs}>
            <span className={`${styles.typeTab} ${styles.typeTabActive} ${styles.selectedEmployeeType}`}>
              {form.emp_type}
            </span>
          </div>

          {form.emp_type === 'Non-Teaching' && <>
            <div className={styles.dividerLabel}>Non-Teaching Work Assignment *</div>
            <div className={styles.typeTabs}>
              {['SDO-Based', 'School-Based'].map(assignment => (
                <button
                  type="button"
                  key={assignment}
                  className={`${styles.typeTab} ${form.work_assignment === assignment ? styles.typeTabActive : ''}`}
                  onClick={() => selectWorkAssignment(assignment)}
                >
                  {assignment}
                </button>
              ))}
            </div>
          </>}

          <div className={styles.dividerLabel}>Personal Information</div>
          <div className={styles.grid3}>
            <div className={styles.field}>
              <label>Last Name *</label>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value.toUpperCase())} placeholder="DELA CRUZ" />
            </div>
            <div className={styles.field}>
              <label>First Name *</label>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value.toUpperCase())} placeholder="JUAN" />
            </div>
            <div className={styles.field}>
              <label>Middle Name</label>
              <input value={form.middle_name} onChange={e => set('middle_name', e.target.value.toUpperCase())} placeholder="SANTOS" />
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
              <select disabled={form.emp_type === 'Non-Teaching' && !form.work_assignment} value={isCustomPosition ? '__custom__' : form.position} onChange={e => selectPosition(e.target.value)}>
                <option value="">{form.emp_type === 'Non-Teaching' && !form.work_assignment ? 'Select work assignment first' : 'Select a position'}</option>
                {positions.map(position => <option key={position} value={position}>{position}</option>)}
                <option value="__custom__">+ Add custom position…</option>
              </select>
              {isCustomPosition && <input
                autoFocus
                value={form.position}
                onChange={e => set('position', e.target.value)}
                placeholder="Enter the new position title"
              />}
            </div>
            <div className={styles.field}>
              <label>Salary Grade / Step</label>
              <div className={styles.salarySelectors}>
                <select
                  value={selectedSalaryGrade || ''}
                  onChange={e => selectSalaryGrade(e.target.value)}
                  disabled={!isCustomPosition}
                  title={isCustomPosition ? 'Select the salary grade for this custom position' : 'Automatically assigned from the selected position'}
                >
                  <option value="">Select SG</option>
                  {SALARY_GRADES.map(grade => <option key={grade} value={grade}>SG-{grade}</option>)}
                </select>
                <select
                  value={selectedSalaryGrade ? selectedSalaryStep : ''}
                  onChange={e => selectSalaryStep(e.target.value)}
                  disabled={!selectedSalaryGrade || form.salary_step_mode === 'automatic'}
                  title={form.salary_step_mode === 'automatic' ? 'Automatically calculated from the current-position start date' : 'Select the HRMO-approved salary step'}
                >
                  <option value="">Step</option>
                  {salarySteps.map(step => <option key={step} value={step}>Step {step}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <label>Date Hired / Appointment *</label>
              <input type="date" value={form.hired_date} onChange={e => set('hired_date', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Monthly Salary (₱)</label>
              <input type="text" value={formatPeso(displayedMonthlySalary)} readOnly placeholder="Select a position and step" />
              <div className={styles.sourceNote}>
                {CURRENT_SALARY_SCHEDULE.year} third tranche · <a href={CURRENT_SALARY_SCHEDULE.sourceUrl} target="_blank" rel="noreferrer">DBM NBC No. 601</a>
              </div>
              {salaryGuidance?.state === 'review' && (
                <div className={styles.salaryGuidanceWarning} role="alert">{salaryGuidance.message}</div>
              )}
            </div>
            <div className={styles.field}>
              <label>Step Increment Method</label>
              <select
                value={form.salary_step_mode}
                onChange={e => selectSalaryStepMode(e.target.value)}
                title="Controls how the salary step within the grade is set: computed from time-in-position, or chosen by HRMO."
              >
                <option value="automatic">Automatic — every 3 qualifying years</option>
                <option value="manual">Manual — HRMO selects the step</option>
              </select>
              <div className={styles.fieldHint}>
                {form.salary_step_mode === 'automatic'
                  ? 'Step is computed from the Current Position Start Date. Use Manual for withheld increments or other exceptions.'
                  : 'HRMO sets the step directly. Switch to Automatic to let the system compute it from time-in-position instead.'}
              </div>
            </div>
            <div className={styles.field}>
              <label>Current Position Start Date</label>
              <input
                type="date"
                min={form.hired_date || undefined}
                value={form.salary_step_basis_date || form.hired_date || ''}
                onChange={e => set('salary_step_basis_date', e.target.value)}
              />
              <div className={styles.sourceNote}>
                Use the appointment date for a new hire or the effective date of promotion to the present position.
              </div>
            </div>
          </div>

          {form.salary_step_mode === 'automatic' && (
            <div className={`${styles.infoBox} ${styles.infoBoxBlue}`}>
              Step {selectedSalaryStep} is locked and calculated from completed 3-year periods in the current position. HRMO must confirm satisfactory service and any periods that defer the increment before saving.
            </div>
          )}

          <div className={styles.dividerLabel}>Retirement / Resignation Documentation</div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label>Expected Retirement / Resignation Date</label>
              <input type="date" value={form.retirement_date || ''} onChange={e => set('retirement_date', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Retirement / Resignation Reference</label>
              <input value={form.retirement_notes || ''} onChange={e => set('retirement_notes', e.target.value)} placeholder="Order, notice, or HRMO reference" />
            </div>
          </div>

          {/* Teaching section — VSC is HRMO-encoded after the record exists, not at creation */}
          {form.emp_type === 'Teaching' && isEdit && (
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
