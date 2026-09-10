<div align="center">
  <h1>mailZy</h1>
  <p>A high-performance, fault-tolerant email scheduling and dispatch engine.</p>
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Express.js](https://img.shields.io/badge/Express.js-404D59?style=flat-square)](https://expressjs.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
  [![BullMQ](https://img.shields.io/badge/BullMQ-FF4081?style=flat-square)](https://docs.bullmq.io/)
</div>

<br />

**mailZy** is a production-grade email job scheduling system designed to handle high-throughput campaigns. It provides granular rate limiting, delayed execution, strict idempotency, and robust crash-recovery mechanisms—all controlled from a sleek Next.js dashboard.

---

## ✨ Features

- **Distributed Queuing:** Powered by BullMQ and Redis for massive scale and reliability.
- **Granular Rate Limiting:** Atomic Redis Lua scripts enforce global and per-sender hourly limits without race conditions.
- **Fault Tolerant:** Delayed jobs persist across server restarts. Idempotent job IDs prevent duplicate sends.
- **Modern Dashboard:** Built with Next.js 14, offering real-time auto-polling queue stats, search, and folder management.
- **Smart Retries:** Intelligent backoff strategies and automatic re-queuing for rate-limited dispatches.
- **Ethereal Integration:** Built-in fake SMTP testing with instant HTML preview links.
- **Slack Alerts:** Real-time webhooks or OAuth notifications for rate limit hits and completed batches.

---

## 🛠️ Architecture Overview

The system is split into two primary components communicating via a REST API:

### Core Infrastructure
- **Frontend:** Next.js 14, Tailwind CSS, Lucide Icons.
- **Backend:** Express.js, TypeScript, Drizzle ORM.
- **Storage & State:** PostgreSQL 16 (persistent records), Redis 7 (delayed queues, atomic limits).
- **Authentication:** Firebase Auth (Google Sign-In).

### Queue & Dispatch Lifecycle
1. **Schedule:** Campaigns are submitted with a configured `delayBetweenMs` and `hourlyLimit`.
2. **Queue:** BullMQ calculates the offset for each recipient and schedules deterministic delayed jobs in Redis.
3. **Process:** Workers pick up matured jobs, evaluating limits via an atomic Lua script.
4. **Dispatch:** Allowed jobs are sent via SMTP; rate-limited jobs are instantly re-queued for the next hourly window.

---

## 🚀 Quick Start

Follow these steps to get mailZy running locally.

### 1. Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [Docker & Docker Compose](https://www.docker.com/)
- A [Firebase Project](https://console.firebase.google.com/) (with Google Sign-In enabled)

### 2. Infrastructure Setup
Start the required PostgreSQL and Redis containers:
```bash
docker-compose up -d
```
> *This provisions PostgreSQL on port `5432` and Redis on port `6379`.*

### 3. Backend Setup
Navigate to the backend directory, install dependencies, and configure your environment.

```bash
cd backend
cp .env.example .env
```
Update `.env` with your Firebase Admin SDK credentials. Then, initialize the database and start the server:

```bash
npm install
npm run db:push    # Push the schema to PostgreSQL
npm run db:seed    # Seed the database with mock Ethereal senders
npm run dev        # Start the backend API on http://localhost:4000
```

### 4. Frontend Setup
Open a new terminal, navigate to the frontend directory, and set up your web environment.

```bash
cd frontend
cp .env.example .env.local
```
Update `.env.local` with your Firebase Web client configuration. Then, launch the dashboard:

```bash
npm install
npm run dev        # Start the Next.js app on http://localhost:3000
```

---

## 💻 Usage Guide

1. **Authentication:** Open `http://localhost:3000` and sign in using Google.
2. **Dashboard:** Monitor real-time queue health, scheduled dispatches, and active senders.
3. **Compose Campaign:**
   - Click **Compose Email**.
   - Input recipients manually or upload a CSV.
   - Use the rich text editor to format your message.
   - Set your **Delay Between Sends** (e.g., `2s`) and **Hourly Limit**.
   - Hit **Schedule Campaign**.
4. **Live Monitoring:** The dashboard automatically polls and updates as emails transition from the delayed queue into the `Sent` folder.
5. **Preview:** Click "View" on any sent email to instantly see the rendered HTML in Ethereal.

---

## ⚙️ Core Configuration

Fine-tune mailZy's behavior via these backend environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `WORKER_CONCURRENCY` | `5` | Maximum number of concurrent email workers processing jobs. |
| `MIN_DELAY_MS` | `2000` | Hard limit for the absolute minimum delay between sends. |
| `MAX_EMAILS_PER_HOUR` | `200` | Global fallback hourly cap across the entire system. |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Default per-sender hourly cap (overridable in the UI). |

---

<div align="center">
  <p>Built with ❤️ for modern engineering teams.</p>
</div>
