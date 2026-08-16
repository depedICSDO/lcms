import {
  vlBalance,
  slBalance,
  vscBalance,
  totalEarned,
  monthsOfService,
  vscMaxDays,
  generateAccrualLog,
  fmt,
} from "@/utils/leaveCalc";
import styles from "../HRMO/Modal.module.css";

export default function EmployeeDetailModal({ employee, onClose }) {
  const isTeaching = employee.emp_type === "Teaching";
  const months = monthsOfService(employee.hired_date);
  const vl = vlBalance(employee);
  const sl = slBalance(employee);
  const vsc = vscBalance(employee);
  const earned = totalEarned(employee.hired_date);
  const accrualLog = !isTeaching ? generateAccrualLog(employee, 6) : [];
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
                color: isTeaching ? "#7B1C1C" : "#0c447c",
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
              {employee.position} · {months} months served
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
                      background: "#7B1C1C",
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

              <div className={styles.dividerLabel}>
                Accrual History (last 6 months)
              </div>
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
            🖨 Print
          </button>
        </div>
      </div>
    </div>
  );
}
