import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  clearSessionCookie,
  generateResetToken,
  hashPassword,
  hashResetToken,
  rateLimit,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  signSessionToken,
  validatePasswordStrength,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { createId, mutateDb, readDb, UPLOADS_DIR } from './server/db.ts';
import {
  createRazorpayOrder,
  getRazorpayConfig,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} from './server/razorpay.ts';
import type {
  AuditLog,
  DatabaseSchema,
  MemberCategory,
  Membership,
  Notification,
  SeatCategory,
  User,
} from './server/types.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function sanitizeUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function addDaysIso(startIso: string, days: number): string {
  const date = new Date(startIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function pushNotification(
  db: DatabaseSchema,
  params: Omit<Notification, 'id' | 'isRead' | 'createdAt'>,
) {
  db.notifications.unshift({
    id: createId('ntf'),
    isRead: false,
    createdAt: new Date().toISOString(),
    ...params,
  });
}

function pushAudit(
  db: DatabaseSchema,
  params: Omit<AuditLog, 'id' | 'createdAt'>,
) {
  db.auditLogs.unshift({
    id: createId('aud'),
    createdAt: new Date().toISOString(),
    ...params,
  });
  if (db.auditLogs.length > 500) {
    db.auditLogs.length = 500;
  }
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, '').slice(-10);
}

function validateMobile(mobile: string): boolean {
  const digits = mobile.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
}

