import { registerPlugin } from "@capacitor/core";
import { isAndroidApp, pb } from "./pb";

// Scanning and looking up barcodes for the pantry (see barcodes.ts). The
// Android app scans with Google's scanner screen (BentoScannerPlugin.java);
// in a browser the number is typed instead, which a USB barcode scanner also
// does by itself.

interface ScannerPlugin {
  scan(): Promise<{ code: string | null }>;
}

const Scanner = registerPlugin<ScannerPlugin>("BentoScanner");

export const canScan = isAndroidApp;

// The scanned number, or null if the scanner was closed.
export async function scanBarcode(): Promise<string | null> {
  return (await Scanner.scan()).code;
}

export interface BarcodeProduct {
  name: string;
  brand: string;
  quantity: string;
}

// What Open Food Facts says the barcode is, or null if it doesn't know
// (pb_hooks/barcodes.pb.js).
export async function lookUpBarcode(code: string): Promise<BarcodeProduct | null> {
  const answer = await pb.send<{ found: boolean } & Partial<BarcodeProduct>>(`/api/cookbook/barcode/${code}`, {});
  return answer.found ? { name: answer.name ?? "", brand: answer.brand ?? "", quantity: answer.quantity ?? "" } : null;
}
