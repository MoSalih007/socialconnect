<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-4.x-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
</p>

<h1 align="center">🌐 SocialConnect</h1>

<p align="center">
  <strong>A production-ready, full-stack social media platform with real-time messaging, encrypted conversations, and a comprehensive admin dashboard.</strong>
</p>

<p align="center">
  Built with React 19 · Node.js · TypeScript · PostgreSQL · Socket.IO · Cloudinary
</p>

---

## ✨ Features at a Glance

| Category | Features |
|----------|----------|
| **🔐 Authentication** | JWT + Refresh tokens, Email verification, Password reset, 2FA (Email OTP), Device PIN login, Device fingerprinting |
| **📰 Social Feed** | Photo/video posts, Likes, Comments, Hashtags, Content moderation, Infinite scroll |
| **💬 Messaging** | Real-time DMs, Group chats, Voice messages, GIF/Sticker support, Message reactions, Reply threads, Read receipts |
| **🔒 Encryption** | AES-256-GCM encrypted messages, Per-conversation HKDF-derived keys, Legacy CBC backwards compatibility |
| **👤 Profiles** | Public/private accounts, Follow/unfollow, Follow requests, Block/unblock, Avatar & cover photo uploads |
| **📖 Stories** | 24-hour ephemeral stories, View tracking, Auto-expiry with Cloudinary cleanup |
| **🛡️ Admin Panel** | User management, Content moderation, Reports queue, Audit logging, Ban/unban with session invalidation |
| **🔔 Notifications** | Real-time push notifications via WebSocket, Like/comment/follow/mention alerts |
| **🎨 UI/UX** | Dark/light theme, Responsive design, Framer Motion animations, Mobile-first navigation |

---

## 🏗️ Architecture

```
socialconnect/
├── client/                 # React 19 + Vite frontend
│   ├── src/
│   │   ├── components/     # 30+ reusable UI components
│   │   │   ├── admin/      # Admin dashboard components
│   │   │   ├── auth/       # PIN setup & verification
│   │   │   ├── chat/       # Messaging UI (12 components)
│   │   │   ├── feed/       # Post cards, stories, suggestions
│   │   │   ├── layout/     # Navbar, mobile navigation
│   │   │   ├── profile/    # Avatar upload, follow modals
│   │   │   └── ui/         # Button, Input, Modal, Avatar
│   │   ├── pages/          # 19 pages + 5 admin pages
│   │   ├── store/          # Zustand state management
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # API client, socket, utils
│   └── ...
├── server/                 # Node.js + Express backend
│   ├── src/
│   │   ├── routes/         # 15 RESTful API route modules
│   │   ├── middleware/     # Auth, rate limiting, validation, error handling
│   │   ├── utils/          # Encryption, Cloudinary, email service
│   │   ├── config/         # Database connection pool
│   │   ├── server.ts       # App entry with security hardening
│   │   └── socket.ts       # Socket.IO real-time server
│   └── *.sql               # Database schema & migrations
└── diagrams/               # Architecture, ER, DFD, UML diagrams
```

---

## 🔧 Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **React 19** | UI framework with latest features |
| **TypeScript** | Type-safe development |
| **Vite 7** | Lightning-fast build tool |
| **Tailwind CSS** | Utility-first styling |
| **Zustand** | Lightweight state management |
| **Framer Motion** | Smooth page transitions & animations |
| **Socket.IO Client** | Real-time WebSocket communication |
| **React Hook Form + Zod** | Form handling with schema validation |
| **FingerprintJS** | Device fingerprinting for trusted devices |
| **Lucide React** | Beautiful icon library |

### Backend
| Technology | Purpose |
|-----------|---------|
| **Node.js + Express** | RESTful API server |
| **TypeScript** | End-to-end type safety |
| **PostgreSQL** | Relational database with 17+ tables |
| **Socket.IO** | Real-time bidirectional communication |
| **JWT + Refresh Tokens** | Stateless auth with token rotation |
| **bcrypt** | Secure password hashing |
| **AES-256-GCM** | Authenticated message encryption |
| **HKDF Key Derivation** | Per-conversation encryption keys |
| **Cloudinary** | Media storage & CDN |
| **Nodemailer** | Email verification & password reset |
| **Helmet** | HTTP security headers (CSP, HSTS, etc.) |
| **express-rate-limit** | API rate limiting & brute-force protection |

---

## 🔐 Security Features

This project implements **production-grade security** — not just basic auth:

| Feature | Implementation |
|---------|---------------|
| **Message Encryption** | AES-256-GCM with per-conversation HKDF-derived keys. Legacy AES-256-CBC support for backwards compatibility. |
| **Authentication** | JWT (HS256) with refresh token rotation stored in httpOnly cookies. Token blacklisting on logout. |
| **Device Trust** | FingerprintJS device identification + PIN-based trusted device system with brute-force lockout. |
| **Two-Factor Auth** | Email-based OTP verification for sensitive operations. |
| **Input Validation** | Server-side validation with `express-validator` + client-side Zod schemas. |
| **Rate Limiting** | Global rate limits + per-endpoint limits on auth routes to prevent brute-force attacks. |
| **Security Headers** | Helmet.js with strict CSP, HSTS (preload), X-Frame-Options (DENY), referrer policy. |
| **SQL Injection Prevention** | Parameterized queries throughout — zero string concatenation in SQL. |
| **Content Moderation** | Database-level trigger-based profanity filter + manual admin review queue. |
| **Ban Enforcement** | Cached ban checks on every request. Fail-closed design — DB outages deny access rather than grant it. |
| **Forced Password Reset** | Admin can force password reset on compromised accounts, enforced server-side on all endpoints. |
| **Environment Validation** | Startup validation of critical env vars (key length, hex format) — server refuses to start with weak config. |
| **Graceful Shutdown** | SIGTERM/SIGINT handling with connection draining and forced timeout. |

