// ─────────────────────────────────────────────────────────────
// src/pages/Signup.jsx — Wholesale Medical Store signup
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/services';
import toast from 'react-hot-toast';
import { handleFormEnterKey } from '../utils/keyboardNav';
import { Building2, User, Mail, Lock, Phone, MapPin } from 'lucide-react';

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: '', ownerName: '', email: '', password: '',
    phone: '', address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field) { return (e) => setForm({ ...form, [field]: e.target.value }); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const res = await authAPI.signup({ ...form, businessType: 'PHARMACY' });
      const { accessToken, refreshToken, user } = res.data;
      login(accessToken, refreshToken, user);
      toast.success('Account created! Welcome.');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-logo">
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'rgba(15, 110, 79, 0.12)', border: '1px solid rgba(15, 110, 79, 0.25)', color: 'var(--brand)', marginBottom: 12 }}>
            <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>+</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px 0' }}>Create Account</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Wholesale Medical Store Management</p>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={(e) => handleFormEnterKey(e, handleSubmit)}>
          {error && (
            <div style={{ background: '#FEE2E2', color: '#B4372B', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #FECACA', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
                <Building2 size={12} /> Business Name *
              </label>
              <input id="su-biz" className="form-input text-sm" placeholder="Al-Rahmat Medical Wholesale" value={form.businessName} onChange={set('businessName')} required />
            </div>
            <div className="form-group">
              <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
                <User size={12} /> Owner Name *
              </label>
              <input id="su-owner" className="form-input text-sm" placeholder="Muhammad Ali" value={form.ownerName} onChange={set('ownerName')} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Mail size={12} /> Email Address *
            </label>
            <input id="su-email" type="email" className="form-input text-sm" placeholder="owner@medicalstore.com" value={form.email} onChange={set('email')} required />
          </div>

          <div className="form-group">
            <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Lock size={12} /> Password * (min 8 chars)
            </label>
            <input id="su-pass" type="password" className="form-input text-sm" placeholder="••••••••" value={form.password} onChange={set('password')} required />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
                <Phone size={12} /> Phone
              </label>
              <input id="su-phone" className="form-input text-sm" placeholder="0300-0000000" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="form-group">
              <label className="form-label text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
                <MapPin size={12} /> Address
              </label>
              <input id="su-addr" className="form-input text-sm" placeholder="Shop address" value={form.address} onChange={set('address')} />
            </div>
          </div>

          <button
            id="su-btn"
            type="submit"
            className="btn btn-brand w-full"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: '11px', fontSize: 14, fontWeight: 600 }}
          >
            {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--brand)', fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
