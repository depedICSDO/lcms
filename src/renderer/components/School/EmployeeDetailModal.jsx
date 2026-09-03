import {
  vlBalance,
  slBalance,
  vscBalance,
  totalEarned,
  yearsOfService,
  vscMaxDays,
  generateAccrualLog,
  fmt,
  protectedVlBalance,
  retirementLeaveMonths,
  ctoBalance,
  ctoCredits,
  LEAVE_TYPES_NONTEACHING,
  leaveAvailability,
  mandatoryLeaveCompliance,
} from "@/utils/leaveCalc";
import { schoolNameById } from "@/utils/schools";
import styles from "../HRMO/Modal.module.css";

export default function EmployeeDetailModal({ employee, onClose }) {
  const isTeaching = employee.emp_type === "Teaching";
  const years = yearsOfService(employee.hired_date);
  const transactions = [...(employee.leave_transactions || [])].sort((a, b) =>
    String(b.created_at || b.date_from || '').localeCompare(String(a.created_at || a.date_from || '')),
  );
  const vl = vlBalance(employee);
  const sl = slBalance(employee);
  const vsc = vscBalance(employee);
  const earned = totalEarned(employee.hired_date);
  const accrualLog = !isTeaching ? generateAccrualLog(employee, 6) : [];
  const protectedVl = protectedVlBalance(employee);
  const mandatoryCompliance = !isTeaching ? mandatoryLeaveCompliance(employee) : null;
  const annualLeaveTypes = !isTeaching
    ? ['special_privilege', 'mandatory_forced', 'wellness'].map(key =>
        LEAVE_TYPES_NONTEACHING.find(type => type.key === key)).filter(Boolean)
    : [];
  const vscPct = isTeaching
    ? Math.min(
        100,
        Math.round(
          ((employee.vsc_balance || 0) / (employee.vsc_max || 15)) * 100,
        ),
      )
    : 0;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>
            {employee.last_name}, {employee.first_name} — Leave Details
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* Header info */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                background: isTeaching ? "#fdf4f4" : "#EBF3FC",
                color: isTeaching ? "var(--sdo-red-dark)" : "var(--sdo-blue)",
              }}
            >
              {employee.emp_type}
            </span>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                background: "#EAF3DE",
                color: "#3B6D11",
              }}
            >
              {employee.emp_status}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                alignSelf: "center",
              }}
            >
              {employee.position} · {years} year(s) in service
              {employee.assigned_school_id ? ` · ${schoolNameById(employee.assigned_school_id)}` : ''}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div className={styles.balCard}>
              <div className={styles.balLabel}>Date Hired</div>
              <div style={{ fontWeight: 500 }}>{employee.hired_date}</div>
            </div>
            <div className={styles.balCard}>
              <div className={styles.balLabel}>Employee No.</div>
              <div style={{ fontWeight: 500 }}>
                {employee.employee_no || "—"}
              </div>
            </div>
          </div>

          {employee.retirement_date && <div className={`${styles.infoBox} ${styles.infoBoxBlue}`}>
            <strong>Retirement / resignation documented:</strong> {employee.retirement_date}
            {employee.retirement_notes ? ` · ${employee.retirement_notes}` : ''}. The year-end mandatory-leave forfeiture is exempt for that calendar year and the event remains in the audit history.
          </div>}

          {isTeaching ? (
            <>
              <div className={styles.dividerLabel}>
                Vacation Service Credits (VSC)
              </div>
              <div className={styles.infoBox}>
                Teaching personnel are not entitled to VL/SL (CSC MC 41 s.1998 /
                RA 4670). VSC is earned for authorized activities during school
                breaks and encoded by HRMO (DepEd Order 013, s. 2024).
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <div className={styles.balCard}>
                  <div className={styles.balLabel}>VSC Balance</div>
                  <div className={styles.balVal}>{fmt(vsc)}</div>
                </div>
                <div className={styles.balCard}>
                  <div className={styles.balLabel}>VSC Used</div>
                  <div
                    style={{ fontSize: 18, fontWeight: 500, color: "#A32D2D" }}
                  >
                    {fmt(employee.vsc_used || 0)}
                  </div>
                </div>
                <div className={styles.balCard}>
                  <div className={styles.balLabel}>Earned This SY</div>
                  <div
                    style={{ fontSize: 18, fontWeight: 500, color: "#3B6D11" }}
                  >
                    {fmt(employee.vsc_earned_this_sy || 0)}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  VSC utilization — {vscPct}% of max {employee.vsc_max} days
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: "var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 4,
                      background: "var(--sdo-blue)",
                      width: `${vscPct}%`,
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.dividerLabel}>
                Vacation Leave (VL) — 1.25 days/month
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <div className={styles.balCard}>
                  <div className={styles.balLabel}>Total Earned</div>
                  <div
                    style={{ fontSize: 16, fontWeight: 500, color: "#3B6D11" }}
                  >
                    +{fmt(earned)}
                  </div>
                </div>
                <div className={styles.balCard}>
                  <div className={styles.balLabel}>VL Used</div>
                  <div
                    style={{ fontSize: 16, fontWeight: 500, color: "#A32D2D" }}
                  >
                    −{fmt(employee.vl_used || 0)}
                  </div>
                </div>
                <div className={styles.balCard}>
                  <div className={styles.balLabel}>VL Balance</div>
                  <div className={styles.balVal}>{fmt(vl)}</div>
                </div>
              </div>

              <div className={styles.dividerLabel}>
                Sick Leave (SL) — 1.25 days/month
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <div className={styles.balCard}>
                  <div className={styles.balLabel}>Total Earned</div>
                  <div
                    style={{ fontSize: 16, fontWeight: 500, color: "#3B6D11" }}
                  >
                    +{fmt(earned)}
                  </div>
                </div>
                <div className={styles.balCard}>
                  <div className={styles.balLabel}>SL Used</div>
                  <div
                    style={{ fontSize: 16, fontWeight: 500, color: "#A32D2D" }}
                  >
                    −{fmt(employee.sl_used || 0)}
                  </div>
                </div>
                <div className={styles.balCard}>
                  <div className={styles.balLabel}>SL Balance</div>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{fmt(sl)}</div>
                </div>
              </div>

              <div className={styles.dividerLabel}>Legacy Protected VL</div>
              <div className={styles.infoBox}>
                {fmt(protectedVl)} legacy protected day(s) are usable for leave and retirement, but cannot be monetized.
                New signing-authority cancellations restore the exact deduction to its original regular/protected VL source.
                At 22 working days per month, this equals {fmt(retirementLeaveMonths(employee))} month(s) of retirement leave.
              </div>

              <div className={styles.dividerLabel}>Annual Leave Entitlements ({new Date().getFullYear()})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {annualLeaveTypes.map(type => {
                  const availability = leaveAvailability(type, employee)
                  if (type.key === 'mandatory_forced') return <div className={styles.balCard} key={type.key}>
                    <div className={styles.balLabel}>{type.label}</div>
                    <div className={styles.balVal}>{mandatoryCompliance.retirementExempt ? 'Exempt' : `${fmt(mandatoryCompliance.remaining)} left`}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                      {fmt(mandatoryCompliance.used)} VL used · {fmt(mandatoryCompliance.authorityCancelled)} authority-cancelled · {fmt(mandatoryCompliance.forfeited)} forfeited
                      {mandatoryCompliance.monetized > 0 ? ` · ${fmt(mandatoryCompliance.monetized)} monetized` : ''}
                    </div>
                  </div>
                  return <div className={styles.balCard} key={type.key}>
                    <div className={styles.balLabel}>{type.label}</div>
                    <div className={styles.balVal}>{fmt(availability.remaining)} left</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                      {fmt(availability.used)} used of {fmt(type.annualEntitlement)} · {type.deduction}
                    </div>
                  </div>
                })}
              </div>

              <div className={styles.dividerLabel}>Accrual History (last 6 months)</div>
              {accrualLog.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 0",
                    borderBottom: "0.5px solid var(--border)",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {row.month}
                  </span>
                  {row.vl > 0 ? (
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 20,
                        background: "#EAF3DE",
                        color: "#3B6D11",
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      +{row.vl} VL · +{row.sl} SL
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 20,
                        background: "var(--surface-1)",
                        color: "var(--text-muted)",
                        fontSize: 11,
                      }}
                    >
                      Not yet hired
                    </span>
                  )}
                </div>
              ))}
            </>
          )}

          <div className={styles.dividerLabel}>Compensatory Time Off (CTO)</div>
          <div className={styles.infoBox}>Active balance: <strong>{fmt(ctoBalance(employee))} day(s)</strong>. Each grant is automatically forfeited on its one-year expiration date.</div>
          {ctoCredits(employee).filter(credit => credit.remaining_days > 0).map(credit => (
            <div key={credit.id || credit.expires_on} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12, background: !credit.expired && credit.daysUntilExpiry <= 14 ? 'var(--danger-bg)' : 'transparent' }}>
              <span>{fmt(credit.remaining_days)} day(s) · Credited {credit.granted_on || '—'}</span>
              <span style={{ color: credit.expired || credit.daysUntilExpiry <= 14 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: credit.daysUntilExpiry <= 14 ? 600 : 400 }}>
                {credit.expired ? 'Forfeited' : `Expires ${credit.expires_on}${credit.daysUntilExpiry <= 14 ? ` (${credit.daysUntilExpiry} day(s) left)` : ''}`}
              </span>
            </div>
          ))}

          <div className={styles.dividerLabel}>Complete Leave Credit History</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr><th style={{ textAlign: 'left', padding: 6 }}>Recorded</th><th style={{ textAlign: 'left', padding: 6 }}>Leave / Credit</th><th style={{ textAlign: 'left', padding: 6 }}>Transaction</th><th style={{ textAlign: 'right', padding: 6 }}>Days</th><th style={{ textAlign: 'left', padding: 6 }}>Leave Dates</th><th style={{ textAlign: 'left', padding: 6 }}>Remarks</th></tr>
              </thead>
              <tbody>
                {transactions.length === 0
                  ? <tr><td colSpan="6" style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)' }}>No leave credit transactions recorded.</td></tr>
                  : transactions.map(transaction => {
                      const days = Number(transaction.days || 0)
                      return <tr key={transaction.id} style={{ borderTop: '0.5px solid var(--border)' }}>
                        <td style={{ padding: 6 }}>{String(transaction.created_at || '').slice(0, 10) || '—'}</td>
                        <td style={{ padding: 6 }}>{transaction.leave_type || '—'}</td>
                        <td style={{ padding: 6 }}>{transaction.txn_type?.replaceAll('_', ' ') || '—'}</td>
                        <td style={{ padding: 6, textAlign: 'right', color: days < 0 ? 'var(--danger)' : 'var(--success)' }}>{days > 0 ? '+' : ''}{fmt(days)}</td>
                        <td style={{ padding: 6 }}>{transaction.date_from || '—'}{transaction.date_to && transaction.date_to !== transaction.date_from ? ` – ${transaction.date_to}` : ''}</td>
                        <td style={{ padding: 6 }}>{transaction.remarks || transaction.reason || '—'}</td>
                      </tr>
                    })}
              </tbody>
            </table>
          </div>

          {employee.notes && (
            <>
              <div className={styles.dividerLabel}>Notes</div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  padding: "8px 12px",
                  background: "var(--surface-1)",
                  borderRadius: "var(--radius)",
                }}
              >
                {employee.notes}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onClose}>
            Close
          </button>
          <button className={styles.btnSave} onClick={() => window.print()}>
            Print Employee History
          </button>
        </div>
      </div>
    </div>
  );
}
