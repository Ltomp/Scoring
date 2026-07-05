import { useState } from "react";
import { QR } from "./QR";

/** A share link presented every useful way: QR, native share, copy. */
export function ShareSheet({ url, title, qrLabel }: { url: string; title: string; qrLabel: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="label">{qrLabel}</div>
      <QR text={url} />
      <div className="hint" style={{ marginBottom: 10 }}>
        Scan with a phone camera, or send the link.
      </div>
      <div className="btn-row">
        {canShare && (
          <button className="btn" onClick={() => navigator.share({ title, url }).catch(() => {})}>
            Share link
          </button>
        )}
        <button
          className={`btn ${canShare ? "ghost" : ""}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              /* fall through to showing the box below */
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
      <textarea
        readOnly
        data-testid="share-url"
        value={url}
        rows={2}
        style={{ marginTop: 10, fontSize: 11 }}
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  );
}
