import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/utils/supabase'
import { SCHOOLS } from '@/utils/schools'
import styles from './Dashboard.module.css'

const BLANK_FORM = { email: '', last_name: '', first_name: '', middle_name: '', role: 'aoii', school_id: '' }
const SDO_SCHOOL_ID = 'DEFAULT'
const SDO_SCHOOL_NAME = 'Default Organization'

export default function AllowedUsersAdmin() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: fetchErr } = await supabase
      .from('LCMS-allowed-users')
      .select('*')
      .order('created_at', { ascending: false })
    if (fetchErr) setError(fetchErr.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function set(field, val) {
    setForm(current => ({ ...current, [field]: val }))
  }

  function selectRole(role) {
    setForm(current => ({ ...current, role, school_id: role === 'aoii' ? current.school_id : '' }))
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.email.trim() || !form.last_name.trim() || !form.first_name.trim()) {
      setError('DepEd email, family name, and first name are required.')
      return
    }
    if (form.role === 'aoii' && !form.school_id) {
      setError('Select the school for an AOII account.')
      return
    }
    const school = SCHOOLS.find(s => s.id === form.school_id)
    setSaving(true)
    const { error: insertErr } = await supabase.from('LCMS-allowed-users').insert({
      email: form.email.trim().toLowerCase(),
      last_name: form.last_name.trim(),
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      role: form.role,
      school_id: form.role === 'aoii' ? form.school_id : SDO_SCHOOL_ID,
      school_name: form.role === 'aoii' ? (school?.name || null) : SDO_SCHOOL_NAME,
      is_active: true,
      added_by: user?.username || null,
    })
    setSaving(false)
    if (insertErr) { setError(insertErr.message); return }
    setForm(BLANK_FORM)
    load()
  }

  async function toggleActive(row) {
    const { error: updateErr } = await supabase
      .from('LCMS-allowed-users')
      .update({ is_active: !row.is_active })
      .eq('id', row.id)
    if (updateErr) { setError(updateErr.message); return }
    load()
  }

  async function removeRow(row) {
    const displayName = fullName(row) || row.email
    const confirmed = window.confirm(
      row.registered_user_id
        ? `${displayName} has already registered. Removing this entry only revokes future re-registration — it does NOT delete their account. Continue?`
        : `Remove the pending allowance for ${displayName}?`
    )
    if (!confirmed) return
    const { error: deleteErr } = await supabase.from('LCMS-allowed-users').delete().eq('id', row.id)
    if (deleteErr) { setError(deleteErr.message); return }
    load()
  }

  function fullName(row) {
    return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Allowed Users</span>
        </div>

        <form onSubmit={handleAdd} className={styles.toolbar} style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>DepEd Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@deped.gov.ph" style={{ height: 32, fontSize: 12, width: 190 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Family Name</label>
            <input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Dela Cruz" style={{ height: 32, fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>First Name</label>
            <input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Juan" style={{ height: 32, fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Middle Name or Initial</label>
            <input value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Santos or S" style={{ height: 32, fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Role</label>
            <select value={form.role} onChange={e => selectRole(e.target.value)} style={{ height: 32, fontSize: 12 }}>
              <option value="aoii">School (AOII)</option>
              <option value="hrmo">SDO (HRMO)</option>
            </select>
          </div>
          {form.role === 'aoii' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>School</label>
              <select className={styles.schoolSelect} value={form.school_id} onChange={e => set('school_id', e.target.value)} style={{ height: 32, fontSize: 12 }}>
                <option value="">Select a school</option>
                {SCHOOLS.map(school => <option key={school.id} value={school.id}>{school.name} ({school.id})</option>)}
              </select>
            </div>
          )}
          <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Adding…' : '+ Allow'}</button>
        </form>

        {error && <div className={styles.inlineError}>{error}</div>}

        {loading
          ? <div className={styles.emptyState}>Loading…</div>
          : <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Full Name</th><th>Email</th><th>Role</th><th>School</th>
                    <th>Status</th><th>Active</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0
                    ? <tr><td colSpan={7} className={styles.emptyState}>No allowed users yet.</td></tr>
                    : rows.map(row => (
                        <tr key={row.id}>
                          <td className={styles.nameCell}>{fullName(row) || '—'}</td>
                          <td className={styles.subCell}>{row.email}</td>
                          <td>
                            <span
                              className={styles.pill}
                              style={row.role === 'hrmo'
                                ? { background: 'var(--sdo-blue)', color: '#fff' }
                                : { background: 'var(--info-bg)', color: 'var(--info-text)' }}
                            >
                              {row.role === 'hrmo' ? 'SDO (HRMO)' : 'School (AOII)'}
                            </span>
                          </td>
                          <td className={styles.subCell}>{row.school_name || '—'}</td>
                          <td>
                            <span className={`${styles.pill} ${row.registered_user_id ? styles.pillOk : styles.pillWarn}`}>
                              {row.registered_user_id ? 'Registered' : 'Pending'}
                            </span>
                          </td>
                          <td>
                            <button className={row.is_active ? styles.btnSuccessSm : styles.btnDangerSm} onClick={() => toggleActive(row)}>
                              {row.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td>
                            <button className={styles.btnDangerSm} onClick={() => removeRow(row)}>Remove</button>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  )
}
