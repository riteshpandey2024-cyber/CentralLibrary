import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Armchair,
  Bell,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  User as UserIcon,
  Wrench,
  X,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { ReceiptModal, type ReceiptData } from '../components/ReceiptModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest, openRazorpayCheckout } from '../lib/api.ts';
import type {
  LibraryAnnouncement,
  MemberProfile,
  Membership,
  MembershipPlan,
  NotificationItem,
  Payment,
  SeatReservation,
  SeatWithAvailability,
  User,
} from '../types.ts';

type MemberTab =
  | 'overview'
  | 'profile'
  | 'membership'
  | 'seats'
  | 'payments'
  | 'notifications'
  | 'announcements';

interface MemberDashboardPayload {
  user: User;
  profile: MemberProfile | null;
  application: { id: string; status: string; reviewNotes: string; createdAt: string } | null;
  currentMembership: Membership | null;
  memberships: Membership[];
  reservations: SeatReservation[];
  payments: Payment[];
  notifications: NotificationItem[];
  announcements: LibraryAnnouncement[];
  settings: {
    operatingHours: string;
    seatCancellationHoursNotice: number;
    allowSelfSeatReservation: boolean;
    requireApprovalBeforeSeatBooking: boolean;
  };
}

function StatusBadgeText({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    approved: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    success: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    paid: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    pending: 'text-amber-800 bg-amber-50 border-amber-200',
    renewal_requested: 'text-amber-800 bg-amber-50 border-amber-200',
    unpaid: 'text-amber-800 bg-amber-50 border-amber-200',
    expired: 'text-red-800 bg-red-50 border-red-200',
    suspended: 'text-red-800 bg-red-50 border-red-200',
    rejected: 'text-red-800 bg-red-50 border-red-200',
    failed: 'text-red-800 bg-red-50 border-red-200',
    cancelled: 'text-[#586272] bg-[#F8F6F0] border-[#D6D2C7]',
    refunded: 'text-[#586272] bg-[#F8F6F0] border-[#D6D2C7]',
  };
  const cls = styles[status] || 'text-[#101D35] bg-[#EAF1F8] border-[#C7D7EA]';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded border capitalize ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function MemberDashboard() {
  const { user, loading: authLoading, logout, refreshAuth } = useAuth();
  const { showToast, confirmAction } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = (searchParams.get('tab') as MemberTab) || 'overview';
  const [activeTab, setActiveTab] = useState<MemberTab>(initialTab);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [data, setData] = useState<MemberDashboardPayload | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Seat grid state
  const todayStr = new Date().toISOString().slice(0, 10);
  const [seatDates, setSeatDates] = useState({ startDate: todayStr, endDate: todayStr });
  const [seats, setSeats] = useState<SeatWithAvailability[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [reservingSeat, setReservingSeat] = useState(false);

  // Payment & Receipt state
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    category: 'Competitive Exam Aspirant',
    institutionName: '',
    courseOrExam: '',
    address: '',
    preferredShift: 'Full Day (7:00 AM – 10:00 PM)',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change form
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPw, setChangingPw] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [meData, planList, payCfg] = await Promise.all([
        apiRequest<MemberDashboardPayload>('/api/members/me'),
        apiRequest<MembershipPlan[]>('/api/membership-plans'),
        apiRequest<{ onlinePaymentConfigured: boolean }>('/api/payments/config'),
      ]);
      setData(meData);
      setPlans(planList);
      setRazorpayConfigured(payCfg.onlinePaymentConfigured);
      setProfileForm({
        fullName: meData.user.fullName,
        category: meData.profile?.category || 'Competitive Exam Aspirant',
        institutionName: meData.profile?.institutionName || '',
        courseOrExam: meData.profile?.courseOrExam || '',
        address: meData.profile?.address || '',
        preferredShift: meData.profile?.preferredShift || 'Full Day (7:00 AM – 10:00 PM)',
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadSeats = useCallback(async () => {
    try {
      const res = await apiRequest<{ seats: SeatWithAvailability[] }>(
        `/api/seats?startDate=${encodeURIComponent(seatDates.startDate)}&endDate=${encodeURIComponent(
          seatDates.endDate,
        )}`,
      );
      setSeats(res.seats);
    } catch {
      // Handled silently when unauthenticated
    }
  }, [seatDates.startDate, seatDates.endDate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    if (user && user.role === 'admin') {
      navigate('/admin');
      return;
    }
    if (user) {
      void loadDashboard();
    }
  }, [user, authLoading, navigate, loadDashboard]);

  useEffect(() => {
    if (user && activeTab === 'seats') {
      void loadSeats();
    }
  }, [user, activeTab, loadSeats]);

  const switchTab = (tab: MemberTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
    setSearchParams({ tab });
  };

  const unreadCount = useMemo(
    () => (data?.notifications || []).filter((n) => !n.isRead).length,
    [data],
  );

  const groupedSeats = useMemo(() => {
    const groups = new Map<string, SeatWithAvailability[]>();
    for (const s of seats) {
      const list = groups.get(s.rowLabel) || [];
      list.push(s);
      groups.set(s.rowLabel, list);
    }
    return Array.from(groups.entries());
  }, [seats]);

  const activeReservation = useMemo(
    () => (data?.reservations || []).find((r) => r.status === 'active') || null,
    [data],
  );

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiRequest('/api/members/me', {
        method: 'PATCH',
        body: JSON.stringify(profileForm),
      });
      await loadDashboard();
      await refreshAuth();
      showToast('Profile updated successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPw(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/members/me/change-password', {
        method: 'POST',
        body: JSON.stringify(pwForm),
      });
      showToast(res.message, 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to change password.', 'error');
    } finally {
      setChangingPw(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      await apiRequest('/api/memberships', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      await loadDashboard();
      showToast('Membership plan selected.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to select plan.', 'error');
    }
  };

  const handleRequestRenewal = async (planId?: string) => {
    try {
      await apiRequest('/api/memberships/renew', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      await loadDashboard();
      showToast('Membership renewal request submitted.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit renewal.', 'error');
    }
  };

  const handlePayWithRazorpay = async (plan: MembershipPlan, membershipId?: string) => {
    if (!data) return;
    setPayingPlanId(plan.id);
    try {
      const idempotencyKey = `pay_${data.user.id}_${plan.id}_${Date.now()}`;
      const orderRes = await apiRequest<{
        order: { id: string; amount: number };
        razorpayConfig: { keyId: string };
      }>('/api/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({
          membershipId,
          planId: plan.id,
          idempotencyKey,
        }),
      });

      openRazorpayCheckout({
        key: orderRes.razorpayConfig.keyId,
        amountPaise: orderRes.order.amount,
        orderId: orderRes.order.id,
        name: 'Central Library Krishna Nagar',
        description: `${plan.name} (${plan.durationLabel})`,
        prefill: {
          name: data.user.fullName,
          email: data.user.email,
          contact: data.user.mobile,
        },
        onSuccess: async (rzpRes) => {
          try {
            await apiRequest('/api/payments/verify', {
              method: 'POST',
              body: JSON.stringify(rzpRes),
            });
            showToast('Payment verified and membership updated!', 'success');
            await loadDashboard();
          } catch (verifyErr) {
            showToast(
              verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed.',
              'error',
            );
          }
        },
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to start payment.', 'error');
    } finally {
      setPayingPlanId(null);
    }
  };

  const handleReserveSeat = async () => {
    if (!selectedSeatId) {
      showToast('Please select an available seat on the floor grid.', 'error');
      return;
    }
    setReservingSeat(true);
    try {
      await apiRequest('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          seatId: selectedSeatId,
          startDate: seatDates.startDate,
          endDate: seatDates.endDate,
          slotLabel: data?.settings.operatingHours || '7:00 AM – 10:00 PM',
        }),
      });
      setSelectedSeatId(null);
      await Promise.all([loadSeats(), loadDashboard()]);
      showToast('Seat reserved successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to reserve seat.', 'error');
    } finally {
      setReservingSeat(false);
    }
  };

  const handleCancelReservation = async (id: string) => {
    const confirmed = await confirmAction({
      title: 'Cancel Seat Reservation',
      message: 'Are you sure you want to release this reserved study desk?',
      confirmLabel: 'Cancel Reservation',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await apiRequest(`/api/reservations/${id}`, { method: 'DELETE' });
      await Promise.all([loadSeats(), loadDashboard()]);
      showToast('Seat reservation cancelled.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to cancel reservation.', 'error');
    }
  };

  const handleViewReceipt = async (paymentId: string) => {
    try {
      const receipt = await apiRequest<ReceiptData>(`/api/payments/${paymentId}/receipt`);
      setReceiptData(receipt);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load receipt.', 'error');
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    await loadDashboard();
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/notifications/me/read-all', { method: 'POST' });
    await loadDashboard();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center p-6">
        <div className="text-sm text-[#586272]">Loading your member portal...</div>
      </div>
    );
  }

  if (!data) return null;

  const navItems: { id: MemberTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'profile', label: 'My Profile', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'membership', label: 'Membership', icon: <FileText className="w-4 h-4" /> },
    { id: 'seats', label: 'Seat Reservation', icon: <Armchair className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { id: 'announcements', label: 'Library Announcements', icon: <Megaphone className="w-4 h-4" /> },
  ];

  const currentPlan = plans.find((p) => p.id === data.currentMembership?.planId) || null;
  const latestPayment = data.payments[0] || null;

  return (
    <div className="min-h-screen bg-[#F8F6F0] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden bg-[#101D35] text-[#F8F6F0] px-4 h-14 flex items-center justify-between sticky top-0 z-30">
        <Link to="/">
          <BrandLogo variant="navbar" light />
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen((v) => !v)}
          className="p-2 rounded-lg border border-[#253D61]"
          aria-label="Toggle dashboard navigation"
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`${
          mobileNavOpen ? 'fixed inset-0 z-40 flex' : 'hidden'
        } lg:flex lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen flex-col bg-[#101D35] text-[#F8F6F0] border-r border-[#172943]`}
      >
        <div className="p-5 border-b border-[#1E3354] flex items-center justify-between">
          <Link to="/">
            <BrandLogo variant="stacked" light />
          </Link>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1.5 text-[#C7CEDB]"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === item.id
                  ? 'bg-[#D4AD62] text-[#101D35] font-semibold'
                  : 'text-[#C7CEDB] hover:bg-[#172943] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#101D35] text-[#D4AD62] tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[#1E3354] space-y-1">
          <Link
            to="/"
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm text-[#C7CEDB] hover:bg-[#172943] hover:text-white transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Public Website</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm text-[#C7CEDB] hover:bg-[#172943] hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 sm:p-8 lg:p-10 max-w-6xl">
        {/* Top Breadcrumb Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2DFD5]">
          <div>
            <p className="text-xs text-[#737B89]">
              Member Portal <span aria-hidden="true">/</span>{' '}
              {navItems.find((n) => n.id === activeTab)?.label}
            </p>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-[#101D35]">
              Welcome, {data.user.fullName}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#737B89]">Account Status:</span>
            <StatusBadgeText status={data.user.accountStatus} />
          </div>
        </div>

        {/* Pending Approval Banner */}
        {data.user.accountStatus === 'pending' && (
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-950">
            <strong>Registration Pending Review:</strong> Your account has been created and is
            awaiting verification by the Central Library Krishna Nagar administrator. You can
            review plans, update your profile, and check notifications in the meantime.
          </div>
        )}

        {data.user.accountStatus === 'rejected' && (
          <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
            <strong>Application Declined:</strong>{' '}
            {data.application?.reviewNotes ||
              'Please contact the Library Desk for further details.'}
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="mt-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              <div className="p-5 rounded-xl bg-white border border-[#E2DFD5]">
                <p className="text-xs text-[#737B89]">Membership Status</p>
                <div className="mt-2">
                  <StatusBadgeText status={data.currentMembership?.status || data.user.accountStatus} />
                </div>
                <p className="mt-2 text-sm font-medium text-[#101D35]">
                  {data.currentMembership?.planNameSnapshot || 'No Plan Selected'}
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#E2DFD5]">
                <p className="text-xs text-[#737B89]">Validity Window</p>
                <p className="mt-2 font-mono text-sm font-semibold text-[#101D35] tabular-nums">
                  {data.currentMembership?.startDate
                    ? new Date(data.currentMembership.startDate).toLocaleDateString('en-IN')
                    : 'Not activated'}
                </p>
                <p className="mt-1 text-xs text-[#586272] tabular-nums">
                  Expires:{' '}
                  {data.currentMembership?.expiryDate
                    ? new Date(data.currentMembership.expiryDate).toLocaleDateString('en-IN')
                    : '—'}
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#E2DFD5]">
                <p className="text-xs text-[#737B89]">Assigned / Reserved Seat</p>
                <p className="mt-2 font-serif text-2xl font-bold text-[#101D35] tabular-nums">
                  {activeReservation ? activeReservation.seatNumberSnapshot : 'None'}
                </p>
                <p className="mt-1 text-xs text-[#586272] tabular-nums">
                  {activeReservation
                    ? `${activeReservation.startDate} to ${activeReservation.endDate}`
                    : 'Visit Seat Reservation to book'}
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-[#E2DFD5]">
                <p className="text-xs text-[#737B89]">Latest Payment</p>
                <p className="mt-2 font-serif text-2xl font-bold text-[#101D35] tabular-nums">
                  {latestPayment ? `₹${latestPayment.amountInr.toLocaleString('en-IN')}` : '—'}
                </p>
                <p className="mt-1 text-xs text-[#586272]">
                  {latestPayment
                    ? `${latestPayment.status.toUpperCase()} · ${latestPayment.transactionId}`
                    : 'No transactions yet'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Notifications */}
              <div className="p-6 rounded-xl bg-white border border-[#E2DFD5]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-lg font-bold text-[#101D35]">
                    Recent Notifications
                  </h2>
                  <button
                    type="button"
                    onClick={() => switchTab('notifications')}
                    className="text-xs font-semibold text-[#BA9245] hover:text-[#101D35] cursor-pointer"
                  >
                    View All
                  </button>
                </div>
                {data.notifications.length === 0 ? (
                  <p className="text-sm text-[#737B89]">No notifications yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.notifications.slice(0, 4).map((n) => (
                      <div
                        key={n.id}
                        className="p-3.5 rounded-lg border border-[#E2DFD5] bg-[#FDFCF9]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#101D35]">{n.title}</span>
                          <span className="text-xs text-[#737B89] tabular-nums">
                            {new Date(n.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#586272] leading-relaxed">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Latest Announcements */}
              <div className="p-6 rounded-xl bg-white border border-[#E2DFD5]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-lg font-bold text-[#101D35]">
                    Library Announcements
                  </h2>
                  <button
                    type="button"
                    onClick={() => switchTab('announcements')}
                    className="text-xs font-semibold text-[#BA9245] hover:text-[#101D35] cursor-pointer"
                  >
                    View All
                  </button>
                </div>
                {data.announcements.length === 0 ? (
                  <p className="text-sm text-[#737B89]">
                    No active announcements from library administration.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.announcements.slice(0, 4).map((a) => (
                      <div
                        key={a.id}
                        className="p-3.5 rounded-lg border border-[#E2DFD5] bg-[#FDFCF9]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#101D35]">{a.title}</span>
                          <span className="text-xs text-[#737B89] tabular-nums">
                            {new Date(a.publishedAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#586272] leading-relaxed">{a.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MY PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 bg-white border border-[#E2DFD5] rounded-xl p-6">
              <h2 className="font-serif text-xl font-bold text-[#101D35]">Personal Information</h2>
              <p className="mt-1 text-sm text-[#586272]">
                Email and mobile number are verified registration identifiers. Contact the desk to
                update registered contact numbers.
              </p>

              <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#586272] mb-1">
                      Registered Email
                    </label>
                    <input
                      type="text"
                      disabled
                      value={data.user.email}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2DFD5] bg-[#F8F6F0] text-sm text-[#737B89]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#586272] mb-1">
                      Registered Mobile
                    </label>
                    <input
                      type="text"
                      disabled
                      value={data.user.mobile}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2DFD5] bg-[#F8F6F0] text-sm font-mono text-[#737B89] tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#101D35] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101D35] mb-1">
                      Category
                    </label>
                    <select
                      value={profileForm.category}
                      onChange={(e) => setProfileForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                    >
                      <option value="Competitive Exam Aspirant">Competitive Exam Aspirant</option>
                      <option value="College Student">College Student</option>
                      <option value="School Student">School Student</option>
                      <option value="Independent Learner">Independent Learner</option>
                      <option value="Working Professional">Working Professional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101D35] mb-1">
                      Preferred Study Shift
                    </label>
                    <input
                      type="text"
                      value={profileForm.preferredShift}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, preferredShift: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101D35] mb-1">
                      Institution Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.institutionName}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, institutionName: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101D35] mb-1">
                      Course / Exam Preparation
                    </label>
                    <input
                      type="text"
                      value={profileForm.courseOrExam}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, courseOrExam: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#101D35] mb-1">
                    Residential Address (optional)
                  </label>
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] cursor-pointer"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-[#E2DFD5] rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-4 h-4 text-[#101D35]" />
                  <h2 className="font-serif text-xl font-bold text-[#101D35]">Change Password</h2>
                </div>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101D35] mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={pwForm.currentPassword}
                      onChange={(e) =>
                        setPwForm((p) => ({ ...p, currentPassword: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101D35] mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101D35] mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={pwForm.confirmPassword}
                      onChange={(e) =>
                        setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingPw}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] cursor-pointer"
                  >
                    {changingPw ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>

              <div className="bg-white border border-[#E2DFD5] rounded-xl p-6 text-sm space-y-2">
                <h3 className="font-serif text-base font-bold text-[#101D35]">
                  Registration Details
                </h3>
                <p className="text-[#586272]">
                  Member ID:{' '}
                  <span className="font-mono text-[#101D35]">{data.user.id}</span>
                </p>
                <p className="text-[#586272] tabular-nums">
                  Registered On:{' '}
                  <span className="text-[#101D35]">
                    {new Date(data.user.createdAt).toLocaleDateString('en-IN')}
                  </span>
                </p>
                <p className="text-[#586272]">
                  Application Status:{' '}
                  <span className="capitalize font-medium text-[#101D35]">
                    {data.application?.status || data.user.accountStatus}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MEMBERSHIP TAB */}
        {activeTab === 'membership' && (
          <div className="mt-8 space-y-8">
            <div className="bg-white border border-[#E2DFD5] rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[#737B89]">Current Membership</p>
                  <h2 className="font-serif text-2xl font-bold text-[#101D35] mt-1">
                    {data.currentMembership?.planNameSnapshot || 'No Active Membership'}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#586272]">
                    <StatusBadgeText status={data.currentMembership?.status || 'pending'} />
                    <span>·</span>
                    <span>
                      Payment:{' '}
                      <strong className="capitalize text-[#101D35]">
                        {data.currentMembership?.paymentStatus || 'unpaid'}
                      </strong>
                    </span>
                    {data.currentMembership?.expiryDate && (
                      <>
                        <span>·</span>
                        <span className="tabular-nums">
                          Valid until{' '}
                          {new Date(data.currentMembership.expiryDate).toLocaleDateString('en-IN')}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {currentPlan &&
                    currentPlan.priceInr !== null &&
                    currentPlan.priceInr > 0 &&
                    data.currentMembership?.paymentStatus !== 'paid' &&
                    razorpayConfigured && (
                      <button
                        type="button"
                        disabled={payingPlanId === currentPlan.id}
                        onClick={() =>
                          handlePayWithRazorpay(currentPlan, data.currentMembership?.id)
                        }
                        className="px-4 py-2.5 rounded-lg bg-[#D4AD62] text-[#101D35] text-sm font-semibold hover:bg-[#DFBC79] cursor-pointer"
                      >
                        Pay &#8377;{currentPlan.priceInr.toLocaleString('en-IN')} Online
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={() => handleRequestRenewal(data.currentMembership?.planId)}
                    className="px-4 py-2.5 rounded-lg border border-[#101D35] text-[#101D35] text-sm font-semibold hover:bg-[#F8F6F0] cursor-pointer"
                  >
                    Submit Renewal Request
                  </button>
                </div>
              </div>

              {!razorpayConfigured && (
                <p className="mt-4 text-xs text-[#586272] bg-[#F8F6F0] p-3 rounded-lg border border-[#E2DFD5]">
                  Note: Online Razorpay checkout is activated once gateway keys are configured by
                  library administration. You may submit your plan or renewal request here and
                  complete Cash / UPI Desk payment at the library counter.
                </p>
              )}
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-[#101D35] mb-4">
                Available Membership Plans
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-6 rounded-xl bg-white border border-[#E2DFD5] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-serif text-lg font-bold text-[#101D35]">{plan.name}</h4>
                        <span className="text-xs font-medium text-[#737B89]">
                          {plan.durationLabel}
                        </span>
                      </div>
                      <p className="mt-2 font-serif text-2xl font-bold text-[#101D35] tabular-nums">
                        {plan.priceInr !== null && plan.priceInr > 0
                          ? `₹${plan.priceInr.toLocaleString('en-IN')}`
                          : 'Fee set by Library Desk'}
                      </p>
                      <p className="mt-2 text-sm text-[#586272]">{plan.description}</p>
                    </div>
                    <div className="mt-5 pt-4 border-t border-[#E2DFD5] flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!plan.isAvailable}
                        onClick={() => handleSelectPlan(plan.id)}
                        className="px-4 py-2 rounded-lg bg-[#101D35] text-[#F8F6F0] text-xs font-semibold hover:bg-[#172943] disabled:opacity-50 cursor-pointer"
                      >
                        Select Plan
                      </button>
                      {plan.priceInr !== null && plan.priceInr > 0 && razorpayConfigured && (
                        <button
                          type="button"
                          disabled={payingPlanId === plan.id}
                          onClick={() => handlePayWithRazorpay(plan)}
                          className="px-4 py-2 rounded-lg bg-[#D4AD62] text-[#101D35] text-xs font-semibold hover:bg-[#DFBC79] cursor-pointer"
                        >
                          Pay Online
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEAT RESERVATION TAB */}
        {activeTab === 'seats' && (
          <div className="mt-8 space-y-6">
            <div className="bg-white border border-[#E2DFD5] rounded-xl p-6">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#101D35]">
                    Study Hall Seat Selection
                  </h2>
                  <p className="mt-1 text-sm text-[#586272]">
                    Choose dates to inspect live seat availability. Overlapping reservations for the
                    same seat are automatically prevented.
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#586272] mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={seatDates.startDate}
                      min={todayStr}
                      onChange={(e) =>
                        setSeatDates((p) => ({
                          startDate: e.target.value,
                          endDate: e.target.value > p.endDate ? e.target.value : p.endDate,
                        }))
                      }
                      className="px-3 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#586272] mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={seatDates.endDate}
                      min={seatDates.startDate}
                      onChange={(e) => setSeatDates((p) => ({ ...p, endDate: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-5 pt-4 border-t border-[#E2DFD5] flex flex-wrap gap-5 text-xs text-[#374151]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border border-[#101D35] bg-white inline-block" />
                  Available
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-[#D4AD62] inline-block" />
                  Selected / Reserved by You
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-[#172943] inline-block" />
                  Occupied
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-[#E2DFD5] inline-block" />
                  Maintenance
                </span>
              </div>

              {/* Realistic Seat Grid */}
              <div className="mt-6 space-y-6">
                {groupedSeats.length === 0 ? (
                  <p className="text-sm text-[#737B89]">
                    No seats configured yet. Administrator can add seats from Seat Management.
                  </p>
                ) : (
                  groupedSeats.map(([rowLabel, rowSeats]) => (
                    <div key={rowLabel}>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737B89] mb-2.5">
                        {rowLabel}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {rowSeats.map((seat) => {
                          const isSelected = selectedSeatId === seat.id;
                          const isAvailable = seat.availability === 'available';
                          const isMine = seat.availability === 'reserved_by_you';
                          const isMaint = seat.availability === 'maintenance';

                          let cardCls =
                            'bg-white border-[#D6D2C7] text-[#101D35] hover:border-[#101D35] cursor-pointer';
                          if (isSelected || isMine) {
                            cardCls = 'bg-[#D4AD62] border-[#BA9245] text-[#101D35]';
                          } else if (isMaint) {
                            cardCls =
                              'bg-[#EFECE2] border-[#D6D2C7] text-[#737B89] cursor-not-allowed';
                          } else if (!isAvailable) {
                            cardCls =
                              'bg-[#172943] border-[#101D35] text-[#C7CEDB] cursor-not-allowed';
                          }

                          return (
                            <button
                              key={seat.id}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => setSelectedSeatId(isSelected ? null : seat.id)}
                              className={`p-3 rounded-lg border text-left transition-colors ${cardCls}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-sm font-bold tabular-nums">
                                  {seat.seatNumber}
                                </span>
                                {isMine ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : isMaint ? (
                                  <Wrench className="w-3.5 h-3.5" />
                                ) : (
                                  <Armchair className="w-4 h-4 opacity-80" />
                                )}
                              </div>
                              <p className="mt-1 text-[11px] truncate opacity-85">
                                {seat.category}
                              </p>
                              <p className="mt-0.5 text-[11px] font-semibold">
                                {isMine
                                  ? 'Your Seat'
                                  : isSelected
                                    ? 'Selected'
                                    : isMaint
                                      ? 'Maintenance'
                                      : isAvailable
                                        ? 'Available'
                                        : 'Occupied'}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selectedSeatId && (
                <div className="mt-6 pt-5 border-t border-[#E2DFD5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-sm text-[#101D35]">
                    Selected Seat:{' '}
                    <strong className="font-mono">
                      {seats.find((s) => s.id === selectedSeatId)?.seatNumber}
                    </strong>{' '}
                    ({seatDates.startDate} to {seatDates.endDate})
                  </div>
                  <button
                    type="button"
                    disabled={reservingSeat}
                    onClick={handleReserveSeat}
                    className="px-5 py-2.5 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] cursor-pointer"
                  >
                    {reservingSeat ? 'Confirming...' : 'Confirm Seat Reservation'}
                  </button>
                </div>
              )}
            </div>

            {/* Member Reservations List */}
            <div className="bg-white border border-[#E2DFD5] rounded-xl p-6">
              <h3 className="font-serif text-lg font-bold text-[#101D35] mb-4">
                Your Reservations
              </h3>
              {data.reservations.length === 0 ? (
                <p className="text-sm text-[#737B89]">You have no seat reservations yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-[#E2DFD5] text-xs text-[#737B89]">
                        <th className="py-2.5 pr-4">Seat</th>
                        <th className="py-2.5 pr-4">Dates</th>
                        <th className="py-2.5 pr-4">Hours</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2DFD5]">
                      {data.reservations.map((r) => (
                        <tr key={r.id}>
                          <td className="py-3 pr-4 font-mono font-semibold text-[#101D35]">
                            {r.seatNumberSnapshot}
                          </td>
                          <td className="py-3 pr-4 tabular-nums">
                            {r.startDate} to {r.endDate}
                          </td>
                          <td className="py-3 pr-4 text-[#586272]">{r.slotLabel}</td>
                          <td className="py-3 pr-4">
                            <StatusBadgeText status={r.status} />
                          </td>
                          <td className="py-3 text-right">
                            {r.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => handleCancelReservation(r.id)}
                                className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <div className="mt-8 bg-white border border-[#E2DFD5] rounded-xl p-6">
            <h2 className="font-serif text-xl font-bold text-[#101D35] mb-4">Payment History</h2>
            {data.payments.length === 0 ? (
              <p className="text-sm text-[#737B89]">No payment transactions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-[#E2DFD5] text-xs text-[#737B89]">
                      <th className="py-2.5 pr-4">Transaction ID</th>
                      <th className="py-2.5 pr-4">Plan</th>
                      <th className="py-2.5 pr-4">Method</th>
                      <th className="py-2.5 pr-4">Date</th>
                      <th className="py-2.5 pr-4 text-right">Amount</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DFD5]">
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 pr-4 font-mono text-xs text-[#101D35] tabular-nums">
                          {p.transactionId}
                        </td>
                        <td className="py-3 pr-4">{p.planNameSnapshot}</td>
                        <td className="py-3 pr-4 uppercase text-xs text-[#586272]">
                          {p.paymentMethod.replace('_', ' ')}
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-[#586272]">
                          {new Date(p.paidAt || p.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                          &#8377;{p.amountInr.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadgeText status={p.status} />
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(p.id)}
                            className="text-xs font-semibold text-[#101D35] hover:underline cursor-pointer"
                          >
                            View Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="mt-8 bg-white border border-[#E2DFD5] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-bold text-[#101D35]">Notifications</h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-[#101D35] hover:underline cursor-pointer"
                >
                  Mark All Read
                </button>
              )}
            </div>
            {data.notifications.length === 0 ? (
              <p className="text-sm text-[#737B89]">No notifications yet.</p>
            ) : (
              <div className="space-y-3">
                {data.notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-lg border ${
                      n.isRead
                        ? 'border-[#E2DFD5] bg-[#FDFCF9]'
                        : 'border-[#D4AD62] bg-[#FFFDF8]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-[#737B89] capitalize">
                          {n.type} ·{' '}
                          <span className="tabular-nums">
                            {new Date(n.createdAt).toLocaleString('en-IN')}
                          </span>
                        </p>
                        <h3 className="mt-1 font-semibold text-sm text-[#101D35]">{n.title}</h3>
                        <p className="mt-1 text-sm text-[#4A5362]">{n.message}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkNotificationRead(n.id)}
                          className="text-xs font-semibold text-[#BA9245] hover:text-[#101D35] shrink-0 cursor-pointer"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {activeTab === 'announcements' && (
          <div className="mt-8 bg-white border border-[#E2DFD5] rounded-xl p-6">
            <h2 className="font-serif text-xl font-bold text-[#101D35] mb-4">
              Library Announcements
            </h2>
            {data.announcements.length === 0 ? (
              <p className="text-sm text-[#737B89]">
                No announcements have been published by administration.
              </p>
            ) : (
              <div className="space-y-4">
                {data.announcements.map((a) => (
                  <div key={a.id} className="p-5 rounded-lg border border-[#E2DFD5] bg-[#FDFCF9]">
                    <div className="flex items-center justify-between gap-3 text-xs text-[#737B89]">
                      <span className="font-semibold uppercase text-[#BA9245]">{a.priority}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(a.publishedAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-serif text-lg font-bold text-[#101D35]">
                      {a.title}
                    </h3>
                    <p className="mt-2 text-sm text-[#4A5362] leading-relaxed">{a.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <ReceiptModal receipt={receiptData} onClose={() => setReceiptData(null)} />
    </div>
  );
}
