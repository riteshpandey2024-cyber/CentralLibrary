import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Armchair,
  Bell,
  BookOpen,
  Check,
  CreditCard,
  FileText,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Scale,
  Settings,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { ReceiptModal, type ReceiptData } from '../components/ReceiptModal.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type {
  Facility,
  GalleryImage,
  LibraryAnnouncement,
  LibraryRule,
  LibrarySettings,
  MembershipPlan,
  SeatCategory,
  User,
} from '../types.ts';

type AdminTab =
  | 'overview'
  | 'applications'
  | 'members'
  | 'plans'
  | 'seats'
  | 'payments'
  | 'announcements'
  | 'facilities'
  | 'gallery'
  | 'rules'
  | 'enquiries'
  | 'settings';

interface DashboardSummary {
  stats: {
    totalMembers: number;
    activeMembers: number;
    pendingApplications: number;
    expiredMemberships: number;
    totalSeats: number;
    availableSeats: number;
    occupiedSeats: number;
    monthlyRevenue: number;
    newEnquiries: number;
  };
  recentRegistrations: Array<User & { category: string; courseOrExam: string }>;
  recentPayments: Array<{
    id: string;
    transactionId: string;
    memberName: string;
    planNameSnapshot: string;
    amountInr: number;
    status: string;
    createdAt: string;
  }>;
}

interface AdminMemberRow extends User {
  profile: { category: string; institutionName: string; courseOrExam: string } | null;
  membership: {
    id: string;
    planId: string;
    planNameSnapshot: string;
    status: string;
    expiryDate: string | null;
  } | null;
  activeReservation: { id: string; seatNumberSnapshot: string } | null;
  totalPaidInr: number;
}

interface ApplicationRow {
  id: string;
  status: string;
  reviewNotes: string;
  createdAt: string;
  user: User | null;
  profile: { category: string; institutionName: string; courseOrExam: string } | null;
  membership: { planNameSnapshot: string } | null;
}

interface SeatRow {
  id: string;
  seatNumber: string;
  rowLabel: string;
  columnIndex: number;
  category: SeatCategory;
  status: 'active' | 'maintenance';
  occupantName: string | null;
}

interface ReservationRow {
  id: string;
  seatNumberSnapshot: string;
  memberName: string;
  memberMobile: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface AdminPaymentRow {
  id: string;
  transactionId: string;
  memberName: string;
  memberMobile: string;
  planNameSnapshot: string;
  amountInr: number;
  paymentMethod: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  paidAt: string | null;
  createdAt: string;
}

interface EnquiryRow {
  id: string;
  name: string;
  email: string;
  mobile: string;
  subject: string;
  message: string;
  status: 'new' | 'reviewed' | 'resolved';
  adminNotes: string;
  createdAt: string;
}

export function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { showToast, confirmAction } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [paySearch, setPaySearch] = useState('');
  const [payFilter, setPayFilter] = useState('all');

  const [announcements, setAnnouncements] = useState<LibraryAnnouncement[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [rules, setRules] = useState<LibraryRule[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [settings, setSettings] = useState<LibrarySettings | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Forms
  const [newPlan, setNewPlan] = useState({
    name: '',
    durationDays: '30',
    durationLabel: '1 Month',
    priceInr: '',
    description: '',
    facilitiesText: '',
    termsAndConditions: '',
  });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const [newSeat, setNewSeat] = useState({
    seatNumber: '',
    rowLabel: 'Row D',
    category: 'Standard Desk' as SeatCategory,
  });
  const [batchSeat, setBatchSeat] = useState({
    rowPrefix: 'D',
    count: '4',
    category: 'Standard Desk' as SeatCategory,
  });
  const [assignSeatForm, setAssignSeatForm] = useState({
    seatId: '',
    userId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });

  const [offlinePay, setOfflinePay] = useState({
    userId: '',
    planId: '',
    amountInr: '',
    paymentMethod: 'cash' as 'cash' | 'upi_desk',
    notes: '',
  });

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal' as 'normal' | 'important',
    notifyAllMembers: true,
  });

  const [directNotify, setDirectNotify] = useState({
    userId: 'all',
    title: '',
    message: '',
  });

  const [newFacility, setNewFacility] = useState({
    title: '',
    description: '',
    iconName: 'BookOpen',
  });

