import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/utils/supabase'
import {
  cacheLocalEmployees,
  cacheLocalTransactions,
  createLocalId,
  deleteLocalEmployee,
  hasLocalDatabase,
  listLocalEmployees,
  listLocalTransactions,
  saveLocalEmployee,
  syncPendingChanges
} from '@/utils/dataStore'
import { useAuth } from './useAuth'

export function useEmployees() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    let localRecords = []
    try {
      if (hasLocalDatabase()) {
        localRecords = await listLocalEmployees(user)
        const localTransactions = await listLocalTransactions(user)
        localRecords = localRecords.map(employee => ({
          ...employee,
          leave_transactions: localTransactions.filter(transaction => transaction.employee_id === employee.id)
        }))
        if (localRecords.length) setEmployees(localRecords)
        await syncPendingChanges()
      }

      let query = supabase
        .from('leave_employees')
        .select('*')
        .order('last_name', { ascending: true })

      // AOII sees only their school; HRMO sees all
      if (user?.role === 'aoii' && !user?.diagnostic && user?.school_id) {
        query = query.eq('school_id', user.school_id)
      }

      const { data, error: err } = await query
      if (err) throw err
      let employeesWithCto = data || []
      const { data: ctoRows, error: ctoError } = await supabase
        .from('leave_cto_credits')
        .select('*')
        .order('expires_on', { ascending: true })
      if (!ctoError) {
        employeesWithCto = employeesWithCto.map(employee => ({
          ...employee,
          cto_credits: (ctoRows || []).filter(credit => credit.employee_id === employee.id)
        }))
      }
      let transactionQuery = supabase.from('leave_transactions').select('*').order('created_at', { ascending: false })
      if (user?.role === 'aoii' && !user?.diagnostic && user?.school_id) {
        transactionQuery = transactionQuery.eq('school_id', user.school_id)
      }
      const { data: transactions, error: transactionError } = await transactionQuery
      if (!transactionError) {
        employeesWithCto = employeesWithCto.map(employee => ({
          ...employee,
          leave_transactions: (transactions || []).filter(transaction => transaction.employee_id === employee.id)
        }))
      }
      if (hasLocalDatabase()) {
        await cacheLocalEmployees(employeesWithCto, user)
        if (!transactionError) await cacheLocalTransactions(transactions || [], user)
        const cachedEmployees = await listLocalEmployees(user)
        const cachedTransactions = await listLocalTransactions(user)
        setEmployees(cachedEmployees.map(employee => ({
          ...employee,
          leave_transactions: cachedTransactions.filter(transaction => transaction.employee_id === employee.id)
        })))
      } else {
        setEmployees(employeesWithCto)
      }
    } catch (err) {
      if (!localRecords.length) setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { if (user) fetch() }, [user, fetch])

  useEffect(() => {
    window.addEventListener('online', fetch)
    return () => window.removeEventListener('online', fetch)
  }, [fetch])

  async function addEmployee(emp) {
    const now = new Date().toISOString()
    const localEmployee = {
      ...emp,
      id: emp.id || createLocalId(),
      school_id: user?.school_id || 'DEFAULT',
      created_at: emp.created_at || now,
      updated_at: now
    }

    if (hasLocalDatabase()) {
      await saveLocalEmployee(localEmployee)
      setEmployees(prev => [...prev, localEmployee].sort((a, b) => a.last_name.localeCompare(b.last_name)))
      const sync = await syncPendingChanges()
      return { success: true, data: localEmployee, pendingSync: sync.pending > 0 }
    }

    const { data, error } = await supabase
      .from('leave_employees')
      .insert([localEmployee])
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    setEmployees(prev => [...prev, data].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    return { success: true, data }
  }

  async function updateEmployee(id, updates) {
    const current = employees.find(employee => employee.id === id)
    const localEmployee = { ...current, ...updates, id, updated_at: new Date().toISOString() }

    if (hasLocalDatabase()) {
      await saveLocalEmployee(localEmployee)
      setEmployees(prev => prev.map(employee => employee.id === id ? localEmployee : employee))
      const sync = await syncPendingChanges()
      return { success: true, data: localEmployee, pendingSync: sync.pending > 0 }
    }

    const { data, error } = await supabase
      .from('leave_employees')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    setEmployees(prev => prev.map(e => e.id === id ? data : e))
    return { success: true, data }
  }

  async function deleteEmployee(id) {
    if (hasLocalDatabase()) {
      await deleteLocalEmployee(id)
      setEmployees(prev => prev.filter(employee => employee.id !== id))
      const sync = await syncPendingChanges()
      return { success: true, pendingSync: sync.pending > 0 }
    }

    const { error } = await supabase
      .from('leave_employees')
      .delete()
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    setEmployees(prev => prev.filter(e => e.id !== id))
    return { success: true }
  }

  return { employees, loading, error, fetch, addEmployee, updateEmployee, deleteEmployee }
}
