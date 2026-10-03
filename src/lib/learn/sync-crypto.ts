/**
 * The sync code and the keys derived from it (docs/SYNC.md). The code is 128
 * random bits, written in Crockford base32 so it can be read aloud or typed.
 * From it come the sync space's id, the token that proves possession of it,
 * and the AES-GCM key that encrypts everything uploaded. The key is never
 * sent anywhere.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string): Uint8Array<ArrayBuffer> | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** A new code, grouped for reading: XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX. */
export function newSyncCode(): string {
  const raw = toBase32(crypto.getRandomValues(new Uint8Array(16)));
  return raw.match(/.{1,5}/g)!.join("-");
}

/** The code's 16 bytes, forgiving case, spaces, dashes and look-alike letters; null if invalid. */
export function readSyncCode(text: string): Uint8Array<ArrayBuffer> | null {
  const clean = text.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
  if (clean.length !== 26) return null;
  const bytes = fromBase32(clean);
  return bytes && bytes.length === 16 ? bytes : null;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function unbase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

export type SyncKeys = { space: string; token: string; key: CryptoKey; ids: CryptoKey };

export async function deriveKeys(secret: Uint8Array<ArrayBuffer>): Promise<SyncKeys> {
  const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits", "deriveKey"]);
  const info = (label: string) => ({ name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("vajefy-sync-v1"), info: new TextEncoder().encode(label) });
  const space = new Uint8Array(await crypto.subtle.deriveBits(info("space"), material, 128));
  const token = new Uint8Array(await crypto.subtle.deriveBits(info("token"), material, 256));
  const key = await crypto.subtle.deriveKey(info("key"), material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const ids = await crypto.subtle.deriveKey(info("id"), material, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  return {
    space: Array.from(space, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    token: base64(token).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    key,
    ids,
  };
}

/**
 * The id an operation is stored under on the server. Operation ids can name
 * what was studied (an imported answer's id holds its word), so the server
 * sees only a keyed hash: the same operation always maps to the same id, which
 * is all deduplication needs.
 */
export async function opaqueId(keys: Pick<SyncKeys, "ids">, id: string): Promise<string> {
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", keys.ids, new TextEncoder().encode(id)));
  return Array.from(mac.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** Compress and encrypt a value for upload. */
export async function seal(key: CryptoKey, value: unknown): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(value)), new CompressionStream("gzip"));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packed));
  return { iv: base64(iv), data: base64(cipher) };
}

/** Decrypt and decompress a downloaded value; throws if it was altered or the key is wrong. */
export async function unseal<T>(key: CryptoKey, sealed: { iv: string; data: string }): Promise<T> {
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(sealed.iv) }, key, unbase64(sealed.data)));
  return JSON.parse(new TextDecoder().decode(await pipe(plain, new DecompressionStream("gzip")))) as T;
}
