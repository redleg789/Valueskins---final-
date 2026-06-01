'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { href: '/demo/marketplace', label: 'Marketplace', icon: '' },
    { href: '/valueskins/store', label: 'ValuSkins Store', icon: '' },
    { href: '/leaderboard', label: 'Leaderboard', icon: '' },
    { href: '/profile', label: 'Profile', icon: '' },
    { href: '/referrals', label: 'Referrals', icon: '' },
    { href: '/scoring', label: 'How Scoring Works', icon: '' },
];

export function Navigation() {
    const pathname = usePathname();

    return (
        <nav style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            padding: '1rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backdropFilter: 'blur(10px)',
            background: 'rgba(10, 10, 15, 0.9)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
            <Link href="/" style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textDecoration: 'none',
            }}>
                Valueskins
            </Link>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                {NAV_ITEMS.map(item => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                background: isActive ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                color: isActive ? 'white' : '#a1a1aa',
                                textDecoration: 'none',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s',
                            }}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Link href="/brands/onboarding" style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#a1a1aa',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                }}>
                    For Brands
                </Link>
                <button style={{
                    padding: '0.5rem 1.25rem',
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                }}>
                    Connect Wallet
                </button>
            </div>
        </nav>
    );
}
