<div align="center">

# 💬 NexTalk

### A production-grade real-time messaging platform

**Built with Next.js 16 · Supabase · LiveKit WebRTC · TypeScript · TailwindCSS v4**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-orange?style=for-the-badge)](https://livekit.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)

---

<!-- Replace with your app screenshot -->
> 📸 *Screenshot / GIF demo coming soon*

</div>

---

## ✨ Features

### 💬 Messaging
- **Real-time chat** — instant message delivery via Supabase Realtime subscriptions
- **Optimistic UI** — messages appear instantly on send; status updates on server confirmation
- **Read receipts** — per-message seen indicators
- **Client-generated IDs** — idempotent message delivery, no duplicates even on unstable connections
- **Custom chat themes** — per-conversation color themes

### 📞 Voice & Video
- **1-on-1 & group calls** — WebRTC-powered audio/video via LiveKit
- **Incoming call notifications** — real-time call alerts with accept/decline
- **Call overlay** — floating in-call UI that doesn't block the chat

### 👥 Groups & Clubs
- **Club rooms** — create and manage named group chat rooms
- **Member management** — invite, browse, and organize club members
- **Group messaging** — full real-time chat within club rooms

### 🟢 Presence
- **Online/Offline indicators** — live user presence via Supabase Realtime
- **Last seen timestamps** — accurate last-seen tracking per user

### 🌍 Internationalization & Theming
- **Multi-language** — English & Vietnamese via `next-intl`
- **Dark / Light mode** — system-aware theme toggle with `next-themes`

### 🔐 Authentication
- **Email/Password auth** — secure sign-up and login via Supabase Auth
- **Server-side session** — SSR-safe auth with `@supabase/ssr`
- **Protected routes** — middleware-based route guards

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Next.js 16)                  │
│  React 19 · App Router · Server Components · next-intl  │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   Supabase               │  │   LiveKit                 │
│  ┌────────────────────┐  │  │  ┌──────────────────────┐ │
│  │  Auth (SSR-safe)   │  │  │  │  WebRTC Media Server │ │
│  │  PostgreSQL (DB)   │  │  │  │  Room / Track mgmt   │ │
│  │  Realtime (WS)     │  │  │  │  Token Auth          │ │
│  │  Storage (avatars) │  │  └──────────────────────────┘ │
│  └────────────────────┘  │                               │
└──────────────────────────┘                               │
               │                                           │
               └───────────────────────────────────────────┘
                   Next.js API Routes bridge both services
```

Data flow for messaging: `User sends → Optimistic UI update → Supabase INSERT → Realtime broadcast → All subscribers receive`

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework with SSR/SSG |
| **Language** | TypeScript 5.7 | Type safety across client & server |
| **Database** | Supabase (PostgreSQL) | Relational data, RLS security policies |
| **Realtime** | Supabase Realtime | WebSocket subscriptions for live updates |
| **Auth** | Supabase Auth + `@supabase/ssr` | SSR-safe authentication & session management |
| **Voice/Video** | LiveKit + `livekit-client` | WebRTC audio/video calls |
| **UI Components** | Radix UI + shadcn/ui | Accessible, unstyled component primitives |
| **Styling** | TailwindCSS v4 | Utility-first CSS |
| **Icons** | Lucide React | Consistent icon system |
| **Forms** | React Hook Form + Zod | Type-safe form validation |
| **i18n** | next-intl | Multi-locale routing & translations |
| **Theming** | next-themes | Dark/light mode |
| **Analytics** | Vercel Analytics | Production usage insights |
| **Deployment** | Vercel | Edge-optimized hosting |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v20+
- **pnpm** v9+ (`npm install -g pnpm`)
- A **[Supabase](https://supabase.com)** project
- A **[LiveKit](https://livekit.io)** project (Cloud or self-hosted)

### 1. Clone & Install

```bash
git clone https://github.com/anhtri22303/v0-chat-with-supabase.git
cd v0-chat-with-supabase
pnpm install
```

### 2. Configure Environment Variables

Create a `.env.local` file at the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# LiveKit
LIVEKIT_API_KEY=<your-livekit-api-key>
LIVEKIT_API_SECRET=<your-livekit-api-secret>
NEXT_PUBLIC_LIVEKIT_URL=wss://<your-livekit-host>
```

### 3. Run Database Migrations

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Start the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

<details>
<summary>Click to expand</summary>

```
v0-chat-with-supabase/
├── app/
│   ├── [locale]/          # Internationalized routes
│   │   └── dashboard/     # Main chat dashboard
│   ├── api/               # API route handlers
│   │   ├── calls/         # LiveKit token generation
│   │   ├── club/          # Club management endpoints
│   │   └── clubs/         # Club listing endpoints
│   ├── auth/              # Auth pages & server actions
│   │   ├── login/
│   │   ├── sign-up/
│   │   └── actions.ts
│   └── clubs/             # Club detail pages
├── components/
│   ├── call/              # Voice/video call UI
│   ├── chat/              # Chat window, messages, input
│   ├── home/              # Room cards, user search, group creation
│   └── layout/            # Sidebar & layout wrappers
├── contexts/              # React contexts (call, notification, presence)
├── hooks/                 # Custom React hooks
├── i18n/                  # next-intl configuration
├── lib/
│   ├── supabase/          # Supabase client (browser & server)
│   ├── livekit.ts         # LiveKit helpers
│   ├── call-types.ts      # Shared call type definitions
│   └── media-utils.ts     # Media device utilities
├── messages/              # Translation files
│   ├── en.json
│   └── vi.json
└── supabase/
    └── migrations/        # Database migration SQL files
```

</details>

---

## 🗄️ Database Migrations

Migrations are located in `supabase/migrations/` and applied in order:

| Migration | Description |
|---|---|
| `20260518000000_call_sessions.sql` | Call session tracking table & policies |
| `20260518010000_fix_club_members_policies.sql` | RLS fix for club membership |
| `20260520000000_add_last_seen.sql` | Last-seen timestamp column |
| `20260521000000_avatars_and_read_receipts.sql` | Avatar storage & read receipt tracking |
| `20260522000000_chat_themes.sql` | Per-conversation theme preferences |
| `20260523000000_client_message_id.sql` | Client-generated idempotency IDs |

---

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs) — App Router, Server Components, API Routes
- [Supabase Documentation](https://supabase.com/docs) — Auth, Realtime, Row Level Security
- [LiveKit Documentation](https://docs.livekit.io) — WebRTC rooms, tracks, and tokens
- [next-intl Documentation](https://next-intl-docs.vercel.app) — i18n routing & translations
- [shadcn/ui](https://ui.shadcn.com) — Component library built on Radix UI

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is for educational/capstone purposes. All rights reserved © 2026 [anhtri22303](https://github.com/anhtri22303).

---

<div align="center">

**Made with ❤️ using Next.js, Supabase & LiveKit**

<a href="https://v0.app/chat/api/kiro/clone/anhtri22303/v0-chat-with-supabase" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>

</div>
