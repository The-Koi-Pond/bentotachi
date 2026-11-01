package com.xel.bento;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Sharing to and from Bento. send() opens Android's share sheet for a recipe
 * (see below).
 *
 * "Share to Bento": text (usually a recipe link) shared to Bento from another
 * app waits here until the web app takes it with BentoShare.take(), which
 * resolves with { text } or { text: null }. If Bento was already open, it
 * also sends a "shared" event so the web app knows to take it.
 */
@CapacitorPlugin(name = "BentoShare")
public class BentoSharePlugin extends Plugin {

    private String pending;

    @Override
    public void load() {
        // Bento was started by the share.
        pending = sharedText(getActivity().getIntent());
        // Forget the share, so reopening Bento later doesn't import it again.
        if (pending != null) getActivity().setIntent(new Intent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String text = sharedText(intent);
        if (text == null) return;
        pending = text;
        notifyListeners("shared", new JSObject());
    }

    @PluginMethod
    public void take(PluginCall call) {
        JSObject answer = new JSObject();
        answer.put("text", pending);
        pending = null;
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

    private static String sharedText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        // Reopened from the recent apps list: that share was already handled.
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return null;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        return text == null || text.trim().isEmpty() ? null : text;
    }
}