---

## 💾 Database Design

**17 tables** with triggers, constraints, and indexes designed for performance and data integrity:

```
users · posts · comments · likes · follows · follow_requests
messages · group_conversations · group_members · group_invitations
message_reactions · message_read_receipts · stories · story_views
notifications · saved_posts · blocks · reports · hashtags
post_hashtags · device_sessions · audit_log · password_resets
token_blacklist · refresh_tokens · content_interactions
screenshot_permissions · cloudinary_cleanup_queue
```

### Key Database Features
- **Triggers**: Automatic content moderation, notification generation
- **Constraints**: Self-follow prevention, message recipient validation (DM XOR group)
- **Indexes**: 30+ performance indexes on frequently queried columns
- **Cascading Deletes**: Proper foreign key cascades for data consistency
- **Check Constraints**: Email lowercase enforcement, self-block prevention

> 📊 Full ER diagram available in [`diagrams/SocialConnect_ER_Diagram.png`](diagrams/SocialConnect_ER_Diagram.png)

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ 
- **PostgreSQL** 14+
- **Cloudinary** account (free tier works)
- **Gmail** account with App Password enabled

### 1. Clone the repository
```bash
git clone https://github.com/MoSalih007/socialconnect.git
cd socialconnect
```

### 2. Set up the database
```bash
# Create the database
psql -U postgres -c "CREATE DATABASE socialconnect;"

# Run the schema
psql -U postgres -d socialconnect -f server/"DATABASE 1.sql"

# Run migrations
psql -U postgres -d socialconnect -f server/MIGRATIONS.sql
```

### 3. Configure environment variables
```bash
# Server
cp server/.env.example server/.env
# Edit server/.env with your database credentials, JWT secret, Cloudinary keys, etc.

# Client
cp client/.env.example client/.env
```

### 4. Install dependencies & run
```bash
# Terminal 1 — Backend
cd server
npm install
npm run dev

# Terminal 2 — Frontend
cd client
npm install
npm run dev
```

The app will be available at **http://localhost:5173**

---

## 📡 API Overview

15 RESTful route modules with 80+ endpoints:

| Module | Endpoints | Description |
|--------|-----------|-------------|
| `/api/auth` | Register, Login, Logout, Refresh, 2FA, PIN | Full authentication flow |
| `/api/users` | Profile CRUD, Follow, Block, Privacy, Online status | User management |
| `/api/posts` | Create, Edit, Delete, Like, Comment, Hashtag | Content operations |
| `/api/messages` | Send, Edit, Delete, Read receipts, Voice/GIF | Direct messaging |
| `/api/groups` | Create, Invite, Join, Leave, Admin, Settings | Group chat management |
| `/api/reactions` | Add, Remove, List | Message reactions |
| `/api/stories` | Create, View, Delete, View tracking | Ephemeral stories |
| `/api/notifications` | List, Mark read, Real-time push | Notification system |
| `/api/search` | Users, Posts, Hashtags | Search functionality |
| `/api/admin` | Dashboard, Ban, Moderate, Audit | Admin operations |
| `/api/reports` | Create, Review, Resolve | Content reporting |
| `/api/hashtags` | Trending, Search | Hashtag discovery |
| `/api/saved-posts` | Save, Unsave, List | Bookmarking |
| `/api/suggestions` | Friend suggestions | ML-style recommendations |
| `/api/password-reset` | Request, Verify, Reset | Password recovery |

---

## 🧪 Real-Time Features

Powered by **Socket.IO** with JWT-authenticated connections:

- **Live Messages** — Instant delivery for DMs and group chats
- **Typing Indicators** — See when someone is typing in real-time
- **Online Presence** — Green dot indicators with last-seen timestamps
- **Push Notifications** — Real-time notification delivery without polling
- **Read Receipts** — Blue ticks when messages are read
- **Multi-Tab Support** — Users can be online from multiple browser tabs simultaneously

---

## 📊 Diagrams

Software engineering documentation included in the `diagrams/` folder:

| Diagram | Description |
|---------|-------------|
| Architecture Diagram | System overview with client-server-database layers |
| ER Diagram | Full database schema with relationships |
| Use Case Diagram | Actor-feature mapping |
| Sequence Diagram | Auth, posting, messaging flows |

---

## 📂 Project Stats

| Metric | Value |
|--------|-------|
| **Frontend Components** | 30+ React components |
| **Frontend Pages** | 24 pages (19 user + 5 admin) |
| **Backend Routes** | 15 route modules, 80+ endpoints |
| **Database Tables** | 17+ tables with triggers & constraints |
| **Database Indexes** | 30+ performance indexes |
| **Lines of Code** | ~15,000+ across client & server |
| **Security Features** | 12+ production-grade implementations |

---

## 👥 Team

Built as an **ADBMS PBL project** by a team of 3:

| Member | Contributions |
|--------|--------------|
| **Mohammed Salih** | Project lead, full-stack development, system architecture, API design, security implementation |
| **Aswathy PJ** | Database schema design, PostgreSQL setup, frontend UI planning, documentation |
| **Manisha KA** | Database design, query optimization, testing, research, project documentation |

---

## 📝 License

This project is for educational and portfolio purposes.
