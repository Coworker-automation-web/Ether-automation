export interface Env {
  DB: D1Database;
  WORKSPACE_ROOM: DurableObjectNamespace;
  QUOTA_GUARD: DurableObjectNamespace;
  APP_ORIGIN: string;
  // Secrets
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ENCRYPTION_KEY?: string;
}
