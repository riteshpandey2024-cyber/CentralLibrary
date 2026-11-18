# Central Library Krishna Nagar

Full-stack library website and management platform for **Central Library Krishna Nagar** (`1 A, Gopal Nagar, Krishna Nagar, Alambagh, Lucknow, Uttar Pradesh – 226023, India`).

## Features

- **Public Library Website**: Hero showcase, About section, Admin-configurable Facilities & Amenities, Study Environment Gallery with category filtering and lightbox, configurable Membership Plans, Library Rules, Google Maps directions, and Contact Enquiry form.
- **Authentication & RBAC**: Member registration (pending approval workflow), Email/Mobile + Password login using `scrypt` password hashing, HMAC-signed `HttpOnly` session cookies, Forgot/Reset Password, and protected Member/Admin routes.
- **Member Portal (`/dashboard`)**: Overview cards, Profile & Password management, Membership plan selection & renewal requests, visual Study Hall Seat Reservation grid with overlap prevention, Payment History with printable official receipts, System Notifications, and Library Announcements.
- **Admin Dashboard (`/admin`)**: Live database-backed metrics, Registration approval/rejection, Member management, Membership Plan pricing & configuration, Seat inventory & batch generation, Seat assignment & cancellation, Offline Cash/UPI payment recording, Razorpay online payment integration & verification, Gallery photo upload, Facilities/Rules/Announcements/Settings CMS, and Contact Enquiry tracking.

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `PORT` (defaults to `3000`)
- `AUTH_SECRET` — Strong random secret for signing session tokens
- `ADMIN_BOOTSTRAP_EMAIL` & `ADMIN_BOOTSTRAP_PASSWORD` — Optional initial administrator credentials (if omitted, initialize once via `/admin-setup`)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — Optional Razorpay credentials for online checkout and webhook verification
- `RESEND_API_KEY` & `EMAIL_FROM` — Optional email delivery for password reset links
- `DATA_DIR` — Directory for persistent database storage (defaults to `./data`)

## Local Setup & Production Build

```bash
npm install
npm run dev        # Runs Express API + Vite dev middleware on port 3000
npm run lint       # TypeScript type-checking
npm run build      # Builds production frontend into dist/
npm start          # Starts production server on port 3000
```
