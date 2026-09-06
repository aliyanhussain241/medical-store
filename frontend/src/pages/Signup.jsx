// ─────────────────────────────────────────────────────────────
// src/pages/Signup.jsx
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/services';
import toast from 'react-hot-toast';

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ businessName: '', ownerName: '', email: '', password: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field) { return (e) => setForm({ ...form, [field]: e.target.value }); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const res = await authAPI.signup(form);
      const { accessToken, refreshToken, user } = res.data;
      login(accessToken, refreshToken, user);
      toast.success('Account created! Welcome to Medical Store.');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-logo">
          <h1>Create Account</h1>
          <p>Medical Store Wholesale Management</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: '#FEE2E2', color: '#B4372B', padding: '10px 12px', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Business Name *</label>
              <input id="su-biz" className="form-input" placeholder="Al-Rahmat Wholesale" value={form.businessName} onChange={set('businessName')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Owner Name *</label>
              <input id="su-owner" className="form-input" placeholder="Muhammad Ali" value={form.ownerName} onChange={set('ownerName')} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input id="su-email" type="email" className="form-input" placeholder="owner@store.com" value={form.email} onChange={set('email')} required />
          </div>

          <div className="form-group">
            <label className="form-label">Password * (min 8 chars)</label>
            <input id="su-pass" type="password" className="form-input" placeholder="••••••••" value={form.password} onChange={set('password')} required />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input id="su-phone" className="form-input" placeholder="0300-0000000" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input id="su-addr" className="form-input" placeholder="Shop address" value={form.address} onChange={set('address')} />
            </div>
          </div>

          <button id="su-btn" type="submit" className="btn btn-brand w-full" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '10px' }}>
            {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
