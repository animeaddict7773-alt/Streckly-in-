import { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for Streakly Android APK.
 *
 * For LOCAL development:
 *   Leave CAPACITOR_SERVER_URL unset — the APK will use bundled web assets.
 *
 * For PRODUCTION APK pointing to your live backend:
 *   Set CAPACITOR_SERVER_URL=https://your-domain.com before running cap sync.
 *   e.g.  CAPACITOR_SERVER_URL=https://api.streakly.app npx cap sync android
 */

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.streakly.app",
  appName: "Streakly",
  webDir: "dist/public",

  // Only attach a remote server URL if explicitly provided.
  // Without this, the APK serves the bundled dist/public assets directly —
  // perfect for a self-contained offline-capable build.
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false,
        },
      }
    : {}),

  plugins: {
    AdMob: {
      appId: {
        android: "ca-app-pub-6278223211027037~4332224410",
      },
    },
  },

  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
  },
};

export default config;
