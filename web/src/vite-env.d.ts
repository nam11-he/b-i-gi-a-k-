/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gateway base URL. Defaults to "/api" on the same origin (Vite proxy in dev, nginx in Docker). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
