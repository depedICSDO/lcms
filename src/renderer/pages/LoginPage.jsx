import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { login, register, loading, error, clearError } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");
    setNotice("");

    if (mode === "register") {
      if (password.length < 8) {
        setLocalError("Password must contain at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match.");
        return;
      }

      const result = await register({ username, email, password, fullName });
      if (result.success) {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setNotice(result.requiresEmailConfirmation
          ? "Registration successful. Confirm your email, then sign in."
          : "Registration successful. You can now sign in.");
      }
      return;
    }

    await login(username.trim(), password);
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setLocalError("");
    setNotice("");
    clearError();
  }

  return (
    <div className={styles.wrap}>
      {/* Animated background rings */}
      <div className={styles.rings}>
        <div className={styles.ring1} />
        <div className={styles.ring2} />
        <div className={styles.ring3} />
      </div>

      <div className={styles.card}>
        {/* Seal */}
        <div className={styles.sealWrap}>
          <div className={styles.seal}>
            <span className={styles.sealInner}>DepEd</span>
          </div>
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>Leave Credits Management System (LCMS)</h1>
          <p className={styles.sub}>Personnel Leave Management</p>
          <p className={styles.sub2}>
            Secure leave records and credit tracking
          </p>
        </div>

        <div className={styles.modeTabs}>
          <button type="button" className={mode === "login" ? styles.modeActive : ""} onClick={() => switchMode("login")}>Sign In</button>
          <button type="button" className={mode === "register" ? styles.modeActive : ""} onClick={() => switchMode("register")}>Register</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === "register" && (
            <>
              <div className={styles.field}>
                <label htmlFor="fullName">Full Name</label>
                <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="email">Approved Email</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your approved email" required />
              </div>
            </>
          )}
          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
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
            <label htmlFor="password">Password</label>
            <div className={styles.passWrap}>
              <input
                id="password"
                type={showPass ? "text" : "password"}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
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

          {mode === "register" && (
            <div className={styles.field}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" type={showPass ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required />
            </div>
          )}

          {(localError || error) && (
            <div className={styles.errorBox} role="alert">
              {localError || error}
            </div>
          )}

          {notice && <div className={styles.successBox} role="status">{notice}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (mode === "register" ? "Registering…" : "Signing in…") : (mode === "register" ? "Register" : "Sign In")}
          </button>
        </form>

        {mode === "register" && (
          <p className={styles.registrationHint}>Registration is limited to users pre-approved by the IECES dashboard manager.</p>
        )}

        <div className={styles.footer}>
          Leading with Compassionate and Modernized Services · v{__APP_VERSION__ || "1.0.0"}
        </div>
      </div>
    </div>
  );
}
