# 🚀 ReachInbox Email Scheduler

A production-grade email scheduler built with **BullMQ + Redis**, **PostgreSQL**, **Express.js**, **Firebase Auth**, and a **Next.js** dashboard.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express.js + TypeScript |
| Queue | BullMQ (Redis-backed delayed jobs) |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Cache / Queue Store | Redis 7 |
| SMTP | Ethereal Email (fake SMTP) |
| Auth | Firebase Authentication (Google Sign-In) |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js 18+
- Docker + Docker Compose
- Firebase Project with Google Sign-In enabled

### 2. Start Infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL on port `5432` and Redis on port `6379`.

### 3. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in your Firebase credentials in .env
npm install

# Push schema to database
npm run db:push

# Seed Ethereal senders
npm run db:seed

# Start dev server
npm run dev
```

Backend runs at `http://localhost:4000`.

### 4. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
# Fill in Firebase web config in .env.local
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## 🔥 Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Google Sign-In** under Authentication > Sign-in method
3. Add `http://localhost:3000` to authorized domains
4. **Backend (Admin SDK)**: Download Service Account JSON from Project Settings > Service Accounts → fill in `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` in `backend/.env`
5. **Frontend**: Copy Web App config from Project Settings > Your apps → fill in `NEXT_PUBLIC_FIREBASE_*` vars in `frontend/.env.local`

---

## ⚙️ Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `5` | Number of parallel email workers |
| `MIN_DELAY_MS` | `2000` | Minimum delay between individual sends (ms) |
| `MAX_EMAILS_PER_HOUR` | `200` | Global hourly cap |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Per-sender hourly cap |

---

## 🏗️ Architecture

### Scheduling Flow

```
POST /api/campaigns
  → Validate request
  → Create campaign in PostgreSQL
  → Return 201 immediately (async scheduling)
  ↓
schedulerService.scheduleCampaign()
  → For each recipient[i]:
      delay = scheduledAt + (i × delayBetweenMs) - now
      BullMQ.add('send-email', jobData, { delay, jobId: 'campaign_X_recipient_Y' })
      INSERT INTO email_jobs (bullJobId = jobId)
```

### Worker Flow

```
BullMQ Worker picks up job when delay expires
  → Idempotency: check if email_job.status == 'sent' → skip
  → Rate limit: Redis atomic Lua script check
      ✓ Allowed: INCR counter → send email via Ethereal → update DB
      ✗ Exceeded: DECR counter → re-queue with delay to next hour window
                  → update DB status = 'rate_limited'
```

### Rate Limiting (Redis Atomic Lua Script)

```lua
local count = redis.call('INCR', KEYS[1])        -- Key: rate:{senderId}:{YYYY-MM-DD-HH}
if count == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
if count > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])   -- Rollback
  return 0                       -- Not allowed
end
return count                     -- Allowed
```

**Why Lua?** Ensures the check-and-increment is atomic across multiple workers, preventing race conditions.

### Persistence After Restarts

BullMQ stores delayed jobs in Redis sorted sets (`bull:email-dispatch:delayed`) keyed by their fire timestamp. On server restart, the worker simply reconnects and jobs fire at their correct time — **no replaying, no duplication**.

### Idempotency

BullMQ jobs use deterministic `jobId = campaign_{id}_recipient_{email}`. If `emailQueue.add()` is called twice with the same `jobId`, BullMQ ignores the duplicate. DB records also use `ON CONFLICT DO NOTHING`.

---

## 📊 Rate Limiting Details

| Config | Default |
|--------|---------|
| Min delay between sends | 2,000ms (via BullMQ `limiter`) |
| Max emails/hour/sender | 100 |
| Max emails/hour global | 200 |

**Behavior at limit:**
- Jobs are **never dropped**
- Excess jobs are re-queued to the start of the next hour window
- DB status shows `rate_limited` until re-queued job succeeds
- Order preserved via sequential delay offsets

**1000+ emails scheduled at same time:**
- All get queued as BullMQ delayed jobs → Redis sorted set
- Workers process 5 concurrent jobs (configurable)
- 2s minimum gap enforced by BullMQ limiter
- Once hourly limit hit → rest re-queue to next hour → continues automatically

---

## 🗄️ Database Schema

```
users:          Firebase UID → user profile
senders:        Ethereal SMTP credentials
campaigns:      Campaign metadata + status
email_jobs:     Per-recipient job tracking (bullJobId, status, sentAt, previewUrl)
```

---

## 📬 Ethereal Email

All emails are sent via [Ethereal](https://ethereal.email/) — a fake SMTP service for testing. Each sent email logs a preview URL to the console and stores it in the DB. View sent emails in the dashboard's "Sent" tab with a **Preview** button.
