# 🏗️ RoadSide+ — System Architecture

## 1. High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   User App       │  │  Provider App    │  │  Admin Dashboard │  │
│  │  (React + Vite)  │  │  (React + Vite)  │  │  (React + Vite)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼────────────────────┼────────────────────┼─────────────┘
            │   HTTPS / WSS      │                    │
┌───────────▼────────────────────▼────────────────────▼─────────────┐
│                          API GATEWAY (Nginx)                        │
│               Load Balancer + Rate Limiter + SSL Termination        │
└────────────────────────────┬───────────────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                       BACKEND LAYER                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Express.js REST API (Node.js)                   │  │
│  │  /auth  /users  /providers  /requests  /payments  /reviews   │  │
│  └──────────────────┬───────────────────────────────────────────┘  │
│                     │                                               │
│  ┌──────────────────▼───────────────────────────────────────────┐  │
│  │           Socket.IO Real-Time Server                         │  │
│  │   (Live tracking, Notifications, Chat, Status updates)       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│                        DATA LAYER                                   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   MongoDB    │  │    Redis     │  │      Cloudinary           │  │
│  │  (Primary DB)│  │  (Cache/Pub  │  │   (File/Image Storage)   │  │
│  │              │  │    Sub)      │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│                     EXTERNAL SERVICES                               │
│                                                                     │
│   Google Maps API    Stripe    Twilio (SMS)    Firebase (FCM)       │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component-Level Architecture

### 2.1 Frontend Architecture (React + Vite)

```
client/src/
├── assets/                    # Static images, icons, fonts
├── components/
│   ├── common/                # Reusable UI components
│   │   ├── Button/
│   │   ├── Modal/
│   │   ├── Toast/
│   │   └── Loader/
│   ├── map/
│   │   ├── LiveMap.jsx        # Google Maps integration
│   │   ├── ProviderMarker.jsx # Animated provider pin
│   │   └── RoutePolyline.jsx  # Live route rendering
│   ├── chat/
│   │   ├── ChatWindow.jsx     # Real-time chat
│   │   └── MessageBubble.jsx
│   └── layout/
│       ├── Navbar.jsx
│       └── Sidebar.jsx
├── pages/
│   ├── auth/
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── user/
│   │   ├── Dashboard.jsx      # Main user home
│   │   ├── RequestService.jsx # Service request flow
│   │   ├── TrackProvider.jsx  # Live tracking page
│   │   ├── PaymentPage.jsx    # Stripe checkout
│   │   └── History.jsx        # Past requests
│   └── provider/
│       ├── ProviderDashboard.jsx
│       ├── ActiveJob.jsx
│       └── Earnings.jsx
├── store/                     # Redux Toolkit
│   ├── index.js               # Store config
│   ├── slices/
│   │   ├── authSlice.js
│   │   ├── requestSlice.js
│   │   ├── trackingSlice.js
│   │   └── chatSlice.js
│   └── middleware/
│       └── socketMiddleware.js # Socket.IO Redux middleware
├── hooks/
│   ├── useSocket.js           # Socket connection hook
│   ├── useGeolocation.js      # GPS hook
│   └── useRealTimeTracking.js
├── services/
│   ├── api.js                 # Axios instance with interceptors
│   ├── authService.js
│   ├── requestService.js
│   └── paymentService.js
└── utils/
    ├── mapHelpers.js          # Distance, ETA calculations
    └── formatters.js
```

### 2.2 Backend Architecture (Node.js + Express)

```
server/
├── config/
│   ├── db.js                  # MongoDB connection
│   ├── redis.js               # Redis client
│   └── cloudinary.js
├── controllers/
│   ├── authController.js      # Register, Login, OAuth
│   ├── userController.js      # Profile CRUD
│   ├── providerController.js  # Provider profile, availability
│   ├── requestController.js   # Service request lifecycle
│   ├── paymentController.js   # Stripe payment intent
│   ├── reviewController.js    # Ratings & reviews
│   └── adminController.js     # Admin operations
├── models/
│   ├── User.js                # User schema
│   ├── Provider.js            # Provider schema (with GeoJSON)
│   ├── ServiceRequest.js      # Request schema
│   ├── Payment.js             # Payment record
│   ├── Review.js              # Review schema
│   └── Message.js             # Chat message schema
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── providerRoutes.js
│   ├── requestRoutes.js
│   ├── paymentRoutes.js
│   └── reviewRoutes.js
├── middleware/
│   ├── authMiddleware.js      # JWT verification
│   ├── roleMiddleware.js      # User/Provider/Admin roles
│   ├── rateLimiter.js         # Express rate limiting
│   ├── errorHandler.js        # Global error handler
│   └── uploadMiddleware.js    # Multer + Cloudinary
├── sockets/
│   ├── socketServer.js        # Socket.IO initialization
│   ├── trackingHandler.js     # GPS location events
│   ├── chatHandler.js         # Message events
│   └── notificationHandler.js # Status update broadcasts
├── services/
│   ├── pricingService.js      # Dynamic pricing algorithm
│   ├── matchingService.js     # Provider matching algorithm
│   ├── notificationService.js # Twilio + FCM
│   ├── stripeService.js       # Stripe wrapper
│   └── emailService.js        # Nodemailer
└── utils/
    ├── geoUtils.js            # Haversine distance, bearing
    ├── tokenUtils.js          # JWT helpers
    └── responseHelper.js      # Standardized API responses
```

