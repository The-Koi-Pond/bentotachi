package com.xel.bento;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Self-updating, like Mihon: BentoUpdater.install({ url }) downloads the new
 * APK from Bento's server and opens Android's "update this app?" prompt.
 * Android only accepts it if it's signed with the same key as the installed
 * app.
 */
@CapacitorPlugin(name = "BentoUpdater")
public class BentoUpdaterPlugin extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("No download address given.");
            return;
        }

        // Android asks once whether Bento may install apps. Until it's
        // allowed, open that setting and let the person try again.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            call.reject("Allow Bentotachi to install apps, then tap Update again.", "NEEDS_PERMISSION");
            return;
        }

        // Downloading can't happen on the screen's own thread.
        new Thread(() -> {
            try {
                File apk = download(url);
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent installer = new Intent(Intent.ACTION_VIEW);
                installer.setDataAndType(uri, "application/vnd.android.package-archive");
                installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(installer);
                call.resolve();
            } catch (Exception e) {
                call.reject("Couldn't download the update: " + e.getMessage());
            }
        }).start();
    }

    private File download(String address) throws Exception {
        File folder = new File(getContext().getCacheDir(), "updates");
        if (!folder.exists() && !folder.mkdirs()) throw new Exception("no space for the download");
        File apk = new File(folder, "bento-update.apk");

        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        try {
            int status = connection.getResponseCode();
            if (status != 200) throw new Exception("the server answered " + status);
            try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            }
        } finally {
            connection.disconnect();
        }
        return apk;
    }
}
