import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env';
import { testDbConnection } from './db';
import { getFirebaseAdmin } from './config/firebase';
import { getRedis } from './config/redis';
import { startEmailWorker } from './jobs/emailWorker';

// Routes
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaigns';
import jobRoutes from './routes/jobs';
import senderRoutes from './routes/senders';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

// ─── Health Check ─────────────────────────────────────────────────────────────

const healthResponse = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    service: 'ReachInbox Email Scheduler API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    environment: env.NODE_ENV,
    endpoints: {
      auth:      '/api/auth',
      campaigns: '/api/campaigns',
      jobs:      '/api/jobs',
      senders:   '/api/senders',
      health:    '/api/health',
    },
  });
};

app.get('/', healthResponse);
app.get('/health', healthResponse);
app.get('/health-check', healthResponse);
app.get('/api/health', healthResponse);


app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/senders', senderRoutes);

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  try {
    // Initialize Firebase Admin
    getFirebaseAdmin();

    // Test DB connection
    await testDbConnection();

    // Test Redis connection
    const redis = getRedis();
    await redis.ping();

    // Start BullMQ worker
    startEmailWorker();

    // Start server
    app.listen(env.PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${env.PORT}`);
      console.log(`📋 Environment: ${env.NODE_ENV}`);
      console.log(`⚙️  Worker concurrency: ${env.WORKER_CONCURRENCY}`);
      console.log(`⏱️  Min delay between sends: ${env.MIN_DELAY_MS}ms`);
      console.log(`📊 Max emails/hour/sender: ${env.MAX_EMAILS_PER_HOUR_PER_SENDER}\n`);
    });
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

bootstrap();
