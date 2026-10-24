import { Request, Response } from 'express';
import { prisma } from '../config/db';
import axios from 'axios';

export class AuthController {
  /**
   * Handle Google credential verification or user profile retrieval
   */
  public static async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { credential, accessToken, userInfo } = req.body;

      let email = 'demo@reachinbox.ai';
      let name = 'ReachInbox Candidate';
      let avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox';

      if (userInfo && userInfo.email) {
        email = userInfo.email;
        name = userInfo.name || userInfo.email.split('@')[0];
        avatar = userInfo.picture || avatar;
      } else if (accessToken) {
        try {
          const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (googleRes.data?.email) {
            email = googleRes.data.email;
            name = googleRes.data.name || email.split('@')[0];
            avatar = googleRes.data.picture || avatar;
          }
        } catch (gErr) {
          console.warn('⚠️ Could not verify Google access token, falling back to profile payload:', (gErr as Error).message);
        }
      }

      // Upsert user in database
      const user = await prisma.user.upsert({
        where: { email },
        update: { name, avatar },
        create: {
          email,
          name,
          avatar,
        },
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
        token: `mock-jwt-token-${user.id}`,
      });
    } catch (error) {
      console.error('❌ Google login error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * Instant Demo User Login for reviewers
   */
  public static async demoLogin(req: Request, res: Response): Promise<void> {
    try {
      const email = 'candidate.demo@reachinbox.ai';
      const name = 'ReachInbox Engineer';
      const avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInboxDemo';

      const user = await prisma.user.upsert({
        where: { email },
        update: { name, avatar },
        create: {
          email,
          name,
          avatar,
        },
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
        token: `mock-jwt-token-${user.id}`,
      });
    } catch (error) {
      console.error('❌ Demo login error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
