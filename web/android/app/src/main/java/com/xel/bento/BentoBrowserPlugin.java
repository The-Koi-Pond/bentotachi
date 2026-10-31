package com.xel.bento;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the web app open Bento's built-in browser:
 * BentoBrowser.open({ url }) resolves with { saved: false } if the person just
 * closed it, or { saved: true, url, html } after "Save to Bento". With
 * mode: "link" or "pantry" the button says "Link this item" or "Add to
 * pantry", html is empty and name is the product's name.
 */
@CapacitorPlugin(name = "BentoBrowser")
public class BentoBrowserPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            call.reject("A web address starting with http:// or https:// is needed.");
            return;
        }
        Intent intent = new Intent(getContext(), BrowserActivity.class);
        intent.putExtra(BrowserActivity.EXTRA_URL, url);
        intent.putExtra(BrowserActivity.EXTRA_MODE, call.getString("mode", "recipe"));
        startActivityForResult(call, intent, "browserClosed");
    }

    @ActivityCallback
    private void browserClosed(PluginCall call, ActivityResult result) {
        if (call == null) return;
        BrowserActivity.SavedPage page = BrowserActivity.takeSavedPage();
        JSObject answer = new JSObject();
        if (result.getResultCode() == Activity.RESULT_OK && page != null) {
            answer.put("saved", true);
            answer.put("url", page.url);
            answer.put("html", page.html);
            answer.put("name", page.name);
        } else {
            answer.put("saved", false);
        }
        call.resolve(answer);
    }
}
