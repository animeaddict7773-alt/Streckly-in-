import { pgTable, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password").notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  xpWeekly: integer("xp_weekly").default(0).notNull(),
  weeklyResetDate: text("weekly_reset_date"),
});

export const habits = pgTable("habits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  order: integer("order").default(0).notNull(),
  streak: integer("streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
});

export const habitCompletions = pgTable("habit_completions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  habitId: integer("habit_id").notNull(),
  date: text("date").notNull(),
});

export const habitDailyXp = pgTable("habit_daily_xp", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  habitId: integer("habit_id").notNull(),
  date: text("date").notNull(),
  amount: integer("amount").notNull(),
});

export const dailyLogs = pgTable("daily_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  notes: text("notes"),
  oneTimeTasks: jsonb("one_time_tasks").default([]).notNull(),
});

export const badges = pgTable("badges", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  type: text("type").notNull(),
  target: integer("target").notNull(),
  xpReward: integer("xp_reward").default(50).notNull(),
});

export const userBadges = pgTable("user_badges", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  badgeId: integer("badge_id").notNull(),
  dateEarned: timestamp("date_earned").defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  analyticsUnlockedUntil: timestamp("analytics_unlocked_until"),
  calendarUnlockedUntil: timestamp("calendar_unlocked_until"),
  dailyPlannerUnlockedUntil: timestamp("daily_planner_unlocked_until"),
  badgesUnlockedUntil: timestamp("badges_unlocked_until"),
  sharingUnlockedUntil: timestamp("sharing_unlocked_until"),
  adsDisabledUntil: timestamp("ads_disabled_until"),
  darkMode: boolean("dark_mode").default(false).notNull(),
  soundEnabled: boolean("sound_enabled").default(true).notNull(),
});

export const streakRewards = pgTable("streak_rewards", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  habitId: integer("habit_id").notNull(),
  milestone: integer("milestone").notNull(),
  claimedAt: timestamp("claimed_at").defaultNow(),
});

export const insertHabitSchema = createInsertSchema(habits).omit({ id: true, streak: true, longestStreak: true });
export const insertHabitCompletionSchema = createInsertSchema(habitCompletions).omit({ id: true });
export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({ id: true });
export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, xp: true, level: true, xpWeekly: true, weeklyResetDate: true });
export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({ id: true, dateEarned: true });

export type Habit = typeof habits.$inferSelect;
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type HabitCompletion = typeof habitCompletions.$inferSelect;
export type InsertHabitCompletion = z.infer<typeof insertHabitCompletionSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type Badge = typeof badges.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserBadge = typeof userBadges.$inferSelect;
export type StreakReward = typeof streakRewards.$inferSelect;
