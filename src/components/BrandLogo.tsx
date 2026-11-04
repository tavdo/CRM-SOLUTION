import Image from "next/image";
import styles from "./BrandLogo.module.css";

export function BrandLogo({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <span className={`${styles.brand} ${compact ? styles.compact : ""}`}>
      <Image src="/images/crm-logo.png" alt="" width={52} height={52} className={styles.image} unoptimized />
      {!compact && <span className={styles.name}>{name}</span>}
    </span>
  );
}
