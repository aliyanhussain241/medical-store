// ─────────────────────────────────────────────────────────────
// src/pages/Login.jsx
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/services';
import toast from 'react-hot-toast';
import { handleFormEnterKey } from '../utils/keyboardNav';
import { Lock, Mail } from 'lucide-react';

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
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <div className="auth-logo">
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'rgba(15, 110, 79, 0.12)', border: '1px solid rgba(15, 110, 79, 0.25)', color: 'var(--brand)', marginBottom: 12 }}>
            <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>+</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px 0' }}>MedStore</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Wholesale Medical Store Management</p>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={(e) => handleFormEnterKey(e, handleSubmit)}>
          {error && (
            <div style={{ background: '#FEE2E2', color: '#B4372B', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #FECACA', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Mail size={12} /> Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input text-sm"
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Lock size={12} /> Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input text-sm"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button
            id="login-btn"
            type="submit"
            className="btn btn-brand w-full"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: '11px', fontSize: 14, fontWeight: 600 }}
          >
            {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Sign In to Workspace'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-muted)' }}>
          New account? <Link to="/signup" style={{ color: 'var(--brand)', fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
