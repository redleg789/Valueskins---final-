import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'creator' | 'brand'>('creator');

  const handleLogin = async () => {
    if (!name || !email) {
      alert('Fill all fields');
      return;
    }

    try {
      // Call ValueSkins backend
      const response = await fetch('http://localhost:8000/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('user_name', name);
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_role', role);
        router.push('/home');
      } else {
        alert('Login failed');
      }
    } catch (err) {
      // Fallback: local auth
      localStorage.setItem('token', 'local_' + Date.now());
      localStorage.setItem('user_id', 'user_' + Date.now());
      localStorage.setItem('user_name', name);
      localStorage.setItem('user_email', email);
      localStorage.setItem('user_role', role);
      router.push('/home');
    }
  };

  return (
    <div style={{ background: '#1a1a1a', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
        <h1 style={{ marginBottom: '30px' }}>ValueSkins Marketplace</h1>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          style={{ width: '100%', padding: '10px', marginBottom: '15px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}
        />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ width: '100%', padding: '10px', marginBottom: '15px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', boxSizing: 'border-box' }}
        />

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px' }}>I am a:</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setRole('creator')}
              style={{
                flex: 1,
                padding: '10px',
                background: role === 'creator' ? '#0066ff' : '#333',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              Creator
            </button>
            <button
              onClick={() => setRole('brand')}
              style={{
                flex: 1,
                padding: '10px',
                background: role === 'brand' ? '#0066ff' : '#333',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              Brand
            </button>
          </div>
        </div>

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            padding: '12px',
            background: '#0066ff',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Login
        </button>
      </div>
    </div>
  );
}
