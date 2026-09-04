export function normalizeTin(value) {
  const digits = String(value || '').replace(/\D/g, '')
  const core = digits.length === 12 && digits.endsWith('000') ? digits.slice(0, -3) : digits
  return /^\d{9}$/.test(core) ? core : null
}

export function formatTin(value) {
  const tin = normalizeTin(value)
  return tin ? tin.replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3') : '—'
}

export function formatTinInput(value) {
  const rawDigits = String(value || '').replace(/\D/g, '')
  const digits = rawDigits.length === 12 && rawDigits.endsWith('000')
    ? rawDigits.slice(0, -3)
    : rawDigits.slice(0, 9)
  return digits.match(/.{1,3}/g)?.join('-') || ''
}

export function isLegacyTinEmployeeNumber(value) {
  return /^\d{9}000$/.test(String(value || '').replace(/\D/g, ''))
}

export function employeeTin(employee) {
  return normalizeTin(employee?.tin_number)
    || (isLegacyTinEmployeeNumber(employee?.employee_no) ? normalizeTin(employee.employee_no) : null)
}

export function employeeNumber(employee) {
  return isLegacyTinEmployeeNumber(employee?.employee_no) ? '' : (employee?.employee_no || '')
}

export function personnelFullName(employee) {
  const givenNames = [employee.first_name, employee.middle_name].filter(Boolean).join(' ')
  return [employee.last_name, givenNames].filter(Boolean).join(', ')
}

export function personnelLeadershipPriority(position, isDivisionOffice = false) {
  const normalized = String(position || '').trim().toLowerCase()
  if (isDivisionOffice) {
    if (normalized === 'schools division superintendent') return 0
    if (normalized === 'assistant schools division superintendent') return 1
    return 2
  }
  if ((normalized.includes('principal') && !normalized.includes('assistant')) || normalized.includes('school head')) return 0
  if (normalized.includes('assistant principal')) return 1
  return 2
}
