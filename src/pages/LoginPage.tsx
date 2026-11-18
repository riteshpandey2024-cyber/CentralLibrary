import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Navbar } from '../components/Navbar.tsx';
import { Footer } from '../components/Footer.tsx';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { User } from '../types.ts';

export function LoginPage() {
  const { setAuthUser, hasAdmin, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetTokenFromUrl = searchParams.get('token') || '';

  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(
    resetTokenFromUrl ? 'reset' : 'login',
  );
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({
    token: resetTokenFromUrl,
    newPassword: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      showToast('Please enter your email or mobile number and password.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      setAuthUser(res.user);
      await refreshAuth();
      showToast(`Welcome back, ${res.user.fullName}.`, 'success');
      navigate(res.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to sign in.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      showToast('Please enter your registered email address.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      setInfoMessage(res.message);
      showToast('Password reset request processed.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Request failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(resetForm),
      });
      showToast(res.message, 'success');
      setMode('login');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reset failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F6F0]">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md bg-white border border-[#E2DFD5] rounded-xl p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <BrandLogo variant="stacked" />
            <h1 className="mt-5 font-serif text-2xl font-bold text-[#101D35]">
              {mode === 'login'
                ? 'Member & Staff Sign In'
                : mode === 'forgot'
                  ? 'Reset Your Password'
                  : 'Set a New Password'}
            </h1>
            <p className="mt-1.5 text-sm text-[#586272]">
              {mode === 'login'
                ? 'Access your Central Library Krishna Nagar membership, seat reservations, and receipts.'
                : mode === 'forgot'
                  ? 'Enter your registered email address to request a password reset.'
                  : 'Enter your reset token and choose a new strong password.'}
            </p>
          </div>

          {infoMessage && (
            <div className="mb-5 p-3.5 rounded-lg bg-[#EAF1F8] border border-[#C7D7EA] text-sm text-[#101D35]">
              {infoMessage}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Email Address or Mobile Number
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@example.com or 10-digit mobile"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm text-[#101D35] focus:outline-none focus:border-[#101D35]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-[#101D35]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setInfoMessage('');
                      setMode('forgot');
                    }}
                    className="text-xs font-medium text-[#BA9245] hover:text-[#101D35] cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm text-[#101D35] focus:outline-none focus:border-[#101D35]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737B89] hover:text-[#101D35] p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Registered Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm text-[#101D35] focus:outline-none focus:border-[#101D35]"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Request Password Reset'}
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="inline-flex items-center gap-1.5 text-sm text-[#586272] hover:text-[#101D35] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#101D35] mb-1.5">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={resetForm.token}
                  onChange={(e) => setResetForm((p) => ({ ...p, token: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101D35] mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm((p) => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101D35] mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={resetForm.confirmPassword}
                  onChange={(e) =>
                    setResetForm((p) => ({ ...p, confirmPassword: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] cursor-pointer"
              >
                {submitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-[#E2DFD5] space-y-2 text-sm text-[#586272]">
            <p>
              New to Central Library Krishna Nagar?{' '}
              <Link to="/register" className="font-semibold text-[#101D35] hover:underline">
                Register for Membership
              </Link>
            </p>
            {!hasAdmin && (
              <p>
                Library Owner?{' '}
                <Link to="/admin-setup" className="font-semibold text-[#BA9245] hover:underline">
                  Initialize Administrator Account
                </Link>
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
