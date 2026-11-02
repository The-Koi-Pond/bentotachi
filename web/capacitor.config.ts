import type { CapacitorConfig } from "@capacitor/cli";

// Settings for the Android app. "npm run android" builds the web app into
// dist/ and copies it into the android/ project.
const config: CapacitorConfig = {
  // The app's permanent ID on phones. Changing it later makes Android treat
  // it as a different app (everyone would reinstall).
  appId: "com.xel.bento",
  appName: "Bentotachi",
  webDir: "dist",
  server: {
    // The app loads itself from http://localhost inside the phone. Keep this
    // fixed: changing it wipes each phone's saved login and settings.
    // (localhost still counts as a secure page, so features like keeping the
    // screen on still work.)
    androidScheme: "http",
    // Lets the app reach a server over plain HTTP. Keep it while any server
    // is: the Pi on its Tailscale address, friends' servers on home Wi-Fi
    // (http://192.168.x.x:8090), and phone-only mode, which is always
    // http://127.0.0.1. Turning it off would break all of them.
    cleartext: true,
  },
};

export default config;
