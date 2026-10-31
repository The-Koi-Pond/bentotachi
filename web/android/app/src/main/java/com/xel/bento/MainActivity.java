package com.xel.bento;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Bento's own plugins have to be registered before the app starts.
        registerPlugin(BentoBrowserPlugin.class);
        registerPlugin(BentoUpdaterPlugin.class);
        registerPlugin(BentoSharePlugin.class);
        registerPlugin(BentoLocalServerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
