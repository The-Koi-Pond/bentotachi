import type { CapacitorConfig } from "@capacitor/cli";

// Settings for the Android app. "npm run android" builds the web app into
// dist/ and copies it into the android/ project.
const config: CapacitorConfig = {
  // The app's permanent ID on phones. Changing it later makes Android treat
  // it as a different app (everyone would reinstall).
  appId: "com.xel.bento",
  appName: "Bento",
  webDir: "dist",
  server: {
    // The app loads itself from http://localhost inside the phone. Keep this
    // fixed: changing it wipes each phone's saved login and settings.
    // (localhost still counts as a secure page, so features like keeping the
    // screen on still work.)
    androidScheme: "http",
    // Lets the app reach a server over plain HTTP, needed while the server
    // is the PC on home Wi-Fi (http://192.168.x.x:8090). Turn this off once
    // the Pi has its HTTPS address from Tailscale.
    cleartext: true,
  },
};

export default config;
