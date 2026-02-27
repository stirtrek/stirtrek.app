"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

const SCANNER_ELEMENT_ID = "qr-scanner-region";

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const runningRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const startScanner = useCallback(async () => {
    setCameraError(null);

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        stream.getTracks().forEach((track) => track.stop());
      }

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {}
      );
      runningRef.current = true;
      setStarted(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      setCameraError(message);
      onError?.(message);
    }
  }, [onScan, onError]);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        if (runningRef.current) {
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {});
        }
        scannerRef.current = null;
        runningRef.current = false;
      }
    };
  }, []);

  return (
    <div>
      {/* Always render the target div so html5-qrcode can find it */}
      <div
        id={SCANNER_ELEMENT_ID}
        className={started ? "w-full overflow-hidden rounded-lg" : ""}
      />

      {!started && !cameraError && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 p-12 text-center">
          <Button onClick={startScanner} size="lg">
            <Camera className="mr-2 h-5 w-5" />
            Open Camera
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Your browser will ask for camera permission
          </p>
        </div>
      )}

      {cameraError && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            Camera access required
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {cameraError}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Please enable camera access in your browser settings and reload.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={startScanner}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
