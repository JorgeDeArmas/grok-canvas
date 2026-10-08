import { webcrypto } from "node:crypto";

const crypto = webcrypto;

function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function b64url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function seal(obj) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(obj)),
  ));
  const keyText = b64url(raw);
  const blobId = ("qa" + b64url(raw.slice(0, 9))).replace(/[^A-Za-z0-9_-]/g, "x").slice(0, 16);
  return {
    blob: { iv: b64(iv), ct: b64(ct) },
    keyText,
    blobId,
    hash: `#b=${blobId}&k=${keyText}`,
  };
}
