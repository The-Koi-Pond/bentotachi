# The phone server (phone-only mode)

"Just me, on this phone" runs Bento's own server inside the Android app: the
same PocketBase as a household server, with Bento's `server/pb_hooks` and
`server/pb_migrations`, listening only on the phone (127.0.0.1) while Bento
is open. Nothing to set up, no Tailscale.

- `bentoserver/server.go`: start, stop, backup and restore (Go).
- `bentoserver/server_test.go`: runs it on the PC with the real hooks and
  migrations: `go test ./...` from this folder.
- `web/android/app/.../BentoLocalServerPlugin.java`: calls it from the app,
  copies the server code out of the app, and handles saving and picking
  backup files.
- `web/src/phoneMode.ts`: the web app's side (starting it, the account,
  backups).

## Building it

Needs Go, the Android NDK (Android Studio: SDK Manager > SDK Tools > NDK)
and gomobile, set up once:

```
go install golang.org/x/mobile/cmd/gomobile@latest
go install golang.org/x/mobile/cmd/gobind@latest
gomobile init
```

Then `npm run android` (from `web`) builds it into
`web/android/app/libs/bentoserver.aar` whenever this folder's Go code has
changed (`npm run server-lib` does just that part). The PocketBase version
in `go.mod` should match the one household servers run.

## Testing on a phone

It's built for real phones only: 64-bit ones (arm64) and older 32-bit ones
(arm, ARMv7). The PC's Android emulator can't run
it: its x86 Android blocks a system call the database uses, and its ARM
translation can't run Go. To try it beside the real Bento:

```
cd web/android
gradlew assembleDebug -PbentoTest
adb install app/build/outputs/apk/debug/app-debug.apk
```

That installs "Bentotachi (test)" (`com.xel.bento.test`), separate from Bento
itself.
