import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './queue/emailQueue';
import './queue/emailWorker'; // Spin up BullMQ Worker
import { apiRouter } from './routes/api';
import { etherealService } from './services/etherealService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup Bull-Board Live Queue Dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// User Auth Mock Middleware (attaches userId to req)
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer mock-jwt-token-')) {
    (req as any).userId = authHeader.replace('Bearer mock-jwt-token-', '');
  } else {
    (req as any).userId = 'demo-user-id';
  }
  next();
});

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', async (req, res) => {
  const defaultSender = await etherealService.getSenderEmail();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    worker: {
      concurrency: process.env.WORKER_CONCURRENCY || '5',
      minDelayMs: process.env.MIN_EMAIL_DELAY_MS || '2000',
      hourlyLimit: process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50',
    },
    etherealSender: defaultSender,
    bullBoardUrl: `http://localhost:${PORT}/admin/queues`,
  });
});

app.listen(PORT, async () => {
  console.log(`======================================================`);
  console.log(`🚀 ReachInbox Email Scheduler API running on port ${PORT}`);
  console.log(`📊 BullMQ Live Queue Dashboard: http://localhost:${PORT}/admin/queues`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/health`);
  console.log(`======================================================`);
});

export default app;
