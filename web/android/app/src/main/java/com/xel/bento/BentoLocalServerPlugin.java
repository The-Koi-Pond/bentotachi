package com.xel.bento;

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.net.Uri;
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
 *   backup()  makes a backup and asks where to save it: { saved }.
 *   restore() asks for a backup file and puts it in place: { restored, url }.
 *   supported() whether this phone can run it (64-bit ARM): { supported }.
 *   erase()   stops it and deletes everything it kept.
 *   rescue()  when it won't start: saves its data as a backup anyway: { saved }.
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
    private File pendingBackup;

    // The server is built for 64-bit ARM only (see mobile/README.md).
    @PluginMethod
    public void supported(PluginCall call) {
        boolean arm64 = java.util.Arrays.asList(android.os.Build.SUPPORTED_ABIS).contains("arm64-v8a");
        call.resolve(new JSObject().put("supported", arm64));
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
            deleteAll(new File(getContext().getFilesDir(), "bento-data"));
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

    @ActivityCallback
    private void backupSaved(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Uri target = result.getData().getData();
        worker.execute(() -> {
            try (InputStream in = new FileInputStream(pendingBackup);
                 OutputStream out = getContext().getContentResolver().openOutputStream(target)) {
                if (out == null) throw new IOException("couldn't open the place you picked");
                copy(in, out);
                call.resolve(new JSObject().put("saved", true));
            } catch (Throwable e) {
                call.reject("Couldn't save the backup: " + e.getMessage());
            }
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
