import styles from './SplashScreen.module.css'

export default function SplashScreen() {
  return (
    <div className={styles.wrap}>
      <div className={styles.seal}>
        <div className={styles.ring1} />
        <div className={styles.ring2} />
        <div className={styles.inner}>DepEd</div>
      </div>
      <p className={styles.label}>Leave Credits System</p>
      <p className={styles.sub}>Loading…</p>
    </div>
  )
}
