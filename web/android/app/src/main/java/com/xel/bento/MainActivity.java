package com.xel.bento;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Bento's own plugins have to be registered before the app starts.
        registerPlugin(BentoBrowserPlugin.class);
        // Not in the Google Play build: Play updates the app itself.
        if (!BuildConfig.BENTO_PLAY) registerPlugin(BentoUpdaterPlugin.class);
        registerPlugin(BentoSharePlugin.class);
        registerPlugin(BentoLocalServerPlugin.class);
        registerPlugin(BentoScannerPlugin.class);
        registerPlugin(BentoFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
