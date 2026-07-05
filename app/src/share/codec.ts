import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { SharePayload } from "./payloads";

/**
 * Share payloads travel as deflate-compressed base64url JSON inside the
 * URL fragment: <app>#/i/<blob>. Fragments never reach any server, and a
 * full 32-player round pack stays comfortably QR-sized.
 */
export function encodePayload(payload: SharePayload): string {
  const packed = deflateSync(strToU8(JSON.stringify(payload)), { level: 9 });
  return toBase64Url(packed);
}

export function decodePayload(blob: string): SharePayload {
  const json = strFromU8(inflateSync(fromBase64Url(blob)));
  const payload = JSON.parse(json) as SharePayload;
  if (payload.v !== 1 || (payload.kind !== "pack" && payload.kind !== "card")) {
    throw new Error("This link isn't a recognised share from this app.");
  }
  return payload;
}

export function shareUrl(payload: SharePayload): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/i/${encodePayload(payload)}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
