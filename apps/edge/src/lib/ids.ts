const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RANDOM_BITS = 80n;
const RANDOM_MAX = (1n << RANDOM_BITS) - 1n;
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

let lastTime = -1;
let lastRandom = 0n;

function encode(value: bigint, length: number): string {
  let out = "";
  let v = value;
  for (let i = 0; i < length; i++) {
    out = ALPHABET[Number(v & 31n)]! + out;
    v >>= 5n;
  }
  return out;
}

function randomBits(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

/**
 * ULID: 48-bit millisecond time + 80 bits of randomness, Crockford base32, 26 chars.
 * Monotonic within an isolate: ids generated in the same millisecond (or after a backwards clock
 * step) sort in generation order by incrementing the previous random part.
 */
export function ulid(nowMs: number = Date.now()): string {
  let time = nowMs;
  let random: bigint;
  if (time <= lastTime) {
    time = lastTime;
    random = lastRandom + 1n;
    if (random > RANDOM_MAX) {
      time += 1;
      random = randomBits();
    }
  } else {
    random = randomBits();
  }
  lastTime = time;
  lastRandom = random;
  return encode(BigInt(time), 10) + encode(random, 16);
}

export function isUlid(value: string): boolean {
  return ULID_REGEX.test(value);
}

/** Milliseconds encoded in a ULID, for tests and debugging. */
export function ulidTime(id: string): number {
  let t = 0;
  for (const ch of id.slice(0, 10)) t = t * 32 + ALPHABET.indexOf(ch);
  return t;
}
