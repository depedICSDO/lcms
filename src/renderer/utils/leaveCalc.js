// ============================================================
// DepEd / CSC Leave Computation Utilities
// CSC MC No. 41, s. 1998 (Omnibus Rules on Leave)
// DepEd Order No. 013, s. 2024 (VSC for Teachers)
// ============================================================

export const ACCRUAL_RATE = 1.25 // days per month for Non-Teaching (VL and SL separately)
export const WORKING_DAYS_PER_MONTH = 22 // per RA 6758

function employeeType(employee) {
  return employee?.emp_type ?? employee?.type
}

function employeeHireDate(employee) {
  return employee?.hired_date ?? employee?.hired
}

/**
 * Months of service from hire date to reference date (inclusive of hire month).
 */
export function monthsOfService(hireDate, refDate = new Date()) {
  const h = new Date(hireDate)
  const r = new Date(refDate)
  if (Number.isNaN(h.getTime()) || Number.isNaN(r.getTime())) return 0
  const months = (r.getFullYear() - h.getFullYear()) * 12 + (r.getMonth() - h.getMonth())
  return Math.max(0, months)
}

/**
 * Non-Teaching: total earned VL or SL from hire date.
 * 1.25 days per month per leave type (CSC MC 41 s.1998).
 */
export function totalEarned(hireDate, refDate = new Date()) {
  const months = monthsOfService(hireDate, refDate)
  return +(months * ACCRUAL_RATE).toFixed(4)
}

/**
 * Non-Teaching: current VL balance.
 * If override is provided (manual HRMO correction), use that.
 */
export function vlBalance(employee, refDate = new Date()) {
  if (employeeType(employee) !== 'Non-Teaching') return 0
  if (employee.vl_override !== null && employee.vl_override !== undefined) {
    return +employee.vl_override
  }
  const earned = totalEarned(employeeHireDate(employee), refDate)
  return Math.max(0, +(earned - (employee.vl_used || 0)).toFixed(2))
}

/**
 * Non-Teaching: current SL balance.
 */
export function slBalance(employee, refDate = new Date()) {
  if (employeeType(employee) !== 'Non-Teaching') return 0
  if (employee.sl_override !== null && employee.sl_override !== undefined) {
    return +employee.sl_override
  }
  const earned = totalEarned(employeeHireDate(employee), refDate)
  return Math.max(0, +(earned - (employee.sl_used || 0)).toFixed(2))
}

/**
 * Teaching: VSC balance (manually entered by HRMO).
 * Per DepEd Order 013, s. 2024 — teachers are not entitled to VL/SL.
 * VSC max depends on years of service:
 *   < 10 years → max 15 days
 *   10–19 years → max 30 days
 *   20+ years → max 45 days
 */
export function vscMaxDays(hireDate, refDate = new Date()) {
  const years = monthsOfService(hireDate, refDate) / 12
  if (years >= 20) return 45
  if (years >= 10) return 30
  return 15
}

export function vscBalance(employee) {
  if (employeeType(employee) !== 'Teaching') return 0
  return Math.max(0, +(((employee.vsc_balance || 0))).toFixed(2))
}

/**
 * Terminal Leave computation (CSC formula):
 * TLB = (D / 22) × Monthly Salary
 * where D = accumulated VL + SL (non-teaching) or VSC (teaching)
 */
export function terminalLeave(employee, monthlySalary) {
  let days = 0
  if (employeeType(employee) === 'Teaching') {
    days = vscBalance(employee)
  } else {
    days = vlBalance(employee) + slBalance(employee)
  }
  return +((days / WORKING_DAYS_PER_MONTH) * monthlySalary).toFixed(2)
}

/**
 * Forced/mandatory leave check (CSC MC 41 s.1998, Sec. 25):
 * Employees with 10+ VL days must take at least 5 consecutive/intermittent VL days per year.
 */
export function requiresForcedLeave(employee) {
  if (employeeType(employee) !== 'Non-Teaching') return false
  return vlBalance(employee) >= 10
}

/**
 * Monetization: 50% or more of accumulated leave credits may be monetized
 * for valid reasons per CSC MC 2, s. 2016.
 * Returns max monetizable days.
 */
