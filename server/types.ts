export type UserRole = 'member' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type MemberCategory =
  | 'School Student'
  | 'College Student'
  | 'Competitive Exam Aspirant'
  | 'Independent Learner'
  | 'Working Professional';

export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  passwordHash: string;
  role: UserRole;
  accountStatus: AccountStatus;
  resetTokenHash: string | null;
  resetTokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberProfile {
  id: string;
  userId: string;
  category: MemberCategory;
  institutionName: string;
  courseOrExam: string;
  address: string;
  preferredShift: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationApplication {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNotes: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  updatedAt: string;
}

export type SeatCategory = 'Standard Desk' | 'Silent Carrel' | 'Window Desk' | 'Power Desk';

export interface Seat {
  id: string;
  seatNumber: string;
  rowLabel: string;
  columnIndex: number;
  category: SeatCategory;
  status: 'active' | 'maintenance';
  notes: string;
  createdAt: string;
  updatedAt: string;
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
  updatedAt: string;
}

export interface Booking {
  id: string;
  userId: string;
  membershipId: string | null;
  reservationId: string | null;
  bookingType: 'membership' | 'seat' | 'renewal';
  status: 'pending' | 'confirmed' | 'cancelled';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  idempotencyKey: string;
  userId: string;
  membershipId: string | null;
  planId: string | null;
  planNameSnapshot: string;
  amountInr: number;
  currency: string;
  paymentMethod: 'razorpay' | 'cash' | 'upi_desk';
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  paidAt: string | null;
  recordedByAdminId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'registration' | 'membership' | 'payment' | 'reservation' | 'announcement' | 'renewal';
  isRead: boolean;
  relatedEntityId: string | null;
  createdAt: string;
}

export interface LibraryAnnouncement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important';
  isPublished: boolean;
  publishedAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Facility {
  id: string;
  title: string;
  description: string;
  iconName: string;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryImage {
  id: string;
  title: string;
  caption: string;
  category: string;
  imageUrl: string;
  displayOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryRule {
  id: string;
  title: string;
  description: string;
  category: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactEnquiry {
  id: string;
  name: string;
  email: string;
  mobile: string;
  subject: string;
  message: string;
  status: 'new' | 'reviewed' | 'resolved';
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
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
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  memberProfiles: MemberProfile[];
  registrationApplications: RegistrationApplication[];
  membershipPlans: MembershipPlan[];
  memberships: Membership[];
  seats: Seat[];
  seatReservations: SeatReservation[];
  bookings: Booking[];
  payments: Payment[];
  notifications: Notification[];
  libraryAnnouncements: LibraryAnnouncement[];
  facilities: Facility[];
  galleryImages: GalleryImage[];
  libraryRules: LibraryRule[];
  contactEnquiries: ContactEnquiry[];
  librarySettings: LibrarySettings;
  auditLogs: AuditLog[];
}
