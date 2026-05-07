# 🚗 RoadSide+ — Intelligent Roadside Assistance Platform

<p align="center">
  <img src="https://img.shields.io/badge/Stack-MERN-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/Realtime-Socket.IO-010101?style=for-the-badge&logo=socket.io" />
  <img src="https://img.shields.io/badge/Maps-Google%20Maps%20API-4285F4?style=for-the-badge&logo=google-maps" />
  <img src="https://img.shields.io/badge/Auth-JWT%20%2B%20OAuth-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Payments-Stripe-635BFF?style=for-the-badge&logo=stripe" />
  <img src="https://img.shields.io/badge/Notifications-Twilio%20%2F%20FCM-red?style=for-the-badge" />
</p>

---

## 📌 Overview

**RoadSide+** is a full-stack, production-grade roadside assistance platform that connects stranded motorists with nearby service providers (mechanics, tow trucks, fuel delivery agents) in real-time.

Think of it as the **Uber for roadside emergencies** — with live GPS tracking, instant booking, dynamic pricing, in-app communication, and AI-powered ETA predictions.

---

## ✨ Features

### 👤 User (Driver) App
- 🔐 Secure registration/login with JWT + Google OAuth
- 📍 Auto-detect location via GPS (Google Maps API)
- 🆘 Request emergency services (tow, fuel, tire change, battery jump, lockout)
- 📡 Real-time provider tracking on map
- 💬 In-app chat with assigned provider
- 💳 Seamless payment via Stripe
- ⭐ Rate & review providers post-service
- 🔔 Push & SMS notifications for updates

### 🔧 Provider (Mechanic/Tow) App
- 📋 Service request dashboard with accept/decline
- 🗺️ Optimized routing to user location
- 💰 Earnings tracker & withdrawal
- 📅 Schedule & availability management
- 📊 Analytics dashboard

### 🛡️ Admin Panel
- 👥 User & Provider management
- 📈 Platform analytics & revenue reports
- 🚩 Dispute resolution system
- 🗺️ Live fleet map of all active jobs
- ⚙️ Dynamic pricing configuration

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js + Vite, Redux Toolkit, TailwindCSS |
| **Backend** | Node.js + Express.js (REST API) |
| **Database** | MongoDB (Mongoose ODM) |
| **Real-time** | Socket.IO |
| **Auth** | JWT + bcrypt + Google OAuth 2.0 |
| **Maps** | Google Maps JS API + Geolocation API |
| **Payments** | Stripe API |
| **Notifications** | Twilio (SMS) + Firebase Cloud Messaging (Push) |
| **File Storage** | Cloudinary |
| **Caching** | Redis |
| **Deployment** | Docker + Nginx + AWS EC2 / Railway |
| **CI/CD** | GitHub Actions |

---

## 📂 Project Structure

```
roadside/
├── client/                  # React frontend (User + Provider apps)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/           # Redux Toolkit slices
│   │   ├── hooks/
│   │   ├── services/        # API calls
│   │   └── utils/
├── server/                  # Node.js + Express backend
│   ├── controllers/
│   ├── models/              # Mongoose schemas
│   ├── routes/
│   ├── middleware/
│   ├── sockets/             # Socket.IO handlers
│   ├── services/            # Business logic (pricing, notifications)
│   └── utils/
├── admin/                   # Admin dashboard (separate React app)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- MongoDB Atlas account (or local MongoDB)
- Google Maps API Key
- Stripe API Keys
- Twilio Account SID + Auth Token
- Firebase project (for FCM)

### Installation

```bash
# Clone the repo
git clone https://github.com/smurtiranikhadanga/Roadside-assistance-
cd roadside

# Install all dependencies
npm run install:all

# Configure environment variables
cp .env.example .env
# Fill in your API keys in .env

# Start development servers
npm run dev
```

---

## 🌐 API Documentation

Base URL: `http://localhost:5000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login user |
| GET | `/services` | Get available service types |
| POST | `/requests` | Create service request |
| GET | `/requests/:id` | Get request details |
| GET | `/providers/nearby` | Get nearby providers |
| POST | `/payments/intent` | Create Stripe payment intent |
| POST | `/reviews` | Submit review |

Full API docs: [Swagger UI](http://localhost:5000/api-docs)

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">Built with ❤️ by Smurti Rani Khadanga</p>
