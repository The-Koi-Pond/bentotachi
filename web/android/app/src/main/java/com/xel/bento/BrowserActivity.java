package com.xel.bento;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Bento's built-in browser: a web page with a top bar holding a close button,
 * the page title and "Save to Bento". Saving reads the recipe data from the
 * page the phone already loaded, so it works even on sites that block
 * Bento's server. Opened by BentoBrowserPlugin, which hands the result back
 * to the app.
 *
 * In link mode (EXTRA_MODE = "link") the button says "Link this item" and
 * hands back the page's address and product name, for linking a pantry item
 * to its product page in a store.
 */
public class BrowserActivity extends AppCompatActivity {

    static final String EXTRA_URL = "url";
    static final String EXTRA_MODE = "mode";

    /** What "Save to Bento" picked up. In link mode, html is "" and name is the product's. */
    static final class SavedPage {
        final String url;
        final String html;
        final String name;

        SavedPage(String url, String html, String name) {
            this.url = url;
            this.html = html;
            this.name = name;
        }
    }

    // Handed over through a field rather than the Intent, because Android
    // limits how much data an Intent can carry.
    private static SavedPage savedPage;

    static synchronized SavedPage takeSavedPage() {
        SavedPage page = savedPage;
        savedPage = null;
        return page;
    }

    private static synchronized void keepSavedPage(SavedPage page) {
        savedPage = page;
    }

    private static final int ACCENT = Color.parseColor("#A82D4A"); // the app's light accent (umeboshi)

    // Runs inside the page. Collects the page's recipe data blocks (and its
    // preview image) into a tiny HTML document for the server's recipe
    // reader, and says whether any of them is a recipe. Pages from older
    // recipe plugins label the visible recipe card instead (itemprop
    // "microdata"); that card is sent too. Failing both, a blog post with
    // an "Ingredients" line is sent for the server's plain-text reader.
    // That line takes the same headings as the server's INGREDIENTS_HEADING
    // (server/pb_hooks/recipe_parse.js): keep the two in step.
    private static final String READ_PAGE_JS =
        "(function () {" +
        "  var parts = [], text = '';" +
        "  document.querySelectorAll('script[type=\"application/ld+json\"]').forEach(function (s) {" +
        "    text += s.textContent;" +
        "    parts.push('<script type=\"application/ld+json\">' + s.textContent.replace(/<\\/script/gi, '<\\\\/script') + '</scr' + 'ipt>');" +
        "  });" +
        "  var og = document.querySelector('meta[property=\"og:image\"]');" +
        "  if (og && og.content) parts.push('<meta property=\"og:image\" content=\"' + og.content.replace(/\"/g, '&quot;') + '\">');" +
        // The page's title, for recipes that don't name themselves.
        "  ['og:title', 'og:site_name'].forEach(function (name) {" +
        "    var meta = document.querySelector('meta[property=\"' + name + '\"]');" +
        "    if (meta && meta.content) parts.push('<meta property=\"' + name + '\" content=\"' + meta.content.replace(/\"/g, '&quot;') + '\">');" +
        "  });" +
        "  parts.push('<title>' + document.title.replace(/</g, '&lt;') + '</title>');" +
        "  var card = document.querySelector('[itemtype*=\"schema.org/Recipe\"], [itemtype*=\"data-vocabulary.org/Recipe\"]');" +
        "  if (card) parts.push(card.outerHTML);" +
        // The recipe writer's notes box (recipe data leaves it out).
        "  var notes = document.querySelector('.wprm-recipe-notes, .tasty-recipes-notes, .mv-create-notes');" +
        "  if (notes && !(card && card.contains(notes))) parts.push(notes.outerHTML);" +
        "  var hasRecipe = /\"@type\"\\s*:\\s*(\\[[^\\]]*)?\"(https?:\\/\\/schema\\.org\\/)?Recipe\"/.test(text) || !!card;" +
        // A recipe written as ordinary text in a blog post: send the post.
        "  var post = hasRecipe ? null : document.querySelector('.entry-content, .post-content, .article-content, .post-body, article');" +
        "  if (post && /(^|\\n)\\s*(ingredients?|what you(['\\u2019]ll| will)? need|you(['\\u2019]ll| will)? need)\\b/i.test(post.innerText)) { parts.push(post.outerHTML); hasRecipe = true; }" +
        "  return JSON.stringify({ html: '<html><head>' + parts.join('') + '</head></html>', hasRecipe: hasRecipe });" +
        "})()";

