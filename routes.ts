import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { insertUserSchema } from "@shared/schema";
import { api } from "@shared/routes";
import passport from "passport";
import { z } from "zod";
import { db } from "./db";
import { badges as badgesTable } from "@shared/schema";

function getUserId(req: Request): number | null {
  if (req.user) return (req.user as any).id;
  return null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const parsed = insertUserSchema
        .extend({
          username: z.string().min(3, "Username must be at least 3 characters"),
          password: z.string().min(6, "Password must be at least 6 characters"),
          email: z.string().email("Invalid email address").optional(),
        })
        .safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
      }

      const { username, password, email } = parsed.data as any;
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(400).json({ message: "Username already taken" });

      const hashed = await hashPassword(password);
      const user = await storage.createUser({ username, email: email || null, password: hashed });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after registration" });
        const { password: _pw, ...safeUser } = user;
        return res.status(201).json(safeUser);
      });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/login", (req: Request, res: Response, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        const { password: _pw, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const { password: _pw, ...safeUser } = req.user as any;
    res.json(safeUser);
  });

  app.get("/api/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.json(null);
    const { password: _pw, ...safeUser } = req.user as any;
    res.json(safeUser);
  });

  app.get(api.habits.list.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const result = await storage.getHabits(userId);
    res.json(result);
  });

  app.post(api.habits.create.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const input = api.habits.create.input.omit({ userId: true } as any).parse(req.body);
    const habit = await storage.createHabit({ ...input, userId });
    res.status(201).json(habit);
  });

  app.put(api.habits.update.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const input = api.habits.update.input.parse(req.body);
    const habit = await storage.updateHabit(id, input);
    if (!habit) return res.status(404).json({ message: "Habit not found" });
    res.json(habit);
  });

  app.delete(api.habits.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteHabit(id);
    res.status(204).end();
  });

  app.get(api.completions.list.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const completions = await storage.getCompletions(userId);
    res.json(completions);
  });

  app.post(api.completions.toggle.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const input = api.completions.toggle.input.parse(req.body);
    const result = await storage.toggleCompletion(userId, input.habitId, input.date);

    let newBadge = undefined;
    if (result.completed) {
      const allBadges = await storage.getBadges();
      const userEarned = await storage.getUserBadges(userId);
      const earnedIds = new Set(userEarned.map(ub => ub.badgeId));

      for (const badge of allBadges) {
        if (earnedIds.has(badge.id)) continue;
        let earned = false;
        if (badge.type === 'streak') {
          const habits = await storage.getHabits(userId);
          if (habits.some(h => h.longestStreak >= badge.target)) earned = true;
        } else if (badge.type === 'count') {
          const comps = await storage.getCompletions(userId);
          if (comps.length >= badge.target) earned = true;
        }
        if (earned) {
          await storage.awardBadge(userId, badge.id);
          newBadge = badge;
          break;
        }
      }
    }

    res.json({ ...result, newBadge });
  });

  app.get('/api/daily-logs', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const logs = await storage.getAllDailyLogs(userId);
    res.json(logs);
  });

  app.get(api.dailyLogs.get.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const log = await storage.getDailyLog(userId, req.params.date);
    res.json(log || null);
  });

  app.put(api.dailyLogs.update.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const input = api.dailyLogs.update.input.parse(req.body);
    const log = await storage.updateDailyLog(userId, req.params.date, input.notes, input.oneTimeTasks);
    res.json(log);
  });

  app.get(api.badges.list.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const allBadges = await storage.getBadges();
    const userEarned = await storage.getUserBadges(userId);
    const earnedIds = new Set(userEarned.map(ub => ub.badgeId));
    const habits = await storage.getHabits(userId);
    const completions = await storage.getCompletions(userId);

    const results = allBadges.map(badge => {
      let progress = 0;
      if (badge.type === 'streak') {
        const maxStreak = habits.reduce((max, h) => Math.max(max, h.longestStreak), 0);
        progress = (maxStreak / badge.target) * 100;
      } else if (badge.type === 'count') {
        progress = (completions.length / badge.target) * 100;
      }
      return { ...badge, isEarned: earnedIds.has(badge.id), progress: Math.min(100, Math.round(progress)) };
    });

    res.json(results);
  });

  app.get(api.leaderboard.get.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const allUsers = await storage.getAllUsers();
    const leaderboard = allUsers
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10)
      .map((u, index) => ({
        rank: index + 1,
        username: u.username,
        xp: u.xp,
        xpWeekly: u.xpWeekly || 0,
        level: u.level,
        isCurrentUser: u.id === userId,
      }));

    const currentUserRank = allUsers.findIndex(u => u.id === userId) + 1;
    const currentUser = allUsers.find(u => u.id === userId);

    const nextRankUser = allUsers.find((u, i) => i === currentUserRank - 2);
    const xpBehind = nextRankUser ? nextRankUser.xp - (currentUser?.xp || 0) : 0;

    res.json({
      leaderboard,
      currentUserRank,
      totalUsers: allUsers.length,
      xpBehindNext: xpBehind > 0 ? xpBehind : 0,
    });
  });

  app.get(api.settings.get.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const s = await storage.getSettings(userId);
    res.json(s);
  });

  app.put(api.settings.update.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const input = api.settings.update.input.parse(req.body);
    const s = await storage.updateSettings(userId, input);
    res.json(s);
  });

  app.post(api.settings.unlockFeature.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const input = api.settings.unlockFeature.input.parse(req.body);
    const s = await storage.unlockFeature(userId, input.feature);
    res.json(s);
  });

  seedBadges().catch(console.error);

  return httpServer;
}

async function seedBadges() {
  const existing = await storage.getBadges();
  if (existing.length === 0) {
    await db.insert(badgesTable).values([
      { name: "First Step", description: "Complete your first habit", icon: "Target", type: "count", target: 1, xpReward: 25 },
      { name: "3-Day Streak", description: "Reach a 3-day streak", icon: "Flame", type: "streak", target: 3, xpReward: 50 },
      { name: "7-Day Streak", description: "Reach a 7-day streak on any habit", icon: "Zap", type: "streak", target: 7, xpReward: 100 },
      { name: "Consistency Master", description: "Reach a 30-day streak", icon: "Shield", type: "streak", target: 30, xpReward: 500 },
      { name: "Century Club", description: "Complete 100 habits total", icon: "Trophy", type: "count", target: 100, xpReward: 200 },
      { name: "Half Century", description: "Complete 50 habits total", icon: "Star", type: "count", target: 50, xpReward: 100 },
    ]);
  }
}
