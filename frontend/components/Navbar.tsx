'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Search, LayoutDashboard, Zap } from 'lucide-react';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { href: '/',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/documents',  label: 'Documents',  icon: FileText },
  { href: '/search',     label: 'Search',     icon: Search },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <Zap size={16} />
          </div>
          <span className={styles.logoText}>
            Docu<span className={styles.logoAccent}>Pulse</span>
          </span>
          <span className={styles.logoBadge}>AI</span>
        </Link>

        {/* Nav links */}
        <ul className={styles.links}>
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`${styles.link} ${isActive ? styles.linkActive : ''}`}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* CTA */}
        <Link href="/documents" className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
          Upload Doc
        </Link>
      </div>
    </nav>
  );
}
