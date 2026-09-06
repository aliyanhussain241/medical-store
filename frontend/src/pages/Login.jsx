// ─────────────────────────────────────────────────────────────
// src/pages/Login.jsx
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/services';
import toast from 'react-hot-toast';
import { handleFormEnterKey } from '../utils/keyboardNav';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      const { accessToken, refreshToken, user } = res.data;
      login(accessToken, refreshToken, user);
      toast.success(`Welcome back, ${user.ownerName}!`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Medical Store</h1>
          <p>Wholesale Management System</p>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={(e) => handleFormEnterKey(e, handleSubmit)}>
          {error && (
            <div style={{ background: '#FEE2E2', color: '#B4372B', padding: '10px 12px', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button id="login-btn" type="submit" className="btn btn-brand w-full" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '10px' }}>
            {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          New account? <Link to="/signup" style={{ color: 'var(--accent)', fontWeight: 600 }}>Create one</Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#aaa' }}>
          Demo: demo@medicalstore.app / Demo@12345
        </p>
      </div>
    </div>
  );
}
