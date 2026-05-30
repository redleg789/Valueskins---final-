'use client';

export default function ExplorePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '24px',
          padding: '48px 32px',
          textAlign: 'center',
          background: '#0a0a0a',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '6px 12px',
            border: '1px solid rgba(255,255,255,0.24)',
            borderRadius: '999px',
            fontSize: '12px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '20px',
          }}
        >
          Explore
        </div>
        <h1 style={{ margin: '0 0 12px', fontSize: '40px', lineHeight: 1, fontWeight: 800 }}>
          Will be launched soon
        </h1>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.68)', fontSize: '16px', lineHeight: 1.6 }}>
          The explore experience is being prepared and will go live soon.
        </p>
      </div>
    </div>
  );
}
