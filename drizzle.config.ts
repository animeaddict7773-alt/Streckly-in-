import { defineConfig } from "drizzle-kit";

if (!process.env.SUPABASE_DIRECT_URL) {
  throw new Error("SUPABASE_DIRECT_URL is required");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DIRECT_URL,
    ssl: true,
  },
});
