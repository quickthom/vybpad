/// <reference types="vite/client" />

/** PAT-013: optional override; default in Vite is wired via env + CORS on the API */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
