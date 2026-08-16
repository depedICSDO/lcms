import test from 'node:test'
import assert from 'node:assert/strict'

import {
  generateAccrualLog,
  LEAVE_TYPES_NONTEACHING,
  LEAVE_TYPES_TEACHING,
  monthsOfService,
  POSITIONS_NONTEACHING,
  requiresForcedLeave,
  slBalance,
  vlBalance,
  vscBalance,
} from './leaveCalc.js'

test('calculates non-teaching balances using database field names', () => {
  const employee = {
    emp_type: 'Non-Teaching',
    hired_date: '2025-01-15',
    vl_used: 2,
    sl_used: 1,
  }

  assert.equal(vlBalance(employee, new Date('2026-01-15')), 13)
  assert.equal(slBalance(employee, new Date('2026-01-15')), 14)
  assert.equal(requiresForcedLeave(employee), true)
})

test('reads teaching VSC balances using the database employee type', () => {
  assert.equal(vscBalance({ emp_type: 'Teaching', vsc_balance: 12.5 }), 12.5)
})

test('uses hired_date when generating accrual history', () => {
  const log = generateAccrualLog({ emp_type: 'Non-Teaching', hired_date: '2999-01-01' }, 1)
  assert.equal(log[0].vl, 0)
  assert.equal(log[0].sl, 0)
})

test('handles invalid dates without returning NaN', () => {
  assert.equal(monthsOfService('', new Date('2026-01-01')), 0)
})

test('includes Wellness Leave for teaching and non-teaching personnel', () => {
  assert.ok(LEAVE_TYPES_TEACHING.some(type => type.key === 'wellness'))
  assert.ok(LEAVE_TYPES_NONTEACHING.some(type => type.key === 'wellness'))
})

test('includes core and newly created SDO plantilla positions', () => {
  for (const position of [
    'Schools Division Superintendent',
    'Chief Education Supervisor',
    'Information Technology Officer I',
    'Attorney III',
    'Legal Assistant I',
    'Administrative Officer IV',
    'Administrative Officer II',
  ]) {
    assert.ok(POSITIONS_NONTEACHING.includes(position), `${position} is missing`)
  }
})
