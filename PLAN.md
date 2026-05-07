# 🗺️ RoadSide+ — Master Execution Plan

> **Goal**: Build a production-grade, full-stack Roadside Assistance platform from scratch using the MERN stack with real-time tracking, payments, and AI-powered matching.

---

## 📊 Project Overview

| Property | Details |
|---|---|
| **Project Name** | RoadSide+ |
| **Type** | Full-Stack Web Application (MERN) |
| **Duration** | ~12–14 weeks (solo) / ~6–7 weeks (team of 3) |
| **Complexity** | ⭐⭐⭐⭐⭐ Advanced |
| **Repo** | [smurtiranikhadanga/Roadside-assistance-](https://github.com/smurtiranikhadanga/Roadside-assistance-) |

---

## 🧠 Advanced Skills Applied

| Domain | Skills |
|---|---|
| **Backend** | REST API design, JWT auth, OAuth 2.0, Socket.IO, Redis pub/sub, Mongoose geospatial queries (`$geoNear`, `2dsphere` index) |
| **Frontend** | React with Redux Toolkit, real-time Socket.IO hooks, Google Maps JS API, Stripe.js, custom hooks |
| **Database** | MongoDB schema design, indexing, aggregation pipelines, GeoJSON |
| **DevOps** | Docker, Docker Compose, Nginx reverse proxy, GitHub Actions CI/CD, AWS EC2 |
| **Security** | RBAC, input sanitization, rate limiting, CSRF, XSS protection, Stripe webhook signature |
| **Algorithms** | Provider matching (geo-scoring), dynamic surge pricing, Redis distributed locks |

---

## 📅 Phased Execution Plan

---

### ✅ PHASE 0 — Project Setup & Tooling (Week 1)

**Goal**: Bootstrap the entire monorepo with best-practice config.

#### Tasks
- [ ] Create monorepo folder structure
  ```
  roadside/
  ├── client/
  ├── server/
  ├── admin/
  ├── docker-compose.yml
  ├── .env.example
  └── package.json (root with workspaces)
  ```
- [ ] Initialize backend (`server/`)
  - `npm init -y`
  - Install: `express`, `mongoose`, `dotenv`, `cors`, `helmet`, `morgan`, `express-rate-limit`, `express-validator`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`
  - Dev: `nodemon`, `eslint`, `prettier`
- [ ] Initialize frontend (`client/`)
  - `npm create vite@latest client -- --template react`
  - Install: `axios`, `react-router-dom`, `@reduxjs/toolkit`, `react-redux`, `socket.io-client`, `@googlemaps/react-wrapper`, `@stripe/react-stripe-js`
  - UI: `lucide-react`, `framer-motion`
- [ ] Initialize admin (`admin/`)
  - `npm create vite@latest admin -- --template react`
  - Install: `recharts`, `react-table`, `@tanstack/react-query`
- [ ] Configure ESLint + Prettier across all workspaces
- [ ] Set up `.env.example` with all required variables
- [ ] Configure `docker-compose.yml` for local MongoDB + Redis
- [ ] Create root `package.json` with `install:all` and `dev` scripts

**Deliverable**: Clean dev environment, all deps installed, `npm run dev` starts all 3 apps.

---

### ✅ PHASE 1 — Database & Auth Foundation (Week 2)

**Goal**: All models defined, full auth system working with JWT + Google OAuth.

#### Backend Tasks
- [ ] **MongoDB Connection** (`config/db.js`)
  - Connect with error handling and retry logic
- [ ] **Redis Connection** (`config/redis.js`)
  - Setup ioredis client for caching + pub/sub
- [ ] **User Model** (`models/User.js`)
  - Fields: name, email, password (hashed), phone, avatar, role, googleId, fcmToken, isVerified
  - Pre-save hook: bcrypt hash password
  - Method: `comparePassword()`
- [ ] **Auth Controller** (`controllers/authController.js`)
  - `register()` — validate, hash pw, create user, send JWT
  - `login()` — validate, compare pw, return access + refresh tokens
  - `googleOAuth()` — passport-google-oauth20 flow
  - `refreshToken()` — verify refresh token, rotate and issue new pair
  - `logout()` — blacklist refresh token in Redis
  - `forgotPassword()` — generate reset token, send email via Nodemailer
  - `resetPassword()` — verify token, update password
- [ ] **Auth Middleware** (`middleware/authMiddleware.js`)
  - Verify JWT from Authorization header or HTTP-only cookie
  - Attach `req.user` to request
- [ ] **Role Middleware** (`middleware/roleMiddleware.js`)
  - `requireRole('admin')`, `requireRole('provider')`, etc.
- [ ] **Rate Limiter** (`middleware/rateLimiter.js`)
  - Strict limits on `/auth/*` routes (5 req/15min)
- [ ] **Global Error Handler** (`middleware/errorHandler.js`)
  - Standardized JSON error responses

#### Frontend Tasks
- [ ] **Redux Auth Slice** (`store/slices/authSlice.js`)
  - State: `user`, `accessToken`, `loading`, `error`
  - Async thunks: `loginUser`, `registerUser`, `logoutUser`
- [ ] **Axios Instance** (`services/api.js`)
  - Base URL, auto-attach JWT, interceptor for 401 → refresh token
- [ ] **Login Page** — email/pw form + Google Sign-In button
- [ ] **Register Page** — role selection (User / Provider), form validation
- [ ] **Protected Route** component — redirect if not authenticated

**Deliverable**: Full register/login/logout/OAuth working. JWT auto-refresh on expiry.

---

### ✅ PHASE 2 — Provider System & Geospatial Matching (Week 3)

**Goal**: Providers can register, go online, and be discovered via geo-queries.

#### Backend Tasks
- [ ] **Provider Model** (`models/Provider.js`)
  - GeoJSON `location` field with `2dsphere` index
  - `serviceTypes`, `isOnline`, `isAvailable`, `rating`, `earnings`
- [ ] **Provider Controller** (`controllers/providerController.js`)
  - `createProfile()` — create provider linked to user
  - `getNearby()` — `$geoNear` query with filters (type, radius, online)
  - `updateLocation()` — update GPS coordinates
  - `toggleStatus()` — toggle isOnline/isAvailable
  - `getProfile()` — public provider profile
- [ ] **Matching Service** (`services/matchingService.js`)
  - Geo-scoring algorithm (distance × weight + rating × weight + jobs × weight)
  - Redis lock to prevent double-assignment

#### Frontend Tasks
- [ ] **Provider Registration Flow**
  - Multi-step form: service types, vehicle info, document upload
  - File upload to Cloudinary via Multer middleware
- [ ] **Provider Dashboard** — online/offline toggle, stats widgets
- [ ] **Google Maps Integration** (`components/map/LiveMap.jsx`)
  - Display user's location
  - Show nearby provider pins with status indicators
  - Custom styled dark map theme

**Deliverable**: User can see nearby providers on map. Provider can go online/offline.

---

### ✅ PHASE 3 — Service Request Lifecycle (Week 4)

**Goal**: Full end-to-end flow: request → accept → in-progress → complete.

#### Backend Tasks
- [ ] **ServiceRequest Model** (`models/ServiceRequest.js`)
  - All status stages, pricing object, location fields, payment ref
- [ ] **Request Controller** (`controllers/requestController.js`)
  - `createRequest()` — calculate initial price, find & notify providers
  - `acceptRequest()` — provider accepts (Redis lock), update status
  - `startJob()` — provider marks en-route
  - `completeJob()` — provider marks complete, trigger payment flow
  - `cancelRequest()` — user or provider cancels with reason
  - `getActiveRequest()` — current open request for user/provider
- [ ] **Pricing Service** (`services/pricingService.js`)
  - Base price table by service type
  - Distance charge calculation
  - Surge multiplier from Redis demand counter
  - Time-of-day multiplier

#### Frontend Tasks
- [ ] **Request Service Page** (`pages/user/RequestService.jsx`)
  - Service type selector (tow, fuel, tire, battery, lockout) with icons
  - Auto-fill location from GPS, manual override
  - Description + photo upload
  - Price estimate display before confirming
- [ ] **Tracking Page** (`pages/user/TrackProvider.jsx`)
  - Live provider location on map (Socket updates)
  - ETA countdown
  - Status timeline (accepted → en route → arrived → in progress)
- [ ] **Provider Active Job Page** (`pages/provider/ActiveJob.jsx`)
  - Navigate button (Google Maps deep link)
  - Status update buttons
  - User contact options

**Deliverable**: Complete request lifecycle from creation to completion.

---

### ✅ PHASE 4 — Real-Time System (Socket.IO) (Week 5)

**Goal**: All real-time features implemented and battle-tested.

#### Backend Tasks
- [ ] **Socket Server** (`sockets/socketServer.js`)
  - Initialize Socket.IO with JWT authentication middleware
  - Room management: `request:{id}`, `provider:{id}`, `user:{id}`
- [ ] **Tracking Handler** (`sockets/trackingHandler.js`)
  - `location:update` → broadcast to user room
  - ETA recalculation on each ping (Google Maps Distance Matrix API)
- [ ] **Chat Handler** (`sockets/chatHandler.js`)
  - `chat:send` → save to DB → emit to room
  - `chat:read` → mark messages as read
- [ ] **Notification Handler** (`sockets/notificationHandler.js`)
  - `request:new` → emit to nearby providers
  - `request:accepted`, `request:completed` → emit to user
  - Fallback to Twilio SMS when user is offline
- [ ] **Redis Pub/Sub** for multi-instance support
  - Publish events from one server instance, subscribe on another

#### Frontend Tasks
- [ ] **Socket Middleware for Redux** (`store/middleware/socketMiddleware.js`)
  - Connect on login, disconnect on logout
  - Dispatch Redux actions on socket events
- [ ] **`useSocket` hook** — manages connection and event listeners
- [ ] **`useRealTimeTracking` hook** — subscribes to location updates
- [ ] **Chat Window Component** (`components/chat/ChatWindow.jsx`)
  - Real-time messages with sent/read indicators
  - Image sharing support

**Deliverable**: Live map tracking, real-time chat, instant status notifications.

---

### ✅ PHASE 5 — Payments (Stripe) (Week 6)

**Goal**: Secure payment flow with Stripe, including webhooks.

#### Backend Tasks
- [ ] **Stripe Service** (`services/stripeService.js`)
  - `createPaymentIntent(amount, currency, metadata)`
  - `constructWebhookEvent(body, signature)`
  - `processRefund(paymentIntentId)`
- [ ] **Payment Controller** (`controllers/paymentController.js`)
  - `createIntent()` — create Stripe PI, save to DB
  - `webhook()` — handle `payment_intent.succeeded`, `payment_intent.failed`
  - `getHistory()` — user's payment history
- [ ] **Payment Model** (`models/Payment.js`)
  - requestId, userId, providerId, amount, currency, status, stripeIntentId

#### Frontend Tasks
- [ ] **Payment Page** (`pages/user/PaymentPage.jsx`)
  - Stripe Elements (CardElement) integration
  - Price breakdown: base + distance + surge
  - Loading states and error handling
- [ ] **Payment Success / Failure** pages with animations
- [ ] **Provider Earnings Widget** — real-time earnings counter

**Deliverable**: End-to-end payment flow, webhook-confirmed, with refund support.

---

### ✅ PHASE 6 — Notifications (Twilio + FCM) (Week 7)

**Goal**: Push and SMS notifications for all critical events.

#### Backend Tasks
- [ ] **Notification Service** (`services/notificationService.js`)
  - `sendSMS(phone, message)` via Twilio
  - `sendPush(fcmToken, title, body, data)` via Firebase Admin SDK
  - `sendEmail(to, subject, template)` via Nodemailer
- [ ] Trigger notifications on:
  - Request accepted → SMS + push to user
  - Provider en route → push to user
  - Job completed → push + email receipt to user
  - Payment confirmed → SMS to user + provider

#### Frontend Tasks
- [ ] **FCM Service Worker** (`public/firebase-messaging-sw.js`)
  - Register service worker for background push notifications
- [ ] **useNotifications hook** — request permission, get FCM token, store to backend
- [ ] **Toast Notification System** (`components/common/Toast/`)
  - Animated toasts for in-app events

**Deliverable**: Users get notified via SMS, push, and email at every stage.

---

### ✅ PHASE 7 — Reviews & Ratings (Week 8)

**Goal**: Post-service rating system with analytics.

#### Backend Tasks
- [ ] **Review Model** + **Review Controller**
- [ ] Auto-calculate provider's average rating with MongoDB aggregation pipeline
- [ ] Prevent multiple reviews per request (validation)

#### Frontend Tasks
- [ ] **Rating Modal** — star rating + text comment after job completes
- [ ] **Provider Profile Page** — reviews list, rating breakdown (5★ to 1★ bar chart)
- [ ] **Request History Page** (`pages/user/History.jsx`)
  - List of past requests with status, cost, and rating buttons

**Deliverable**: Complete review system with aggregated provider ratings.

---

### ✅ PHASE 8 — Admin Dashboard (Week 9)

**Goal**: Full admin control panel with analytics.

#### Admin App Tasks
- [ ] **Login** — admin-only JWT route
- [ ] **Overview Dashboard**
  - KPI cards: total users, total providers, requests today, revenue today
  - Charts: `recharts` — requests over time, revenue by service type
- [ ] **Live Fleet Map**
  - All online providers shown on map in real-time
  - Color-coded by availability (green=available, yellow=busy, grey=offline)
- [ ] **Users Table** — search, filter, ban/unban
- [ ] **Providers Table** — approve/reject documents, manage status
- [ ] **Requests Table** — all requests with status filter, full detail view
- [ ] **Disputes** — flagged requests, resolution actions
- [ ] **Pricing Config** — update base prices + surge multipliers (saved to DB)

**Deliverable**: Complete admin panel with live data and management controls.

---

### ✅ PHASE 9 — UI Polish & UX (Week 10)

**Goal**: Make the app look and feel world-class.

- [ ] **Design System** — color tokens, typography scale, spacing system
- [ ] **Dark Mode** with `prefers-color-scheme` + manual toggle
- [ ] **Framer Motion** animations:
  - Page transitions
  - Map pin bounce animation
  - Service card hover lift
  - Status timeline animated progress
- [ ] **Skeleton Loaders** for all async data
- [ ] **Empty States** with illustrations (use SVG or generate with AI)
- [ ] **Error Boundaries** — graceful UI fallbacks
- [ ] **Mobile Responsive** — fully responsive on all screen sizes
- [ ] **PWA** — `manifest.json`, service worker for installability
- [ ] Lighthouse audit — target score > 90 on all metrics

---

### ✅ PHASE 10 — Testing (Week 11)

**Goal**: Confidence in code correctness at unit, integration, and E2E levels.

- [ ] **Unit Tests** (Jest + Supertest)
  - Auth controller tests
  - Pricing service tests
  - Matching algorithm tests
- [ ] **Integration Tests**
  - Full request lifecycle (create → accept → complete → pay)
  - Auth flow (register → login → refresh → logout)
- [ ] **Frontend Tests** (Vitest + React Testing Library)
  - Component render tests
  - Redux slice tests
- [ ] **E2E Tests** (Playwright)
  - Critical user journey: register → request service → track → pay → rate

---

### ✅ PHASE 11 — DevOps & Deployment (Week 12)

**Goal**: App running reliably in production with zero-downtime deploys.

#### Docker
- [ ] `Dockerfile` for each app (client, server, admin)
- [ ] `docker-compose.yml` for local dev (MongoDB + Redis + all apps)
- [ ] Multi-stage Docker builds for production (smaller images)

#### Nginx
- [ ] Reverse proxy config: route `/api/*` → server, `/` → client
- [ ] SSL termination with Let's Encrypt (Certbot)
- [ ] Gzip compression, security headers

#### CI/CD (GitHub Actions)
- [ ] On push to `main`:
  1. Run tests (Jest, Vitest)
  2. Build Docker images
  3. Push to Docker Hub
  4. SSH into EC2, pull new images, restart containers

#### Monitoring
- [ ] Winston logger with Morgan for HTTP request logging
- [ ] Error tracking with Sentry
- [ ] Uptime monitoring

**Deliverable**: App live at a public domain with HTTPS, auto-deploys on push.

---

## 📐 Git Branching Strategy (Git Flow)

```
main          ← production-ready, tagged releases
  └── develop ← integration branch, all features merged here
        ├── feature/auth-system
        ├── feature/provider-matching
        ├── feature/realtime-tracking
        ├── feature/stripe-payments
        └── feature/admin-dashboard
```

**Commit Convention** (Conventional Commits):
```
feat: add provider geo-matching algorithm
fix: resolve JWT refresh token race condition
chore: update dependencies
docs: add API reference to README
test: add integration tests for payment flow
```

---

## 🏆 Milestone Summary

| Milestone | What's Done | Week |
|---|---|---|
| 🔧 Setup | Monorepo, tooling, Docker | 1 |
| 🔐 Auth | JWT, OAuth, role-based access | 2 |
| 📍 Geo | Provider model, map, nearby search | 3 |
| 🆘 Requests | Full request lifecycle | 4 |
| 📡 Real-time | Socket.IO tracking + chat | 5 |
| 💳 Payments | Stripe integration + webhooks | 6 |
| 🔔 Notifications | Twilio + FCM + email | 7 |
| ⭐ Reviews | Rating system + provider analytics | 8 |
| 🛡️ Admin | Full admin dashboard | 9 |
| 🎨 Polish | UI animations, PWA, responsiveness | 10 |
| 🧪 Tests | Unit, integration, E2E | 11 |
| 🚀 Deploy | Docker + Nginx + CI/CD + AWS | 12 |

---

## 💡 Nice-to-Have (Post-MVP)

- [ ] **AI-powered ETA** using ML model on historical traffic data
- [ ] **In-app Voice/Video calls** (WebRTC)
- [ ] **Provider availability calendar** (shift scheduling)
- [ ] **Loyalty/rewards system** for repeat users
- [ ] **Subscription plans** for providers (featured listing)
- [ ] **Native mobile apps** (React Native / Expo)
- [ ] **Multi-language support** (i18n with react-i18next)
- [ ] **Offline support** with service workers + IndexedDB sync

---

*Last updated: May 2026 | Maintained by Smurti Rani Khadanga*
