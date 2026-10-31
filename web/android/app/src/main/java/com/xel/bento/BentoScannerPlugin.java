package com.xel.bento;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

/**
 * Scanning a barcode on a pantry item: BentoScanner.scan() opens Google's own
 * scanner screen (from Google Play services) and resolves with { code }, or
 * { code: null } if it was closed. Google's screen handles the camera itself,
 * so Bento needs no camera permission and only ever sees the number.
 */
@CapacitorPlugin(name = "BentoScanner")
public class BentoScannerPlugin extends Plugin {

    @PluginMethod
    public void scan(PluginCall call) {
        // The barcodes on groceries.
        GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E)
            .enableAutoZoom()
            .build();
        GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(getActivity(), options);
        scanner
            .startScan()
            .addOnSuccessListener(barcode -> call.resolve(new JSObject().put("code", barcode.getRawValue())))
            .addOnCanceledListener(() -> call.resolve(new JSObject().put("code", null)))
            .addOnFailureListener(error ->
                // The first time, Google Play may still be fetching the scanner.
                call.reject("The scanner isn't ready yet (Google Play may still be setting it up). Try again in a minute. (" + error.getMessage() + ")")
            );
    }
}