async function startServer() {
  const app = express();

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Raw body capture for Razorpay webhook verification
  app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      try {
        const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
        const sig = req.headers['x-razorpay-signature'] as string | undefined;
        if (!verifyRazorpayWebhookSignature(rawBody, sig)) {
          res.status(400).json({ error: 'Invalid webhook signature' });
          return;
        }
        const event = JSON.parse(rawBody) as {
          event: string;
          payload?: {
            payment?: {
              entity?: {
                id: string;
                order_id: string;
                status: string;
              };
            };
          };
        };

        const paymentEntity = event.payload?.payment?.entity;
        if (event.event === 'payment.captured' && paymentEntity?.order_id) {
          await mutateDb((db) => {
            const payment = db.payments.find((p) => p.razorpayOrderId === paymentEntity.order_id);
            if (!payment || payment.status === 'success') return;
            const now = new Date().toISOString();
            payment.status = 'success';
            payment.razorpayPaymentId = paymentEntity.id;
            payment.paidAt = now;
            payment.updatedAt = now;

            if (payment.membershipId) {
              const membership = db.memberships.find((m) => m.id === payment.membershipId);
              const user = db.users.find((u) => u.id === payment.userId);
              const plan = payment.planId
                ? db.membershipPlans.find((pl) => pl.id === payment.planId)
                : null;
              if (membership) {
                membership.paymentStatus = 'paid';
                if (user?.accountStatus === 'active' && plan) {
                  membership.status = 'active';
                  membership.startDate = now;
                  membership.expiryDate = addDaysIso(now, plan.durationDays);
                }
                membership.updatedAt = now;
              }
              pushNotification(db, {
                userId: payment.userId,
                title: 'Payment Confirmed',
                message: `Your payment of INR ${payment.amountInr} (${payment.transactionId}) has been verified.`,
                type: 'payment',
                relatedEntityId: payment.id,
              });
            }
          });
        }
        res.json({ received: true });
      } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Webhook processing error' });
      }
    },
  );

  app.use(express.json({ limit: '6mb' }));

  // Serve uploaded gallery files
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Ensure DB initialized
  readDb();

  // ==================== PUBLIC ROUTES ====================

  app.get('/api/public/site-data', (_req, res) => {
    const db = readDb();
    res.json({
      settings: db.librarySettings,
      facilities: db.facilities
        .filter((f) => f.isAvailable)
        .sort((a, b) => a.displayOrder - b.displayOrder),
      gallery: db.galleryImages
        .filter((g) => g.isVisible)
        .sort((a, b) => a.displayOrder - b.displayOrder),
      plans: db.membershipPlans
        .filter((p) => p.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder),
      rules: db.libraryRules
        .filter((r) => r.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder),
      announcements: db.libraryAnnouncements
        .filter((a) => a.isPublished)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 5),
    });
  });

  app.get('/api/membership-plans', (_req, res) => {
    const db = readDb();
    res.json(
      db.membershipPlans
        .filter((p) => p.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    );
  });

  app.post('/api/contact', rateLimit(15, 10 * 60 * 1000), async (req, res) => {
    try {
      const { name, email, mobile, subject, message } = req.body as {
        name?: string;
        email?: string;
        mobile?: string;
        subject?: string;
        message?: string;
      };

      if (!name?.trim() || !email?.trim() || !message?.trim()) {
        res.status(400).json({ error: 'Name, email address, and message are required.' });
        return;
      }
      if (!validateEmail(email.trim())) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }
      if (mobile?.trim() && !validateMobile(mobile.trim())) {
        res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
        return;
      }

      const enquiry = await mutateDb((db) => {
        const now = new Date().toISOString();
        const entry = {
          id: createId('enq'),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile?.trim() ? normalizeMobile(mobile.trim()) : '',
          subject: subject?.trim() || 'General Enquiry',
          message: message.trim(),
          status: 'new' as const,
          adminNotes: '',
          createdAt: now,
          updatedAt: now,
        };
        db.contactEnquiries.unshift(entry);
        return entry;
      });

      res.status(201).json({
        message: 'Thank you for contacting Central Library Krishna Nagar. Our team will respond shortly.',
        enquiryId: enquiry.id,
      });
    } catch (err) {
      console.error('Contact enquiry error:', err);
      res.status(500).json({ error: 'Unable to submit enquiry right now.' });
    }
  });

  // ==================== AUTH ROUTES ====================

  app.get('/api/auth/status', (_req, res) => {
    const db = readDb();
    const hasAdmin = db.users.some((u) => u.role === 'admin');
    res.json({ hasAdmin });
  });

  app.post('/api/auth/setup-admin', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
    try {
      const { fullName, email, mobile, password } = req.body as {
        fullName?: string;
        email?: string;
        mobile?: string;
        password?: string;
      };

      if (!fullName?.trim() || !email?.trim() || !mobile?.trim() || !password) {
        res.status(400).json({ error: 'All administrator fields are required.' });
        return;
      }
      if (!validateEmail(email.trim())) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }
      if (!validateMobile(mobile.trim())) {
        res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
        return;
      }
      const pwError = validatePasswordStrength(password);
      if (pwError) {
        res.status(400).json({ error: pwError });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedMobile = normalizeMobile(mobile.trim());

      const adminUser = await mutateDb((db) => {
        if (db.users.some((u) => u.role === 'admin')) {
          throw new Error('ADMIN_EXISTS');
        }
        if (
          db.users.some(
            (u) => u.email.toLowerCase() === normalizedEmail || u.mobile === normalizedMobile,
          )
        ) {
          throw new Error('DUPLICATE_USER');
        }
        const now = new Date().toISOString();
        const user: User = {
          id: createId('usr'),
          fullName: fullName.trim(),
          email: normalizedEmail,
          mobile: normalizedMobile,
          passwordHash: hashPassword(password),
          role: 'admin',
          accountStatus: 'active',
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          createdAt: now,
          updatedAt: now,
        };
        db.users.push(user);
        pushAudit(db, {
          actorUserId: user.id,
          actorName: user.fullName,
          action: 'ADMIN_INITIALIZED',
          targetType: 'user',
          targetId: user.id,
          details: 'Initial administrator account configured.',
        });
        return user;
      });

      const token = signSessionToken({
        sub: adminUser.id,
        role: adminUser.role,
        email: adminUser.email,
      });
      setSessionCookie(res, token);
      res.status(201).json({ user: sanitizeUser(adminUser) });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'ADMIN_EXISTS') {
        res.status(403).json({ error: 'Administrator account already exists. Please sign in.' });
        return;
      }
      if (err instanceof Error && err.message === 'DUPLICATE_USER') {
        res.status(409).json({ error: 'An account with this email or mobile already exists.' });
        return;
      }
      console.error('Setup admin error:', err);
      res.status(500).json({ error: 'Failed to initialize administrator account.' });
    }
  });

  app.post('/api/auth/register', rateLimit(20, 15 * 60 * 1000), async (req, res) => {
    try {
      const {
        fullName,
        mobile,
        email,
        password,
        confirmPassword,
        category,
        institutionName,
        courseOrExam,
        planId,
        privacyAccepted,
        termsAccepted,
      } = req.body as {
        fullName?: string;
        mobile?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        category?: MemberCategory;
        institutionName?: string;
        courseOrExam?: string;
        planId?: string;
        privacyAccepted?: boolean;
        termsAccepted?: boolean;
      };

      if (!fullName?.trim() || !mobile?.trim() || !email?.trim() || !password) {
        res.status(400).json({ error: 'Full name, mobile number, email, and password are required.' });
        return;
      }
      if (!validateEmail(email.trim())) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (!validateMobile(mobile.trim())) {
        res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ error: 'Passwords do not match.' });
        return;
      }
      const pwError = validatePasswordStrength(password);
      if (pwError) {
        res.status(400).json({ error: pwError });
        return;
      }
      if (!privacyAccepted || !termsAccepted) {
        res.status(400).json({ error: 'Please accept the Privacy Policy and Terms & Conditions.' });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedMobile = normalizeMobile(mobile.trim());

      const created = await mutateDb((db) => {
        const duplicateEmail = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
        if (duplicateEmail) {
          throw new Error('DUPLICATE_EMAIL');
        }
        const duplicateMobile = db.users.find((u) => u.mobile === normalizedMobile);
        if (duplicateMobile) {
          throw new Error('DUPLICATE_MOBILE');
        }

        const now = new Date().toISOString();
        const userId = createId('usr');
        const user: User = {
          id: userId,
          fullName: fullName.trim(),
          email: normalizedEmail,
          mobile: normalizedMobile,
          passwordHash: hashPassword(password),
          role: 'member',
          accountStatus: 'pending',
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          createdAt: now,
          updatedAt: now,
        };
        db.users.push(user);

        db.memberProfiles.push({
          id: createId('prof'),
          userId,
          category: category || 'Competitive Exam Aspirant',
          institutionName: institutionName?.trim() || '',
          courseOrExam: courseOrExam?.trim() || '',
          address: '',
          preferredShift: 'Full Day (7:00 AM – 10:00 PM)',
          createdAt: now,
          updatedAt: now,
        });

        db.registrationApplications.unshift({
          id: createId('app'),
          userId,
          status: 'pending',
          reviewNotes: '',
          reviewedBy: null,
          reviewedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        const selectedPlan = planId
          ? db.membershipPlans.find((p) => p.id === planId && p.isActive)
          : db.membershipPlans.find((p) => p.isActive);

        if (selectedPlan) {
          const membership: Membership = {
            id: createId('mem'),
            userId,
            planId: selectedPlan.id,
            planNameSnapshot: selectedPlan.name,
            status: 'pending',
            startDate: null,
            expiryDate: null,
            paymentStatus: 'unpaid',
            renewalRequestedAt: null,
            renewalPlanId: null,
            createdAt: now,
            updatedAt: now,
          };
          db.memberships.push(membership);
          db.bookings.push({
            id: createId('bkg'),
            userId,
            membershipId: membership.id,
            reservationId: null,
            bookingType: 'membership',
            status: 'pending',
            notes: `Initial registration with ${selectedPlan.name}`,
            createdAt: now,
            updatedAt: now,
          });
        }

        pushNotification(db, {
          userId,
          title: 'Registration Received',
          message:
            'Your registration application for Central Library Krishna Nagar has been received and is pending administrator review.',
          type: 'registration',
          relatedEntityId: userId,
        });

        return user;
      });

      const token = signSessionToken({
        sub: created.id,
        role: created.role,
        email: created.email,
      });
      setSessionCookie(res, token);

      res.status(201).json({
        message: 'Registration submitted successfully. Your membership status is currently Pending approval.',
        user: sanitizeUser(created),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'DUPLICATE_EMAIL') {
        res.status(409).json({ error: 'An account with this email address already exists.' });
        return;
      }
      if (err instanceof Error && err.message === 'DUPLICATE_MOBILE') {
        res.status(409).json({ error: 'An account with this mobile number already exists.' });
        return;
      }
      console.error('Register error:', err);
      res.status(500).json({ error: 'Unable to complete registration.' });
    }
  });

  app.post('/api/auth/login', rateLimit(30, 15 * 60 * 1000), async (req, res) => {
    try {
      const { identifier, password } = req.body as {
        identifier?: string;
        password?: string;
      };

      if (!identifier?.trim() || !password) {
        res.status(400).json({ error: 'Email or mobile number and password are required.' });
        return;
      }

      const rawId = identifier.trim();
      const db = readDb();
      const normalizedEmail = rawId.toLowerCase();
      const normalizedMobile = normalizeMobile(rawId);

      const user = db.users.find(
        (u) =>
          u.email.toLowerCase() === normalizedEmail ||
          (normalizedMobile.length === 10 && u.mobile === normalizedMobile),
      );

      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: 'Invalid email/mobile or password.' });
        return;
      }

      if (user.accountStatus === 'suspended') {
        res.status(403).json({
          error: 'Your account is currently suspended. Please contact library administration.',
        });
        return;
      }

      const token = signSessionToken({
        sub: user.id,
        role: user.role,
        email: user.email,
      });
      setSessionCookie(res, token);

      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Unable to sign in right now.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ message: 'Signed out successfully.' });
  });

  app.post('/api/auth/forgot-password', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email?.trim() || !validateEmail(email.trim())) {
        res.status(400).json({ error: 'Please provide a valid registered email address.' });
        return;
      }

      const targetEmail = email.trim().toLowerCase();
      let emailDispatched = false;

      await mutateDb(async (db) => {
        const user = db.users.find((u) => u.email.toLowerCase() === targetEmail);
        if (!user) return;
        const { rawToken, tokenHash } = generateResetToken();
        user.resetTokenHash = tokenHash;
        user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        user.updatedAt = new Date().toISOString();

        const resendKey = process.env.RESEND_API_KEY?.trim();
        const appUrl = process.env.APP_URL?.trim() || `http://localhost:${PORT}`;
        if (resendKey) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'Central Library <noreply@centrallibrarykn.in>',
                to: [user.email],
                subject: 'Reset Your Central Library Krishna Nagar Password',
                html: `<p>Hello ${user.fullName},</p><p>Use the following link to reset your password (valid for 30 minutes):</p><p><a href="${appUrl}/reset-password?token=${rawToken}">Reset Password</a></p>`,
              }),
            });
            emailDispatched = true;
          } catch (mailErr) {
            console.error('Email dispatch error:', mailErr);
          }
        }
      });

      res.json({
        message: emailDispatched
          ? 'If an account matches that email, a password reset link has been sent.'
          : 'If an account matches that email, a password reset request has been logged. If email delivery is not yet configured, please contact the Library Desk for assistance.',
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Unable to process password reset request.' });
    }
  });

  app.post('/api/auth/reset-password', rateLimit(15, 15 * 60 * 1000), async (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = req.body as {
        token?: string;
        newPassword?: string;
        confirmPassword?: string;
      };
      if (!token?.trim() || !newPassword) {
        res.status(400).json({ error: 'Reset token and new password are required.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'Passwords do not match.' });
        return;
      }
      const pwError = validatePasswordStrength(newPassword);
      if (pwError) {
        res.status(400).json({ error: pwError });
        return;
      }

      const tokenHash = hashResetToken(token.trim());
      await mutateDb((db) => {
        const now = new Date().toISOString();
        const user = db.users.find(
          (u) => u.resetTokenHash === tokenHash && u.resetTokenExpiresAt && u.resetTokenExpiresAt > now,
        );
        if (!user) {
          throw new Error('INVALID_TOKEN');
        }
        user.passwordHash = hashPassword(newPassword);
        user.resetTokenHash = null;
        user.resetTokenExpiresAt = null;
        user.updatedAt = now;
      });

      res.json({ message: 'Password updated successfully. You may now sign in.' });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'INVALID_TOKEN') {
        res.status(400).json({ error: 'Reset token is invalid or has expired.' });
        return;
      }
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Unable to reset password.' });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const user = db.users.find((u) => u.id === req.auth!.sub);
    if (!user) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Account not found.' });
      return;
    }
    const profile = db.memberProfiles.find((p) => p.userId === user.id) || null;
    res.json({ user: sanitizeUser(user), profile });
  });

  // ==================== MEMBER ROUTES ====================

  app.get('/api/members/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const user = db.users.find((u) => u.id === req.auth!.sub);
    if (!user) {
      res.status(404).json({ error: 'Member not found.' });
      return;
    }
    const profile = db.memberProfiles.find((p) => p.userId === user.id) || null;
    const application = db.registrationApplications.find((a) => a.userId === user.id) || null;
    const memberships = db.memberships
      .filter((m) => m.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const currentMembership = memberships[0] || null;
    const reservations = db.seatReservations
      .filter((r) => r.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const payments = db.payments
      .filter((p) => p.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const notifications = db.notifications
      .filter((n) => n.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const announcements = db.libraryAnnouncements
      .filter((a) => a.isPublished)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    res.json({
      user: sanitizeUser(user),
      profile,
      application,
      currentMembership,
      memberships,
      reservations,
      payments,
      notifications,
      announcements,
      settings: {
        operatingHours: db.librarySettings.operatingHours,
        seatCancellationHoursNotice: db.librarySettings.seatCancellationHoursNotice,
        allowSelfSeatReservation: db.librarySettings.allowSelfSeatReservation,
        requireApprovalBeforeSeatBooking: db.librarySettings.requireApprovalBeforeSeatBooking,
      },
    });
  });

  app.patch('/api/members/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { fullName, category, institutionName, courseOrExam, address, preferredShift } =
        req.body as {
          fullName?: string;
          category?: MemberCategory;
          institutionName?: string;
          courseOrExam?: string;
          address?: string;
          preferredShift?: string;
        };

      const updated = await mutateDb((db) => {
        const user = db.users.find((u) => u.id === req.auth!.sub);
        if (!user) throw new Error('NOT_FOUND');
        const now = new Date().toISOString();
        if (fullName?.trim()) {
          user.fullName = fullName.trim();
          user.updatedAt = now;
        }
        let profile = db.memberProfiles.find((p) => p.userId === user.id);
        if (!profile) {
          profile = {
            id: createId('prof'),
            userId: user.id,
            category: category || 'Independent Learner',
            institutionName: institutionName?.trim() || '',
            courseOrExam: courseOrExam?.trim() || '',
            address: address?.trim() || '',
            preferredShift: preferredShift?.trim() || 'Full Day (7:00 AM – 10:00 PM)',
            createdAt: now,
            updatedAt: now,
          };
          db.memberProfiles.push(profile);
        } else {
          if (category) profile.category = category;
          if (institutionName !== undefined) profile.institutionName = institutionName.trim();
          if (courseOrExam !== undefined) profile.courseOrExam = courseOrExam.trim();
          if (address !== undefined) profile.address = address.trim();
          if (preferredShift !== undefined) profile.preferredShift = preferredShift.trim();
          profile.updatedAt = now;
        }
        return { user: sanitizeUser(user), profile };
      });

      res.json(updated);
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Unable to update profile.' });
    }
  });

  app.post('/api/members/me/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
      };
      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current password and new password are required.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'New passwords do not match.' });
        return;
      }
      const pwError = validatePasswordStrength(newPassword);
      if (pwError) {
        res.status(400).json({ error: pwError });
        return;
      }

      await mutateDb((db) => {
        const user = db.users.find((u) => u.id === req.auth!.sub);
        if (!user) throw new Error('NOT_FOUND');
        if (!verifyPassword(currentPassword, user.passwordHash)) {
          throw new Error('WRONG_PASSWORD');
        }
        user.passwordHash = hashPassword(newPassword);
        user.updatedAt = new Date().toISOString();
      });

      res.json({ message: 'Password changed successfully.' });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'WRONG_PASSWORD') {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
      res.status(500).json({ error: 'Unable to change password.' });
    }
  });

  app.get('/api/members/me/membership', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const memberships = db.memberships
      .filter((m) => m.userId === req.auth!.sub)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ current: memberships[0] || null, history: memberships });
  });

  app.post('/api/memberships', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { planId } = req.body as { planId?: string };
      if (!planId) {
        res.status(400).json({ error: 'Please select a membership plan.' });
        return;
      }
      const membership = await mutateDb((db) => {
        const plan = db.membershipPlans.find((p) => p.id === planId && p.isActive && p.isAvailable);
        if (!plan) throw new Error('PLAN_UNAVAILABLE');
        const now = new Date().toISOString();
        const created: Membership = {
          id: createId('mem'),
          userId: req.auth!.sub,
          planId: plan.id,
          planNameSnapshot: plan.name,
          status: 'pending',
          startDate: null,
          expiryDate: null,
          paymentStatus: 'unpaid',
          renewalRequestedAt: null,
          renewalPlanId: null,
          createdAt: now,
          updatedAt: now,
        };
        db.memberships.unshift(created);
        db.bookings.unshift({
          id: createId('bkg'),
          userId: req.auth!.sub,
          membershipId: created.id,
          reservationId: null,
          bookingType: 'membership',
          status: 'pending',
          notes: `Selected ${plan.name}`,
          createdAt: now,
          updatedAt: now,
        });
        pushNotification(db, {
          userId: req.auth!.sub,
          title: 'Membership Plan Selected',
          message: `You selected ${plan.name}. Complete payment or await administrator confirmation to activate.`,
          type: 'membership',
          relatedEntityId: created.id,
        });
        return created;
      });
      res.status(201).json(membership);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'PLAN_UNAVAILABLE') {
        res.status(404).json({ error: 'Selected membership plan is unavailable.' });
        return;
      }
      res.status(500).json({ error: 'Unable to create membership.' });
    }
  });

  app.post('/api/memberships/renew', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { planId } = req.body as { planId?: string };
      const updated = await mutateDb((db) => {
        const current = db.memberships
          .filter((m) => m.userId === req.auth!.sub)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        const targetPlan = planId
          ? db.membershipPlans.find((p) => p.id === planId && p.isActive)
          : current
            ? db.membershipPlans.find((p) => p.id === current.planId)
            : db.membershipPlans.find((p) => p.isActive);

        if (!targetPlan) throw new Error('PLAN_NOT_FOUND');

        const now = new Date().toISOString();
        if (current) {
          current.renewalRequestedAt = now;
          current.renewalPlanId = targetPlan.id;
          if (current.status === 'expired') {
            current.status = 'renewal_requested';
          }
          current.updatedAt = now;
        }

        const newMembership: Membership = {
          id: createId('mem'),
          userId: req.auth!.sub,
          planId: targetPlan.id,
          planNameSnapshot: targetPlan.name,
          status: 'pending',
          startDate: null,
          expiryDate: null,
          paymentStatus: 'unpaid',
          renewalRequestedAt: now,
          renewalPlanId: targetPlan.id,
          createdAt: now,
          updatedAt: now,
        };
        db.memberships.unshift(newMembership);

        db.bookings.unshift({
          id: createId('bkg'),
          userId: req.auth!.sub,
          membershipId: newMembership.id,
          reservationId: null,
          bookingType: 'renewal',
          status: 'pending',
          notes: `Renewal requested for ${targetPlan.name}`,
          createdAt: now,
          updatedAt: now,
        });

        pushNotification(db, {
          userId: req.auth!.sub,
          title: 'Renewal Request Submitted',
          message: `Your renewal request for ${targetPlan.name} has been recorded. Complete payment or confirm at the library desk.`,
          type: 'renewal',
          relatedEntityId: newMembership.id,
        });

        return newMembership;
      });
      res.status(201).json(updated);
    } catch (err) {
      console.error('Renew error:', err);
      res.status(500).json({ error: 'Unable to submit renewal request.' });
    }
  });

  // ==================== SEATS & RESERVATIONS ====================

  app.get('/api/seats', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const today = new Date().toISOString().slice(0, 10);
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;

    const seatsWithState = db.seats.map((seat) => {
      if (seat.status === 'maintenance') {
        return { ...seat, availability: 'maintenance' as const, reservedByCurrentUser: false };
      }
      const conflict = db.seatReservations.find(
        (r) =>
          r.seatId === seat.id &&
          r.status === 'active' &&
          datesOverlap(r.startDate, r.endDate, startDate, endDate),
      );
      if (!conflict) {
        return { ...seat, availability: 'available' as const, reservedByCurrentUser: false };
      }
      return {
        ...seat,
        availability: conflict.userId === req.auth!.sub ? ('reserved_by_you' as const) : ('occupied' as const),
        reservedByCurrentUser: conflict.userId === req.auth!.sub,
      };
    });

    res.json({
      startDate,
      endDate,
      seats: seatsWithState,
      policy: {
        allowSelfSeatReservation: db.librarySettings.allowSelfSeatReservation,
        requireApprovalBeforeSeatBooking: db.librarySettings.requireApprovalBeforeSeatBooking,
        seatCancellationHoursNotice: db.librarySettings.seatCancellationHoursNotice,
      },
    });
  });

  app.get('/api/seats/availability', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const today = new Date().toISOString().slice(0, 10);
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;

    const available = db.seats.filter((seat) => {
      if (seat.status !== 'active') return false;
      return !db.seatReservations.some(
        (r) =>
          r.seatId === seat.id &&
          r.status === 'active' &&
          datesOverlap(r.startDate, r.endDate, startDate, endDate),
      );
    });
    res.json({ startDate, endDate, availableSeats: available });
  });

  app.post('/api/reservations', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { seatId, startDate, endDate, slotLabel } = req.body as {
        seatId?: string;
        startDate?: string;
        endDate?: string;
        slotLabel?: string;
      };

      if (!seatId || !startDate || !endDate) {
        res.status(400).json({ error: 'Seat, start date, and end date are required.' });
        return;
      }
      if (startDate > endDate) {
        res.status(400).json({ error: 'End date must be on or after the start date.' });
        return;
      }

      const reservation = await mutateDb((db) => {
        const user = db.users.find((u) => u.id === req.auth!.sub);
        if (!user) throw new Error('USER_NOT_FOUND');

        if (!db.librarySettings.allowSelfSeatReservation && user.role !== 'admin') {
          throw new Error('SELF_BOOKING_DISABLED');
        }
        if (
          db.librarySettings.requireApprovalBeforeSeatBooking &&
          user.accountStatus !== 'active' &&
          user.role !== 'admin'
        ) {
          throw new Error('APPROVAL_REQUIRED');
        }

        const seat = db.seats.find((s) => s.id === seatId);
        if (!seat || seat.status !== 'active') {
          throw new Error('SEAT_UNAVAILABLE');
        }

        // Prevent overlapping booking for the same seat
        const seatConflict = db.seatReservations.find(
          (r) =>
            r.seatId === seatId &&
            r.status === 'active' &&
            datesOverlap(r.startDate, r.endDate, startDate, endDate),
        );
        if (seatConflict) {
          throw new Error('SEAT_ALREADY_BOOKED');
        }

        // Prevent a single member holding overlapping multiple active seats
        const memberConflict = db.seatReservations.find(
          (r) =>
            r.userId === user.id &&
            r.status === 'active' &&
            datesOverlap(r.startDate, r.endDate, startDate, endDate),
        );
        if (memberConflict) {
          throw new Error('MEMBER_ALREADY_HAS_SEAT');
        }

        const now = new Date().toISOString();
        const created = {
          id: createId('res'),
          seatId: seat.id,
          seatNumberSnapshot: seat.seatNumber,
          userId: user.id,
          startDate,
          endDate,
          slotLabel: slotLabel?.trim() || db.librarySettings.operatingHours,
          status: 'active' as const,
          assignedByAdmin: false,
          cancelledAt: null,
          cancellationReason: null,
          createdAt: now,
          updatedAt: now,
        };
        db.seatReservations.unshift(created);
        db.bookings.unshift({
          id: createId('bkg'),
          userId: user.id,
          membershipId: null,
          reservationId: created.id,
          bookingType: 'seat',
          status: 'confirmed',
          notes: `Reserved seat ${seat.seatNumber} (${startDate} to ${endDate})`,
          createdAt: now,
          updatedAt: now,
        });
        pushNotification(db, {
          userId: user.id,
          title: 'Seat Reservation Confirmed',
          message: `Seat ${seat.seatNumber} (${seat.category}) is reserved for you from ${startDate} to ${endDate}.`,
          type: 'reservation',
          relatedEntityId: created.id,
        });
        return created;
      });

      res.status(201).json(reservation);
    } catch (err: unknown) {
      if (err instanceof Error) {
        const map: Record<string, [number, string]> = {
          SELF_BOOKING_DISABLED: [403, 'Self-service seat reservation is currently managed by administration.'],
          APPROVAL_REQUIRED: [403, 'Your membership registration must be approved before reserving a seat.'],
          SEAT_UNAVAILABLE: [400, 'Selected seat is unavailable or under maintenance.'],
          SEAT_ALREADY_BOOKED: [409, 'This seat is already reserved for overlapping dates. Please choose another seat.'],
          MEMBER_ALREADY_HAS_SEAT: [409, 'You already have an active seat reservation for overlapping dates.'],
        };
        if (map[err.message]) {
          const [status, msg] = map[err.message];
          res.status(status).json({ error: msg });
          return;
        }
      }
      console.error('Reservation error:', err);
      res.status(500).json({ error: 'Unable to reserve seat.' });
    }
  });

  app.get('/api/reservations/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const list = db.seatReservations
      .filter((r) => r.userId === req.auth!.sub)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(list);
  });

  app.delete('/api/reservations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const reason = (req.body as { reason?: string } | undefined)?.reason || 'Cancelled by member';
      await mutateDb((db) => {
        const reservation = db.seatReservations.find(
          (r) => r.id === id && r.userId === req.auth!.sub,
        );
        if (!reservation) throw new Error('NOT_FOUND');
        if (reservation.status !== 'active') throw new Error('NOT_ACTIVE');

        const noticeHours = db.librarySettings.seatCancellationHoursNotice || 0;
        const startMs = new Date(`${reservation.startDate}T07:00:00`).getTime();
        const diffHours = (startMs - Date.now()) / (1000 * 60 * 60);
        if (noticeHours > 0 && diffHours < noticeHours && diffHours > -24) {
          // Allow cancellation if startDate is in the future respecting notice, or allow with clear rule check
          if (diffHours < 0) {
            throw new Error('PAST_CANCELLATION_WINDOW');
          }
          if (diffHours < noticeHours) {
            throw new Error('NOTICE_PERIOD');
          }
        }

        const now = new Date().toISOString();
        reservation.status = 'cancelled';
        reservation.cancelledAt = now;
        reservation.cancellationReason = reason;
        reservation.updatedAt = now;

        const booking = db.bookings.find((b) => b.reservationId === reservation.id);
        if (booking) {
          booking.status = 'cancelled';
          booking.updatedAt = now;
        }

        pushNotification(db, {
          userId: req.auth!.sub,
          title: 'Seat Reservation Cancelled',
          message: `Your reservation for seat ${reservation.seatNumberSnapshot} (${reservation.startDate} to ${reservation.endDate}) has been cancelled.`,
          type: 'reservation',
          relatedEntityId: reservation.id,
        });
      });

      res.json({ message: 'Reservation cancelled successfully.' });
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'NOT_FOUND') {
          res.status(404).json({ error: 'Reservation not found.' });
          return;
        }
        if (err.message === 'NOT_ACTIVE') {
          res.status(400).json({ error: 'This reservation is already closed.' });
          return;
        }
        if (err.message === 'NOTICE_PERIOD' || err.message === 'PAST_CANCELLATION_WINDOW') {
          res.status(400).json({
            error: 'Reservations cannot be self-cancelled past the configured notice window. Please contact the Library Desk.',
          });
          return;
        }
      }
      res.status(500).json({ error: 'Unable to cancel reservation.' });
    }
  });

  // ==================== PAYMENTS ====================

  app.get('/api/payments/config', requireAuth, (_req, res) => {
    res.json(getRazorpayConfig());
  });

  app.post('/api/payments/create-order', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { membershipId, planId, idempotencyKey } = req.body as {
        membershipId?: string;
        planId?: string;
        idempotencyKey?: string;
      };

      if (!planId || !idempotencyKey) {
        res.status(400).json({ error: 'Plan ID and idempotency key are required.' });
        return;
      }

      const dbSnap = readDb();
      const existingByKey = dbSnap.payments.find(
        (p) => p.idempotencyKey === idempotencyKey && p.userId === req.auth!.sub,
      );
      if (existingByKey) {
        res.json({
          payment: existingByKey,
          razorpayConfig: getRazorpayConfig(),
        });
        return;
      }

      const plan = dbSnap.membershipPlans.find((p) => p.id === planId && p.isActive);
      if (!plan) {
        res.status(404).json({ error: 'Membership plan not found.' });
        return;
      }
      if (plan.priceInr === null || plan.priceInr <= 0) {
        res.status(400).json({
          error: 'Fee for this plan has not been configured by the administrator yet.',
        });
        return;
      }

      const config = getRazorpayConfig();
      if (!config.onlinePaymentConfigured) {
        res.status(503).json({
          error: 'Online Razorpay checkout is not configured yet. Please pay at the Library Desk or contact the administrator.',
        });
        return;
      }

      const txId = `CLKN-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const order = await createRazorpayOrder({
        amountInr: plan.priceInr,
        receipt: txId,
        notes: {
          userId: req.auth!.sub,
          planId: plan.id,
          membershipId: membershipId || '',
        },
      });

      const payment = await mutateDb((db) => {
        const now = new Date().toISOString();
        const record = {
          id: createId('pay'),
          transactionId: txId,
          idempotencyKey,
          userId: req.auth!.sub,
          membershipId: membershipId || null,
          planId: plan.id,
          planNameSnapshot: plan.name,
          amountInr: plan.priceInr!,
          currency: 'INR',
          paymentMethod: 'razorpay' as const,
          razorpayOrderId: order.id,
          razorpayPaymentId: null,
          razorpaySignature: null,
          status: 'pending' as const,
          paidAt: null,
          recordedByAdminId: null,
          notes: 'Online Razorpay checkout initiated',
          createdAt: now,
          updatedAt: now,
        };
        db.payments.unshift(record);
        return record;
      });

      res.status(201).json({
        payment,
        order,
        razorpayConfig: config,
      });
    } catch (err) {
      console.error('Create payment order error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to create payment order.',
      });
    }
  });

  app.post('/api/payments/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
      };

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400).json({ error: 'Missing payment verification parameters.' });
        return;
      }

      const valid = verifyRazorpaySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

      if (!valid) {
        await mutateDb((db) => {
          const p = db.payments.find(
            (item) =>
              item.razorpayOrderId === razorpay_order_id && item.userId === req.auth!.sub,
          );
          if (p && p.status === 'pending') {
            p.status = 'failed';
            p.notes = 'Signature verification failed';
            p.updatedAt = new Date().toISOString();
          }
        });
        res.status(400).json({ error: 'Payment signature verification failed.' });
        return;
      }

      const verifiedPayment = await mutateDb((db) => {
        const payment = db.payments.find(
          (p) => p.razorpayOrderId === razorpay_order_id && p.userId === req.auth!.sub,
        );
        if (!payment) throw new Error('PAYMENT_NOT_FOUND');
        if (payment.status === 'success') return payment; // Idempotent

        const now = new Date().toISOString();
        payment.status = 'success';
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpaySignature = razorpay_signature;
        payment.paidAt = now;
        payment.updatedAt = now;

        const user = db.users.find((u) => u.id === req.auth!.sub);
        const plan = payment.planId
          ? db.membershipPlans.find((pl) => pl.id === payment.planId)
          : null;

        if (payment.membershipId) {
          const membership = db.memberships.find((m) => m.id === payment.membershipId);
          if (membership) {
            membership.paymentStatus = 'paid';
            if (user?.accountStatus === 'active' && plan) {
              membership.status = 'active';
              membership.startDate = now;
              membership.expiryDate = addDaysIso(now, plan.durationDays);
            }
            membership.updatedAt = now;
          }
        }

        pushNotification(db, {
          userId: req.auth!.sub,
          title: 'Payment Verified',
          message: `Your payment of INR ${payment.amountInr} for ${payment.planNameSnapshot} is confirmed (Receipt: ${payment.transactionId}).`,
          type: 'payment',
          relatedEntityId: payment.id,
        });

        return payment;
      });

      res.json({ payment: verifiedPayment, message: 'Payment verified and recorded.' });
    } catch (err) {
      console.error('Verify payment error:', err);
      res.status(500).json({ error: 'Unable to verify payment.' });
    }
  });

  app.get('/api/payments/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const payments = db.payments
      .filter((p) => p.userId === req.auth!.sub)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(payments);
  });

  app.get('/api/payments/:id/receipt', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const payment = db.payments.find((p) => p.id === req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Receipt not found.' });
      return;
    }
    if (payment.userId !== req.auth!.sub && req.auth!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const member = db.users.find((u) => u.id === payment.userId);
    res.json({
      receiptNumber: payment.transactionId,
      libraryName: db.librarySettings.libraryName,
      libraryAddress: db.librarySettings.address,
      libraryPhone: db.librarySettings.phone,
      libraryEmail: db.librarySettings.email,
      memberName: member?.fullName || 'Member',
      memberEmail: member?.email || '',
      memberMobile: member?.mobile || '',
      planName: payment.planNameSnapshot,
      amountInr: payment.amountInr,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt || payment.createdAt,
      razorpayPaymentId: payment.razorpayPaymentId,
    });
  });

  // ==================== NOTIFICATIONS & ANNOUNCEMENTS ====================

  app.get('/api/notifications/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = readDb();
    const items = db.notifications
      .filter((n) => n.userId === req.auth!.sub)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(items);
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
    await mutateDb((db) => {
      const item = db.notifications.find(
        (n) => n.id === req.params.id && n.userId === req.auth!.sub,
      );
      if (item) item.isRead = true;
    });
    res.json({ ok: true });
  });

  app.post('/api/notifications/me/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
    await mutateDb((db) => {
      for (const n of db.notifications) {
        if (n.userId === req.auth!.sub) n.isRead = true;
      }
    });
    res.json({ ok: true });
  });

  app.get('/api/announcements', requireAuth, (_req, res) => {
    const db = readDb();
    res.json(
      db.libraryAnnouncements
        .filter((a) => a.isPublished)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    );
  });

  // ==================== ADMIN ROUTES ====================

  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    const db = readDb();
    const members = db.users.filter((u) => u.role === 'member');
    const activeMembers = members.filter((u) => u.accountStatus === 'active').length;
    const pendingApplications = db.registrationApplications.filter((a) => a.status === 'pending').length;
    const expiredMemberships = db.memberships.filter((m) => m.status === 'expired').length;

    const today = new Date().toISOString().slice(0, 10);
    const activeSeats = db.seats.filter((s) => s.status === 'active');
    const occupiedSeatIds = new Set(
      db.seatReservations
        .filter((r) => r.status === 'active' && r.startDate <= today && r.endDate >= today)
        .map((r) => r.seatId),
    );
    const occupiedSeats = activeSeats.filter((s) => occupiedSeatIds.has(s.id)).length;
    const availableSeats = activeSeats.length - occupiedSeats;

    const currentMonthPrefix = today.slice(0, 7);
    const monthlyRevenue = db.payments
      .filter(
        (p) =>
          p.status === 'success' && (p.paidAt || p.createdAt).startsWith(currentMonthPrefix),
      )
      .reduce((sum, p) => sum + p.amountInr, 0);

    const recentRegistrations = members
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((u) => {
        const profile = db.memberProfiles.find((p) => p.userId === u.id);
        return {
          ...sanitizeUser(u),
          category: profile?.category || '',
          courseOrExam: profile?.courseOrExam || '',
        };
      });

    const recentPayments = db.payments
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((p) => {
        const user = db.users.find((u) => u.id === p.userId);
        return {
          ...p,
          memberName: user?.fullName || 'Member',
        };
      });

    res.json({
      stats: {
        totalMembers: members.length,
        activeMembers,
        pendingApplications,
        expiredMemberships,
        totalSeats: db.seats.length,
        availableSeats,
        occupiedSeats,
        monthlyRevenue,
        newEnquiries: db.contactEnquiries.filter((e) => e.status === 'new').length,
      },
      recentRegistrations,
      recentPayments,
    });
  });

  app.get('/api/admin/members', requireAdmin, (req, res) => {
    const db = readDb();
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const statusFilter = (req.query.status as string) || 'all';

    const list = db.users
      .filter((u) => u.role === 'member')
      .map((u) => {
        const profile = db.memberProfiles.find((p) => p.userId === u.id) || null;
        const membership =
          db.memberships
            .filter((m) => m.userId === u.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
        const activeReservation =
          db.seatReservations.find((r) => r.userId === u.id && r.status === 'active') || null;
        const payments = db.payments.filter((p) => p.userId === u.id);
        return {
          ...sanitizeUser(u),
          profile,
          membership,
          activeReservation,
          paymentCount: payments.length,
          totalPaidInr: payments
            .filter((p) => p.status === 'success')
            .reduce((s, p) => s + p.amountInr, 0),
        };
      })
      .filter((item) => {
        if (statusFilter !== 'all' && item.accountStatus !== statusFilter) return false;
        if (!search) return true;
        return (
          item.fullName.toLowerCase().includes(search) ||
          item.email.toLowerCase().includes(search) ||
          item.mobile.includes(search)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json(list);
  });

  app.patch('/api/admin/members/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { accountStatus, planId, membershipStatus, startDate, expiryDate, notes } =
        req.body as {
          accountStatus?: 'pending' | 'active' | 'suspended' | 'rejected';
          planId?: string;
          membershipStatus?: Membership['status'];
          startDate?: string;
          expiryDate?: string;
          notes?: string;
        };

      const updated = await mutateDb((db) => {
        const user = db.users.find((u) => u.id === req.params.id && u.role === 'member');
        if (!user) throw new Error('NOT_FOUND');
        const actor = db.users.find((u) => u.id === req.auth!.sub);
        const now = new Date().toISOString();

        if (accountStatus) {
          user.accountStatus = accountStatus;
          user.updatedAt = now;
        }

        let membership = db.memberships
          .filter((m) => m.userId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        if (planId && (!membership || membership.planId !== planId)) {
          const plan = db.membershipPlans.find((p) => p.id === planId);
          if (plan) {
            membership = {
              id: createId('mem'),
              userId: user.id,
              planId: plan.id,
              planNameSnapshot: plan.name,
              status: membershipStatus || 'active',
              startDate: startDate || now,
              expiryDate: expiryDate || addDaysIso(startDate || now, plan.durationDays),
              paymentStatus: 'paid',
              renewalRequestedAt: null,
              renewalPlanId: null,
              createdAt: now,
              updatedAt: now,
            };
            db.memberships.unshift(membership);
          }
        } else if (membership) {
          if (membershipStatus) membership.status = membershipStatus;
          if (startDate !== undefined) membership.startDate = startDate;
          if (expiryDate !== undefined) membership.expiryDate = expiryDate;
          membership.updatedAt = now;
        }

        pushAudit(db, {
          actorUserId: req.auth!.sub,
          actorName: actor?.fullName || 'Admin',
          action: 'MEMBER_UPDATED',
          targetType: 'user',
          targetId: user.id,
          details: notes || `Updated member status (${user.accountStatus})`,
        });

        if (accountStatus === 'active') {
          pushNotification(db, {
            userId: user.id,
            title: 'Account Active',
            message: 'Your membership account at Central Library Krishna Nagar is active.',
            type: 'membership',
            relatedEntityId: user.id,
          });
        } else if (accountStatus === 'suspended') {
          pushNotification(db, {
            userId: user.id,
            title: 'Account Suspended',
            message: 'Your account has been suspended by administration. Please contact the Library Desk.',
            type: 'membership',
            relatedEntityId: user.id,
          });
        }

        return sanitizeUser(user);
      });

      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Member not found.' });
    }
  });

  app.get('/api/admin/applications', requireAdmin, (_req, res) => {
    const db = readDb();
    const list = db.registrationApplications
      .map((appItem) => {
        const user = db.users.find((u) => u.id === appItem.userId);
        const profile = db.memberProfiles.find((p) => p.userId === appItem.userId);
        const membership = db.memberships.find((m) => m.userId === appItem.userId);
        return {
          ...appItem,
          user: user ? sanitizeUser(user) : null,
          profile: profile || null,
          membership: membership || null,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(list);
  });

  app.patch('/api/admin/applications/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, reviewNotes, activateMembership } = req.body as {
        status?: 'approved' | 'rejected';
        reviewNotes?: string;
        activateMembership?: boolean;
      };
      if (status !== 'approved' && status !== 'rejected') {
        res.status(400).json({ error: 'Status must be approved or rejected.' });
        return;
      }

      const result = await mutateDb((db) => {
        const appItem = db.registrationApplications.find((a) => a.id === req.params.id);
        if (!appItem) throw new Error('NOT_FOUND');
        const user = db.users.find((u) => u.id === appItem.userId);
        const actor = db.users.find((u) => u.id === req.auth!.sub);
        const now = new Date().toISOString();

        appItem.status = status;
        appItem.reviewNotes = reviewNotes?.trim() || '';
        appItem.reviewedBy = req.auth!.sub;
        appItem.reviewedAt = now;
        appItem.updatedAt = now;

        if (user) {
          user.accountStatus = status === 'approved' ? 'active' : 'rejected';
          user.updatedAt = now;

          const membership = db.memberships
            .filter((m) => m.userId === user.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

          if (status === 'approved' && membership && (activateMembership || membership.paymentStatus === 'paid')) {
            const plan = db.membershipPlans.find((p) => p.id === membership.planId);
            membership.status = 'active';
            membership.startDate = now;
            membership.expiryDate = plan ? addDaysIso(now, plan.durationDays) : addDaysIso(now, 30);
            membership.updatedAt = now;
          }

          pushNotification(db, {
            userId: user.id,
            title: status === 'approved' ? 'Registration Approved' : 'Registration Declined',
            message:
              status === 'approved'
                ? 'Welcome to Central Library Krishna Nagar. Your registration has been approved.'
                : `Your registration application could not be approved.${reviewNotes ? ` Note: ${reviewNotes}` : ''}`,
            type: 'registration',
            relatedEntityId: appItem.id,
          });
        }

        pushAudit(db, {
          actorUserId: req.auth!.sub,
          actorName: actor?.fullName || 'Admin',
          action: `APPLICATION_${status.toUpperCase()}`,
          targetType: 'registration_application',
          targetId: appItem.id,
          details: reviewNotes || `Application ${status}`,
        });

        return appItem;
      });

      res.json(result);
    } catch {
      res.status(404).json({ error: 'Application not found.' });
    }
  });

  // Admin Membership Plans CRUD
  app.get('/api/admin/membership-plans', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json(db.membershipPlans.slice().sort((a, b) => a.displayOrder - b.displayOrder));
  });

  app.post('/api/admin/membership-plans', requireAdmin, async (req: AuthenticatedRequest, res) => {
    const { name, durationDays, durationLabel, priceInr, facilitiesIncluded, termsAndConditions, description, isAvailable, isActive } =
      req.body as {
        name?: string;
        durationDays?: number;
        durationLabel?: string;
        priceInr?: number | null;
        facilitiesIncluded?: string[];
        termsAndConditions?: string;
        description?: string;
        isAvailable?: boolean;
        isActive?: boolean;
      };
    if (!name?.trim() || !durationDays || durationDays <= 0) {
      res.status(400).json({ error: 'Plan name and positive duration in days are required.' });
      return;
    }
    const created = await mutateDb((db) => {
      const now = new Date().toISOString();
      const plan = {
        id: createId('plan'),
        name: name.trim(),
        durationDays: Number(durationDays),
        durationLabel: durationLabel?.trim() || `${durationDays} Days`,
        priceInr: priceInr !== null && priceInr !== undefined && priceInr !== ('' as unknown) ? Number(priceInr) : null,
        facilitiesIncluded: Array.isArray(facilitiesIncluded) ? facilitiesIncluded.filter(Boolean) : [],
        termsAndConditions: termsAndConditions?.trim() || '',
        description: description?.trim() || '',
        isAvailable: isAvailable ?? true,
        isActive: isActive ?? true,
        displayOrder: db.membershipPlans.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      db.membershipPlans.push(plan);
      pushAudit(db, {
        actorUserId: req.auth!.sub,
        actorName: 'Admin',
        action: 'PLAN_CREATED',
        targetType: 'membership_plan',
        targetId: plan.id,
        details: `Created plan ${plan.name}`,
      });
      return plan;
    });
    res.status(201).json(created);
  });

  app.patch('/api/admin/membership-plans/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const updated = await mutateDb((db) => {
        const plan = db.membershipPlans.find((p) => p.id === req.params.id);
        if (!plan) throw new Error('NOT_FOUND');
        const body = req.body as Record<string, unknown>;
        if (typeof body.name === 'string' && body.name.trim()) plan.name = body.name.trim();
        if (typeof body.durationDays === 'number' && body.durationDays > 0) plan.durationDays = body.durationDays;
        if (typeof body.durationLabel === 'string') plan.durationLabel = body.durationLabel.trim();
        if (body.priceInr === null || body.priceInr === '') {
          plan.priceInr = null;
        } else if (typeof body.priceInr === 'number' || typeof body.priceInr === 'string') {
          const parsed = Number(body.priceInr);
          plan.priceInr = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        }
        if (Array.isArray(body.facilitiesIncluded)) {
          plan.facilitiesIncluded = body.facilitiesIncluded.map(String).filter(Boolean);
        }
        if (typeof body.termsAndConditions === 'string') plan.termsAndConditions = body.termsAndConditions;
        if (typeof body.description === 'string') plan.description = body.description;
        if (typeof body.isAvailable === 'boolean') plan.isAvailable = body.isAvailable;
        if (typeof body.isActive === 'boolean') plan.isActive = body.isActive;
        plan.updatedAt = new Date().toISOString();
        pushAudit(db, {
          actorUserId: req.auth!.sub,
          actorName: 'Admin',
          action: 'PLAN_UPDATED',
          targetType: 'membership_plan',
          targetId: plan.id,
          details: `Updated plan ${plan.name}`,
        });
        return plan;
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Membership plan not found.' });
    }
  });

  app.delete('/api/admin/membership-plans/:id', requireAdmin, async (req, res) => {
    await mutateDb((db) => {
      db.membershipPlans = db.membershipPlans.filter((p) => p.id !== req.params.id);
    });
    res.json({ deleted: true });
  });

  // Admin Seats Management
  app.get('/api/admin/seats', requireAdmin, (_req, res) => {
    const db = readDb();
    const today = new Date().toISOString().slice(0, 10);
    const enriched = db.seats.map((seat) => {
      const currentRes = db.seatReservations.find(
        (r) =>
          r.seatId === seat.id &&
          r.status === 'active' &&
          r.startDate <= today &&
          r.endDate >= today,
      );
      const occupant = currentRes ? db.users.find((u) => u.id === currentRes.userId) : null;
      return {
        ...seat,
        currentReservation: currentRes || null,
        occupantName: occupant?.fullName || null,
      };
    });
    res.json(enriched);
  });

  app.post('/api/admin/seats', requireAdmin, async (req, res) => {
    try {
      const { seatNumber, rowLabel, columnIndex, category, status, notes } = req.body as {
        seatNumber?: string;
        rowLabel?: string;
        columnIndex?: number;
        category?: SeatCategory;
        status?: 'active' | 'maintenance';
        notes?: string;
      };
      if (!seatNumber?.trim()) {
        res.status(400).json({ error: 'Seat number is required.' });
        return;
      }
      const seat = await mutateDb((db) => {
        if (db.seats.some((s) => s.seatNumber.toLowerCase() === seatNumber.trim().toLowerCase())) {
          throw new Error('DUPLICATE_SEAT');
        }
        const now = new Date().toISOString();
        const created = {
          id: createId('seat'),
          seatNumber: seatNumber.trim(),
          rowLabel: rowLabel?.trim() || 'Row A',
          columnIndex: Number(columnIndex) || 1,
          category: category || 'Standard Desk',
          status: status || 'active',
          notes: notes?.trim() || '',
          createdAt: now,
          updatedAt: now,
        };
        db.seats.push(created);
        return created;
      });
      res.status(201).json(seat);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'DUPLICATE_SEAT') {
        res.status(409).json({ error: 'Seat number already exists.' });
        return;
      }
      res.status(500).json({ error: 'Unable to add seat.' });
    }
  });

  app.post('/api/admin/seats/batch', requireAdmin, async (req, res) => {
    try {
      const { rowPrefix, count, category } = req.body as {
        rowPrefix?: string;
        count?: number;
        category?: SeatCategory;
      };
      const prefix = (rowPrefix || 'D').trim().toUpperCase();
      const total = Math.min(Math.max(Number(count) || 4, 1), 30);
      const added = await mutateDb((db) => {
        const now = new Date().toISOString();
        const createdList = [];
        for (let i = 1; i <= total; i++) {
          const seatNumber = `${prefix}-${String(i).padStart(2, '0')}`;
          if (db.seats.some((s) => s.seatNumber.toLowerCase() === seatNumber.toLowerCase())) {
            continue;
          }
          const seat = {
            id: createId('seat'),
            seatNumber,
            rowLabel: `Row ${prefix}`,
            columnIndex: i,
            category: category || 'Standard Desk',
            status: 'active' as const,
            notes: '',
            createdAt: now,
            updatedAt: now,
          };
          db.seats.push(seat);
          createdList.push(seat);
        }
        return createdList;
      });
      res.status(201).json(added);
    } catch {
      res.status(500).json({ error: 'Unable to batch generate seats.' });
    }
  });

  app.patch('/api/admin/seats/:id', requireAdmin, async (req, res) => {
    try {
      const updated = await mutateDb((db) => {
        const seat = db.seats.find((s) => s.id === req.params.id);
        if (!seat) throw new Error('NOT_FOUND');
        const { seatNumber, rowLabel, category, status, notes } = req.body as Record<string, unknown>;
        if (typeof seatNumber === 'string' && seatNumber.trim()) seat.seatNumber = seatNumber.trim();
        if (typeof rowLabel === 'string' && rowLabel.trim()) seat.rowLabel = rowLabel.trim();
        if (typeof category === 'string') seat.category = category as SeatCategory;
        if (status === 'active' || status === 'maintenance') seat.status = status;
        if (typeof notes === 'string') seat.notes = notes;
        seat.updatedAt = new Date().toISOString();
        return seat;
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Seat not found.' });
    }
  });

  app.delete('/api/admin/seats/:id', requireAdmin, async (req, res) => {
    await mutateDb((db) => {
      db.seats = db.seats.filter((s) => s.id !== req.params.id);
    });
    res.json({ deleted: true });
  });

  // Admin Reservations
  app.get('/api/admin/reservations', requireAdmin, (_req, res) => {
    const db = readDb();
    const list = db.seatReservations
      .map((r) => {
        const user = db.users.find((u) => u.id === r.userId);
        return {
          ...r,
          memberName: user?.fullName || 'Member',
          memberMobile: user?.mobile || '',
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(list);
  });

  app.post('/api/admin/reservations', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { seatId, userId, startDate, endDate, slotLabel } = req.body as {
        seatId?: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
        slotLabel?: string;
      };
      if (!seatId || !userId || !startDate || !endDate) {
        res.status(400).json({ error: 'Seat, member, start date, and end date are required.' });
        return;
      }
      const created = await mutateDb((db) => {
        const seat = db.seats.find((s) => s.id === seatId);
        const user = db.users.find((u) => u.id === userId);
        if (!seat || !user) throw new Error('INVALID_TARGET');
        const conflict = db.seatReservations.find(
          (r) =>
            r.seatId === seatId &&
            r.status === 'active' &&
            datesOverlap(r.startDate, r.endDate, startDate, endDate),
        );
        if (conflict) throw new Error('CONFLICT');
        const now = new Date().toISOString();
        const record = {
          id: createId('res'),
          seatId: seat.id,
          seatNumberSnapshot: seat.seatNumber,
          userId: user.id,
          startDate,
          endDate,
          slotLabel: slotLabel?.trim() || db.librarySettings.operatingHours,
          status: 'active' as const,
          assignedByAdmin: true,
          cancelledAt: null,
          cancellationReason: null,
          createdAt: now,
          updatedAt: now,
        };
        db.seatReservations.unshift(record);
        pushNotification(db, {
          userId: user.id,
          title: 'Seat Assigned',
          message: `Seat ${seat.seatNumber} has been assigned to you from ${startDate} to ${endDate}.`,
          type: 'reservation',
          relatedEntityId: record.id,
        });
        pushAudit(db, {
          actorUserId: req.auth!.sub,
          actorName: 'Admin',
          action: 'SEAT_ASSIGNED',
          targetType: 'seat_reservation',
          targetId: record.id,
          details: `Assigned ${seat.seatNumber} to ${user.fullName}`,
        });
        return record;
      });
      res.status(201).json(created);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'CONFLICT') {
        res.status(409).json({ error: 'Seat already reserved during selected dates.' });
        return;
      }
      res.status(400).json({ error: 'Unable to assign seat.' });
    }
  });

  app.delete('/api/admin/reservations/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    await mutateDb((db) => {
      const resItem = db.seatReservations.find((r) => r.id === req.params.id);
      if (resItem && resItem.status === 'active') {
        const now = new Date().toISOString();
        resItem.status = 'cancelled';
        resItem.cancelledAt = now;
        resItem.cancellationReason = 'Cancelled by administrator';
        resItem.updatedAt = now;
        pushNotification(db, {
          userId: resItem.userId,
          title: 'Seat Reservation Cancelled',
          message: `Your reservation for seat ${resItem.seatNumberSnapshot} was cancelled by administration.`,
          type: 'reservation',
          relatedEntityId: resItem.id,
        });
        pushAudit(db, {
          actorUserId: req.auth!.sub,
          actorName: 'Admin',
          action: 'RESERVATION_CANCELLED',
          targetType: 'seat_reservation',
          targetId: resItem.id,
          details: `Cancelled seat ${resItem.seatNumberSnapshot}`,
        });
      }
    });
    res.json({ cancelled: true });
  });

  // Admin Payments
  app.get('/api/admin/payments', requireAdmin, (req, res) => {
    const db = readDb();
    const status = (req.query.status as string) || 'all';
    const search = ((req.query.search as string) || '').trim().toLowerCase();

    const list = db.payments
      .map((p) => {
        const user = db.users.find((u) => u.id === p.userId);
        return {
          ...p,
          memberName: user?.fullName || 'Member',
          memberEmail: user?.email || '',
          memberMobile: user?.mobile || '',
        };
      })
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false;
        if (!search) return true;
        return (
          item.transactionId.toLowerCase().includes(search) ||
          item.memberName.toLowerCase().includes(search) ||
          item.memberMobile.includes(search)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json(list);
  });

  app.post('/api/admin/payments/record-offline', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { userId, planId, amountInr, paymentMethod, status, notes, activateMembership } =
        req.body as {
          userId?: string;
          planId?: string;
          amountInr?: number;
          paymentMethod?: 'cash' | 'upi_desk';
          status?: 'success' | 'pending';
          notes?: string;
          activateMembership?: boolean;
        };

      if (!userId || !amountInr || Number(amountInr) <= 0) {
        res.status(400).json({ error: 'Member and valid payment amount are required.' });
        return;
      }

      const created = await mutateDb((db) => {
        const user = db.users.find((u) => u.id === userId);
        if (!user) throw new Error('USER_NOT_FOUND');
        const plan = planId ? db.membershipPlans.find((p) => p.id === planId) : null;
        const now = new Date().toISOString();
        const txId = `CLKN-DESK-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

        let membership = db.memberships
          .filter((m) => m.userId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        if (!membership && plan) {
          membership = {
            id: createId('mem'),
            userId: user.id,
            planId: plan.id,
            planNameSnapshot: plan.name,
            status: 'pending',
            startDate: null,
            expiryDate: null,
            paymentStatus: 'unpaid',
            renewalRequestedAt: null,
            renewalPlanId: null,
            createdAt: now,
            updatedAt: now,
          };
          db.memberships.unshift(membership);
        }

        const payStatus = status === 'pending' ? 'pending' : 'success';
        const payment = {
          id: createId('pay'),
          transactionId: txId,
          idempotencyKey: `offline_${txId}`,
          userId: user.id,
          membershipId: membership?.id || null,
          planId: plan?.id || membership?.planId || null,
          planNameSnapshot: plan?.name || membership?.planNameSnapshot || 'Library Membership',
          amountInr: Number(amountInr),
          currency: 'INR',
          paymentMethod: paymentMethod || 'cash',
          razorpayOrderId: null,
          razorpayPaymentId: null,
          razorpaySignature: null,
          status: payStatus as 'pending' | 'success',
          paidAt: payStatus === 'success' ? now : null,
          recordedByAdminId: req.auth!.sub,
          notes: notes?.trim() || 'Recorded at Library Desk',
          createdAt: now,
          updatedAt: now,
        };
        db.payments.unshift(payment);

        if (payStatus === 'success' && membership) {
          membership.paymentStatus = 'paid';
          if (activateMembership !== false) {
            user.accountStatus = 'active';
            user.updatedAt = now;
            const days = plan?.durationDays || 30;
            membership.status = 'active';
            membership.startDate = now;
            membership.expiryDate = addDaysIso(now, days);
          }
          membership.updatedAt = now;
        }

        pushNotification(db, {
          userId: user.id,
          title: payStatus === 'success' ? 'Payment Recorded & Receipt Ready' : 'Pending Payment Logged',
          message:
            payStatus === 'success'
              ? `Payment of INR ${payment.amountInr} (${payment.paymentMethod.toUpperCase()}) recorded. Receipt ${payment.transactionId} is available.`
              : `A pending payment entry of INR ${payment.amountInr} has been logged for your account.`,
          type: 'payment',
          relatedEntityId: payment.id,
        });

        pushAudit(db, {
          actorUserId: req.auth!.sub,
          actorName: 'Admin',
          action: 'OFFLINE_PAYMENT_RECORDED',
          targetType: 'payment',
          targetId: payment.id,
          details: `INR ${payment.amountInr} for ${user.fullName}`,
        });

        return payment;
      });

      res.status(201).json(created);
    } catch {
      res.status(400).json({ error: 'Unable to record offline payment.' });
    }
  });

  app.patch('/api/admin/payments/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, notes } = req.body as {
        status?: 'pending' | 'success' | 'failed' | 'refunded';
        notes?: string;
      };
      const updated = await mutateDb((db) => {
        const payment = db.payments.find((p) => p.id === req.params.id);
        if (!payment) throw new Error('NOT_FOUND');
        const now = new Date().toISOString();
        if (status) payment.status = status;
        if (status === 'success' && !payment.paidAt) payment.paidAt = now;
        if (notes !== undefined) payment.notes = notes;
        payment.updatedAt = now;
        if (status === 'refunded' && payment.membershipId) {
          const m = db.memberships.find((item) => item.id === payment.membershipId);
          if (m) m.paymentStatus = 'refunded';
        }
        pushAudit(db, {
          actorUserId: req.auth!.sub,
          actorName: 'Admin',
          action: 'PAYMENT_STATUS_UPDATED',
          targetType: 'payment',
          targetId: payment.id,
          details: `Payment ${payment.transactionId} -> ${payment.status}`,
        });
        return payment;
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Payment not found.' });
    }
  });

  // Admin Announcements & Notifications
  app.get('/api/admin/announcements', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json(db.libraryAnnouncements.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.post('/api/admin/announcements', requireAdmin, async (req: AuthenticatedRequest, res) => {
    const { title, content, priority, isPublished, notifyAllMembers } = req.body as {
      title?: string;
      content?: string;
      priority?: 'normal' | 'important';
      isPublished?: boolean;
      notifyAllMembers?: boolean;
    };
    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ error: 'Title and content are required.' });
      return;
    }
    const created = await mutateDb((db) => {
      const now = new Date().toISOString();
      const ann = {
        id: createId('ann'),
        title: title.trim(),
        content: content.trim(),
        priority: priority || 'normal',
        isPublished: isPublished ?? true,
        publishedAt: now,
        createdBy: req.auth!.sub,
        createdAt: now,
        updatedAt: now,
      };
      db.libraryAnnouncements.unshift(ann);
      if (ann.isPublished && notifyAllMembers !== false) {
        for (const u of db.users.filter((usr) => usr.role === 'member')) {
          pushNotification(db, {
            userId: u.id,
            title: `Announcement: ${ann.title}`,
            message: ann.content,
            type: 'announcement',
            relatedEntityId: ann.id,
          });
        }
      }
      return ann;
    });
    res.status(201).json(created);
  });

  app.patch('/api/admin/announcements/:id', requireAdmin, async (req, res) => {
    try {
      const updated = await mutateDb((db) => {
        const ann = db.libraryAnnouncements.find((a) => a.id === req.params.id);
        if (!ann) throw new Error('NOT_FOUND');
        const { title, content, priority, isPublished } = req.body as Record<string, unknown>;
        if (typeof title === 'string' && title.trim()) ann.title = title.trim();
        if (typeof content === 'string' && content.trim()) ann.content = content.trim();
        if (priority === 'normal' || priority === 'important') ann.priority = priority;
        if (typeof isPublished === 'boolean') ann.isPublished = isPublished;
        ann.updatedAt = new Date().toISOString();
        return ann;
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Announcement not found.' });
    }
  });

  app.delete('/api/admin/announcements/:id', requireAdmin, async (req, res) => {
    await mutateDb((db) => {
      db.libraryAnnouncements = db.libraryAnnouncements.filter((a) => a.id !== req.params.id);
    });
    res.json({ deleted: true });
  });

  app.post('/api/admin/notifications', requireAdmin, async (req, res) => {
    const { userId, title, message, type } = req.body as {
      userId?: string;
      title?: string;
      message?: string;
      type?: Notification['type'];
    };
    if (!title?.trim() || !message?.trim()) {
      res.status(400).json({ error: 'Title and message are required.' });
      return;
    }
    await mutateDb((db) => {
      const targets =
        userId && userId !== 'all'
          ? db.users.filter((u) => u.id === userId)
          : db.users.filter((u) => u.role === 'member');
      for (const target of targets) {
        pushNotification(db, {
          userId: target.id,
          title: title.trim(),
          message: message.trim(),
          type: type || 'announcement',
          relatedEntityId: null,
        });
      }
    });
    res.status(201).json({ sent: true });
  });

  // Admin Facilities CRUD
  app.get('/api/admin/facilities', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json(db.facilities.slice().sort((a, b) => a.displayOrder - b.displayOrder));
  });

  app.post('/api/admin/facilities', requireAdmin, async (req, res) => {
    const { title, description, iconName, isAvailable } = req.body as {
      title?: string;
      description?: string;
      iconName?: string;
      isAvailable?: boolean;
    };
    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: 'Facility title and description are required.' });
      return;
    }
    const created = await mutateDb((db) => {
      const now = new Date().toISOString();
      const item = {
        id: createId('fac'),
        title: title.trim(),
        description: description.trim(),
        iconName: iconName?.trim() || 'BookOpen',
        isAvailable: isAvailable ?? true,
        displayOrder: db.facilities.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      db.facilities.push(item);
      return item;
    });
    res.status(201).json(created);
  });

  app.patch('/api/admin/facilities/:id', requireAdmin, async (req, res) => {
    try {
      const updated = await mutateDb((db) => {
        const item = db.facilities.find((f) => f.id === req.params.id);
        if (!item) throw new Error('NOT_FOUND');
        const { title, description, iconName, isAvailable } = req.body as Record<string, unknown>;
        if (typeof title === 'string' && title.trim()) item.title = title.trim();
        if (typeof description === 'string' && description.trim()) item.description = description.trim();
        if (typeof iconName === 'string' && iconName.trim()) item.iconName = iconName.trim();
        if (typeof isAvailable === 'boolean') item.isAvailable = isAvailable;
        item.updatedAt = new Date().toISOString();
        return item;
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Facility not found.' });
    }
  });

  app.delete('/api/admin/facilities/:id', requireAdmin, async (req, res) => {
    await mutateDb((db) => {
      db.facilities = db.facilities.filter((f) => f.id !== req.params.id);
    });
    res.json({ deleted: true });
  });

  // Admin Gallery CRUD + Upload
  app.get('/api/admin/gallery', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json(db.galleryImages.slice().sort((a, b) => a.displayOrder - b.displayOrder));
  });

  app.post('/api/admin/gallery/upload', requireAdmin, async (req, res) => {
    try {
      const { fileName, dataUrl } = req.body as { fileName?: string; dataUrl?: string };
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        res.status(400).json({ error: 'Please upload a valid image file (PNG, JPG, WebP).' });
        return;
      }
      const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: 'Unsupported image format. Use PNG, JPG, or WebP.' });
        return;
      }
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 4 * 1024 * 1024) {
        res.status(400).json({ error: 'Image size must be under 4 MB.' });
        return;
      }
      const safeBase = (fileName || 'library').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
      const outputName = `${safeBase}_${Date.now()}.${ext}`;
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOADS_DIR, outputName), buffer);
      res.status(201).json({ imageUrl: `/uploads/${outputName}` });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Failed to save uploaded image.' });
    }
  });

  app.post('/api/admin/gallery', requireAdmin, async (req, res) => {
    const { title, caption, category, imageUrl, isVisible } = req.body as {
      title?: string;
      caption?: string;
      category?: string;
      imageUrl?: string;
      isVisible?: boolean;
    };
    if (!title?.trim() || !imageUrl?.trim()) {
      res.status(400).json({ error: 'Image title and URL are required.' });
      return;
    }
    const created = await mutateDb((db) => {
      const now = new Date().toISOString();
      const item = {
        id: createId('gal'),
        title: title.trim(),
        caption: caption?.trim() || '',
        category: category?.trim() || 'Library Interior',
        imageUrl: imageUrl.trim(),
        displayOrder: db.galleryImages.length + 1,
        isVisible: isVisible ?? true,
        createdAt: now,
        updatedAt: now,
      };
      db.galleryImages.push(item);
      return item;
    });
    res.status(201).json(created);
  });

  app.patch('/api/admin/gallery/:id', requireAdmin, async (req, res) => {
    try {
      const updated = await mutateDb((db) => {
        const item = db.galleryImages.find((g) => g.id === req.params.id);
        if (!item) throw new Error('NOT_FOUND');
        const { title, caption, category, imageUrl, isVisible } = req.body as Record<string, unknown>;
        if (typeof title === 'string' && title.trim()) item.title = title.trim();
        if (typeof caption === 'string') item.caption = caption.trim();
        if (typeof category === 'string' && category.trim()) item.category = category.trim();
        if (typeof imageUrl === 'string' && imageUrl.trim()) item.imageUrl = imageUrl.trim();
        if (typeof isVisible === 'boolean') item.isVisible = isVisible;
        item.updatedAt = new Date().toISOString();
        return item;
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Gallery item not found.' });
    }
  });

  app.delete('/api/admin/gallery/:id', requireAdmin, async (req, res) => {
    await mutateDb((db) => {
      db.galleryImages = db.galleryImages.filter((g) => g.id !== req.params.id);
    });
    res.json({ deleted: true });
  });

  // Admin Rules CRUD
  app.get('/api/admin/rules', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json(db.libraryRules.slice().sort((a, b) => a.displayOrder - b.displayOrder));
  });

  app.post('/api/admin/rules', requireAdmin, async (req, res) => {
    const { title, description, category, isActive } = req.body as {
      title?: string;
      description?: string;
      category?: string;
      isActive?: boolean;
    };
    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: 'Rule title and description are required.' });
      return;
    }
    const created = await mutateDb((db) => {
      const now = new Date().toISOString();
      const item = {
        id: createId('rule'),
        title: title.trim(),
        description: description.trim(),
        category: category?.trim() || 'Discipline',
        displayOrder: db.libraryRules.length + 1,
        isActive: isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
      db.libraryRules.push(item);
      return item;
    });
    res.status(201).json(created);
  });

  app.patch('/api/admin/rules/:id', requireAdmin, async (req, res) => {
    try {
      const updated = await mutateDb((db) => {
        const item = db.libraryRules.find((r) => r.id === req.params.id);
        if (!item) throw new Error('NOT_FOUND');
        const { title, description, category, isActive } = req.body as Record<string, unknown>;
        if (typeof title === 'string' && title.trim()) item.title = title.trim();
        if (typeof description === 'string' && description.trim()) item.description = description.trim();
        if (typeof category === 'string' && category.trim()) item.category = category.trim();
        if (typeof isActive === 'boolean') item.isActive = isActive;
        item.updatedAt = new Date().toISOString();
        return item;
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Rule not found.' });
    }
  });

  app.delete('/api/admin/rules/:id', requireAdmin, async (req, res) => {
    await mutateDb((db) => {
      db.libraryRules = db.libraryRules.filter((r) => r.id !== req.params.id);
    });
    res.json({ deleted: true });
  });

  // Admin Contact Enquiries
  app.get('/api/admin/enquiries', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json(db.contactEnquiries.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  app.patch('/api/admin/enquiries/:id', requireAdmin, async (req, res) => {
    try {
      const updated = await mutateDb((db) => {
        const item = db.contactEnquiries.find((e) => e.id === req.params.id);
        if (!item) throw new Error('NOT_FOUND');
        const { status, adminNotes } = req.body as {
          status?: 'new' | 'reviewed' | 'resolved';
          adminNotes?: string;
        };
        if (status) item.status = status;
        if (adminNotes !== undefined) item.adminNotes = adminNotes;
        item.updatedAt = new Date().toISOString();
        return item;
      });
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Enquiry not found.' });
    }
  });

  // Admin Website Settings
  app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json(db.librarySettings);
  });

  app.patch('/api/admin/settings', requireAdmin, async (req: AuthenticatedRequest, res) => {
    const updated = await mutateDb((db) => {
      const s = db.librarySettings;
      const body = req.body as Partial<typeof s>;
      if (typeof body.libraryName === 'string' && body.libraryName.trim()) s.libraryName = body.libraryName.trim();
      if (typeof body.tagline === 'string') s.tagline = body.tagline.trim();
      if (typeof body.address === 'string' && body.address.trim()) s.address = body.address.trim();
      if (typeof body.operatingHours === 'string' && body.operatingHours.trim()) s.operatingHours = body.operatingHours.trim();
      if (typeof body.phone === 'string') s.phone = body.phone.trim();
      if (typeof body.email === 'string') s.email = body.email.trim();
      if (typeof body.googleMapsUrl === 'string' && body.googleMapsUrl.trim()) s.googleMapsUrl = body.googleMapsUrl.trim();
      if (typeof body.aboutHeading === 'string' && body.aboutHeading.trim()) s.aboutHeading = body.aboutHeading.trim();
      if (typeof body.aboutBody === 'string' && body.aboutBody.trim()) s.aboutBody = body.aboutBody.trim();
      if (typeof body.aboutSecondaryBody === 'string') s.aboutSecondaryBody = body.aboutSecondaryBody.trim();
      if (typeof body.seatCancellationHoursNotice === 'number') s.seatCancellationHoursNotice = body.seatCancellationHoursNotice;
      if (typeof body.allowSelfSeatReservation === 'boolean') s.allowSelfSeatReservation = body.allowSelfSeatReservation;
      if (typeof body.requireApprovalBeforeSeatBooking === 'boolean') s.requireApprovalBeforeSeatBooking = body.requireApprovalBeforeSeatBooking;
      if (body.socialLinks && typeof body.socialLinks === 'object') {
        s.socialLinks = {
          instagram: body.socialLinks.instagram ?? s.socialLinks.instagram,
          facebook: body.socialLinks.facebook ?? s.socialLinks.facebook,
          youtube: body.socialLinks.youtube ?? s.socialLinks.youtube,
          whatsapp: body.socialLinks.whatsapp ?? s.socialLinks.whatsapp,
        };
      }
      if (typeof body.privacyPolicyText === 'string') s.privacyPolicyText = body.privacyPolicyText;
      if (typeof body.termsText === 'string') s.termsText = body.termsText;
      s.updatedAt = new Date().toISOString();

      pushAudit(db, {
        actorUserId: req.auth!.sub,
        actorName: 'Admin',
        action: 'SETTINGS_UPDATED',
        targetType: 'library_settings',
        targetId: 'global',
        details: 'Updated website and policy settings.',
      });

      return s;
    });
    res.json(updated);
  });

  app.get('/api/admin/audit-logs', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json(db.auditLogs.slice(0, 100));
  });

  app.get('/api/download-source', (_req, res) => {
    const zipPath = path.resolve(process.cwd(), 'public/central-library-krishna-nagar.zip');
    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ error: 'Source archive not found.' });
      return;
    }
    res.download(zipPath, 'central-library-krishna-nagar.zip');
  });

  // ==================== VITE / STATIC SERVING ====================

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Central Library Krishna Nagar server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