    // Runs inside the page in link mode: the product's name, from the page's
    // product data, else its main heading, else its title.
    private static final String READ_NAME_JS =
        "(function () {" +
        "  var name = '';" +
        "  document.querySelectorAll('script[type=\"application/ld+json\"]').forEach(function (s) {" +
        "    try {" +
        "      var data = JSON.parse(s.textContent);" +
        "      [].concat(data['@graph'] || data).forEach(function (thing) {" +
        "        if (!name && thing && /Product/.test([].concat(thing['@type']).join(' ')) && thing.name) name = String(thing.name);" +
        "      });" +
        "    } catch (e) {}" +
        "  });" +
        "  var h1 = document.querySelector('h1');" +
        "  if (!name && h1) name = h1.textContent.trim();" +
        "  var og = document.querySelector('meta[property=\"og:title\"]');" +
        "  if (!name && og) name = og.content || '';" +
        "  return name || document.title || '';" +
        "})()";

    private WebView webView;
    private TextView title;
    private ProgressBar progress;
    private Button save;
    // "Link this item" instead of Save to Bento.
    private boolean linkMode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        linkMode = "link".equals(getIntent().getStringExtra(EXTRA_MODE));
        buildLayout();
        setUpWebView();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Back goes back a page within the site, then closes.
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(getIntent().getStringExtra(EXTRA_URL));
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    private void buildLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(4), dp(6), dp(10), dp(6));
        bar.setBackgroundColor(Color.WHITE);

        TextView close = new TextView(this);
        close.setText("✕");
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        close.setTextColor(Color.parseColor("#2B2420"));
        close.setGravity(Gravity.CENTER);
        close.setMinWidth(dp(48));
        close.setMinHeight(dp(48));
        close.setContentDescription("Close the browser");
        close.setOnClickListener(v -> finish());

        title = new TextView(this);
        title.setText("Loading…");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        title.setTextColor(Color.parseColor("#2B2420"));
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        title.setPadding(dp(4), 0, dp(8), 0);

        save = new Button(this);
        save.setText(buttonLabel());
        save.setAllCaps(false);
        save.setTextColor(Color.WHITE);
        save.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(ACCENT);
        pill.setCornerRadius(dp(22));
        save.setBackground(pill);
        save.setPadding(dp(16), 0, dp(16), 0);
        save.setMinHeight(dp(44));
        save.setMinimumHeight(dp(44));
        save.setOnClickListener(v -> savePage());

        bar.addView(close);
        bar.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        bar.addView(save, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(44)));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(ACCENT));

        webView = new WebView(this);

        root.addView(bar, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(progress, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3)));
        root.addView(webView, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        // Newer Android draws apps under the status and navigation bars; pad
        // the screen so the top bar and the page stay clear of them.
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        setContentView(root);
    }

    private void setUpWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) return false;
                // Links like mailto: or app links go to the phone's other apps,
                // but only when tapped: a page (like an ad's redirect) mustn't
                // open the Play Store or another app by itself.
                if (!request.hasGesture()) return true;
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                // Only apps that say they can be opened from a web link.
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                try {
                    startActivity(intent);
                } catch (RuntimeException ignored) {
                    // Nothing on the phone handles it (or Android won't allow
                    // it); stay put.
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress < 100 ? View.VISIBLE : View.INVISIBLE);
            }

            @Override
            public void onReceivedTitle(WebView view, String pageTitle) {
                title.setText(pageTitle);
            }
        });
    }

    private String buttonLabel() {
        return linkMode ? "Link this item" : "Save to Bentotachi";
    }

    private void savePage() {
        if (linkMode) {
            // The address of the product page that's open, and its name.
            webView.evaluateJavascript(READ_NAME_JS, value -> {
                String name = "";
                try {
                    Object read = new JSONTokener(value).nextValue();
                    if (read instanceof String) name = (String) read;
                } catch (Exception ignored) {
                    // No name; the app suggests one from the address instead.
                }
                keepSavedPage(new SavedPage(webView.getUrl(), "", name));
                setResult(RESULT_OK);
                finish();
            });
            return;
        }
        save.setEnabled(false);
        save.setText("Saving…");
        webView.evaluateJavascript(READ_PAGE_JS, value -> {
            try {
                // The page's answer arrives as a quoted JSON string; unwrap it.
                String json = (String) new JSONTokener(value).nextValue();
                JSONObject page = new JSONObject(json);
                if (!page.optBoolean("hasRecipe")) {
                    Toast.makeText(this, "No recipe on this page. Open the recipe itself, then tap Save.", Toast.LENGTH_LONG).show();
                    resetSaveButton();
                    return;
                }
                keepSavedPage(new SavedPage(webView.getUrl(), page.getString("html"), ""));
                setResult(RESULT_OK);
                finish();
            } catch (Exception e) {
                Toast.makeText(this, "Couldn't read this page. Try again once it has finished loading.", Toast.LENGTH_LONG).show();
                resetSaveButton();
            }
        });
    }

    private void resetSaveButton() {
        save.setEnabled(true);
        save.setText(buttonLabel());
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}