export function maxMonetizable(employee) {
  if (employeeType(employee) === 'Teaching') {
    return Math.floor(vscBalance(employee) * 0.5)
  }
  const total = vlBalance(employee) + slBalance(employee)
  return Math.floor(total * 0.5)
}

/**
 * Generate accrual log for the past N months for a Non-Teaching employee.
 */
export function generateAccrualLog(employee, months = 12) {
  const log = []
  const today = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const hired = new Date(employeeHireDate(employee))
    const earned = !Number.isNaN(hired.getTime()) && d >= new Date(hired.getFullYear(), hired.getMonth(), 1)
    log.push({
      month: d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
      vl: earned ? ACCRUAL_RATE : 0,
      sl: earned ? ACCRUAL_RATE : 0,
      date: d
    })
  }
  return log
}

/**
 * Format a number as leave days string.
 */
export function fmt(n) {
  if (n === null || n === undefined || n === '—') return '—'
  return (+n).toFixed(2)
}

export const LEAVE_TYPES_NONTEACHING = [
  { key: 'vacation', label: 'Vacation Leave (VL)', basis: 'EO 292, Rule XVI, Sec. 51' },
  { key: 'mandatory_forced', label: 'Mandatory / Forced Leave', basis: 'EO 292, Rule XVI, Sec. 25' },
  { key: 'sick', label: 'Sick Leave (SL)', basis: 'EO 292, Rule XVI, Sec. 43' },
  { key: 'maternity', label: 'Maternity Leave', basis: 'RA 11210' },
  { key: 'paternity', label: 'Paternity Leave', basis: 'RA 8187' },
  { key: 'special_privilege', label: 'Special Privilege Leave', basis: 'EO 292, Rule XVI, Sec. 21' },
  { key: 'solo_parent', label: 'Solo Parent Leave', basis: 'RA 8972, as amended by RA 11861' },
  { key: 'study', label: 'Study Leave', basis: 'EO 292, Rule XVI, Sec. 68' },
  { key: 'vawc', label: '10-Day VAWC Leave', basis: 'RA 9262 / CSC MC 15, s. 2005' },
  { key: 'rehabilitation', label: 'Rehabilitation Privilege', basis: 'EO 292, Rule XVI, Sec. 55' },
  { key: 'special_leave_women', label: 'Special Leave Benefits for Women', basis: 'RA 9710 / CSC MC 25, s. 2010' },
  { key: 'special_emergency', label: 'Special Emergency (Calamity) Leave', basis: 'CSC MC 2, s. 2012' },
  { key: 'adoption', label: 'Adoption Leave', basis: 'RA 11642' },
  { key: 'wellness', label: 'Wellness Leave', basis: 'CSC MC 1, s. 2026 / DepEd DO 2, s. 2026' },
  { key: 'monetization', label: 'Monetization of Leave Credits', basis: 'CSC MC 41, s. 1998' },
  { key: 'terminal', label: 'Terminal Leave', basis: 'EO 292 / CSC leave rules' },
]

export const LEAVE_TYPES_TEACHING = [
  { key: 'vsc', label: 'Vacation Service Credits (VSC)', basis: 'DepEd Order 013 s.2024' },
  { key: 'maternity', label: 'Maternity Leave', basis: 'RA 11210' },
  { key: 'paternity', label: 'Paternity Leave', basis: 'RA 8187' },
  { key: 'special_privilege', label: 'Special Privilege Leave', basis: 'EO 292, Rule XVI, Sec. 21' },
  { key: 'solo_parent', label: 'Solo Parent Leave', basis: 'RA 8972, as amended by RA 11861' },
  { key: 'study', label: 'Study Leave', basis: 'RA 4670 Sec. 24' },
  { key: 'indefinite_sick', label: 'Indefinite Sick Leave', basis: 'RA 4670 Sec. 25' },
  { key: 'vawc', label: '10-Day VAWC Leave', basis: 'RA 9262 / CSC MC 15, s. 2005' },
  { key: 'rehabilitation', label: 'Rehabilitation Privilege', basis: 'EO 292, Rule XVI, Sec. 55' },
  { key: 'special_leave_women', label: 'Special Leave Benefits for Women', basis: 'RA 9710 / CSC MC 25, s. 2010' },
  { key: 'special_emergency', label: 'Special Emergency (Calamity) Leave', basis: 'CSC MC 2, s. 2012' },
  { key: 'adoption', label: 'Adoption Leave', basis: 'RA 11642' },
  { key: 'wellness', label: 'Wellness Leave', basis: 'CSC MC 1, s. 2026 / DepEd DO 2, s. 2026' },
  { key: 'terminal', label: 'Terminal Leave', basis: 'EO 292 / CSC leave rules' },
]

