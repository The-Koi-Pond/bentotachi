package com.xel.bento;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.MlKitException;
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
            .addOnFailureListener(error -> {
                int code = error instanceof MlKitException ? ((MlKitException) error).getErrorCode() : -1;
                // Closing the scanner with the phone's Back arrives here as
                // INTERNAL ("Failed to scan code."), not as cancelled; its own
                // ✕ is reported as cancelled (Pixel 7 Pro, Android 17,
                // 2026-11-03). A real internal failure is rare, and quietly
                // back on the page beats a wrong alarm after every Back.
                if (code == MlKitException.CODE_SCANNER_CANCELLED || code == MlKitException.INTERNAL) {
                    call.resolve(new JSObject().put("code", null));
                } else if (code == MlKitException.CODE_SCANNER_GOOGLE_PLAY_SERVICES_VERSION_TOO_OLD) {
                    call.reject("Scanning needs a newer Google Play services. Update it from the Play Store, then try again.");
                } else if (code == MlKitException.UNAVAILABLE || code == MlKitException.CODE_SCANNER_UNAVAILABLE) {
                    // The first time, Google Play may still be fetching the scanner.
                    call.reject("The scanner isn't ready yet (Google Play may still be setting it up). Try again in a minute.");
                } else {
                    call.reject("The scanner stopped with a problem. Try again, or type the barcode's numbers instead. (" + code + ": " + error.getMessage() + ")");
                }
            });
    }
}
