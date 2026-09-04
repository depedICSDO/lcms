import test from 'node:test'
import assert from 'node:assert/strict'
import { employeeNumber, employeeTin, formatTin, formatTinInput, normalizeTin, personnelFullName, personnelLeadershipPriority } from './personnel.js'

test('formats a PSIPOP TIN without its trailing branch code', () => {
  assert.equal(formatTin('950882949000'), '950-882-949')
  assert.equal(formatTin('950-882-949'), '950-882-949')
  assert.equal(normalizeTin('950882949000'), '950882949')
  assert.equal(normalizeTin('950-882-949'), '950882949')
  assert.equal(formatTin('N/A'), '—')
})

test('formats TIN progressively during input', () => {
  assert.equal(formatTinInput('9508'), '950-8')
  assert.equal(formatTinInput('950882949'), '950-882-949')
  assert.equal(formatTinInput('950882949000'), '950-882-949')
})

test('separates a legacy PSIPOP TIN from employee number', () => {
  const employee = { employee_no: '921731907000', tin_number: null }
  assert.equal(employeeNumber(employee), '')
  assert.equal(employeeTin(employee), '921731907')
  assert.equal(formatTin(employeeTin(employee)), '921-731-907')
  assert.equal(employeeNumber({ employee_no: '6450497' }), '6450497')
})

test('formats a complete personnel name', () => {
  assert.equal(personnelFullName({ last_name: 'Bazan', first_name: 'Jonybhee', middle_name: 'Alabat' }), 'Bazan, Jonybhee Alabat')
})

test('prioritizes school and division leaders correctly', () => {
  assert.equal(personnelLeadershipPriority('School Principal I'), 0)
  assert.equal(personnelLeadershipPriority('Assistant Principal I'), 1)
  assert.equal(personnelLeadershipPriority('Head Teacher VI'), 2)
  assert.equal(personnelLeadershipPriority('Schools Division Superintendent', true), 0)
  assert.equal(personnelLeadershipPriority('Assistant Schools Division Superintendent', true), 1)
  assert.equal(personnelLeadershipPriority('Administrative Officer V', true), 2)
})
