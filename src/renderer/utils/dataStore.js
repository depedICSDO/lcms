import { supabase } from './supabase'

function api() {
  return window.electronAPI
}

export function hasLocalDatabase() {
  return typeof window !== 'undefined' && Boolean(api()?.listLocalEmployees)
}

export async function listLocalEmployees(user) {
  if (!hasLocalDatabase()) return []
  return api().listLocalEmployees({
    schoolId: user?.role === 'aoii' && !user?.diagnostic ? user.school_id : undefined
  })
}

export async function listLocalTransactions(user) {
  if (!hasLocalDatabase() || !api()?.listLocalTransactions) return []
  return api().listLocalTransactions({
    schoolId: user?.role === 'aoii' && !user?.diagnostic ? user.school_id : undefined
  })
}

export async function cacheLocalEmployees(employees, user) {
  if (!hasLocalDatabase()) return
  await api().cacheLocalEmployees({
    employees,
    schoolId: user?.role === 'aoii' && !user?.diagnostic ? user.school_id : undefined
  })
}

export async function cacheLocalTransactions(transactions, user) {
  if (!hasLocalDatabase()) return
  await api().cacheLocalTransactions({
    transactions,
    schoolId: user?.role === 'aoii' && !user?.diagnostic ? user.school_id : undefined
  })
}

export async function saveLocalEmployee(employee) {
  if (!hasLocalDatabase()) return
  await api().saveLocalEmployee(employee)
}

export async function deleteLocalEmployee(id) {
  if (!hasLocalDatabase()) return
  await api().deleteLocalEmployee(id)
}

export async function recordLocalLeave(transaction, employee) {
  if (!hasLocalDatabase()) return
  await api().recordLocalLeave({ transaction, employee })
}

export async function syncPendingChanges() {
  if (!hasLocalDatabase() || !navigator.onLine) return { synced: 0, pending: 0 }

  const changes = await api().getPendingChanges()
  let synced = 0

  for (const change of changes) {
    try {
      let entity
      if (change.entity_type === 'employee' && change.operation === 'upsert') {
        const {
          cto_credits: _localCtoCredits,
          leave_transactions: _localTransactions,
          ...employeePayload
        } = change.payload
        const { data, error } = await supabase
          .from('leave_employees')
          .upsert(employeePayload, { onConflict: 'id' })
          .select()
          .single()
        if (error) throw error
        entity = { type: 'employee', data }
      } else if (change.entity_type === 'employee' && change.operation === 'delete') {
        const { error } = await supabase.from('leave_employees').delete().eq('id', change.entity_id)
        if (error) throw error
      } else if (change.entity_type === 'transaction' && change.operation === 'insert') {
        const { data, error } = await supabase
          .from('leave_transactions')
          .insert(change.payload)
          .select()
          .single()
        if (error && error.code !== '23505') throw error
        if (data) entity = { type: 'transaction', data }
      }

      await api().resolvePendingChange({ queueId: change.id, entity })
      synced += 1
    } catch {
      // Keep failed operations queued for the next online synchronization.
    }
  }

  return { synced, pending: changes.length - synced }
}

export function createLocalId() {
  return crypto.randomUUID()
}
