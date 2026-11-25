import type { Db } from "../db";
import { auditLog } from "../db/schema";
import { ulid } from "./ids";

export interface AuditEntry {
  orgId?: string | null;
  actorId?: string | null;
  /** Dotted verb, e.g. "key.mint", "member.remove". */
  action: string;
  /** Id of the thing acted on (a user id, key id, workspace id). Never a secret. */
  target?: string | null;
  meta?: Record<string, unknown>;
}

const SECRET_KEY = /token|secret|password|authorization|cookie|ciphertext|plaintext|^iv$|^key$|apikey|api_key|rolekey|role_key/i;
const CONTENT_KEY = /^(content|text|prompt|document|body|summary|title)$/i;
const MAX_STRING = 200;
const MAX_META_CHARS = 2000;
const MAX_DEPTH = 3;

function scrub(value: unknown, depth: number): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) || CONTENT_KEY.test(k) ? "[redacted]" : scrub(v, depth + 1);
    }
    return out;
  }
  return undefined; // functions, symbols, bigint, undefined
}

/** Audit metadata must never carry secrets or document text: redact by key name and cap the size. */
export function serializeMeta(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  const json = JSON.stringify(scrub(meta, 0));
  return json.length > MAX_META_CHARS ? JSON.stringify({ truncated: true }) : json;
}

/** Returns the insert so it can join an atomic `db.batch([...])` with the change it records. */
export function auditInsert(db: Db, e: AuditEntry) {
  return db.insert(auditLog).values({
    id: ulid(),
    orgId: e.orgId ?? null,
    actorId: e.actorId ?? null,
    action: e.action,
    target: e.target ?? null,
    meta: serializeMeta(e.meta),
  });
}

export async function writeAudit(db: Db, e: AuditEntry): Promise<void> {
  await auditInsert(db, e);
}
