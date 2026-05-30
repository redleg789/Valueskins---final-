'use client';

import Link from 'next/link';

interface TopNavProps {
  userName?: string;
  unreadMessages?: number;
  unreadNotifications?: number;
  onProfileClick?: () => void;
  onMessagesClick?: () => void;
  onNotificationsClick?: () => void;
}

export default function TopNav({
  userName = 'Creator',
  unreadMessages = 0,
  unreadNotifications = 0,
  onProfileClick,
  onMessagesClick,
  onNotificationsClick,
}: TopNavProps) {
  return (
    <nav
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        borderRadius: '8px',
      }}
    >
      {/* Left - Home button and Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/" passHref>
          <a style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
            Home
          </a>
        </Link>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>
          ValueSkins
        </div>
      </div>

      {/* Center - Search */}
      <input
        type="text"
        placeholder="Search deals, brands..."
        style={{
          maxWidth: '300px',
          padding: '10px 16px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />

      {/* Right - Icons & Menu */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        {/* Notifications */}
        <button
          onClick={onNotificationsClick}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            position: 'relative',
          }}
          title="Notifications"
        >
          🔔
          {unreadNotifications > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: '#ef4444',
                color: '#ffffff',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 600,
              }}
            >
              {unreadNotifications}
            </span>
          )}
        </button>

        {/* Messages */}
        <button
          onClick={onMessagesClick}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            position: 'relative',
          }}
          title="Messages"
        >
          💬
          {unreadMessages > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: '#ef4444',
                color: '#ffffff',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 600,
              }}
            >
              {unreadMessages}
            </span>
          )}
        </button>

        {/* Profile Menu */}
        <button
          onClick={onProfileClick}
          style={{
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#1f2937',
            cursor: 'pointer',
          }}
        >
          👤 {userName}
        </button>
      </div>
    </nav>
  );
}
