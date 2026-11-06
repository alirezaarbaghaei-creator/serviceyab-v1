import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // appId remains unchanged temporarily; Android package namespace migration
  // must update Gradle, Java/Kotlin package paths and native metadata together.
  appId: 'com.kateb.app',
  appName: 'سرویس‌یاب',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0f172a',
    overrideUserInterfaceStyle: 'default',
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
