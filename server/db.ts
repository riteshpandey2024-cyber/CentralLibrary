import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DatabaseSchema } from './types.ts';
import { hashPassword } from './auth.ts';

const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || 'data');
const DB_FILE = path.join(DATA_DIR, 'library-db.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function buildInitialData(): DatabaseSchema {
  const ts = nowIso();

  const users: DatabaseSchema['users'] = [];
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (bootstrapEmail && bootstrapPassword) {
    users.push({
      id: createId('usr'),
      fullName: 'Library Administrator',
      email: bootstrapEmail,
      mobile: '0000000000',
      passwordHash: hashPassword(bootstrapPassword),
      role: 'admin',
      accountStatus: 'active',
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  return {
    users,
    memberProfiles: [],
    registrationApplications: [],
    membershipPlans: [
      {
        id: createId('plan'),
        name: 'Monthly Membership',
        durationDays: 30,
        durationLabel: '1 Month',
        priceInr: null,
        facilitiesIncluded: [
          'Full access during operating hours (7:00 AM – 10:00 PM)',
          'Dedicated study desk access',
          'Drinking water and charging point access',
        ],
        termsAndConditions:
          'Valid for 30 calendar days from activation. Subject to library silence and cleanliness guidelines.',
        description: 'Flexible monthly study access for regular preparation and short-term examination sprints.',
        isAvailable: true,
        isActive: true,
        displayOrder: 1,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('plan'),
        name: 'Quarterly Membership',
        durationDays: 90,
        durationLabel: '3 Months',
        priceInr: null,
        facilitiesIncluded: [
          'Full access during operating hours (7:00 AM – 10:00 PM)',
          'Priority desk reservation eligibility',
          'All confirmed study hall amenities',
        ],
        termsAndConditions:
          'Valid for 90 calendar days from activation. Renewal requests may be submitted prior to expiry.',
        description: 'Structured three-month plan suited for semester coursework and focused test series cycles.',
        isAvailable: true,
        isActive: true,
        displayOrder: 2,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('plan'),
        name: 'Half-Yearly Membership',
        durationDays: 180,
        durationLabel: '6 Months',
        priceInr: null,
        facilitiesIncluded: [
          'Full access during operating hours (7:00 AM – 10:00 PM)',
          'Seat reservation eligibility across study zones',
          'All confirmed study hall amenities',
        ],
        termsAndConditions:
          'Valid for 180 calendar days from activation. Non-transferable individual membership.',
        description: 'Consistent six-month study commitment designed for competitive examination aspirants.',
        isAvailable: true,
        isActive: true,
        displayOrder: 3,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('plan'),
        name: 'Annual Membership',
        durationDays: 365,
        durationLabel: '12 Months',
        priceInr: null,
        facilitiesIncluded: [
          'Year-round access during operating hours (7:00 AM – 10:00 PM)',
          'Full seat reservation access and priority renewals',
          'All confirmed study hall amenities',
        ],
        termsAndConditions:
          'Valid for 365 calendar days from activation. Governed by Central Library Krishna Nagar rules.',
        description: 'Long-term academic membership for year-round preparation and uninterrupted daily routine.',
        isAvailable: true,
        isActive: true,
        displayOrder: 4,
        createdAt: ts,
        updatedAt: ts,
      },
    ],
    memberships: [],
    seats: [
      ...['A', 'B', 'C'].flatMap((row, rIdx) =>
        [1, 2, 3, 4].map((col) => ({
          id: createId('seat'),
          seatNumber: `${row}-${String(col).padStart(2, '0')}`,
          rowLabel: `Row ${row}`,
          columnIndex: col,
          category:
            rIdx === 0
              ? ('Silent Carrel' as const)
              : col === 1
                ? ('Window Desk' as const)
                : ('Standard Desk' as const),
          status: 'active' as const,
          notes: '',
          createdAt: ts,
          updatedAt: ts,
        })),
      ),
    ],
    seatReservations: [],
    bookings: [],
    payments: [],
    notifications: [],
    libraryAnnouncements: [],
    facilities: [
      {
        id: createId('fac'),
        title: 'Comfortable Study Seating',
        description: 'Ergonomic chairs designed to support long, uninterrupted hours of focused academic reading and writing.',
        iconName: 'Armchair',
        isAvailable: true,
        displayOrder: 1,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('fac'),
        title: 'Dedicated Study Desks',
        description: 'Spacious individual desks arranged to give every learner personal workspace and minimal visual distraction.',
        iconName: 'BookOpen',
        isAvailable: true,
        displayOrder: 2,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('fac'),
        title: 'Peaceful Study Environment',
        description: 'A disciplined, quiet reading hall culture where every member respects shared concentration.',
        iconName: 'VolumeX',
        isAvailable: true,
        displayOrder: 3,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('fac'),
        title: 'Proper Lighting',
        description: 'Balanced ambient and desk illumination calibrated for eye comfort across morning and evening hours.',
        iconName: 'Lightbulb',
        isAvailable: true,
        displayOrder: 4,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('fac'),
        title: 'Charging Facilities',
        description: 'Accessible power sockets at study desks to keep laptops, tablets, and study devices powered throughout the day.',
        iconName: 'Plug',
        isAvailable: true,
        displayOrder: 5,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('fac'),
        title: 'Drinking Water',
        description: 'Clean, accessible drinking water available on the premises so students can stay hydrated during study sessions.',
        iconName: 'Droplets',
        isAvailable: true,
        displayOrder: 6,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('fac'),
        title: 'Clean and Organized Premises',
        description: 'Regularly maintained study halls, tidy desk rows, and neat common areas for a refreshing daily routine.',
        iconName: 'Sparkles',
        isAvailable: true,
        displayOrder: 7,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('fac'),
        title: 'Security and Safety',
        description: 'Well-supervised entry and orderly premises management ensuring a safe, welcoming environment for all learners.',
        iconName: 'ShieldCheck',
        isAvailable: true,
        displayOrder: 8,
        createdAt: ts,
        updatedAt: ts,
      },
    ],
    galleryImages: [
      {
        id: createId('gal'),
        title: 'Study Cabin & Desks',
        caption: 'Quiet study desks with dedicated task lighting and privacy partitions.',
        category: 'Study Desks',
        imageUrl: '/src/assets/images/P1.jpg',
        displayOrder: 1,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('gal'),
        title: 'Main Reading Space',
        caption: 'Organized reading hall with comfortable seating and quiet atmosphere.',
        category: 'Reading Hall',
        imageUrl: '/src/assets/images/P2.jpg',
        displayOrder: 2,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('gal'),
        title: 'Quiet Focus Zone',
        caption: 'Focused learning space free from distractions for competitive prep.',
        category: 'Focus Zone',
        imageUrl: '/src/assets/images/P3.jpg',
        displayOrder: 3,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('gal'),
        title: 'Personal Workstations',
        caption: 'Dedicated individual study desks with power access and clean surfaces.',
        category: 'Study Desks',
        imageUrl: '/src/assets/images/P4.webp',
        displayOrder: 4,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('gal'),
        title: 'Reading Hall Corridor',
        caption: 'Calm study aisle designed for long uninterrupted study sessions.',
        category: 'Reading Hall',
        imageUrl: '/src/assets/images/P5.jpg',
        displayOrder: 5,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('gal'),
        title: 'Individual Study Pods',
        caption: 'Ergonomically designed private seating for deep concentration.',
        category: 'Focus Zone',
        imageUrl: '/src/assets/images/P6.jpg',
        displayOrder: 6,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('gal'),
        title: 'Clean Study Aisles',
        caption: 'Neat study lanes with comfortable seating and balanced illumination.',
        category: 'Study Desks',
        imageUrl: '/src/assets/images/P7.jpg',
        displayOrder: 7,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('gal'),
        title: 'Ergonomic Seating',
        caption: 'Supportive chairs and well-proportioned tables for study comfort.',
        category: 'Reading Hall',
        imageUrl: '/src/assets/images/P8.jpg',
        displayOrder: 8,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('gal'),
        title: 'Silent Preparation Zone',
        caption: 'Strictly quiet hall supporting daily consistent preparation routines.',
        category: 'Focus Zone',
        imageUrl: '/src/assets/images/P9.jpg',
        displayOrder: 9,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('gal'),
        title: 'Modern Study Facility',
        caption: 'Well-maintained library premises equipped for modern academic needs.',
        category: 'Reading Hall',
        imageUrl: '/src/assets/images/P10.jpg',
        displayOrder: 10,
        isVisible: true,
        createdAt: ts,
        updatedAt: ts,
      },
    ],
    libraryRules: [
      {
        id: createId('rule'),
        title: 'Maintain Strict Silence',
        description: 'Preserve complete quiet inside the reading hall at all times. Discussions should be taken outside the study zone.',
        category: 'Discipline',
        displayOrder: 1,
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('rule'),
        title: 'Keep Mobile Phones on Silent Mode',
        description: 'Switch all mobile phones and devices to silent mode before entering. Attend calls strictly outside the reading room.',
        category: 'Digital Etiquette',
        displayOrder: 2,
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('rule'),
        title: 'Respect Other Members',
        description: 'Be courteous to fellow aspirants and students. Avoid reserving desks on behalf of others without a valid booking.',
        category: 'Community',
        displayOrder: 3,
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('rule'),
        title: 'Keep the Study Area Clean',
        description: 'Leave your desk neat after each session and dispose of waste in designated bins. Meals are not permitted at study desks.',
        category: 'Cleanliness',
        displayOrder: 4,
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('rule'),
        title: 'Avoid Disturbing Other Learners',
        description: 'Move chairs gently, use earphones at low volume so sound does not leak, and avoid unnecessary movement in aisles.',
        category: 'Conduct',
        displayOrder: 5,
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: createId('rule'),
        title: 'Follow Membership and Booking Policies',
        description: 'Carry valid membership confirmation, adhere to assigned seat reservations, and renew memberships promptly prior to expiry.',
        category: 'Policies',
        displayOrder: 6,
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      },
    ],
    contactEnquiries: [],
    librarySettings: {
      libraryName: 'Central Library Krishna Nagar',
      tagline: 'A Better Space. A Better Focus. A Better Future.',
      address: '1 A, Gopal Nagar, Krishna Nagar, Alambagh, Lucknow, Uttar Pradesh – 226023, India',
      operatingHours: '7:00 AM – 10:00 PM',
      phone: '',
      email: '',
      googleMapsUrl:
        'https://maps.google.com/?q=1+A,+Gopal+Nagar,+Krishna+Nagar,+Alambagh,+Lucknow,+Uttar+Pradesh+226023',
      aboutHeading: 'A Space Designed for Serious Learning',
      aboutBody:
        'Central Library Krishna Nagar provides a dedicated environment for students and independent learners who value concentration, consistency, and academic growth. Our aim is to make focused learning more comfortable, organized, and accessible.',
      aboutSecondaryBody:
        'Situated at 1 A, Gopal Nagar, Krishna Nagar, Alambagh, Lucknow, our premises are thoughtfully structured to replace household distractions with calm routine, proper study furniture, and daily discipline from 7:00 AM to 10:00 PM.',
      seatCancellationHoursNotice: 12,
      allowSelfSeatReservation: true,
      requireApprovalBeforeSeatBooking: true,
      socialLinks: {
        instagram: '',
        facebook: '',
        youtube: '',
        whatsapp: '',
      },
      privacyPolicyText:
        'Central Library Krishna Nagar collects only the essential personal information required for member registration, seat reservation, payment receipts, and library communication (such as full name, mobile number, email address, and academic category). We do not request unnecessary sensitive identification numbers such as Aadhaar by default. Member records are used solely for library administration and are never sold or shared with third-party marketers.',
      termsText:
        'Membership at Central Library Krishna Nagar is personal and non-transferable. Members agree to maintain silence, keep mobile devices on silent mode, protect library furniture, and follow seat reservation and renewal policies. Operating hours are 7:00 AM – 10:00 PM unless notified otherwise through official library announcements. Management reserves the right to suspend accounts in case of repeated conduct violations.',
      updatedAt: ts,
    },
    auditLogs: [],
  };
}

let writeQueue: Promise<void> = Promise.resolve();
let cachedDb: DatabaseSchema | null = null;

function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function readDb(): DatabaseSchema {
  if (cachedDb) {
    return cachedDb;
  }
  ensureDirectories();
  if (!fs.existsSync(DB_FILE)) {
    const initial = buildInitialData();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    cachedDb = initial;
    return cachedDb;
  }
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  cachedDb = JSON.parse(raw) as DatabaseSchema;
  return cachedDb;
}

export async function mutateDb<T>(mutator: (db: DatabaseSchema) => T | Promise<T>): Promise<T> {
  let result!: T;
  const task = writeQueue.then(async () => {
    const db = structuredClone(readDb());
    result = await mutator(db);
    ensureDirectories();
    const tempPath = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_FILE);
    cachedDb = db;
  });
  writeQueue = task.catch(() => {});
  await task;
  return result;
}
