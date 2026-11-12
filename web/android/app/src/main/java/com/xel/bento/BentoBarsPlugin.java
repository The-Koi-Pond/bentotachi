package com.xel.bento;

import android.content.res.Configuration;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android's own bars in the app's colours, so choosing Dark in the app
 * doesn't leave light strips above the top bar and below the tab bar.
 * Capacitor pads the window by the bars' height and the window's own
 * background shows through them (on Android 14 and older, and with an
 * older web view), so this paints that background: the top bar's colour
 * in the top strip, the tab bar's everywhere else (the app covers the
 * middle). paint({ top, bottom }) from SystemBarColours.tsx. Whether the
 * bars' icons are light or dark is Capacitor's SystemBars, which also
 * resets the window's background whenever it restyles (a rotation, the
 * phone's own light or dark changing): painted again just after.
 */
@CapacitorPlugin(name = "BentoBars")
public class BentoBarsPlugin extends Plugin {

    private Integer top;
    private Integer bottom;

    @PluginMethod
    public void paint(PluginCall call) {
        try {
            top = Color.parseColor(call.getString("top", ""));
            bottom = Color.parseColor(call.getString("bottom", ""));
        } catch (IllegalArgumentException e) {
            call.reject("Those aren't colours");
            return;
        }
        getActivity().runOnUiThread(() -> {
            apply();
            call.resolve();
        });
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // After SystemBars has put the theme's background back.
        View decor = getActivity().getWindow().getDecorView();
        decor.post(this::apply);
    }

    private void apply() {
        if (top == null || bottom == null) return;
        View decor = getActivity().getWindow().getDecorView();
        decor.setBackground(new BarsBackground(decor, top, bottom));
    }

    // The top colour down to where the app starts (the window's top padding,
    // the status bar), the bottom one below it.
    private static final class BarsBackground extends Drawable {

        private final View decor;
        private final int top;
        private final int bottom;
        private final Paint paint = new Paint();

        BarsBackground(View decor, int top, int bottom) {
            this.decor = decor;
            this.top = top;
            this.bottom = bottom;
        }

        @Override
        public void draw(Canvas canvas) {
            Rect bounds = getBounds();
            paint.setColor(bottom);
            canvas.drawRect(bounds, paint);
            paint.setColor(top);
            canvas.drawRect(bounds.left, bounds.top, bounds.right, bounds.top + decor.getPaddingTop(), paint);
        }

        @Override
        public void setAlpha(int alpha) {
            // Always solid: nothing behind the window to show through.
        }

        @Override
        public void setColorFilter(ColorFilter colorFilter) {
            // Never filtered: the colours are the app's own.
        }

        @Override
        public int getOpacity() {
            return PixelFormat.OPAQUE;
        }
    }
}
