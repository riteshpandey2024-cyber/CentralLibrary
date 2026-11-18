import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Eye, EyeOff } from 'lucide-react';
import { Navbar } from '../components/Navbar.tsx';
import { Footer } from '../components/Footer.tsx';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { MembershipPlan, User } from '../types.ts';

const DEFAULT_PLANS: MembershipPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly Membership',
    durationLabel: '1 Month',
    durationDays: 30,
    priceInr: null,
    isAvailable: true,
    isActive: true,
    displayOrder: 1,
    termsAndConditions: 'Library rules and quiet hours apply.',
    description: 'Full day library access with dedicated desk and high speed internet.',
    facilitiesIncluded: ['AC Study Hall', 'High-Speed Wi-Fi', 'Personal Charging Point', 'RO Water'],
  },
  {
    id: 'quarterly',
    name: 'Quarterly Membership',
    durationLabel: '3 Months',
    durationDays: 90,
    priceInr: null,
    isAvailable: true,
    isActive: true,
    displayOrder: 2,
    termsAndConditions: 'Library rules and quiet hours apply.',
    description: 'Three months continuous access for focused exam preparation.',
    facilitiesIncluded: ['AC Study Hall', 'High-Speed Wi-Fi', 'Personal Charging Point', 'RO Water'],
  },
  {
    id: 'half-yearly',
    name: 'Half-Yearly Membership',
    durationLabel: '6 Months',
    durationDays: 180,
    priceInr: null,
    isAvailable: true,
    isActive: true,
    displayOrder: 3,
    termsAndConditions: 'Library rules and quiet hours apply.',
    description: 'Six months study pack with priority seating and uninterrupted power.',
    facilitiesIncluded: ['AC Study Hall', 'High-Speed Wi-Fi', 'Personal Charging Point', 'RO Water'],
  },
  {
    id: 'annual',
    name: 'Annual Membership',
    durationLabel: '12 Months',
    durationDays: 365,
    priceInr: null,
    isAvailable: true,
    isActive: true,
    displayOrder: 4,
    termsAndConditions: 'Library rules and quiet hours apply.',
    description: 'Complete year-round study access for serious learners.',
    facilitiesIncluded: ['AC Study Hall', 'High-Speed Wi-Fi', 'Personal Charging Point', 'RO Water'],
  },
];

