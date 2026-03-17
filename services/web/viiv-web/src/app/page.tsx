import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>VIIV Commerce Platform</h1>
          <p>
            Launch your online store and manage products, orders, and customers
            from one place.
          </p>
        </div>
        <div className={styles.ctas}>
          <Link className={styles.primary} href="/signup">
            Sign up
          </Link>
          <Link className={styles.secondary} href="/login">
            Login
          </Link>
        </div>
      </main>
    </div>
  );
}
