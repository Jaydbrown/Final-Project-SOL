/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_CHAIN_NAME?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_EXPLORER_URLS?: string;
  readonly VITE_FUJI_EXPLORER_URLS?: string;
  readonly VITE_FACTORY_ADDRESS?: string;
  readonly VITE_USDC_ADDRESS?: string;
  readonly VITE_PINATA_JWT?: string;
  readonly VITE_IPFS_UPLOAD_TIMEOUT_MS?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_BACKEND_URL?: string;
}