export function RegisterPage() {
  const { setAuthUser, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPlanId = searchParams.get('plan') || '';

  const [plans, setPlans] = useState<MembershipPlan[]>(DEFAULT_PLANS);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: '',
    category: 'Competitive Exam Aspirant',
    institutionName: '',
    courseOrExam: '',
    planId: preselectedPlanId || 'monthly',
    privacyAccepted: false,
    termsAccepted: false,
  });

  useEffect(() => {
    apiRequest<MembershipPlan[]>('/api/membership-plans')
      .then((list) => {
        if (list && list.length > 0) {
          setPlans(list);
          if (!form.planId) {
            setForm((prev) => ({ ...prev, planId: preselectedPlanId || list[0].id }));
          }
        }
      })
      .catch(() => {
        // Fallback to default plans already initialized
      });
  }, [preselectedPlanId, form.planId]);

  const passwordChecks = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      setResult('Passwords do not match');
      showToast('Passwords do not match.', 'error');
      return;
    }

    if (!form.privacyAccepted || !form.termsAccepted) {
      setResult('Please accept Privacy Policy and Terms');
      showToast('Please accept the Privacy Policy and Terms & Conditions.', 'error');
      return;
    }

    setIsSubmitting(true);
    setResult('Sending....');

    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    
    // Remove sensitive password fields before sending to Web3Forms
    // Web3Forms blocks submissions containing "password" fields for anti-phishing security
    formData.delete('password');
    formData.delete('confirmPassword');

    formData.append('access_key', 'b32b0db4-73ce-4946-8a83-6596757bb52f');
    formData.append('subject', 'New Member Registration - Central Library Krishna Nagar');

    const selectedPlan = plans.find((p) => p.id === form.planId);
    if (selectedPlan) {
      formData.append(
        'Selected Plan Details',
        `${selectedPlan.name} (${selectedPlan.durationLabel})`
      );
    }

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult('Form Submitted Successfully');
        showToast('Membership application submitted successfully!', 'success');

        // Non-blocking attempt to register in local auth backend if online
        try {
          const res = await apiRequest<{ message: string; user: User }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(form),
          });
          if (res?.user) {
            setAuthUser(res.user);
            await refreshAuth();
          }
        } catch {
          // Local auth backend sync error ignored since Web3Forms succeeded
        }

        formEl.reset();
        setForm({
          fullName: '',
          mobile: '',
          email: '',
          password: '',
          confirmPassword: '',
          category: 'Competitive Exam Aspirant',
          institutionName: '',
          courseOrExam: '',
          planId: preselectedPlanId || (plans[0]?.id || 'monthly'),
          privacyAccepted: false,
          termsAccepted: false,
        });
      } else {
        setResult(data.message || 'Error');
        showToast(data.message || 'Error submitting application.', 'error');
      }
    } catch {
      setResult('Error');
      showToast('Unable to submit application. Please check your internet connection.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F6F0]">
      <Navbar />
      <main className="flex-1 py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto bg-white border border-[#E2DFD5] rounded-xl p-6 sm:p-10 shadow-sm">
          <div className="mb-4">
            <BrandLogo variant="stacked" />
          </div>
          <h1 className="mt-1.5 font-serif text-3xl font-bold text-[#101D35]">
            Member Registration
          </h1>
          <p className="mt-2 text-sm text-[#586272] leading-relaxed">
            Create your study library account. After submission, your membership status starts as
            Pending until reviewed by our administrator.
          </p>

          {result && (
            <div
              className={`mt-5 p-4 rounded-lg text-sm font-medium ${
                result === 'Form Submitted Successfully'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : result === 'Sending....'
                  ? 'bg-blue-50 border border-blue-200 text-blue-900'
                  : 'bg-red-50 border border-red-200 text-red-900'
              }`}
            >
              {result}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {/* Web3Forms anti-spam honeypot */}
            <input type="checkbox" name="botcheck" className="hidden" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Full Name *
                </label>
                <input
                  id="reg-name"
                  name="fullName"
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm focus:outline-none focus:border-[#101D35]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-mobile"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Mobile Number *
                </label>
                <input
                  id="reg-mobile"
                  name="mobile"
                  type="tel"
                  required
                  value={form.mobile}
                  onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
                  placeholder="10-digit mobile number"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm tabular-nums focus:outline-none focus:border-[#101D35]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Email Address *
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm focus:outline-none focus:border-[#101D35]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-category"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Student / Learner Category *
                </label>
                <select
                  id="reg-category"
                  name="category"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm focus:outline-none focus:border-[#101D35]"
                >
                  <option value="Competitive Exam Aspirant">Competitive Exam Aspirant</option>
                  <option value="College Student">College Student</option>
                  <option value="School Student">School Student</option>
                  <option value="Independent Learner">Independent Learner</option>
                  <option value="Working Professional">Working Professional</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="reg-inst"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Institution Name (optional)
                </label>
                <input
                  id="reg-inst"
                  name="institutionName"
                  type="text"
                  value={form.institutionName}
                  onChange={(e) => setForm((p) => ({ ...p, institutionName: e.target.value }))}
                  placeholder="University, College, or Coaching"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm focus:outline-none focus:border-[#101D35]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-course"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Course / Exam Preparation (optional)
                </label>
                <input
                  id="reg-course"
                  name="courseOrExam"
                  type="text"
                  value={form.courseOrExam}
                  onChange={(e) => setForm((p) => ({ ...p, courseOrExam: e.target.value }))}
                  placeholder="e.g., UPSC, SSC, NEET, B.Tech, CA"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm focus:outline-none focus:border-[#101D35]"
                />
              </div>
            </div>

            {plans.length > 0 && (
              <div>
                <label
                  htmlFor="reg-plan"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Preferred Membership Plan
                </label>
                <select
                  id="reg-plan"
                  name="preferredMembershipPlan"
                  value={form.planId}
                  onChange={(e) => setForm((p) => ({ ...p, planId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm focus:outline-none focus:border-[#101D35]"
                >
                  {plans.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} ({pl.durationLabel})
                      {pl.priceInr !== null && pl.priceInr > 0
                        ? ` — ₹${pl.priceInr.toLocaleString('en-IN')}`
                        : ' — Fee set by Desk'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="reg-pass"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Password *
                </label>
                <div className="relative">
                  <input
                    id="reg-pass"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Create strong password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm focus:outline-none focus:border-[#101D35]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737B89] p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-confirm"
                  className="block text-sm font-medium text-[#101D35] mb-1.5"
                >
                  Confirm Password *
                </label>
                <input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.confirmPassword}
                  onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm focus:outline-none focus:border-[#101D35]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#586272]">
              {[
                { ok: passwordChecks.length, label: '8+ characters' },
                { ok: passwordChecks.upper, label: 'Uppercase letter' },
                { ok: passwordChecks.lower, label: 'Lowercase letter' },
                { ok: passwordChecks.number, label: 'Number' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-1.5 ${item.ok ? 'text-emerald-700 font-medium' : ''}`}
                >
                  <Check className={`w-3.5 h-3.5 ${item.ok ? 'opacity-100' : 'opacity-30'}`} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2 border-t border-[#E2DFD5] text-sm text-[#4A5362]">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="privacyConsent"
                  checked={form.privacyAccepted}
                  onChange={(e) => setForm((p) => ({ ...p, privacyAccepted: e.target.checked }))}
                  className="mt-1 rounded border-[#D6D2C7]"
                />
                <span>
                  I consent to the{' '}
                  <Link to="/privacy" target="_blank" className="text-[#101D35] underline">
                    Privacy Policy
                  </Link>{' '}
                  for library membership administration.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="termsConsent"
                  checked={form.termsAccepted}
                  onChange={(e) => setForm((p) => ({ ...p, termsAccepted: e.target.checked }))}
                  className="mt-1 rounded border-[#D6D2C7]"
                />
                <span>
                  I accept the{' '}
                  <Link to="/terms" target="_blank" className="text-[#101D35] underline">
                    Terms and Conditions
                  </Link>{' '}
                  and agree to abide by the Library Rules.
                </span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Sending....' : 'Submit Membership Application'}
              </button>
              {result && (
                <div className="mt-2 text-center">
                  <span
                    className={`text-sm font-medium ${
                      result === 'Form Submitted Successfully'
                        ? 'text-emerald-700'
                        : result === 'Sending....'
                        ? 'text-blue-700'
                        : 'text-red-600'
                    }`}
                  >
                    {result}
                  </span>
                </div>
              )}
            </div>
          </form>

          <p className="mt-6 text-sm text-[#586272] text-center">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-[#101D35] hover:underline">
              Member Login
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
