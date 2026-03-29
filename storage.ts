import { db } from "./db";
import {
  habits, habitCompletions, dailyLogs, badges, settings, users, userBadges, streakRewards, habitDailyXp,
  type InsertHabit, type Habit, type HabitCompletion, type InsertDailyLog,
  type DailyLog, type Badge, type Settings, type InsertSettings,
  type User, type InsertUser, type UserBadge, type StreakReward
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const XP_PER_COMPLETION = 10;
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const STREAK_MILESTONE_XP: Record<number, number> = {
  3: 50,
  7: 100,
  14: 200,
  30: 500,
  60: 1000,
  100: 2000,
};

export const LEVELS = [
  { level: 1, name: "Beginner", minXp: 0, maxXp: 500 },
  { level: 2, name: "Intermediate", minXp: 500, maxXp: 1500 },
  { level: 3, name: "Pro", minXp: 1500, maxXp: 3500 },
  { level: 4, name: "Elite", minXp: 3500, maxXp: 7500 },
  { level: 5, name: "Legend", minXp: 7500, maxXp: Infinity },
];

export function getLevelFromXp(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) return LEVELS[i];
  }
  return LEVELS[0];
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  addXp(userId: number, xp: number): Promise<{ user: User; leveledUp: boolean; newLevel?: number }>;
  getAllUsers(): Promise<User[]>;

  getHabits(userId: number): Promise<Habit[]>;
  getHabit(id: number): Promise<Habit | undefined>;
  createHabit(habit: InsertHabit & { userId: number }): Promise<Habit>;
  updateHabit(id: number, updates: Partial<InsertHabit>): Promise<Habit | undefined>;
  deleteHabit(id: number): Promise<void>;

  getCompletions(userId: number): Promise<HabitCompletion[]>;
  toggleCompletion(userId: number, habitId: number, date: string): Promise<{
    completed: boolean;
    streak: number;
    longestStreak: number;
    xpGained: number;
    newLevel?: number;
    streakMilestone?: number;
  }>;

  getAllDailyLogs(userId: number): Promise<DailyLog[]>;
  getDailyLog(userId: number, date: string): Promise<DailyLog | undefined>;
  updateDailyLog(userId: number, date: string, notes?: string, oneTimeTasks?: any): Promise<DailyLog>;

  getBadges(): Promise<Badge[]>;
  getUserBadges(userId: number): Promise<UserBadge[]>;
  awardBadge(userId: number, badgeId: number): Promise<UserBadge>;

  getSettings(userId: number): Promise<Settings>;
  updateSettings(userId: number, updates: Partial<Settings>): Promise<Settings>;
  unlockFeature(userId: number, feature: string): Promise<Settings>;

  getStreakRewards(userId: number): Promise<StreakReward[]>;
  addStreakReward(userId: number, habitId: number, milestone: number): Promise<StreakReward>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({ ...insertUser, xp: 0, level: 1, xpWeekly: 0 }).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.xp));
  }

  async addXp(userId: number, xpAmount: number): Promise<{ user: User; leveledUp: boolean; newLevel?: number }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error("User not found");

    const oldLevel = getLevelFromXp(user.xp);
    const newXp = user.xp + xpAmount;
    const newXpWeekly = (user.xpWeekly || 0) + xpAmount;
    const newLevelData = getLevelFromXp(newXp);
    const leveledUp = newLevelData.level > oldLevel.level;

    const [updated] = await db.update(users)
      .set({ xp: newXp, xpWeekly: newXpWeekly, level: newLevelData.level })
      .where(eq(users.id, userId))
      .returning();

    return { user: updated, leveledUp, newLevel: leveledUp ? newLevelData.level : undefined };
  }

  async getHabits(userId: number): Promise<Habit[]> {
    return await db.select().from(habits).where(eq(habits.userId, userId)).orderBy(habits.order);
  }

  async getHabit(id: number): Promise<Habit | undefined> {
    const [habit] = await db.select().from(habits).where(eq(habits.id, id));
    return habit;
  }

  async createHabit(habit: InsertHabit & { userId: number }): Promise<Habit> {
    const [newHabit] = await db.insert(habits).values(habit).returning();
    return newHabit;
  }

  async updateHabit(id: number, updates: Partial<InsertHabit>): Promise<Habit | undefined> {
    const [updated] = await db.update(habits).set(updates).where(eq(habits.id, id)).returning();
    return updated;
  }

  async deleteHabit(id: number): Promise<void> {
    await db.delete(habitCompletions).where(eq(habitCompletions.habitId, id));
    await db.delete(streakRewards).where(eq(streakRewards.habitId, id));
    await db.delete(habitDailyXp).where(eq(habitDailyXp.habitId, id));
    await db.delete(habits).where(eq(habits.id, id));
  }

  async getCompletions(userId: number): Promise<HabitCompletion[]> {
    return await db.select().from(habitCompletions).where(eq(habitCompletions.userId, userId));
  }

  async toggleCompletion(userId: number, habitId: number, date: string): Promise<{
    completed: boolean;
    streak: number;
    longestStreak: number;
    xpGained: number;
    newLevel?: number;
    streakMilestone?: number;
  }> {
    const [existing] = await db.select()
      .from(habitCompletions)
      .where(and(
        eq(habitCompletions.userId, userId),
        eq(habitCompletions.habitId, habitId),
        eq(habitCompletions.date, date)
      ));

    let completed = false;
    let xpGained = 0;
    let newLevel: number | undefined;
    let streakMilestone: number | undefined;

    if (existing) {
      await db.delete(habitCompletions).where(eq(habitCompletions.id, existing.id));
      completed = false;
    } else {
      await db.insert(habitCompletions).values({ userId, habitId, date });
      completed = true;
    }

    const allComps = await db.select()
      .from(habitCompletions)
      .where(and(eq(habitCompletions.userId, userId), eq(habitCompletions.habitId, habitId)));

    const completionDates = new Set(allComps.map(c => c.date));
    let currentStreak = 0;
    let longestStreak = 0;

    const today = new Date();
    let checkDate = today;
    const todayStr = checkDate.toISOString().split('T')[0];
    if (!completionDates.has(todayStr)) {
      checkDate = new Date(today.getTime() - 86400000);
    }
    while (completionDates.has(checkDate.toISOString().split('T')[0])) {
      currentStreak++;
      checkDate = new Date(checkDate.getTime() - 86400000);
    }

    const sortedDates = Array.from(completionDates).sort();
    if (sortedDates.length > 0) {
      let tempStreak = 1;
      let maxTemp = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diff = (curr.getTime() - prev.getTime()) / (1000 * 3600 * 24);
        if (Math.round(diff) === 1) {
          tempStreak++;
        } else {
          maxTemp = Math.max(maxTemp, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(maxTemp, tempStreak);
    }

    await db.update(habits)
      .set({ streak: currentStreak, longestStreak })
      .where(eq(habits.id, habitId));

    if (completed) {
      const [alreadyAwarded] = await db.select()
        .from(habitDailyXp)
        .where(and(
          eq(habitDailyXp.userId, userId),
          eq(habitDailyXp.habitId, habitId),
          eq(habitDailyXp.date, date)
        ));

      if (!alreadyAwarded) {
        xpGained = XP_PER_COMPLETION;

        const existingRewards = await this.getStreakRewards(userId);
        const claimedMilestones = new Set(
          existingRewards.filter(r => r.habitId === habitId).map(r => r.milestone)
        );

        for (const milestone of STREAK_MILESTONES) {
          if (currentStreak >= milestone && !claimedMilestones.has(milestone)) {
            const bonusXp = STREAK_MILESTONE_XP[milestone] || 50;
            xpGained += bonusXp;
            streakMilestone = milestone;
            await this.addStreakReward(userId, habitId, milestone);
            break;
          }
        }

        await db.insert(habitDailyXp).values({ userId, habitId, date, amount: xpGained });

        const result = await this.addXp(userId, xpGained);
        if (result.leveledUp) {
          newLevel = result.newLevel;
        }
      }
    }

    return { completed, streak: currentStreak, longestStreak, xpGained, newLevel, streakMilestone };
  }

  async getAllDailyLogs(userId: number): Promise<DailyLog[]> {
    return db.select().from(dailyLogs).where(eq(dailyLogs.userId, userId));
  }

  async getDailyLog(userId: number, date: string): Promise<DailyLog | undefined> {
    const [log] = await db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));
    return log;
  }

  async updateDailyLog(userId: number, date: string, notes?: string, oneTimeTasks?: any): Promise<DailyLog> {
    const [existing] = await db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)));

    if (existing) {
      const updates: Partial<InsertDailyLog> = {};
      if (notes !== undefined) updates.notes = notes;
      if (oneTimeTasks !== undefined) updates.oneTimeTasks = oneTimeTasks;
      const [updated] = await db.update(dailyLogs).set(updates).where(eq(dailyLogs.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await db.insert(dailyLogs)
        .values({ userId, date, notes: notes || "", oneTimeTasks: oneTimeTasks || [] })
        .returning();
      return created;
    }
  }

  async getBadges(): Promise<Badge[]> {
    return await db.select().from(badges);
  }

  async getUserBadges(userId: number): Promise<UserBadge[]> {
    return await db.select().from(userBadges).where(eq(userBadges.userId, userId));
  }

  async awardBadge(userId: number, badgeId: number): Promise<UserBadge> {
    const [badge] = await db.select().from(badges).where(eq(badges.id, badgeId));
    if (badge?.xpReward) {
      await this.addXp(userId, badge.xpReward);
    }
    const [userBadge] = await db.insert(userBadges).values({ userId, badgeId }).returning();
    return userBadge;
  }

  async getSettings(userId: number): Promise<Settings> {
    const [s] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
    if (!s) {
      const [created] = await db.insert(settings).values({ userId, darkMode: false, soundEnabled: true }).returning();
      return created;
    }
    return s;
  }

  async updateSettings(userId: number, updates: Partial<Settings>): Promise<Settings> {
    const s = await this.getSettings(userId);
    const [updated] = await db.update(settings)
      .set(updates)
      .where(eq(settings.id, s.id))
      .returning();
    return updated;
  }

  async unlockFeature(userId: number, feature: string): Promise<Settings> {
    const s = await this.getSettings(userId);
    const unlockUntil = new Date();
    unlockUntil.setHours(unlockUntil.getHours() + 24);
    const fieldName = `${feature}UnlockedUntil` as keyof InsertSettings;
    const [updated] = await db.update(settings)
      .set({ [fieldName]: unlockUntil })
      .where(eq(settings.id, s.id))
      .returning();
    return updated;
  }

  async getStreakRewards(userId: number): Promise<StreakReward[]> {
    return await db.select().from(streakRewards).where(eq(streakRewards.userId, userId));
  }

  async addStreakReward(userId: number, habitId: number, milestone: number): Promise<StreakReward> {
    const [reward] = await db.insert(streakRewards).values({ userId, habitId, milestone }).returning();
    return reward;
  }
}

export const storage = new DatabaseStorage();
