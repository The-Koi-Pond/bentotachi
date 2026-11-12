package com.xel.bento;

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Bundle;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.xel.bento.server.bentoserver.Bentoserver;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Phone-only mode: runs Bento's server inside the app (the Go code in
 * mobile/bentoserver, built into libs/bentoserver.aar), listening only on
 * this phone. The web app calls:
 *
 *   start()   starts it (if it isn't already) and resolves with { url }.
 *   backup()  makes a backup and asks where to save it: { saved, bytes }.
 *   restore() asks for a backup file and puts it in place: { restored, url }.
 *   supported() whether this phone can run it (an ARM phone): { supported }.
 *   erase()   stops it and deletes everything it kept.
 *   rescue()  when it won't start: saves its data as a backup anyway: { saved }.
 *   onlyAccount() the data's one account after a restore: { username } ("" for several).
 *   setPassword({ username, password }) gives it (and its admin) this phone's password.
 *
 * Bento's server code (server/pb_hooks and pb_migrations) comes inside the
 * app (see copyBentoServerCode in build.gradle) and is copied out to the
 * app's own storage on each start, so an app update brings new server code.
 * The data lives in the app's storage too ("bento-data").
 */
@CapacitorPlugin(name = "BentoLocalServer")
public class BentoLocalServerPlugin extends Plugin {

    // One at a time, off the screen's thread: starting can take a few seconds.
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final String PENDING_BACKUP_KEY = "bentoPendingBackup";
    // Where Bentoserver.rescue() writes: the data folder's name + "-rescued.zip".
    private static final String RESCUED_ZIP = "bento-data-rescued.zip";
    private File pendingBackup;

    // The server is built for ARM phones, 64-bit and 32-bit (see
    // mobile/README.md). The phone's own kind comes first in SUPPORTED_ABIS;
    // an x86 Chromebook lists ARM kinds after its own (it translates ARM
    // apps), and Go can't run that way.
    @PluginMethod
    public void supported(PluginCall call) {
        String[] abis = android.os.Build.SUPPORTED_ABIS;
        String own = abis.length > 0 ? abis[0] : "";
        boolean arm = own.equals("arm64-v8a") || own.equals("armeabi-v7a");
        call.resolve(new JSObject().put("supported", arm));
    }

    @PluginMethod
    public void start(PluginCall call) {
        worker.execute(() -> {
            try {
                File code = copyServerCode();
                File data = new File(getContext().getFilesDir(), "bento-data");
                long port = Bentoserver.start(
                    data.getPath(),
                    new File(code, "pb_hooks").getPath(),
                    new File(code, "pb_migrations").getPath()
                );
                call.resolve(withUrl(new JSObject(), port));
            } catch (Throwable e) {
                // Throwable, not Exception: a phone the server wasn't built
                // for can't even load it.
                call.reject("Bentotachi couldn't start on this phone: " + e.getMessage());
            }
        });
    }

    // A restored backup's one account, for this phone to take over (see
    // Bentoserver.onlyAccount): { username }, "" when there are several.
    @PluginMethod
    public void onlyAccount(PluginCall call) {
        worker.execute(() -> {
            try {
                call.resolve(new JSObject().put("username", Bentoserver.onlyAccount()));
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    // Gives that account this phone's new hidden password.
    @PluginMethod
    public void setPassword(PluginCall call) {
        String username = call.getString("username");
        String password = call.getString("password");
        if (username == null || password == null) {
            call.reject("No account or password given");
            return;
        }
        worker.execute(() -> {
            try {
                Bentoserver.setPassword(username, password);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    // "Delete my account" on a phone-only Bento: stops the server and deletes
    // everything it kept (recipes, photos, lists, the account). Can't be undone.
    @PluginMethod
    public void erase(PluginCall call) {
        worker.execute(() -> {
            try {
                Bentoserver.stop();
            } catch (Throwable e) {
                // Not running (or can't run here): nothing to stop.
            }
            // Every "bento-data*": the data itself, plus what sits beside it
            // (rescue()'s zip, and what an interrupted restore left behind).
            File[] kept = getContext().getFilesDir().listFiles((folder, name) -> name.startsWith("bento-data"));
            if (kept != null) for (File file : kept) deleteAll(file);
            deleteAll(new File(getContext().getFilesDir(), "bento-server"));
            call.resolve();
        });
    }

    @PluginMethod
    public void backup(PluginCall call) {
        worker.execute(() -> {
            try {
                pendingBackup = new File(Bentoserver.backup());
            } catch (Throwable e) {
                call.reject(e.getMessage());
                return;
            }
            // Android's "save as" screen: on the phone, Google Drive and so on.
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/zip");
            // Named here, in the phone's own time: the Go server's clock is UTC
            // on Android, so its file name can be a day off.
            String now = new java.text.SimpleDateFormat("yyyy-MM-dd-HHmm", java.util.Locale.ROOT).format(new java.util.Date());
            intent.putExtra(Intent.EXTRA_TITLE, "bentotachi-backup-" + now + ".zip");
            getActivity().runOnUiThread(() -> startActivityForResult(call, intent, "backupSaved"));
        });
    }

    // When the server won't start: the data straight from its folder (the
    // server isn't running), saved like a backup.
    @PluginMethod
    public void rescue(PluginCall call) {
        worker.execute(() -> {
            try {
                pendingBackup = new File(Bentoserver.rescue(new File(getContext().getFilesDir(), "bento-data").getPath()));
            } catch (Throwable e) {
                call.reject(e.getMessage());
                return;
            }
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/zip");
            intent.putExtra(Intent.EXTRA_TITLE, "bentotachi-saved-data.zip");
            getActivity().runOnUiThread(() -> startActivityForResult(call, intent, "backupSaved"));
        });
    }

    // Android sometimes closes Bentotachi in the background while the "save
    // as" screen is open. The backup file itself stays (in the app's own
    // storage), so its path is kept with Capacitor's saved state, and the
    // fresh start still saves it where the person picked. The answer then
    // arrives as "appRestoredResult" (see noteRestoredBackup in phoneMode.ts).
    @Override
    protected Bundle saveInstanceState() {
        Bundle state = super.saveInstanceState();
        if (state != null && pendingBackup != null) state.putString(PENDING_BACKUP_KEY, pendingBackup.getPath());
        return state;
    }

    @Override
    protected void restoreState(Bundle state) {
        String path = state.getString(PENDING_BACKUP_KEY);
        if (path != null) pendingBackup = new File(path);
    }

    @ActivityCallback
    private void backupSaved(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Uri target = result.getData().getData();
        File backup = pendingBackup;
        if (backup == null || !backup.isFile()) {
            // The saved state didn't come back (or the file is gone).
            call.reject("Android closed Bentotachi meanwhile, so the backup wasn't saved. Try again.");
            return;
        }
        worker.execute(() -> {
            // On purpose: "saved" only once the file is closed, as some
            // places (cloud folders) only write it then, and that can fail.
            try (InputStream in = new FileInputStream(backup);
                 OutputStream out = getContext().getContentResolver().openOutputStream(target)) {
                if (out == null) throw new IOException("couldn't open the place you picked");
                copy(in, out);
            } catch (Throwable e) {
                call.reject("Couldn't save the backup: " + e.getMessage());
                return;
            }
            // rescue()'s zip is a whole extra copy of the data, now saved where
            // the person picked. backup()'s stays: the next backup replaces it.
            long bytes = backup.length();
            if (backup.getName().equals(RESCUED_ZIP)) backup.delete();
            // Its size, for "Backup saved (2.0 MB)": some phones' pickers show
            // a fresh file as 0 B.
            call.resolve(new JSObject().put("saved", true).put("bytes", bytes));
        });
    }

    @PluginMethod
    public void restore(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // Zips are labelled differently by different apps.
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "application/zip", "application/x-zip-compressed", "application/octet-stream" });
        startActivityForResult(call, intent, "backupPicked");
    }

    @ActivityCallback
    private void backupPicked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("restored", false));
            return;
        }
        Uri source = result.getData().getData();
        worker.execute(() -> {
            File zip = new File(getContext().getCacheDir(), "restoring.zip");
            try {
                try (InputStream in = getContext().getContentResolver().openInputStream(source);
                     OutputStream out = new FileOutputStream(zip)) {
                    if (in == null) throw new IOException("couldn't open that file");
                    copy(in, out);
                }
                long port = Bentoserver.restore(zip.getPath());
                call.resolve(withUrl(new JSObject().put("restored", true), port));
            } catch (Throwable e) {
                // Nothing changed; the web app asks start() for the address.
                call.reject(e.getMessage());
            } finally {
                zip.delete();
            }
        });
    }

    private static JSObject withUrl(JSObject answer, long port) {
        return answer.put("url", "http://127.0.0.1:" + port);
    }

    // The app's copy of Bento's server code, fresh each start.
    private File copyServerCode() throws IOException {
        File target = new File(getContext().getFilesDir(), "bento-server");
        deleteAll(target);
        copyAssets(getContext().getAssets(), "bento-server", target);
        return target;
    }

    private static void copyAssets(AssetManager assets, String path, File target) throws IOException {
        String[] children = assets.list(path);
        if (children == null || children.length == 0) {
            // A file (folders always have something in them here).
            try (InputStream in = assets.open(path); OutputStream out = new FileOutputStream(target)) {
                copy(in, out);
            }
            return;
        }
        if (!target.isDirectory() && !target.mkdirs()) throw new IOException("couldn't make " + target);
        for (String child : children) copyAssets(assets, path + "/" + child, new File(target, child));
    }

    private static void deleteAll(File file) {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteAll(child);
        file.delete();
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
    }
}
