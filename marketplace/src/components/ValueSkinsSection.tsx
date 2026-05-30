import { useValueSkinsCredentials } from '@/lib/valueskins/hooks';

interface ValueSkinsSectionProps {
  userId: string | null;
  token: string | null;
}

export default function ValueSkinsSection({ userId, token }: ValueSkinsSectionProps) {
  const { credentials } = useValueSkinsCredentials(userId, token);

  return (
    <div style={{ background: '#2a2a2a', padding: '20px', borderRadius: '8px', border: '1px solid #444', marginBottom: '20px' }}>
      <h3 style={{ marginBottom: '15px' }}>🎖️ ValueSkins Credentials</h3>
      <p style={{ color: '#999', marginBottom: '15px' }}>Verified social media accounts with sticker badges</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {['instagram', 'tiktok', 'youtube', 'twitter'].map(platform => {
          const hasLinked = credentials.some(c => c.platform === platform);
          return (
            <button
              key={platform}
              disabled={hasLinked}
              style={{
                padding: '12px',
                background: hasLinked ? '#1a3a1a' : '#333',
                border: hasLinked ? '1px solid #00cc66' : '1px solid #444',
                borderRadius: '4px',
                color: hasLinked ? '#00cc66' : '#fff',
                cursor: hasLinked ? 'default' : 'pointer',
                fontWeight: 'bold',
              }}
            >
              {hasLinked ? `✓ ${platform.toUpperCase()}` : `+ ${platform.toUpperCase()}`}
            </button>
          );
        })}
      </div>

      {credentials.length > 0 && (
        <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '4px', border: '1px solid #00cc66' }}>
          <h4 style={{ marginBottom: '10px', color: '#00cc66' }}>✓ Verified Accounts</h4>
          <div style={{ display: 'grid', gap: '8px' }}>
            {credentials.map((cred: any) => (
              <div key={cred.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#2a2a2a', borderRadius: '4px' }}>
                <span>{cred.platform?.toUpperCase()}: @{cred.handle}</span>
                <span style={{ color: '#00cc66', fontWeight: 'bold' }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
