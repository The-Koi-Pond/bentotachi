package com.xel.bento;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Saving a file the web app made (like a recipe export), where a browser
 * would just download it. The app's web view can't download, so the web app
 * sends the file in pieces, then Android's "save as" screen asks where:
 *
 *   begin()                  starts a new file (in the app's cache).
 *   append({ data })         adds a piece (base64), in order.
 *   save({ name, mime })     asks where to save it, copies it there and
 *                            resolves with { saved }.
 *
 * In pieces because one huge message to the app can run out of memory.
 */
@CapacitorPlugin(name = "BentoFiles")
public class BentoFilesPlugin extends Plugin {

    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    private File pending() {
        return new File(getContext().getCacheDir(), "saving.tmp");
    }

    @PluginMethod
    public void begin(PluginCall call) {
        worker.execute(() -> {
            File file = pending();
            if (file.exists() && !file.delete()) {
                call.reject("Couldn't start a new file.");
                return;
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void append(PluginCall call) {
        String data = call.getString("data", "");
        worker.execute(() -> {
            try (OutputStream out = new FileOutputStream(pending(), true)) {
                out.write(Base64.decode(data, Base64.DEFAULT));
                call.resolve();
            } catch (Throwable e) {
                call.reject("Couldn't make the file: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void save(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "Bento file"));
        startActivityForResult(call, intent, "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            pending().delete();
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Uri target = result.getData().getData();
        worker.execute(() -> {
            try (InputStream in = new FileInputStream(pending());
                 OutputStream out = getContext().getContentResolver().openOutputStream(target)) {
                if (out == null) throw new IOException("couldn't open the place you picked");
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                call.resolve(new JSObject().put("saved", true));
            } catch (Throwable e) {
                call.reject("Couldn't save the file: " + e.getMessage());
            } finally {
                pending().delete();
            }
        });
    }
}