---

## 3. Database Schema Design (MongoDB)

### 3.1 User Collection
```json
{
  "_id": "ObjectId",
  "name": "String",
  "email": "String (unique)",
  "password": "String (hashed)",
  "phone": "String",
  "avatar": "String (Cloudinary URL)",
  "role": "Enum: ['user', 'provider', 'admin']",
  "googleId": "String (OAuth)",
  "fcmToken": "String (Push notifications)",
  "isVerified": "Boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 3.2 Provider Collection
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref: User)",
  "serviceTypes": ["tow", "fuel", "tire", "battery", "lockout"],
  "vehicleInfo": {
    "make": "String",
    "model": "String",
    "licensePlate": "String"
  },
  "documents": {
    "licenseUrl": "String",
    "certificateUrl": "String"
  },
  "location": {
    "type": "Point",          // GeoJSON for geospatial queries
    "coordinates": [lng, lat]
  },
  "isOnline": "Boolean",
  "isAvailable": "Boolean",
  "rating": "Number (avg)",
  "totalJobs": "Number",
  "earnings": "Number",
  "createdAt": "Date"
}
```

### 3.3 ServiceRequest Collection
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref: User)",
  "providerId": "ObjectId (ref: Provider)",
  "serviceType": "Enum: ['tow', 'fuel', 'tire', 'battery', 'lockout']",
  "status": "Enum: ['pending', 'accepted', 'en_route', 'in_progress', 'completed', 'cancelled']",
  "userLocation": {
    "type": "Point",
    "coordinates": [lng, lat],
    "address": "String"
  },
  "providerLocation": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "description": "String",
  "images": ["String (Cloudinary URLs)"],
  "estimatedArrival": "Date",
  "actualArrival": "Date",
  "completedAt": "Date",
  "pricing": {
    "basePrice": "Number",
    "distanceCharge": "Number",
    "surgeMultiplier": "Number",
    "total": "Number"
  },
  "paymentStatus": "Enum: ['unpaid', 'paid', 'refunded']",
  "paymentIntentId": "String (Stripe)",
  "cancellationReason": "String",
  "createdAt": "Date"
}
```

### 3.4 Review Collection
```json
{
  "_id": "ObjectId",
  "requestId": "ObjectId (ref: ServiceRequest)",
  "reviewerId": "ObjectId (ref: User)",
  "revieweeId": "ObjectId (ref: Provider)",
  "rating": "Number (1-5)",
  "comment": "String",
  "createdAt": "Date"
}
```

### 3.5 Message Collection
```json
{
  "_id": "ObjectId",
  "requestId": "ObjectId (ref: ServiceRequest)",
  "senderId": "ObjectId (ref: User)",
  "senderRole": "Enum: ['user', 'provider']",
  "content": "String",
  "type": "Enum: ['text', 'image', 'location']",
  "isRead": "Boolean",
  "createdAt": "Date"
}
```

---

## 4. Real-Time Communication (Socket.IO)

### Event Flow Diagram
```
USER CLIENT                   SERVER                  PROVIDER CLIENT
     │                          │                           │
     │──── request:create ──────►│                           │
     │                          │──── request:new ──────────►│
     │                          │                           │
     │                          │◄─── request:accept ───────│
     │◄─── request:accepted ────│                           │
     │                          │                           │
     │                          │◄─── location:update ──────│
     │◄─── location:update ─────│  (every 5 seconds)        │
     │  (live provider GPS)     │                           │
     │                          │                           │
     │◄──── chat:message ───────│◄──── chat:send ───────────│
     │──── chat:send ──────────►│──── chat:message ─────────►│
     │                          │                           │
     │                          │◄─── request:complete ─────│
     │◄─── request:completed ───│                           │
     │                          │                           │
