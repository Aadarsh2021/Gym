/**
 * Platform Camera & QR Scanner Contract
 * Abstracts camera input and barcode/QR decoding across Web (MediaDevices / HTML5 Video)
 * and Mobile (Native Camera / BarcodeScanner plugins).
 */
export interface BarcodeScanResult {
  content: string;
  format?: string;
}

export interface IPlatformCamera {
  isSupported(): boolean;
  requestPermission(): Promise<boolean>;
  scanBarcode?(): Promise<BarcodeScanResult | null>;
}
