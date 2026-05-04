interface ImportMetaEnv {
  readonly VITE_OPENCODE_SERVER_HOST: string
  readonly VITE_OPENCODE_SERVER_PORT: string
  readonly VITE_CODEGENIE_CHANNEL?: "dev" | "beta" | "prod"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: true
    }
  }
}
