import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar.tsx';
import { Footer } from '../components/Footer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { User } from '../types.ts';

export function AdminSetupPage() {
  const { hasAdmin, setAuthUser, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hasAdmin) {
      navigate('/login');
    }
  }, [hasAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/setup-admin', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setAuthUser(res.user);
      await refreshAuth();
      showToast('Administrator account created.', 'success');
      navigate('/admin');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to create admin.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F6F0]">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-md bg-white border border-[#E2DFD5] rounded-xl p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-wider text-[#BA9245] uppercase">
            One-Time Initialization
          </p>
          <h1 className="mt-1.5 font-serif text-2xl font-bold text-[#101D35]">
            Initialize Library Administrator
          </h1>
          <p className="mt-2 text-sm text-[#586272]">
            Set up the primary administrator account for Central Library Krishna Nagar. This page
            locks automatically once an administrator is created.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#101D35] mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Library Administrator"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#101D35] mb-1.5">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="admin@centrallibrarykn.in"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#101D35] mb-1.5">
                Mobile Number
              </label>
              <input
                type="tel"
                required
                value={form.mobile}
                onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#101D35] mb-1.5">
                Strong Password
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Min 8 chars, upper, lower & number"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] cursor-pointer"
            >
              {submitting ? 'Creating Administrator...' : 'Create Administrator Account'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
