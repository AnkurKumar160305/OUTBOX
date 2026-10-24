import { Router } from 'express';
import { EmailController } from '../controllers/emailController';
import { SlackController } from '../controllers/slackController';
import { AuthController } from '../controllers/authController';

export const apiRouter = Router();

// Authentication
apiRouter.post('/auth/google', AuthController.googleLogin);
apiRouter.post('/auth/demo', AuthController.demoLogin);

// Email Scheduler & Retrieval
apiRouter.post('/emails/schedule', EmailController.scheduleEmails);
apiRouter.get('/emails/scheduled', EmailController.getScheduledEmails);
apiRouter.get('/emails/sent', EmailController.getSentEmails);
apiRouter.get('/emails/search', EmailController.searchEmails);
apiRouter.delete('/emails/:id', EmailController.cancelScheduledEmail);
apiRouter.get('/dashboard/stats', EmailController.getDashboardStats);

// Slack Integration
apiRouter.get('/slack/status', SlackController.getStatus);
apiRouter.post('/slack/connect', SlackController.connect);
apiRouter.post('/slack/disconnect', SlackController.disconnect);
apiRouter.post('/slack/test', SlackController.testNotification);
apiRouter.get('/slack/oauth/callback', SlackController.oauthCallback);