  const [newGallery, setNewGallery] = useState({
    title: '',
    caption: '',
    category: 'Library Interior',
    imageUrl: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const [newRule, setNewRule] = useState({
    title: '',
    description: '',
    category: 'Discipline',
  });

  const loadAll = useCallback(async () => {
    try {
      const [
        dashRes,
        appRes,
        memRes,
        planRes,
        seatRes,
        resRes,
        payRes,
        annRes,
        facRes,
        galRes,
        ruleRes,
        enqRes,
        setRes,
      ] = await Promise.all([
        apiRequest<DashboardSummary>('/api/admin/dashboard'),
        apiRequest<ApplicationRow[]>('/api/admin/applications'),
        apiRequest<AdminMemberRow[]>(
          `/api/admin/members?search=${encodeURIComponent(memberSearch)}&status=${encodeURIComponent(
            memberFilter,
          )}`,
        ),
        apiRequest<MembershipPlan[]>('/api/admin/membership-plans'),
        apiRequest<SeatRow[]>('/api/admin/seats'),
        apiRequest<ReservationRow[]>('/api/admin/reservations'),
        apiRequest<AdminPaymentRow[]>(
          `/api/admin/payments?status=${encodeURIComponent(payFilter)}&search=${encodeURIComponent(
            paySearch,
          )}`,
        ),
        apiRequest<LibraryAnnouncement[]>('/api/admin/announcements'),
        apiRequest<Facility[]>('/api/admin/facilities'),
        apiRequest<GalleryImage[]>('/api/admin/gallery'),
        apiRequest<LibraryRule[]>('/api/admin/rules'),
        apiRequest<EnquiryRow[]>('/api/admin/enquiries'),
        apiRequest<LibrarySettings>('/api/admin/settings'),
      ]);
      setSummary(dashRes);
      setApplications(appRes);
      setMembers(memRes);
      setPlans(planRes);
      setSeats(seatRes);
      setReservations(resRes);
      setPayments(payRes);
      setAnnouncements(annRes);
      setFacilities(facRes);
      setGallery(galRes);
      setRules(ruleRes);
      setEnquiries(enqRes);
      setSettings(setRes);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load admin data.', 'error');
    }
  }, [memberSearch, memberFilter, payFilter, paySearch, showToast]);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      navigate('/login');
      return;
    }
    if (user && user.role === 'admin') {
      void loadAll();
    }
  }, [user, authLoading, navigate, loadAll]);

  const handleApplicationDecision = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await apiRequest(`/api/admin/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, activateMembership: status === 'approved' }),
      });
      showToast(`Application ${status}.`, 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update application.', 'error');
    }
  };

  const handleMemberStatusChange = async (memberId: string, accountStatus: string) => {
    try {
      await apiRequest(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ accountStatus }),
      });
      showToast(`Member status updated to ${accountStatus}.`, 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update member.', 'error');
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: newPlan.name,
      durationDays: Number(newPlan.durationDays),
      durationLabel: newPlan.durationLabel,
      priceInr: newPlan.priceInr.trim() ? Number(newPlan.priceInr) : null,
      description: newPlan.description,
      facilitiesIncluded: newPlan.facilitiesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      termsAndConditions: newPlan.termsAndConditions,
    };

    try {
      if (editingPlanId) {
        await apiRequest(`/api/admin/membership-plans/${editingPlanId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast('Membership plan updated.', 'success');
      } else {
        await apiRequest('/api/admin/membership-plans', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Membership plan created.', 'success');
      }
      setEditingPlanId(null);
      setNewPlan({
        name: '',
        durationDays: '30',
        durationLabel: '1 Month',
        priceInr: '',
        description: '',
        facilitiesText: '',
        termsAndConditions: '',
      });
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save plan.', 'error');
    }
  };

  const handleAddSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/seats', {
        method: 'POST',
        body: JSON.stringify(newSeat),
      });
      setNewSeat({ seatNumber: '', rowLabel: 'Row D', category: 'Standard Desk' });
      showToast('Seat added.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add seat.', 'error');
    }
  };

  const handleBatchSeats = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/seats/batch', {
        method: 'POST',
        body: JSON.stringify({
          rowPrefix: batchSeat.rowPrefix,
          count: Number(batchSeat.count),
          category: batchSeat.category,
        }),
      });
      showToast('Batch seats generated.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to generate seats.', 'error');
    }
  };

  const handleAssignSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/reservations', {
        method: 'POST',
        body: JSON.stringify(assignSeatForm),
      });
      showToast('Seat assigned to member.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to assign seat.', 'error');
    }
  };

  const handleRecordOfflinePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/payments/record-offline', {
        method: 'POST',
        body: JSON.stringify({
          ...offlinePay,
          amountInr: Number(offlinePay.amountInr),
          activateMembership: true,
        }),
      });
      setOfflinePay({ userId: '', planId: '', amountInr: '', paymentMethod: 'cash', notes: '' });
      showToast('Payment recorded and receipt generated.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to record payment.', 'error');
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(newAnnouncement),
      });
      setNewAnnouncement({ title: '', content: '', priority: 'normal', notifyAllMembers: true });
      showToast('Announcement published.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to publish announcement.', 'error');
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify(directNotify),
      });
      setDirectNotify({ userId: 'all', title: '', message: '' });
      showToast('Notification dispatched.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to send notification.', 'error');
    }
  };

  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/facilities', {
        method: 'POST',
        body: JSON.stringify(newFacility),
      });
      setNewFacility({ title: '', description: '', iconName: 'BookOpen' });
      showToast('Facility added.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add facility.', 'error');
    }
  };

  const handleGalleryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('File read error'));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest<{ imageUrl: string }>('/api/admin/gallery/upload', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, dataUrl }),
      });
      setNewGallery((p) => ({ ...p, imageUrl: res.imageUrl }));
      showToast('Image uploaded. Enter title and save to gallery.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/gallery', {
        method: 'POST',
        body: JSON.stringify(newGallery),
      });
      setNewGallery({ title: '', caption: '', category: 'Library Interior', imageUrl: '' });
      showToast('Gallery image added.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save gallery item.', 'error');
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/rules', {
        method: 'POST',
        body: JSON.stringify(newRule),
      });
      setNewRule({ title: '', description: '', category: 'Discipline' });
      showToast('Library rule added.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add rule.', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      showToast('Website settings saved and published.', 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save settings.', 'error');
    }
  };

  const handleDeleteWithConfirm = async (label: string, endpoint: string) => {
    const ok = await confirmAction({
      title: `Delete ${label}`,
      message: `Are you sure you want to remove this ${label.toLowerCase()}?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await apiRequest(endpoint, { method: 'DELETE' });
    showToast(`${label} deleted.`, 'success');
    await loadAll();
  };

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'applications',
      label: 'Registration Requests',
      icon: <UserCheck className="w-4 h-4" />,
      badge: summary?.stats.pendingApplications || undefined,
    },
    { id: 'members', label: 'Member Management', icon: <Users className="w-4 h-4" /> },
    { id: 'plans', label: 'Membership Plans', icon: <FileText className="w-4 h-4" /> },
    { id: 'seats', label: 'Seats & Reservations', icon: <Armchair className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'announcements', label: 'Announcements & Alerts', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'facilities', label: 'Facilities Management', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'gallery', label: 'Gallery Management', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'rules', label: 'Library Rules', icon: <Scale className="w-4 h-4" /> },
    {
      id: 'enquiries',
      label: 'Contact Enquiries',
      icon: <Mail className="w-4 h-4" />,
      badge: summary?.stats.newEnquiries || undefined,
    },
    { id: 'settings', label: 'Website Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center p-6">
        <p className="text-sm text-[#586272]">Loading administration console...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F0] flex flex-col lg:flex-row">
      {/* Mobile Bar */}
      <header className="lg:hidden bg-[#101D35] text-[#F8F6F0] px-4 h-14 flex items-center justify-between sticky top-0 z-30">
        <BrandLogo variant="navbar" light />
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 rounded-lg border border-[#253D61]"
          aria-label="Toggle admin menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? 'fixed inset-0 z-40 flex' : 'hidden'
        } lg:flex lg:w-68 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen flex-col bg-[#101D35] text-[#F8F6F0] border-r border-[#172943]`}
      >
        <div className="p-5 border-b border-[#1E3354] flex items-center justify-between">
          <Link to="/">
            <BrandLogo variant="stacked" light />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-[#C7CEDB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-[#D4AD62] text-[#101D35] font-semibold'
                  : 'text-[#C7CEDB] hover:bg-[#172943] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
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
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm text-[#C7CEDB] hover:bg-[#172943] hover:text-white"
          >
            <Home className="w-4 h-4" />
            <span>View Public Website</span>
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm text-[#C7CEDB] hover:bg-[#172943] hover:text-white cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 min-w-0 p-4 sm:p-8 lg:p-10 max-w-7xl">
        <div className="pb-6 border-b border-[#E2DFD5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#737B89]">
              Administration <span aria-hidden="true">/</span>{' '}
              {navItems.find((n) => n.id === tab)?.label}
            </p>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-[#101D35]">
              {navItems.find((n) => n.id === tab)?.label}
            </h1>
          </div>
          <p className="text-xs text-[#586272]">Signed in as {user.fullName}</p>
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && summary && (
          <div className="mt-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: 'Total Registered Members', val: summary.stats.totalMembers },
                { label: 'Active Members', val: summary.stats.activeMembers },
                { label: 'Pending Applications', val: summary.stats.pendingApplications },
                { label: 'Expired Memberships', val: summary.stats.expiredMemberships },
                { label: 'Available Seats Today', val: summary.stats.availableSeats },
                { label: 'Occupied Seats Today', val: summary.stats.occupiedSeats },
                {
                  label: 'Monthly Revenue',
                  val: `₹${summary.stats.monthlyRevenue.toLocaleString('en-IN')}`,
                },
                { label: 'New Contact Enquiries', val: summary.stats.newEnquiries },
              ].map((kpi) => (
                <div key={kpi.label} className="p-5 rounded-xl bg-white border border-[#E2DFD5]">
                  <p className="text-xs text-[#737B89]">{kpi.label}</p>
                  <p className="mt-2 font-serif text-3xl font-bold text-[#101D35] tabular-nums">
                    {kpi.val}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-white border border-[#E2DFD5]">
                <h2 className="font-serif text-lg font-bold text-[#101D35] mb-4">
                  Recent Registrations
                </h2>
                {summary.recentRegistrations.length === 0 ? (
                  <p className="text-sm text-[#737B89]">No registered members yet.</p>
                ) : (
                  <div className="divide-y divide-[#E2DFD5] text-sm">
                    {summary.recentRegistrations.map((r) => (
                      <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[#101D35]">{r.fullName}</p>
                          <p className="text-xs text-[#737B89]">
                            {r.category || 'Member'} · {r.mobile}
                          </p>
                        </div>
                        <span className="text-xs font-semibold capitalize text-[#101D35]">
                          {r.accountStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-xl bg-white border border-[#E2DFD5]">
                <h2 className="font-serif text-lg font-bold text-[#101D35] mb-4">
                  Recent Payments
                </h2>
                {summary.recentPayments.length === 0 ? (
                  <p className="text-sm text-[#737B89]">No payments recorded yet.</p>
                ) : (
                  <div className="divide-y divide-[#E2DFD5] text-sm">
                    {summary.recentPayments.map((p) => (
                      <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[#101D35]">{p.memberName}</p>
                          <p className="text-xs text-[#737B89] font-mono tabular-nums">
                            {p.transactionId} · {p.planNameSnapshot}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">
                            &#8377;{p.amountInr.toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs capitalize text-[#737B89]">{p.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REGISTRATION APPLICATIONS */}
        {tab === 'applications' && (
          <div className="mt-8 bg-white border border-[#E2DFD5] rounded-xl p-6">
            {applications.length === 0 ? (
              <p className="text-sm text-[#737B89]">No registration applications found.</p>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="p-5 rounded-lg border border-[#E2DFD5] bg-[#FDFCF9] flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-serif text-lg font-bold text-[#101D35]">
                          {app.user?.fullName || 'Applicant'}
                        </span>
                        <span className="text-xs font-semibold uppercase text-[#BA9245]">
                          {app.status}
                        </span>
                      </div>
                      <p className="text-[#586272]">
                        {app.user?.email} · <span className="font-mono">{app.user?.mobile}</span>
                      </p>
                      <p className="text-xs text-[#737B89]">
                        {app.profile?.category}
                        {app.profile?.courseOrExam ? ` · ${app.profile.courseOrExam}` : ''}
                        {app.membership ? ` · Selected: ${app.membership.planNameSnapshot}` : ''}
                      </p>
                    </div>
                    {app.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApplicationDecision(app.id, 'approved')}
                          className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                        >
                          Approve &amp; Activate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplicationDecision(app.id, 'rejected')}
                          className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MEMBER MANAGEMENT */}
        {tab === 'members' && (
          <div className="mt-8 bg-white border border-[#E2DFD5] rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search by name, email, or mobile..."
                className="flex-1 px-3.5 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
              />
              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="px-3.5 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {members.length === 0 ? (
              <p className="text-sm text-[#737B89]">No matching members.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-[#E2DFD5] text-xs text-[#737B89]">
                      <th className="py-2.5 pr-4">Member</th>
                      <th className="py-2.5 pr-4">Category / Exam</th>
                      <th className="py-2.5 pr-4">Membership</th>
                      <th className="py-2.5 pr-4">Seat</th>
                      <th className="py-2.5 pr-4">Total Paid</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DFD5]">
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-[#101D35]">{m.fullName}</p>
                          <p className="text-xs text-[#737B89] font-mono tabular-nums">
                            {m.mobile} · {m.email}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-xs text-[#586272]">
                          {m.profile?.category}
                          {m.profile?.courseOrExam ? ` (${m.profile.courseOrExam})` : ''}
                        </td>
                        <td className="py-3 pr-4 text-xs">
                          <p className="font-medium text-[#101D35]">
                            {m.membership?.planNameSnapshot || 'None'}
                          </p>
                          <p className="text-[#737B89] capitalize">
                            {m.membership?.status || '—'}
                          </p>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">
                          {m.activeReservation?.seatNumberSnapshot || '—'}
                        </td>
                        <td className="py-3 pr-4 font-semibold tabular-nums">
                          &#8377;{m.totalPaidInr.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 pr-4 capitalize font-medium text-xs">
                          {m.accountStatus}
                        </td>
                        <td className="py-3 text-right space-x-2">
                          {m.accountStatus !== 'active' && (
                            <button
                              type="button"
                              onClick={() => handleMemberStatusChange(m.id, 'active')}
                              className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                            >
                              Activate
                            </button>
                          )}
                          {m.accountStatus !== 'suspended' && (
                            <button
                              type="button"
                              onClick={() => handleMemberStatusChange(m.id, 'suspended')}
                              className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                            >
                              Suspend
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
        )}

        {/* MEMBERSHIP PLANS */}
        {tab === 'plans' && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white border border-[#E2DFD5] rounded-xl p-6 h-fit">
              <h2 className="font-serif text-lg font-bold text-[#101D35] mb-4">
                {editingPlanId ? 'Edit Membership Plan' : 'Add Membership Plan'}
              </h2>
              <form onSubmit={handleSavePlan} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#101D35] mb-1">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPlan.name}
                    onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Monthly Full-Day Plan"
                    className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#101D35] mb-1">
                      Duration (Days) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newPlan.durationDays}
                      onChange={(e) => setNewPlan((p) => ({ ...p, durationDays: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#101D35] mb-1">
                      Duration Label
                    </label>
                    <input
                      type="text"
                      value={newPlan.durationLabel}
                      onChange={(e) =>
                        setNewPlan((p) => ({ ...p, durationLabel: e.target.value }))
                      }
                      placeholder="1 Month"
                      className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#101D35] mb-1">
                    Price in INR (leave blank to keep configurable at desk)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPlan.priceInr}
                    onChange={(e) => setNewPlan((p) => ({ ...p, priceInr: e.target.value }))}
                    placeholder="Leave empty or enter e.g. 1200"
                    className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#101D35] mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={newPlan.description}
                    onChange={(e) => setNewPlan((p) => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#101D35] mb-1">
                    Facilities Included (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={newPlan.facilitiesText}
                    onChange={(e) =>
                      setNewPlan((p) => ({ ...p, facilitiesText: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#101D35] mb-1">
                    Terms &amp; Conditions
                  </label>
                  <textarea
                    rows={2}
                    value={newPlan.termsAndConditions}
                    onChange={(e) =>
                      setNewPlan((p) => ({ ...p, termsAndConditions: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-lg bg-[#101D35] text-white text-sm font-semibold hover:bg-[#172943] cursor-pointer"
                  >
                    {editingPlanId ? 'Update Plan' : 'Create Plan'}
                  </button>
                  {editingPlanId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlanId(null);
                        setNewPlan({
                          name: '',
                          durationDays: '30',
                          durationLabel: '1 Month',
                          priceInr: '',
                          description: '',
                          facilitiesText: '',
                          termsAndConditions: '',
                        });
                      }}
                      className="px-4 py-2.5 rounded-lg border border-[#D6D2C7] text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {plans.map((pl) => (
                <div
                  key={pl.id}
                  className="p-5 rounded-xl bg-white border border-[#E2DFD5] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#101D35]">{pl.name}</h3>
                    <p className="text-xs text-[#737B89] tabular-nums">
                      {pl.durationLabel} ({pl.durationDays} days) ·{' '}
                      {pl.priceInr !== null ? `₹${pl.priceInr}` : 'Price configurable'} ·{' '}
                      {pl.isAvailable ? 'Available' : 'Closed'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlanId(pl.id);
                        setNewPlan({
                          name: pl.name,
                          durationDays: String(pl.durationDays),
                          durationLabel: pl.durationLabel,
                          priceInr: pl.priceInr !== null ? String(pl.priceInr) : '',
                          description: pl.description,
                          facilitiesText: pl.facilitiesIncluded.join('\n'),
                          termsAndConditions: pl.termsAndConditions,
                        });
                      }}
                      className="text-[#101D35] hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/admin/membership-plans/${pl.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ isAvailable: !pl.isAvailable }),
                        });
                        await loadAll();
                      }}
                      className="text-[#BA9245] hover:underline cursor-pointer"
                    >
                      {pl.isAvailable ? 'Pause' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteWithConfirm('Plan', `/api/admin/membership-plans/${pl.id}`)
                      }
                      className="text-red-700 hover:underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEATS & RESERVATIONS */}
        {tab === 'seats' && (
          <div className="mt-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add Single Seat */}
              <form
                onSubmit={handleAddSeat}
                className="p-5 rounded-xl bg-white border border-[#E2DFD5] space-y-3"
              >
                <h2 className="font-serif text-base font-bold text-[#101D35]">Add Single Seat</h2>
                <input
                  type="text"
                  required
                  value={newSeat.seatNumber}
                  onChange={(e) => setNewSeat((p) => ({ ...p, seatNumber: e.target.value }))}
                  placeholder="Seat Number (e.g., D-01)"
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
                <input
                  type="text"
                  value={newSeat.rowLabel}
                  onChange={(e) => setNewSeat((p) => ({ ...p, rowLabel: e.target.value }))}
                  placeholder="Row Label (e.g., Row D)"
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
                <select
                  value={newSeat.category}
                  onChange={(e) =>
                    setNewSeat((p) => ({ ...p, category: e.target.value as SeatCategory }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                >
                  <option value="Standard Desk">Standard Desk</option>
                  <option value="Silent Carrel">Silent Carrel</option>
                  <option value="Window Desk">Window Desk</option>
                  <option value="Power Desk">Power Desk</option>
                </select>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-[#101D35] text-white text-sm font-semibold cursor-pointer"
                >
                  Add Seat
                </button>
              </form>

              {/* Batch Generate Row */}
              <form
                onSubmit={handleBatchSeats}
                className="p-5 rounded-xl bg-white border border-[#E2DFD5] space-y-3"
              >
                <h2 className="font-serif text-base font-bold text-[#101D35]">
                  Batch Generate Row
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={batchSeat.rowPrefix}
                    onChange={(e) => setBatchSeat((p) => ({ ...p, rowPrefix: e.target.value }))}
                    placeholder="Row Prefix (D)"
                    className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={batchSeat.count}
                    onChange={(e) => setBatchSeat((p) => ({ ...p, count: e.target.value }))}
                    placeholder="Seat Count"
                    className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm tabular-nums"
                  />
                </div>
                <select
                  value={batchSeat.category}
                  onChange={(e) =>
                    setBatchSeat((p) => ({ ...p, category: e.target.value as SeatCategory }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                >
                  <option value="Standard Desk">Standard Desk</option>
                  <option value="Silent Carrel">Silent Carrel</option>
                  <option value="Window Desk">Window Desk</option>
                  <option value="Power Desk">Power Desk</option>
                </select>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-[#101D35] text-white text-sm font-semibold cursor-pointer"
                >
                  Generate Row Seats
                </button>
              </form>

              {/* Assign Seat to Member */}
              <form
                onSubmit={handleAssignSeat}
                className="p-5 rounded-xl bg-white border border-[#E2DFD5] space-y-3"
              >
                <h2 className="font-serif text-base font-bold text-[#101D35]">
                  Assign Seat to Member
                </h2>
                <select
                  required
                  value={assignSeatForm.seatId}
                  onChange={(e) => setAssignSeatForm((p) => ({ ...p, seatId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                >
                  <option value="">Select Seat</option>
                  {seats
                    .filter((s) => s.status === 'active')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.seatNumber} ({s.category})
                      </option>
                    ))}
                </select>
                <select
                  required
                  value={assignSeatForm.userId}
                  onChange={(e) => setAssignSeatForm((p) => ({ ...p, userId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                >
                  <option value="">Select Member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.mobile})
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={assignSeatForm.startDate}
                    onChange={(e) =>
                      setAssignSeatForm((p) => ({ ...p, startDate: e.target.value }))
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-[#D6D2C7] text-xs tabular-nums"
                  />
                  <input
                    type="date"
                    required
                    value={assignSeatForm.endDate}
                    onChange={(e) => setAssignSeatForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-lg border border-[#D6D2C7] text-xs tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-[#D4AD62] text-[#101D35] text-sm font-semibold cursor-pointer"
                >
                  Assign Seat
                </button>
              </form>
            </div>

            {/* Seat Inventory Table */}
            <div className="p-6 rounded-xl bg-white border border-[#E2DFD5]">
              <h3 className="font-serif text-lg font-bold text-[#101D35] mb-4">
                Configured Seats ({seats.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {seats.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-lg border border-[#E2DFD5] bg-[#FDFCF9] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-mono font-bold text-[#101D35]">
                      <span>{s.seatNumber}</span>
                      <span className="capitalize font-sans font-normal text-[#737B89]">
                        {s.status}
                      </span>
                    </div>
                    <p className="text-[#586272] truncate">{s.category}</p>
                    <p className="text-[#101D35] truncate font-medium">
                      {s.occupantName ? `Occupant: ${s.occupantName}` : 'Unoccupied today'}
                    </p>
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/seats/${s.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              status: s.status === 'active' ? 'maintenance' : 'active',
                            }),
                          });
                          await loadAll();
                        }}
                        className="text-[#BA9245] hover:underline cursor-pointer"
                      >
                        {s.status === 'active' ? 'Maintenance' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWithConfirm('Seat', `/api/admin/seats/${s.id}`)}
                        className="text-red-700 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reservations Table */}
            <div className="p-6 rounded-xl bg-white border border-[#E2DFD5]">
              <h3 className="font-serif text-lg font-bold text-[#101D35] mb-4">
                All Seat Reservations
              </h3>
              {reservations.length === 0 ? (
                <p className="text-sm text-[#737B89]">No reservations recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-[#E2DFD5] text-xs text-[#737B89]">
                        <th className="py-2 pr-4">Seat</th>
                        <th className="py-2 pr-4">Member</th>
                        <th className="py-2 pr-4">Dates</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2DFD5]">
                      {reservations.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 pr-4 font-mono font-semibold">
                            {r.seatNumberSnapshot}
                          </td>
                          <td className="py-2.5 pr-4">
                            {r.memberName}{' '}
                            <span className="text-xs text-[#737B89] font-mono">
                              ({r.memberMobile})
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 tabular-nums">
                            {r.startDate} to {r.endDate}
                          </td>
                          <td className="py-2.5 pr-4 capitalize">{r.status}</td>
                          <td className="py-2.5 text-right">
                            {r.status === 'active' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiRequest(`/api/admin/reservations/${r.id}`, {
                                    method: 'DELETE',
                                  });
                                  showToast('Reservation cancelled.', 'success');
                                  await loadAll();
                                }}
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

        {/* PAYMENTS */}
        {tab === 'payments' && (
          <div className="mt-8 space-y-6">
            <form
              onSubmit={handleRecordOfflinePayment}
              className="p-6 rounded-xl bg-white border border-[#E2DFD5]"
            >
              <h2 className="font-serif text-lg font-bold text-[#101D35] mb-4">
                Record Cash or Desk UPI Payment
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <select
                  required
                  value={offlinePay.userId}
                  onChange={(e) => setOfflinePay((p) => ({ ...p, userId: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                >
                  <option value="">Select Member *</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.mobile})
                    </option>
                  ))}
                </select>
                <select
                  value={offlinePay.planId}
                  onChange={(e) => {
                    const pl = plans.find((x) => x.id === e.target.value);
                    setOfflinePay((p) => ({
                      ...p,
                      planId: e.target.value,
                      amountInr: pl?.priceInr ? String(pl.priceInr) : p.amountInr,
                    }));
                  }}
                  className="px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                >
                  <option value="">Select Plan</option>
                  {plans.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  required
                  min="1"
                  value={offlinePay.amountInr}
                  onChange={(e) => setOfflinePay((p) => ({ ...p, amountInr: e.target.value }))}
                  placeholder="Amount (INR) *"
                  className="px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm tabular-nums"
                />
                <select
                  value={offlinePay.paymentMethod}
                  onChange={(e) =>
                    setOfflinePay((p) => ({
                      ...p,
                      paymentMethod: e.target.value as 'cash' | 'upi_desk',
                    }))
                  }
                  className="px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                >
                  <option value="cash">Cash at Desk</option>
                  <option value="upi_desk">UPI at Desk</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#101D35] text-white text-sm font-semibold hover:bg-[#172943] cursor-pointer"
                >
                  Record &amp; Activate
                </button>
              </div>
            </form>

            <div className="p-6 rounded-xl bg-white border border-[#E2DFD5] space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="search"
                  value={paySearch}
                  onChange={(e) => setPaySearch(e.target.value)}
                  placeholder="Search member or transaction ID..."
                  className="flex-1 px-3.5 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
                <select
                  value={payFilter}
                  onChange={(e) => setPayFilter(e.target.value)}
                  className="px-3.5 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Successful</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              {payments.length === 0 ? (
                <p className="text-sm text-[#737B89]">No payment records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-[#E2DFD5] text-xs text-[#737B89]">
                        <th className="py-2 pr-4">Transaction ID</th>
                        <th className="py-2 pr-4">Member</th>
                        <th className="py-2 pr-4">Plan</th>
                        <th className="py-2 pr-4">Method</th>
                        <th className="py-2 pr-4 text-right">Amount</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2DFD5]">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">
                            {p.transactionId}
                          </td>
                          <td className="py-2.5 pr-4">{p.memberName}</td>
                          <td className="py-2.5 pr-4">{p.planNameSnapshot}</td>
                          <td className="py-2.5 pr-4 uppercase text-xs">
                            {p.paymentMethod.replace('_', ' ')}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">
                            &#8377;{p.amountInr.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 pr-4 capitalize">{p.status}</td>
                          <td className="py-2.5 text-right space-x-2 text-xs font-semibold">
                            <button
                              type="button"
                              onClick={async () => {
                                const receipt = await apiRequest<ReceiptData>(
                                  `/api/payments/${p.id}/receipt`,
                                );
                                setReceiptData(receipt);
                              }}
                              className="text-[#101D35] hover:underline cursor-pointer"
                            >
                              Receipt
                            </button>
                            {p.status === 'success' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiRequest(`/api/admin/payments/${p.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ status: 'refunded' }),
                                  });
                                  await loadAll();
                                }}
                                className="text-red-700 hover:underline cursor-pointer"
                              >
                                Mark Refunded
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

        {/* ANNOUNCEMENTS & NOTIFICATIONS */}
        {tab === 'announcements' && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <form
                onSubmit={handlePublishAnnouncement}
                className="p-6 rounded-xl bg-white border border-[#E2DFD5] space-y-4"
              >
                <h2 className="font-serif text-lg font-bold text-[#101D35]">
                  Publish Library Announcement
                </h2>
                <input
                  type="text"
                  required
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Announcement Title"
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
                <textarea
                  rows={3}
                  required
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Announcement details..."
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
                <div className="flex items-center justify-between gap-4">
                  <select
                    value={newAnnouncement.priority}
                    onChange={(e) =>
                      setNewAnnouncement((p) => ({
                        ...p,
                        priority: e.target.value as 'normal' | 'important',
                      }))
                    }
                    className="px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="important">Important Notice</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs text-[#374151]">
                    <input
                      type="checkbox"
                      checked={newAnnouncement.notifyAllMembers}
                      onChange={(e) =>
                        setNewAnnouncement((p) => ({ ...p, notifyAllMembers: e.target.checked }))
                      }
                    />
                    Also notify members
                  </label>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#101D35] text-white text-sm font-semibold cursor-pointer"
                >
                  Publish Announcement
                </button>
              </form>

              <form
                onSubmit={handleSendNotification}
                className="p-6 rounded-xl bg-white border border-[#E2DFD5] space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#101D35]" />
                  <h2 className="font-serif text-lg font-bold text-[#101D35]">
                    Send Direct Notification
                  </h2>
                </div>
                <select
                  value={directNotify.userId}
                  onChange={(e) => setDirectNotify((p) => ({ ...p, userId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                >
                  <option value="all">All Registered Members</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.mobile})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={directNotify.title}
                  onChange={(e) => setDirectNotify((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Notification Title"
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
                <textarea
                  rows={2}
                  required
                  value={directNotify.message}
                  onChange={(e) => setDirectNotify((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Notification message..."
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#D4AD62] text-[#101D35] text-sm font-semibold cursor-pointer"
                >
                  Send Notification
                </button>
              </form>
            </div>

            <div className="p-6 rounded-xl bg-white border border-[#E2DFD5] space-y-4">
              <h2 className="font-serif text-lg font-bold text-[#101D35]">
                Published Announcements
              </h2>
              {announcements.length === 0 ? (
                <p className="text-sm text-[#737B89]">No announcements published yet.</p>
              ) : (
                announcements.map((a) => (
                  <div key={a.id} className="p-4 rounded-lg border border-[#E2DFD5] bg-[#FDFCF9]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[#101D35]">{a.title}</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteWithConfirm(
                            'Announcement',
                            `/api/admin/announcements/${a.id}`,
                          )
                        }
                        className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-[#586272]">{a.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* FACILITIES MANAGEMENT */}
        {tab === 'facilities' && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={handleAddFacility}
              className="lg:col-span-4 p-6 rounded-xl bg-white border border-[#E2DFD5] space-y-4 h-fit"
            >
              <h2 className="font-serif text-lg font-bold text-[#101D35]">Add Facility</h2>
              <input
                type="text"
                required
                value={newFacility.title}
                onChange={(e) => setNewFacility((p) => ({ ...p, title: e.target.value }))}
                placeholder="Facility Title"
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
              <textarea
                rows={3}
                required
                value={newFacility.description}
                onChange={(e) => setNewFacility((p) => ({ ...p, description: e.target.value }))}
                placeholder="Facility description..."
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
              <select
                value={newFacility.iconName}
                onChange={(e) => setNewFacility((p) => ({ ...p, iconName: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              >
                <option value="BookOpen">Study Desk</option>
                <option value="Armchair">Comfortable Seating</option>
                <option value="VolumeX">Silent Environment</option>
                <option value="Lightbulb">Lighting</option>
                <option value="Plug">Charging Sockets</option>
                <option value="Droplets">Drinking Water</option>
                <option value="Sparkles">Cleanliness</option>
                <option value="ShieldCheck">Security &amp; Safety</option>
              </select>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#101D35] text-white text-sm font-semibold cursor-pointer"
              >
                Add Facility
              </button>
            </form>

            <div className="lg:col-span-8 space-y-3">
              {facilities.map((f) => (
                <div
                  key={f.id}
                  className="p-5 rounded-xl bg-white border border-[#E2DFD5] flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-base font-bold text-[#101D35]">{f.title}</h3>
                      <span
                        className={`text-xs font-semibold ${
                          f.isAvailable ? 'text-emerald-700' : 'text-[#737B89]'
                        }`}
                      >
                        {f.isAvailable ? 'Visible on site' : 'Hidden'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#586272]">{f.description}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/admin/facilities/${f.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ isAvailable: !f.isAvailable }),
                        });
                        await loadAll();
                      }}
                      className="text-[#BA9245] hover:underline cursor-pointer"
                    >
                      {f.isAvailable ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteWithConfirm('Facility', `/api/admin/facilities/${f.id}`)
                      }
                      className="text-red-700 hover:underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GALLERY MANAGEMENT */}
        {tab === 'gallery' && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={handleAddGallery}
              className="lg:col-span-4 p-6 rounded-xl bg-white border border-[#E2DFD5] space-y-4 h-fit"
            >
              <h2 className="font-serif text-lg font-bold text-[#101D35]">Add Gallery Photo</h2>
              <div>
                <label className="block text-xs font-medium text-[#101D35] mb-1">
                  Upload Photo from Device
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleGalleryFileUpload}
                  className="w-full text-xs text-[#586272]"
                />
                {uploadingImage && (
                  <p className="text-xs text-[#BA9245] mt-1">Uploading image...</p>
                )}
              </div>
              <input
                type="text"
                required
                value={newGallery.imageUrl}
                onChange={(e) => setNewGallery((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="Or paste Image URL"
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
              <input
                type="text"
                required
                value={newGallery.title}
                onChange={(e) => setNewGallery((p) => ({ ...p, title: e.target.value }))}
                placeholder="Photo Title"
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
              <select
                value={newGallery.category}
                onChange={(e) => setNewGallery((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              >
                <option value="Library Interior">Library Interior</option>
                <option value="Study Desks">Study Desks</option>
                <option value="Seating Arrangements">Seating Arrangements</option>
                <option value="Reading Environment">Reading Environment</option>
                <option value="Common Areas">Common Areas</option>
              </select>
              <textarea
                rows={2}
                value={newGallery.caption}
                onChange={(e) => setNewGallery((p) => ({ ...p, caption: e.target.value }))}
                placeholder="Caption..."
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#101D35] text-white text-sm font-semibold cursor-pointer"
              >
                Save to Gallery
              </button>
            </form>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {gallery.map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl bg-white border border-[#E2DFD5] overflow-hidden"
                >
                  <div className="aspect-[4/3] bg-[#101D35]">
                    <ResilientImage
                      src={g.imageUrl}
                      alt={g.title}
                      className="w-full h-full object-cover"
                      fallbackTitle={g.title}
                    />
                  </div>
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#737B89]">{g.category}</p>
                      <h3 className="font-serif text-base font-bold text-[#101D35]">{g.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteWithConfirm('Gallery Photo', `/api/admin/gallery/${g.id}`)
                      }
                      className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIBRARY RULES */}
        {tab === 'rules' && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={handleAddRule}
              className="lg:col-span-4 p-6 rounded-xl bg-white border border-[#E2DFD5] space-y-4 h-fit"
            >
              <h2 className="font-serif text-lg font-bold text-[#101D35]">Add Library Rule</h2>
              <input
                type="text"
                required
                value={newRule.title}
                onChange={(e) => setNewRule((p) => ({ ...p, title: e.target.value }))}
                placeholder="Rule Title"
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
              <input
                type="text"
                value={newRule.category}
                onChange={(e) => setNewRule((p) => ({ ...p, category: e.target.value }))}
                placeholder="Category (e.g. Discipline)"
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
              <textarea
                rows={3}
                required
                value={newRule.description}
                onChange={(e) => setNewRule((p) => ({ ...p, description: e.target.value }))}
                placeholder="Rule description..."
                className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#101D35] text-white text-sm font-semibold cursor-pointer"
              >
                Add Rule
              </button>
            </form>

            <div className="lg:col-span-8 space-y-3">
              {rules.map((r, i) => (
                <div
                  key={r.id}
                  className="p-5 rounded-xl bg-white border border-[#E2DFD5] flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-xs text-[#737B89]">
                      <span className="font-mono font-semibold text-[#BA9245]">
                        {String(i + 1).padStart(2, '0')}.
                      </span>{' '}
                      {r.category}
                    </p>
                    <h3 className="font-serif text-base font-bold text-[#101D35] mt-0.5">
                      {r.title}
                    </h3>
                    <p className="mt-1 text-sm text-[#586272]">{r.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteWithConfirm('Rule', `/api/admin/rules/${r.id}`)}
                    className="text-xs font-semibold text-red-700 hover:underline shrink-0 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTACT ENQUIRIES */}
        {tab === 'enquiries' && (
          <div className="mt-8 bg-white border border-[#E2DFD5] rounded-xl p-6 space-y-4">
            {enquiries.length === 0 ? (
              <p className="text-sm text-[#737B89]">No contact enquiries received yet.</p>
            ) : (
              enquiries.map((enq) => (
                <div
                  key={enq.id}
                  className="p-5 rounded-lg border border-[#E2DFD5] bg-[#FDFCF9] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[#101D35]">{enq.name}</span>
                      <span className="text-xs uppercase font-semibold text-[#BA9245]">
                        {enq.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#737B89]">
                      {enq.email} {enq.mobile ? `· ${enq.mobile}` : ''} · {enq.subject}
                    </p>
                    <p className="text-sm text-[#374151] pt-1">{enq.message}</p>
                  </div>
                  {enq.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/admin/enquiries/${enq.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'resolved' }),
                        });
                        await loadAll();
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#101D35] text-white text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark Resolved
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* WEBSITE SETTINGS */}
        {tab === 'settings' && settings && (
          <form
            onSubmit={handleSaveSettings}
            className="mt-8 bg-white border border-[#E2DFD5] rounded-xl p-6 sm:p-8 space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-[#101D35] mb-1">
                  Library Name
                </label>
                <input
                  type="text"
                  value={settings.libraryName}
                  onChange={(e) =>
                    setSettings((s) => (s ? { ...s, libraryName: e.target.value } : s))
                  }
                  className="w-full px-3.5 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101D35] mb-1">
                  Operating Hours
                </label>
                <input
                  type="text"
                  value={settings.operatingHours}
                  onChange={(e) =>
                    setSettings((s) => (s ? { ...s, operatingHours: e.target.value } : s))
                  }
                  className="w-full px-3.5 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101D35] mb-1">
                  Official Phone Number
                </label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings((s) => (s ? { ...s, phone: e.target.value } : s))}
                  placeholder="+91 ..."
                  className="w-full px-3.5 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101D35] mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings((s) => (s ? { ...s, email: e.target.value } : s))}
                  placeholder="contact@centrallibrarykn.in"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101D35] mb-1">Address</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings((s) => (s ? { ...s, address: e.target.value } : s))}
                className="w-full px-3.5 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101D35] mb-1">
                About Section Heading
              </label>
              <input
                type="text"
                value={settings.aboutHeading}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, aboutHeading: e.target.value } : s))
                }
                className="w-full px-3.5 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101D35] mb-1">
                About Section Body
              </label>
              <textarea
                rows={3}
                value={settings.aboutBody}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, aboutBody: e.target.value } : s))
                }
                className="w-full px-3.5 py-2 rounded-lg border border-[#D6D2C7] text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E2DFD5]">
              <label className="flex items-center gap-2 text-sm text-[#101D35]">
                <input
                  type="checkbox"
                  checked={settings.allowSelfSeatReservation}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, allowSelfSeatReservation: e.target.checked } : s,
                    )
                  }
                />
                Allow member seat reservation
              </label>
              <label className="flex items-center gap-2 text-sm text-[#101D35]">
                <input
                  type="checkbox"
                  checked={settings.requireApprovalBeforeSeatBooking}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, requireApprovalBeforeSeatBooking: e.target.checked } : s,
                    )
                  }
                />
                Require approval before booking
              </label>
              <div>
                <label className="block text-xs text-[#586272] mb-1">
                  Cancellation Notice (Hours)
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.seatCancellationHoursNotice}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, seatCancellationHoursNotice: Number(e.target.value) } : s,
                    )
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-[#D6D2C7] text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E2DFD5]">
              <div>
                <label className="block text-xs font-medium text-[#586272] mb-1">
                  Instagram URL
                </label>
                <input
                  type="url"
                  value={settings.socialLinks.instagram}
                  onChange={(e) =>
                    setSettings((s) =>
                      s
                        ? { ...s, socialLinks: { ...s.socialLinks, instagram: e.target.value } }
                        : s,
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#586272] mb-1">
                  WhatsApp / Channel Link
                </label>
                <input
                  type="url"
                  value={settings.socialLinks.whatsapp}
                  onChange={(e) =>
                    setSettings((s) =>
                      s
                        ? { ...s, socialLinks: { ...s.socialLinks, whatsapp: e.target.value } }
                        : s,
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#D6D2C7] text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-[#101D35] text-white text-sm font-semibold hover:bg-[#172943] cursor-pointer"
            >
              Save Website Settings
            </button>
          </form>
        )}
      </main>

      <ReceiptModal receipt={receiptData} onClose={() => setReceiptData(null)} />
    </div>
  );
}
