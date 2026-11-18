export type UserRole = 'member' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MemberProfile {
  id: string;
  userId: string;
  category: string;
  institutionName: string;
  courseOrExam: string;
  address: string;
  preferredShift: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  durationDays: number;
  durationLabel: string;
  priceInr: number | null;
  facilitiesIncluded: string[];
  termsAndConditions: string;
  description: string;
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface Membership {
  id: string;
  userId: string;
  planId: string;
  planNameSnapshot: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled' | 'renewal_requested';
  startDate: string | null;
  expiryDate: string | null;
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'refunded';
  renewalRequestedAt: string | null;
  renewalPlanId: string | null;
  createdAt: string;
}

export type SeatCategory = 'Standard Desk' | 'Silent Carrel' | 'Window Desk' | 'Power Desk';

export interface SeatWithAvailability {
  id: string;
  seatNumber: string;
  rowLabel: string;
  columnIndex: number;
  category: SeatCategory;
  status: 'active' | 'maintenance';
  notes: string;
  availability: 'available' | 'occupied' | 'reserved_by_you' | 'maintenance';
  reservedByCurrentUser: boolean;
}

export interface SeatReservation {
  id: string;
  seatId: string;
  seatNumberSnapshot: string;
  userId: string;
  startDate: string;
  endDate: string;
  slotLabel: string;
  status: 'active' | 'cancelled' | 'completed';
  assignedByAdmin: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  userId: string;
  membershipId: string | null;
  planId: string | null;
  planNameSnapshot: string;
  amountInr: number;
  currency: string;
  paymentMethod: 'razorpay' | 'cash' | 'upi_desk';
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  paidAt: string | null;
  notes: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'registration' | 'membership' | 'payment' | 'reservation' | 'announcement' | 'renewal';
  isRead: boolean;
  createdAt: string;
}

export interface LibraryAnnouncement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important';
  isPublished: boolean;
  publishedAt: string;
}

export interface Facility {
  id: string;
  title: string;
  description: string;
  iconName: string;
  isAvailable: boolean;
  displayOrder: number;
}

export interface GalleryImage {
  id: string;
  title: string;
  caption: string;
  category: string;
  imageUrl: string;
  displayOrder: number;
  isVisible: boolean;
}

export interface LibraryRule {
  id: string;
  title: string;
  description: string;
  category: string;
  displayOrder: number;
  isActive: boolean;
}

export interface LibrarySettings {
  libraryName: string;
  tagline: string;
  address: string;
  operatingHours: string;
  phone: string;
  email: string;
  googleMapsUrl: string;
  aboutHeading: string;
  aboutBody: string;
  aboutSecondaryBody: string;
  seatCancellationHoursNotice: number;
  allowSelfSeatReservation: boolean;
  requireApprovalBeforeSeatBooking: boolean;
  socialLinks: {
    instagram: string;
    facebook: string;
    youtube: string;
    whatsapp: string;
  };
  privacyPolicyText: string;
  termsText: string;
}

export interface PublicSiteData {
  settings: LibrarySettings;
  facilities: Facility[];
  gallery: GalleryImage[];
  plans: MembershipPlan[];
  rules: LibraryRule[];
  announcements: LibraryAnnouncement[];
}