```

### Socket Events Reference

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `request:create` | Client → Server | `{ serviceType, location, description }` | User creates a new request |
| `request:new` | Server → Provider | `{ requestId, userLocation, serviceType }` | Notify nearby providers |
| `request:accept` | Provider → Server | `{ requestId, providerId }` | Provider accepts job |
| `request:accepted` | Server → User | `{ provider, eta }` | Confirm acceptance to user |
| `location:update` | Provider → Server | `{ requestId, lat, lng }` | Provider GPS ping |
| `location:update` | Server → User | `{ lat, lng, eta }` | Broadcast position to user |
| `chat:send` | Client → Server | `{ requestId, content, type }` | Send message |
| `chat:message` | Server → Client | `{ message }` | Deliver message |
| `request:complete` | Provider → Server | `{ requestId }` | Mark job done |
| `request:completed` | Server → User | `{ summary, amount }` | Notify user |

---

## 5. API Design (REST)

### Base URL: `/api/v1`

#### 🔐 Auth Routes
```
POST   /auth/register          → Register (user or provider)
POST   /auth/login             → Login with JWT response
POST   /auth/google            → Google OAuth callback
POST   /auth/refresh-token     → Refresh access token
POST   /auth/logout            → Invalidate refresh token
POST   /auth/forgot-password   → Send reset email
POST   /auth/reset-password    → Reset with token
```

#### 👤 User Routes (Protected)
```
GET    /users/me               → Get own profile
PATCH  /users/me               → Update profile
DELETE /users/me               → Delete account
GET    /users/me/history       → Past service requests
```

#### 🔧 Provider Routes (Protected)
```
GET    /providers/nearby       → Get nearby providers (query: lat, lng, type, radius)
GET    /providers/:id          → Get provider profile
POST   /providers              → Create provider profile
PATCH  /providers/me           → Update provider profile
PATCH  /providers/me/location  → Update GPS location
PATCH  /providers/me/status    → Toggle online/offline
```

#### 🆘 Service Request Routes (Protected)
```
POST   /requests               → Create new request
GET    /requests/:id           → Get request details
PATCH  /requests/:id/cancel    → Cancel a request
GET    /requests/active        → Get active request
```

#### 💳 Payment Routes (Protected)
```
POST   /payments/intent        → Create Stripe payment intent
POST   /payments/confirm/:id   → Confirm payment
GET    /payments/history       → Payment history
```

#### ⭐ Review Routes (Protected)
```
POST   /reviews                → Submit a review
GET    /reviews/provider/:id   → Get provider reviews
```

---

## 6. Dynamic Pricing Algorithm

```
finalPrice = (basePrice + distanceSurge) × surgePriceMultiplier × timeMultiplier

Where:
  basePrice          = fixed fee by service type (e.g., tow = ₹500 base)
  distanceSurge      = distance_km × pricePerKm (e.g., ₹15/km)
  surgePriceMultiplier = 1.0 to 2.5x (based on demand/supply ratio in zone)
  timeMultiplier     = 1.0 (day) | 1.3 (night 10PM-6AM) | 1.5 (festivals)
```

---

## 7. Provider Matching Algorithm

```
1. Query MongoDB with $geoNear to find providers within 10km radius
   using 2dsphere index on Provider.location

2. Filter by:
   - isOnline = true
   - isAvailable = true
   - serviceTypes includes requested type

3. Score each provider:
   score = (0.5 × normalizedDistance) + (0.3 × rating) + (0.2 × completedJobs)

4. Return top 5 ranked providers

5. Broadcast request to all 5 simultaneously
   → First to accept wins (race condition handled via Redis lock)
```

---

## 8. Security Architecture

| Threat | Mitigation |
|--------|-----------|
| Brute force attacks | Rate limiting (express-rate-limit) on auth routes |
| Token theft | Short-lived access tokens (15min) + refresh token rotation |
| XSS | HTTP-only cookies for tokens, CSP headers |
| CSRF | SameSite cookie flag + CSRF tokens |
| SQL/NoSQL Injection | Mongoose validation + input sanitization (express-validator) |
| Unauthorized access | JWT middleware + role-based access control |
| Data exposure | `.env` secrets never committed, dotenv-safe |
| Payment fraud | Stripe webhook signature verification |

---

## 9. Deployment Architecture (Production)

```
                         ┌─────────────────────┐
                         │   GitHub Actions CI  │
                         │  (Build + Test + Push│
                         │   Docker images)     │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │    Docker Hub /      │
                         │    GitHub Registry   │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────▼────────────────┐
                    │        AWS EC2 Instance          │
                    │                                  │
                    │  ┌────────────────────────────┐  │
                    │  │    Nginx (Reverse Proxy)   │  │
                    │  │  Port 80/443 → containers  │  │
                    │  └──────────────┬─────────────┘  │
                    │                 │                  │
                    │   ┌─────────────┼────────────┐    │
                    │   │             │            │    │
                    │  ┌▼──────┐  ┌──▼──────┐ ┌──▼───┐ │
                    │  │Client │  │ Server  │ │Admin │ │
                    │  │:3000  │  │  :5000  │ │:3001 │ │
                    │  └───────┘  └─────────┘ └──────┘ │
                    │                                  │
                    │   MongoDB Atlas   Redis Cloud     │
                    └──────────────────────────────────┘
```

---

## 10. Environment Variables

```env
# Server
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# Database
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/roadside
REDIS_URL=redis://localhost:6379

# Auth
JWT_ACCESS_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>

# Google Maps
GOOGLE_MAPS_API_KEY=<key>

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Twilio
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_PHONE_NUMBER=+1...

# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY=<json>

# Cloudinary
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
```
