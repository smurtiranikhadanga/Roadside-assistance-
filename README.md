# 🚗 RoadSide+ — AI-Powered Roadside Assistance Platform

A full-stack roadside assistance platform built with **Flask + SQLite/MySQL + SocketIO**.  
Features a public landing page, role-based dashboards, real-time GPS tracking, AI chatbot, and Razorpay payments.

---

## ✨ Features

| Feature | Tech Used |
|---|---|
| Public Landing Page + Navbar | HTML, CSS, Vanilla JS |
| Google OAuth 2.0 Login | Authlib |
| Role-based Dashboards (User/Mechanic/Admin) | Flask Blueprints |
| Real-time GPS Tracking | Flask-SocketIO + Leaflet.js |
| Interactive Maps | Leaflet.js + OpenStreetMap (free, no key needed) |
| AI Roadside Chatbot | OpenAI GPT-4o-mini (with mock fallback) |
| Smart Mechanic Matching | Haversine formula + scoring algorithm |
| Payments | Razorpay (with demo fallback) |
| Analytics Charts | Chart.js |
| Database | SQLite (dev) / MySQL (prod) |

---

## 🚀 Quick Start

### 1. Clone & install
```bash
git clone https://github.com/smurtiranikhadanga/Roadside-assistance-
cd Roadside-assistance-
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — only SECRET_KEY is required to run
```

### 3. Run
```bash
python app.py
```

Open **http://localhost:5000** — use the **Demo Login** buttons to explore all 3 roles instantly.

---

## 🗝️ API Keys (all optional for testing)

| Key | Feature unlocked |
|---|---|
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Real Google Sign-In |
| `OPENAI_API_KEY` | Live AI chatbot responses |
| `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` | Real UPI/card payments |
| `GOOGLE_MAPS_API_KEY` | Not needed — uses free OpenStreetMap |

The app runs **fully without any API keys** using demo login + mock AI + simulated payments.

---

## 📁 Project Structure

```
roadside/
├── app.py                  # Application factory
├── config.py               # Environment configuration
├── extensions.py           # Flask extension instances
├── blueprints/
│   ├── landing/            # Public landing page
│   ├── auth/               # Google OAuth + demo login
│   ├── user/               # User dashboard
│   ├── mechanic/           # Mechanic dashboard
│   ├── admin/              # Admin dashboard
│   ├── api/                # REST API endpoints
│   └── ai/                 # AI chatbot + ETA
├── models/                 # SQLAlchemy models
├── sockets/                # SocketIO real-time events
├── static/
│   ├── css/main.css        # Design system
│   └── js/                 # Maps, payments, AI chat
├── templates/              # Jinja2 HTML templates
└── database/roadside.sql   # MySQL schema (for production)
```

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, Flask, Flask-SQLAlchemy, Flask-SocketIO, Authlib
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+), Leaflet.js, Chart.js
- **Database**: SQLite (dev) / MySQL (prod via PyMySQL)
- **Real-time**: eventlet + Socket.IO
- **Auth**: Google OAuth 2.0 + session-based demo login

---

## 📱 Demo Accounts

Visit http://localhost:5000 and click any demo button:

| Role | Access |
|---|---|
| 👤 **User** | Request assistance, track mechanic, pay, review |
| 🔧 **Mechanic** | Manage jobs, toggle availability, view earnings |
| 🛡️ **Admin** | Full platform management, analytics, user control |

---

Made with ❤️ in India
