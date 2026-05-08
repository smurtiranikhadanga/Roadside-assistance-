<div align="center">
  <h1>🚗 RoadSide+</h1>
  <p><strong>AI-Powered Full-Stack Roadside Assistance Platform</strong></p>
  <p>
    A real-time, location-based service platform connecting stranded drivers with nearby mechanics instantly.
    Built with Python, Flask, WebSockets, and AI integrations.
  </p>
  <br />
</div>

## 📖 Table of Contents
- [About the Project](#-about-the-project)
- [Key Features](#-key-features)
- [System Architecture & Tech Stack](#️-system-architecture--tech-stack)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [Environment Configuration](#-environment-configuration)
- [Demo Accounts & Roles](#-demo-accounts--roles)
- [Deployment](#-deployment)
- [Future Roadmap](#-future-roadmap)
- [License](#-license)

---

## 🚀 About the Project

**RoadSide+** is a comprehensive roadside assistance solution designed to reduce wait times for stranded drivers and optimize workflow for mechanics. By leveraging real-time GPS tracking, smart matching algorithms, and an AI-powered chatbot, it provides a seamless Uber-like experience for roadside emergencies such as towing, fuel delivery, battery jump-starts, and tire changes.

---

## ✨ Key Features

### 👤 For Users
- **Instant Service Requests:** Request help in just a few clicks with automatic GPS location detection.
- **Real-Time Tracking:** Watch the assigned mechanic arrive in real-time on a live interactive map.
- **AI Roadside Assistant:** Chat with an integrated AI (powered by OpenAI) for immediate troubleshooting tips and ETA estimates.
- **Secure Payments:** Seamless Razorpay integration for fast, cashless transactions.
- **Google Authentication:** Secure and easy login using Google OAuth 2.0.

### 🔧 For Mechanics
- **Smart Job Matching:** Haversine formula-based matching ensures mechanics only receive requests within their proximity.
- **Interactive Dashboard:** Manage active jobs, toggle availability, and navigate to users effortlessly.
- **Earnings Tracker:** Built-in analytics to track daily and weekly earnings.

### 🛡️ For Administrators
- **Platform Management:** Full visibility over all active requests, users, and registered mechanics.
- **Analytics & Insights:** Visual charts and graphs (via Chart.js) detailing platform usage, service types, and revenue.

---

## 🛠️ System Architecture & Tech Stack

The application follows a modular monolith architecture utilizing Flask Blueprints for clean separation of concerns.

### Backend
- **Core Framework:** Python 3.10+, Flask
- **Real-Time Engine:** Flask-SocketIO (with `eventlet`) for WebSockets
- **Database:** SQLite (Development) / MySQL via PyMySQL (Production)
- **ORM:** Flask-SQLAlchemy
- **Authentication:** Flask-Login, Authlib (Google OAuth)

### Frontend
- **Languages:** HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Mapping & GIS:** Leaflet.js with OpenStreetMap (Free, no API key required)
- **Data Visualization:** Chart.js
- **Templates:** Jinja2

### External APIs
- **AI Integration:** OpenAI API (GPT-4o-mini)
- **Payments:** Razorpay API

---

## 📁 Project Structure

```text
roadside/
├── app.py                  # Application factory and entry point
├── config.py               # Environment configuration and settings
├── extensions.py           # Initialization of Flask extensions (DB, SocketIO, etc.)
├── requirements.txt        # Python dependencies
├── Procfile                # Heroku/Render process configuration
├── render.yaml             # Render infrastructure as code setup
├── blueprints/             # Modular application routes
│   ├── landing/            # Public-facing landing pages
│   ├── auth/               # Authentication flows (OAuth, Login)
│   ├── user/               # User dashboard and request logic
│   ├── mechanic/           # Mechanic job management panel
│   ├── admin/              # Administrator dashboard and charts
│   ├── api/                # REST API endpoints for client data
│   └── ai/                 # OpenAI chatbot handling routes
├── models/                 # SQLAlchemy database models
├── sockets/                # Real-time Socket.IO event handlers
├── static/                 # Static assets
│   ├── css/                # Main stylesheets and design system
│   ├── js/                 # Client-side scripts (Maps, Sockets, Payments)
│   └── images/             # Image assets
├── templates/              # Jinja2 HTML views
└── database/               # Database assets (e.g., MySQL schemas)
```

---

## ⚙️ Setup & Installation

### Prerequisites
- **Python 3.10+** installed on your system.
- **Git** for version control.

### Step-by-step Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/smurtiranikhadanga/Roadside-assistance-
   cd Roadside-assistance-
   ```

2. **Create a Virtual Environment (Recommended):**
   ```bash
   # On Windows
   python -m venv venv
   venv\Scripts\activate

   # On macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize the Database:**
   The SQLite database is automatically generated on the first run inside the `instance/` folder.

5. **Start the Development Server:**
   ```bash
   python app.py
   ```
   *The application will be running at `http://localhost:5000`.*

---

## 🗝️ Environment Configuration

The application is designed to run seamlessly out-of-the-box without strict API key requirements (using built-in mock fallback mechanisms). However, to unlock the full potential, configure the `.env` file.

1. Copy the example configuration:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to include your keys:

| Environment Variable | Description / Feature Unlocked | Required |
|----------------------|---------------------------------|----------|
| `SECRET_KEY` | Cryptographic key for Flask sessions. | **Yes** |
| `DATABASE_URL` | Override SQLite with MySQL/PostgreSQL. | No |
| `GOOGLE_CLIENT_ID` | Enables real Google Sign-In. | No |
| `GOOGLE_CLIENT_SECRET`| Enables real Google Sign-In. | No |
| `OPENAI_API_KEY` | Enables live AI chatbot responses. | No |
| `RAZORPAY_KEY_ID` | Enables real UPI/card payments. | No |
| `GOOGLE_MAPS_API_KEY` | Enables real-time nearby mechanics, petrol pumps, and directions via Google Maps Places/Distance Matrix API. | **Yes (for Maps)** |

*Note: The platform falls back to demo data if API keys are missing, but a Google Maps API key is highly recommended for full mapping features.*

---

## 📱 Demo Accounts & Roles

To make testing easy, the application features one-click demo login buttons directly on the authentication page (`http://localhost:5000/auth/login`).

| Role | Access Level | Capabilities |
|------|--------------|--------------|
| 👤 **User** | Consumer | Request services, track mechanic arrival on the live map, simulate payments, write reviews. |
| 🔧 **Mechanic** | Service Provider | Accept/Decline job requests, toggle "Online" status, view service locations, track earnings. |
| 🛡️ **Admin** | System Operator | View system-wide analytics, monitor all active requests, manage registered users and mechanics. |

---

## 🌐 Deployment

The repository comes pre-configured for modern PaaS platforms.

### Deploying to Render
1. Connect your GitHub repository to Render.
2. The provided `render.yaml` blueprint will automatically configure the Web Service and environment.
3. Ensure `SOCKETIO_ASYNC_MODE` is set appropriately for production (e.g., `eventlet` or `gevent`).

### Deploying to Heroku
1. Create a new Heroku app.
2. Push your code: `git push heroku main`.
3. The `Procfile` uses `gunicorn` with `eventlet` workers to handle WebSockets efficiently:
   ```text
   web: gunicorn -k eventlet -w 1 app:app
   ```

---

## 🔮 Future Roadmap

- [ ] **Native Mobile Application:** React Native wrappers for iOS and Android.
- [ ] **Advanced Dispatch Algorithm:** Traffic-aware ETA routing and predictive dispatching.
- [ ] **Fleet Management:** Allowing independent towing companies to manage multiple drivers under one account.
- [ ] **In-App VoIP Calls:** Secure calling between driver and mechanic without sharing phone numbers.

---

## 📜 License

This project is licensed under the MIT License. You are free to use, modify, and distribute this software.

---
<div align="center">
  <i>Made with ❤️ in India.</i>
</div>
