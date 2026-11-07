package com.xel.bento;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Sharing to and from Bento. send() opens Android's share sheet for a recipe
 * (see below).
 *
 * "Share to Bento": text (usually a recipe link) shared to Bento from another
 * app, or a file opened with or shared to it (a Paprika file, from Files,
 * email or chat: Xel, 2026-11-07), waits here until the web app takes it
 * with BentoShare.take(), which resolves with { text, file }: the text or
 * null, and the file as { name, path } (copied into the app's own cache,
 * where the web view can read it) or null. If Bento was already open, it
 * also sends a "shared" event so the web app knows to take it.
 */
@CapacitorPlugin(name = "BentoShare")
public class BentoSharePlugin extends Plugin {

    private String pending;
    // A file opened with Bento, waiting to be copied when the web app takes
    // it (take() runs off the screen's thread, so a big file doesn't freeze it).
    private Uri pendingFile;

    @Override
    public void load() {
        // Bento was started by the share.
        Intent intent = getActivity().getIntent();
        pending = sharedText(intent);
        pendingFile = sharedFile(intent);
        // Forget the share, so reopening Bento later doesn't import it again.
        if (pending != null || pendingFile != null) getActivity().setIntent(new Intent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String text = sharedText(intent);
        Uri file = sharedFile(intent);
        if (text == null && file == null) return;
        pending = text;
        pendingFile = file;
        notifyListeners("shared", new JSObject());
    }

    @PluginMethod
    public void take(PluginCall call) {
        JSObject answer = new JSObject();
        answer.put("text", pending);
        pending = null;
        Uri file = pendingFile;
        pendingFile = null;
        if (file != null) {
            // Only files handed over the modern way (content://): an old-style
            // file:// address could point anywhere, Bentotachi's own private
            // files included (found in review), and usually can't be read.
            if (!"content".equals(file.getScheme())) {
                call.reject("Bentotachi can't open a file handed over that way. Save it to the phone, then choose it from ⋮ → Import & export.");
                return;
            }
            try {
                answer.put("file", copyToCache(file));
            } catch (Exception e) {
                call.reject("Couldn't open that file. Try opening it again, or save it and choose it from ⋮ → Import & export.");
                return;
            }
        }
        call.resolve(answer);
    }

    /**
     * The other way: sharing from Bento (a recipe as text) through Android's
     * share sheet. send({ title, text }) resolves once the sheet is open.
     */
    @PluginMethod
    public void send(PluginCall call) {
        String text = call.getString("text", "");
        if (text.trim().isEmpty()) {
            call.reject("Nothing to share.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, text);
        intent.putExtra(Intent.EXTRA_SUBJECT, call.getString("title", ""));
        getActivity().startActivity(Intent.createChooser(intent, call.getString("title", "Share")));
        call.resolve();
    }

    // Shared text (usually a link), or null. Judged by what the share carries,
    // not its label: some apps label a link "any type" (found in review).
    private static String sharedText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        // Reopened from the recent apps list: that share was already handled.
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return null;
        if (sharedFile(intent) != null) return null;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        return text == null || text.trim().isEmpty() ? null : text;
    }

    // A file opened with Bento ("Open with") or shared to it (a file that
    // isn't plain text, which comes as text instead), or null.
    @SuppressWarnings("deprecation")
    private static Uri sharedFile(Intent intent) {
        if (intent == null || (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) return intent.getData();
        if (Intent.ACTION_SEND.equals(intent.getAction()) && !"text/plain".equals(intent.getType())) {
            Object stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            return stream instanceof Uri ? (Uri) stream : null;
        }
        return null;
    }

    // Copies the opened file into the app's cache (one at a time: the last
    // one replaces the one before) and says its name and where it is.
    private JSObject copyToCache(Uri uri) throws Exception {
        String name = displayName(uri);
        File folder = new File(getContext().getCacheDir(), "opened");
        // The last opened file's copy goes first, so only one is ever kept.
        File[] old = folder.listFiles();
        if (old != null) for (File each : old) each.delete();
        if (!folder.isDirectory() && !folder.mkdirs()) throw new Exception("No cache folder");
        File copy = new File(folder, "opened-file");
        try (InputStream in = getContext().getContentResolver().openInputStream(uri); OutputStream out = new FileOutputStream(copy)) {
            if (in == null) throw new Exception("Nothing to read");
            byte[] buffer = new byte[256 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
        }
        JSObject file = new JSObject();
        file.put("name", name);
        file.put("path", copy.getAbsolutePath());
        return file;
    }

    // The file's name as the other app gives it ("Export … .paprikarecipes"),
    // else the last part of its address.
    private String displayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                if (name != null && !name.isEmpty()) return name;
            }
        } catch (Exception ignored) {
            // Some apps don't say; fall back to the address.
        }
        String last = uri.getLastPathSegment();
        return last == null ? "the file" : last;
    }
}
