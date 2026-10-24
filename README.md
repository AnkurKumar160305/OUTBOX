# 🚀 ReachInbox — Production-Grade Email Job Scheduler & Dashboard

A resilient, scalable, full-stack email scheduling service and real-time dashboard built for **ReachInbox.ai (Outbox Labs)**.

Designed to mimic enterprise outreach engines that schedule, throttle, and deliver millions of emails without dropped jobs, duplicate sends, or cron job dependencies.

---

## 📑 Table of Contents
1. [Core Features & Architecture](#-core-features--architecture)
2. [Hard Constraints & Guarantees](#-hard-constraints--guarantees)
3. [Throughput, Rate Limiting & Concurrency](#-throughput-rate-limiting--concurrency)
4. [Live Slack Rate-Limit Notifications](#-live-slack-rate-limit-notifications)
5. [Elasticsearch Search Engine](#-elasticsearch-search-engine)
6. [Ethereal SMTP Integration](#-ethereal-smtp-integration)
7. [Tech Stack](#-tech-stack)
8. [Getting Started (Step-by-Step)](#-getting-started-step-by-step)
9. [Feature Mapping Matrix](#-feature-mapping-matrix)
10. [Submission & Access Details](#-submission--access-details)

---

## 🏛️ Core Features & Architecture

```mermaid
flowchart TD
    subgraph Frontend["React 18 + TypeScript + Tailwind CSS"]
        UI[Main Dashboard]
        Compose[Compose Modal + CSV Parser]
        Search[Elasticsearch Full-Text Search]
        BoardEmbed[BullMQ Live Queue Monitor]
        SlackUI[Slack Integration Modal]
    end

    subgraph API["Express.js + TypeScript Backend"]
        Endpoints[REST API Routes]
        BullBoard["Bull-Board (/admin/queues)"]
    end

    subgraph Database["PostgreSQL (Prisma ORM)"]
        Users[(Users)]
        Campaigns[(Campaigns)]
        Emails[(Scheduled & Sent Emails)]
        RateLimitLogs[(Rate Limit Events)]
        SlackTokens[(Slack Configs)]
    end

    subgraph QueueEngine["BullMQ Engine (Redis)"]
        DelayedQueue["Delayed Queue (ZSET)"]
        ActiveQueue["Active Jobs"]
        RedisRL["Redis Hourly Counters (Lua)"]
    end

    subgraph SearchCluster["Elasticsearch"]
        ESIndex["Index: reachinbox_emails"]
    end

    subgraph External["External Services"]
        Ethereal["Ethereal SMTP Server"]
        SlackHook["Slack Webhook / API"]
    end

    Compose -->|POST /api/emails/schedule| Endpoints
    Endpoints -->|Store Record| Emails
    Endpoints -->|Add Delayed Job| DelayedQueue
    Endpoints -->|Index Email| ESIndex

    DelayedQueue -->|When Delay Expires| ActiveQueue
    ActiveQueue --> Worker[BullMQ Concurrency Workers]

    Worker -->|Atomic Rate Check| RedisRL
    RedisRL -->|Under Limit| Ethereal
    RedisRL -->|Limit Exceeded| ReDelay[Reschedule to Next Hour]
    ReDelay -->|job.moveToDelayed| DelayedQueue
    RedisRL -->|Trigger Once per Window| SlackHook

    Worker -->|Update Status = SENT| Emails
    Worker -->|Update Status = SENT| ESIndex
```

---

## 🔒 Hard Constraints & Guarantees

### 1. ❌ Strictly NO Cron Jobs
- **No OS cron** (crontab, systemd timers).
- **No Node cron libraries** (`node-cron`, `agenda`, etc.).
- **Pure BullMQ Delayed Jobs:** Timing is strictly enforced using BullMQ delayed jobs backed by Redis sorted sets (`ZSET`). Jobs sleep in Redis with millisecond precision and awake automatically when due.

### 2. 🛡️ Resilience Across Server Restarts
- When the backend or worker stops, Redis retains all scheduled jobs and timestamps.
- When restarted, workers immediately reconnect to Redis and resume execution at the exact scheduled timestamp.
- **Idempotency Guarantee:** BullMQ `jobId` strictly matches PostgreSQL `ScheduledEmail.id`. The worker validates `email.status === 'SENT'` prior to dispatching; completed emails are never duplicated or re-sent.

---

## ⚡ Throughput, Rate Limiting & Concurrency

### ✅ 1. Worker Concurrency
- BullMQ worker is instantiated with configurable concurrency:
  ```env
  WORKER_CONCURRENCY=5
  ```
- Workers pull and process jobs concurrently in parallel while respecting rate limits.

### ✅ 2. Minimum Delay Between Each Email (Throttling)
- To prevent spam flag triggers and emulate realistic email provider throttling, a minimum delay is enforced:
  ```env
  MIN_EMAIL_DELAY_MS=2000
  ```
- Defaults to **2.0 seconds** between consecutive sends per sender, or custom delay set during campaign creation.

### ✅ 3. Hourly Rate Limiting (Redis-Backed Atomic Counters)
- Enforces an hourly cap per sender:
  ```env
  MAX_EMAILS_PER_HOUR_PER_SENDER=50
  ```
- **Distributed & Safe Across Multiple Workers:** Uses Redis atomic Lua scripts with hour keys:
  ```
  ratelimit:emails:{senderEmail}:{YYYY-MM-DD:HH}
  ```
- **Zero Dropped Jobs Policy:** When a limit is hit, the job is **NOT dropped or failed**. Instead, the worker calculates the exact milliseconds remaining until the top of the next hour window and re-delays the job using:
  ```typescript
  await job.moveToDelayed(Date.now() + delayMs, job.token);
  ```
- Job order is preserved and jobs execute automatically in the subsequent hour window.

---

## 🔔 Live Slack Rate-Limit Notifications

- **Connect Slack Flow:** Users open the **Connect Slack** modal in the dashboard and configure their Slack Incoming Webhook or OAuth token.
- **Instant Live Trigger:** The exact moment a sender hits their hourly limit, the BullMQ worker fires an alert directly to the user's Slack channel:
  - Formatted Slack Block Kit message with:
    - ⚠️ Warning header
    - Sender Email
    - Hourly Limit
    - Sent Count in current window
    - Exact Next Sending Window timestamp
- **Disconnect / Reconnect Tolerance:** If Slack is not connected, the worker executes silently without error. If connected later, notifications immediately fire on subsequent breaches without redeployment.
- **Built-in Test Alert:** The Slack modal features a **Test Alert** button that dispatches a live verification alert immediately.

---

## 🔍 Elasticsearch Search Engine

- **Full-Text Indexing:** Every scheduled and sent email is indexed into Elasticsearch (`reachinbox_emails`) with custom analyzers (`uax_url_email` for email parsing).
- **Search Capabilities:** Multi-match queries across `recipientEmail`, `subject`, `body`, and `senderEmail` with search highlights.
- **Resilient Fallback:** If Elasticsearch is temporarily unavailable, the search service automatically and transparently falls back to PostgreSQL ILIKE queries, ensuring 100% service uptime.

---

## 📬 Ethereal SMTP Integration

- Sends real emails through Ethereal fake SMTP (`smtp.ethereal.email`).
- Auto-generates test credentials on first run if `.env` values are omitted.
- Captures `nodemailer.getTestMessageUrl(info)` for every sent email.
- The dashboard displays a clickable **"View Email"** button in the Sent Emails table, opening the fully rendered HTML email in Ethereal's web viewer.

---

## 💻 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | TypeScript, Express.js |
| **Queue Engine** | BullMQ + Redis |
| **Database** | PostgreSQL + Prisma ORM |
| **SMTP Testing** | Ethereal Email + Nodemailer |
| **Search Engine** | Elasticsearch 7/8 (`@elastic/elasticsearch`) |
| **Live Queue Dashboard** | `@bull-board/express` |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS |
| **Icons & Design** | Lucide React, Glassmorphism, ReachInbox Obsidian Theme |
| **Auth** | Google OAuth (`@react-oauth/google`) + Instant Demo Sign-In |
| **Lead Parser** | PapaParse (CSV & TXT lead detection) |

---

## 🚀 Getting Started (Step-by-Step)

### Option A: Local Development (Quick Setup)

#### 1. Prerequisites
- Node.js v18+ and npm
- Redis server running on port `6379`
- PostgreSQL running on port `5432` (or custom port)

#### 2. Configure Backend
```bash
cd backend
npm install
npx prisma db push
npx prisma generate
```

Edit `backend/.env` with your settings:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reachinbox?schema=public"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=50
```

Start the backend:
```bash
npm run dev
```

#### 3. Configure Frontend
```bash
cd ../frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

### Option B: Run with Docker Compose
```bash
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- BullMQ Live Dashboard: `http://localhost:5000/admin/queues`

---

## 📋 Feature Mapping Matrix

| Requirement | Implementation Detail | Status |
|---|---|:---:|
| **BullMQ + Redis Delayed Jobs** | `backend/src/queue/emailQueue.ts` (0% cron, 100% BullMQ) | ✅ Complete |
| **Server Restart Resilience** | Redis sorted sets persist jobs; DB maintains status; resumes upon restart | ✅ Complete |
| **Worker Concurrency** | Configurable via `WORKER_CONCURRENCY` in `emailWorker.ts` | ✅ Complete |
| **Provider Throttling Delay** | Configurable `MIN_EMAIL_DELAY_MS` (default 2s) | ✅ Complete |
| **Hourly Rate Limiting** | Redis atomic Lua script per `sender:hourWindow` | ✅ Complete |
| **Zero Dropped Jobs** | Auto-reschedules over-limit jobs to next hour with `moveToDelayed` | ✅ Complete |
| **Live Slack Notifications** | Direct Slack Webhook / OAuth with rich Block Kit alerts | ✅ Complete |
| **Elasticsearch Search** | Indexed emails with multi-match search + resilient DB fallback | ✅ Complete |
| **Ethereal Email & Preview URLs** | `nodemailer.getTestMessageUrl` with "View Email" buttons | ✅ Complete |
| **BullMQ Live Dashboard** | Bull-Board mounted at `/admin/queues` & embedded in UI | ✅ Complete |
| **Google Login** | Real Google OAuth + Instant Demo Reviewer mode | ✅ Complete |
| **CSV / Lead File Parser** | PapaParse with automatic email extraction & lead chip preview | ✅ Complete |
| **Scheduled & Sent Tables** | Responsive tables with search, status pills, and empty states | ✅ Complete |

---

## 👥 GitHub Access & Submission

- **Repository Access:** Granted to:
  - `mitrajit`
  - `Yadav036`
- **Submission Form:** [ReachInbox Assignment Submission Form](https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST)
- **Demo Recording:** Included in artifacts (`reachinbox_demo.webp`).
