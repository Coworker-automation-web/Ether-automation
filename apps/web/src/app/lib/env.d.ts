/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** "1" switches the app to typed in-browser mocks; the backend is not required. */
  readonly PUBLIC_API_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
