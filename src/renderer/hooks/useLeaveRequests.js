import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useAuth } from './useAuth'

const REQUEST_SELECT = `
  *,
  employee:leave_employees!employee_id (
    id, employee_no, first_name, middle_name, last_name, position,
    emp_type, school_id, vl_used, sl_used, vl_override, sl_override,
    vsc_balance, vsc_used, hired_date, protected_vl_balance
  )
`

export function useLeaveRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchRequests = useCallback(async ({ silent = false } = {}) => {
    if (!user || user.diagnostic) {
      setRequests([])
      return
    }
    if (!silent) setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('leave_requests')
        .select(REQUEST_SELECT)
        .order('created_at', { ascending: false })

      if (user.role === 'aoii') query = query.eq('school_id', user.school_id)
      const { data, error: requestError } = await query
      if (requestError) throw requestError
      setRequests(data || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchRequests()
    const timer = window.setInterval(() => fetchRequests({ silent: true }), 30000)
    const handleOnline = () => fetchRequests({ silent: true })
    window.addEventListener('online', handleOnline)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', handleOnline)
    }
  }, [fetchRequests])

  async function submitRequest(request) {
    if (user?.diagnostic) return { success: false, error: 'Diagnostic users cannot submit online requests.' }
    const payload = {
      ...request,
      requested_by_user: user.id,
      requested_by: user.username,
      status: 'pending'
    }
    const { data, error: requestError } = await supabase
      .from('leave_requests')
      .insert(payload)
      .select(REQUEST_SELECT)
      .single()
    if (requestError) return { success: false, error: requestError.message }
    setRequests(current => [data, ...current])
    return { success: true, data }
  }

  async function approveRequest(id) {
    const { error: approvalError } = await supabase.rpc('lcms_approve_leave_request', {
      request_uuid: id,
      form6_is_confirmed: true
    })
    if (approvalError) return { success: false, error: approvalError.message }
    await fetchRequests({ silent: true })
    return { success: true }
  }

  async function rejectRequest(id, reason) {
    const { error: rejectionError } = await supabase.rpc('lcms_reject_leave_request', {
      request_uuid: id,
      rejection_note: reason || 'Not approved'
    })
    if (rejectionError) return { success: false, error: rejectionError.message }
    await fetchRequests({ silent: true })
    return { success: true }
  }

  async function cancelMandatoryRequest(id, reason) {
    const { error: cancellationError } = await supabase.rpc('lcms_cancel_mandatory_leave', {
      request_uuid: id,
      cancellation_note: reason || 'Cancelled by employee'
    })
    if (cancellationError) return { success: false, error: cancellationError.message }
    await fetchRequests({ silent: true })
    return { success: true }
  }

  return { requests, loading, error, fetchRequests, submitRequest, approveRequest, rejectRequest, cancelMandatoryRequest }
}