export const POSITIONS_TEACHING = [
  'Teacher I', 'Teacher II', 'Teacher III', 'Teacher IV', 'Teacher V', 'Teacher VI', 'Teacher VII',
  'Master Teacher I', 'Master Teacher II', 'Master Teacher III', 'Master Teacher IV', 'Master Teacher V',
  'Special Education Teacher I', 'Special Education Teacher II', 'Special Education Teacher III',
  'Special Science Teacher I', 'Special Science Teacher II', 'Special Science Teacher III',
  'Special Science Teacher IV', 'Special Science Teacher V',
  'Head Teacher I', 'Head Teacher II', 'Head Teacher III',
  'Head Teacher IV', 'Head Teacher V', 'Head Teacher VI',
  'Principal I', 'Principal II', 'Principal III', 'Principal IV',
  'School Principal I', 'School Principal II', 'School Principal III', 'School Principal IV',
  'Assistant School Principal I', 'Assistant School Principal II',
]

export const POSITIONS_NONTEACHING = [
  // Office of the Schools Division Superintendent
  'Schools Division Superintendent',
  'Assistant Schools Division Superintendent',
  'Attorney III',
  'Legal Assistant I',
  'Legal Assistant II',
  'Information Technology Officer I',

  // Curriculum Implementation and School Governance and Operations
  'Chief Education Supervisor',
  'Education Program Supervisor',
  'Education Program Specialist I',
  'Education Program Specialist II',
  'Senior Education Program Specialist',
  'Planning Officer I',
  'Planning Officer II',
  'Planning Officer III',
  'Project Development Officer I',
  'Project Development Officer II',
  'Project Development Officer III',
  'Project Development Officer IV',
  'Statistician I',

  // Education facilities and school health
  'Architect II',
  'Engineer II',
  'Engineer III',
  'Medical Officer III',
  'Dentist I',
  'Dentist II',
  'Nurse I',
  'Nurse II',
  'Nutritionist-Dietitian I',
  'Nutritionist-Dietitian II',
  'Psychologist I',
  'Psychologist II',
  'Psychometrician I',
  'Guidance Counselor I',
  'Guidance Counselor II',
  'Guidance Services Specialist I',
  'Guidance Services Specialist II',

  // Administrative and finance services
  'Administrative Officer I',
  'Administrative Officer II',
  'Administrative Officer III',
  'Administrative Officer IV',
  'Administrative Officer V',
  'Human Resource Management Officer I',
  'Human Resource Management Officer II',
  'Records Officer I',
  'Records Officer II',
  'Supply Officer I',
  'Supply Officer II',
  'Budget Officer I',
  'Budget Officer II',
  'Budget Officer III',
  'Accountant I',
  'Accountant II',
  'Accountant III',
  'Cashier I',
  'Cashier II',
  'Disbursing Officer I',
  'Disbursing Officer II',
  'Bookkeeper I',
  'Administrative Assistant I',
  'Administrative Assistant II',
  'Administrative Assistant III (Senior Bookkeeper)',
  'Administrative Assistant IV',
  'Administrative Assistant V',
  'Administrative Aide I',
  'Administrative Aide II',
  'Administrative Aide III',
  'Administrative Aide IV',
  'Administrative Aide V',
  'Administrative Aide VI',

  // School and general support services
  'Librarian I',
  'Librarian II',
  'Registrar I',
  'School Counselor Associate I',
  'School Nurse I',
  'School Nurse II',
  'Driver I',
  'Driver II',
  'Security Guard I',
  'Security Guard II',
  'Utility Worker I',
  'Utility Worker II',
]
