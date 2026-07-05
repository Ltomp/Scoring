import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QR({ text, size = 200 }: { text: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current)
      QRCode.toCanvas(ref.current, text, { width: size, margin: 0, errorCorrectionLevel: "L" }).catch(() => {});
  }, [text, size]);
  return (
    <div className="qr-wrap">
      <canvas ref={ref} aria-label="QR code" />
    </div>
  );
}
