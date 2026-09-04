import { useState } from 'react'
import { useEmployees } from '@/hooks/useEmployees'
import { fmt, fmtDate, slBalance, vlBalance, vscBalance, yearsOfService } from '@/utils/leaveCalc'
import { automaticSalaryStep, parseSalaryGrade, salaryStepsForGrade } from '@/utils/salarySchedule'
import { employeeNumber, employeeTin, formatTin, personnelFullName, personnelLeadershipPriority } from '@/utils/personnel'
import { SCHOOLS, schoolNameById } from '@/utils/schools'
import EmployeeModal from '@/components/HRMO/EmployeeModal'
import ClearableSearchInput from '@/components/shared/ClearableSearchInput'
import styles from './Dashboard.module.css'

function currentStep(employee) {
  const recordedStep = Number(employee.salary_step) || 1
  if (employee.salary_step_mode !== 'automatic') return recordedStep
  const grade = parseSalaryGrade(employee.salary_grade)
  return automaticSalaryStep(
    employee.salary_step_basis_date || employee.hired_date,
    new Date(),
    salaryStepsForGrade(grade).length || 8,
  )
}

function personnelSchoolId(employee) {
  return employee.assigned_school_id || employee.school_id || 'UNASSIGNED'
}

export default function PersonnelAdmin() {
  const { employees, loading, error, updateEmployee } = useEmployees()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const query = search.trim().toLowerCase()
  const personnel = employees.filter(employee => {
    const searchable = [personnelFullName(employee), employee.item_number, employeeTin(employee),
      employeeNumber(employee), employee.position, schoolNameById(personnelSchoolId(employee))]
      .filter(Boolean).join(' ').toLowerCase()
    return (!query || searchable.includes(query))
      && (!typeFilter || employee.emp_type === typeFilter)
      && (!schoolFilter || personnelSchoolId(employee) === schoolFilter)
  }).sort((a, b) => {
    if (schoolFilter) {
      const priorityOrder = personnelLeadershipPriority(a.position, schoolFilter === 'DEFAULT')
        - personnelLeadershipPriority(b.position, schoolFilter === 'DEFAULT')
      if (priorityOrder) return priorityOrder
    }
    return personnelFullName(a).localeCompare(personnelFullName(b), 'en', { sensitivity: 'base' })
  })

  const schoolCounts = employees.reduce((counts, employee) => {
    const schoolId = personnelSchoolId(employee)
    counts[schoolId] = (counts[schoolId] || 0) + 1
    return counts
  }, {})

  return <>
  <div className={styles.card}>
    <div className={styles.cardHeader}><span className={styles.cardTitle}>All Personnel</span></div>
    <div className={styles.toolbar}>
      <ClearableSearchInput className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, OSEC no., TIN, position, or school…" />
      <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
        <option value="">All types</option><option value="Teaching">Teaching</option><option value="Non-Teaching">Non-Teaching</option>
      </select>
      <select className={styles.schoolSelect} value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}>
        <option value="">All Schools / Offices ({employees.length})</option>
        {schoolCounts.DEFAULT > 0 && <option value="DEFAULT">SDO / Division Office ({schoolCounts.DEFAULT})</option>}
        {schoolCounts.UNASSIGNED > 0 && <option value="UNASSIGNED">Unassigned ({schoolCounts.UNASSIGNED})</option>}
        {SCHOOLS.map(school => <option key={school.id} value={school.id}>{school.name} ({schoolCounts[school.id] || 0})</option>)}
      </select>
      <span className={styles.personnelCount} aria-live="polite">({personnel.length}) personnel</span>
    </div>
    {error && <div className={styles.inlineError}>Could not load personnel: {error}</div>}
    {loading && personnel.length === 0 ? <div className={styles.emptyState}>Loading…</div> : <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.centeredHeaders}`}>
        <thead><tr><th>Full Name</th><th>OSEC No.</th><th>Position / School</th><th>Type</th><th>Date Hired</th><th>Years in Service</th><th>Date Last Promoted</th><th>Current Step</th><th>TIN</th><th>VL</th><th>SL</th><th>VSC</th></tr></thead>
        <tbody>{personnel.length === 0
          ? <tr><td colSpan={12} className={styles.emptyState}>No personnel found.</td></tr>
          : personnel.map(employee => {
              const teaching = employee.emp_type === 'Teaching'
              return <tr
                key={employee.id}
                className={styles.clickableRow}
                onClick={() => setEditTarget(employee)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setEditTarget(employee)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Edit ${personnelFullName(employee)}`}
              >
                <td className={styles.nameCell}>{personnelFullName(employee)}</td>
                <td className={styles.subCell}>{employee.item_number || '—'}</td>
                <td><div>{employee.position || '—'}</div><div className={styles.subCell}>{schoolNameById(personnelSchoolId(employee)) || 'Unassigned'}</div></td>
                <td><span className={`${styles.pill} ${teaching ? styles.pillTeaching : styles.pillNT}`}>{employee.emp_type}</span></td>
                <td className={styles.subCell}>{fmtDate(employee.hired_date)}</td>
                <td className={styles.subCell}>{yearsOfService(employee.hired_date)} year(s)</td>
                <td className={styles.subCell}>{fmtDate(employee.salary_step_basis_date)}</td>
                <td className={styles.creditCell}>Step {currentStep(employee)}</td>
                <td className={styles.subCell}>{formatTin(employeeTin(employee))}</td>
                <td className={styles.creditCell}>{teaching ? '—' : fmt(vlBalance(employee))}</td>
                <td className={styles.creditCell}>{teaching ? '—' : fmt(slBalance(employee))}</td>
                <td className={styles.creditCell}>{teaching ? fmt(vscBalance(employee)) : '—'}</td>
              </tr>
            })}</tbody>
      </table>
    </div>}
  </div>
  {editTarget && <EmployeeModal
    employee={editTarget}
    onSave={async data => {
      const result = await updateEmployee(editTarget.id, data)
      if (result.success) setEditTarget(null)
      return result
    }}
    onClose={() => setEditTarget(null)}
  />}
  </>
}
