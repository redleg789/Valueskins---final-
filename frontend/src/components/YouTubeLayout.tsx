'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/*
 * YOUTUBE-SPECIFIC LAYOUT
 * Dark mode with red accents, video-first interface
 * Matches YouTube's design language for video creator marketplace
 */

interface YouTubeLayoutProps {
    children: ReactNode;
    title?: string;
    headerRight?: ReactNode;
    hideHeader?: boolean;
}

export default function YouTubeLayout({ children, title, headerRight, hideHeader }: YouTubeLayoutProps) {
    const pathname = usePathname();

    return (
        <div style={{
            background: '#0f0f0f',
            minHeight: '100vh',
            display: 'flex',
            justifyContent: 'center',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '500px',
                background: '#0f0f0f',
                position: 'relative',
                minHeight: '100vh',
            }}>
                {/* ── Header ──────────────────── */}
                {!hideHeader && (
                    <header style={{
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'sticky',
                        top: 0,
                        background: '#0f0f0f',
                        zIndex: 50,
                        padding: '0 12px',
                    }}>
                        {/* YouTube Logo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{
                                width: 28,
                                height: 20,
                                borderRadius: 4,
                                background: '#ff0000',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <div style={{
                                    width: 0,
                                    height: 0,
                                    borderLeft: '8px solid white',
                                    borderTop: '5px solid transparent',
                                    borderBottom: '5px solid transparent',
                                    marginLeft: 2,
                                }} />
                            </div>
                            <span style={{
                                fontWeight: 700,
                                fontSize: 18,
                                color: '#ffffff',
                                letterSpacing: '-0.5px',
                            }}>
                                {title || 'Valueskins'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {/* Search icon */}
                            <button style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                                    <circle cx="11" cy="11" r="7" />
                                    <line x1="16.65" y1="16.65" x2="21" y2="21" />
                                </svg>
                            </button>
                            {headerRight}
                        </div>
                    </header>
                )}

                {/* ── Content ─────────────────── */}
                <main style={{
                    paddingBottom: 56,
                    minHeight: hideHeader ? '100vh' : 'calc(100vh - 56px)',
                }}>
                    {children}
                </main>

                {/* ── Bottom Navigation ────────── */}
                <nav style={{
                    position: 'fixed',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    maxWidth: 500,
                    height: 52,
                    background: '#212121',
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    zIndex: 50,
                }}>
                    <NavItem href="/feed" active={pathname === '/feed'} label="Home">
                        <HomeIcon filled={pathname === '/feed'} />
                    </NavItem>
                    <NavItem href="/explore" active={pathname === '/explore'} label="Shorts">
                        <ShortsIcon filled={pathname === '/explore'} />
                    </NavItem>
                    {/* Center "Create" button */}
                    <Link href="/store" style={{ textDecoration: 'none' }}>
                        <div style={{
                            width: 40,
                            height: 28,
                            borderRadius: 8,
                            background: pathname === '/store' ? '#ff0000' : 'transparent',
                            border: pathname === '/store' ? 'none' : '1px solid #606060',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </div>
                    </Link>
                    <NavItem href="/marketplace" active={pathname === '/marketplace'} label="Deals">
                        <DealsIcon filled={pathname === '/marketplace'} />
                    </NavItem>
                    <NavItem href="/profile/me" active={pathname.startsWith('/profile')} label="You">
                        <ProfileIcon filled={pathname.startsWith('/profile')} />
                    </NavItem>
                </nav>
            </div>
        </div>
    );
}

function NavItem({ href, active, label, children }: {
    href: string;
    active: boolean;
    label: string;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 12px',
                textDecoration: 'none',
            }}
        >
            <div style={{ color: active ? '#ffffff' : '#aaaaaa' }}>
                {children}
            </div>
            <span style={{
                fontSize: 9,
                marginTop: 2,
                color: active ? '#ffffff' : '#aaaaaa',
                fontWeight: active ? 500 : 400,
            }}>
                {label}
            </span>
        </Link>
    );
}

/* ── SVG Nav Icons (YouTube-style) ──────── */

function HomeIcon({ filled }: { filled: boolean }) {
    if (filled) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 21V10L12 3L20 10V21H14V14H10V21H4Z" />
            </svg>
        );
    }
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 21V10L12 3L20 10V21H14V14H10V21H4Z" />
        </svg>
    );
}

function ShortsIcon({ filled }: { filled: boolean }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
            <path d="M10 14.65V9.35L15 12L10 14.65ZM17.77 10.32L18.8 10.58C19.25 10.69 19.6 11.01 19.73 11.43L20.44 13.64C20.55 14 20.45 14.39 20.19 14.65L19.56 15.28C19.4 15.44 19.36 15.69 19.47 15.9L20.35 17.66C20.44 17.85 20.4 18.07 20.25 18.22L18.91 19.56C18.69 19.78 18.35 19.82 18.09 19.66L16.06 18.38C15.87 18.26 15.63 18.26 15.44 18.37L13.36 19.59C13.11 19.74 12.79 19.7 12.58 19.49L11.24 18.15C11.09 18 11.05 17.78 11.14 17.59L12.02 15.83C12.13 15.62 12.09 15.37 11.93 15.21L11.3 14.58C11.04 14.32 10.94 13.93 11.05 13.57L11.76 11.36C11.89 10.94 12.24 10.62 12.69 10.51L13.72 10.25C13.97 10.19 14.18 10.03 14.29 9.8L15.02 8.17C15.16 7.85 15.49 7.65 15.84 7.65H16.68C17.03 7.65 17.36 7.85 17.5 8.17L18.23 9.8C18.34 10.03 18.55 10.19 18.8 10.25L17.77 10.32Z" />
        </svg>
    );
}

function DealsIcon({ filled }: { filled: boolean }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}>
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function ProfileIcon({ filled }: { filled: boolean }) {
    if (filled) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20C4 16 7.58 14 12 14C16.42 14 20 16 20 20H4Z" />
            </svg>
        );
    }
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20C4 16 7.58 14 12 14C16.42 14 20 16 20 20" />
        </svg>
    );
}
