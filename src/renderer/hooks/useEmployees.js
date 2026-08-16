import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/utils/supabase'
import { useAuth } from './useAuth'

export function useEmployees() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('leave_employees')
        .select('*')
        .order('last_name', { ascending: true })

      // AOII sees only their school; HRMO sees all
      if (user?.role === 'aoii' && user?.school_id) {
        query = query.eq('school_id', user.school_id)
      }

      const { data, error: err } = await query
      if (err) throw err
      setEmployees(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { if (user) fetch() }, [user, fetch])

  async function addEmployee(emp) {
    const { data, error } = await supabase
      .from('leave_employees')
      .insert([{ ...emp, school_id: user?.school_id || 'DEFAULT' }])
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    setEmployees(prev => [...prev, data].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    return { success: true, data }
  }

  async function updateEmployee(id, updates) {
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
