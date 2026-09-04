import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import styles from "./LoginPage.module.css";
import lcmsLogo from "../../image/LCMS.png";

export default function AdminLoginPage({ onBack, onAdminLoggedIn }) {
  const { login, logout, loading, error, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");
    clearError();
    const result = await login(username.trim(), password);
    if (!result.success) return;
    if (result.role && result.role !== "hrmo") {
      await logout();
      setLocalError("This entrance is for administrator accounts only.");
      return;
    }
    onAdminLoggedIn?.();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.rings}>
        <div className={styles.ring1} />
        <div className={styles.ring2} />
        <div className={styles.ring3} />
      </div>

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <img className={styles.logo} src={lcmsLogo} alt="LCMS — Leave Credits Management System" />
        </div>

        <div className={styles.header}>
          <p className={styles.sub2}>Administrator Access</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="admin-username">Username</label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="admin-password">Password</label>
            <div className={styles.passWrap}>
              <input
                id="admin-password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {(localError || error) && (
            <div className={styles.errorBox} role="alert">
              {localError || error}
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className={styles.registrationHint}>
          <button type="button" onClick={onBack} style={{ background: "none", border: 0, color: "var(--sdo-blue)", cursor: "pointer", font: "inherit" }}>
            ← Back
          </button>
        </p>
      </div>
    </div>
  );
}
