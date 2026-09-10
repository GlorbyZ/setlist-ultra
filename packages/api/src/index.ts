import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type HostedChart = {
  id: string;
  content_hash: string;
  source_provider: string | null;
  source_external_id: string | null;
  chordpro: string;
  ast: string | null;
  title: string | null;
  artist: string | null;
  original_key: string | null;
  created_at: string;
};

export type HostedLibraryItem = {
  id: string;
  user_id: string;
  org_id: string | null;
  chart_id: string;
  title: string;
  artist: string;
  capo: number | null;
  key_shift: number | null;
  duration_seconds: number | null;
  extras: Record<string, unknown> | null;
  updated_at: string;
};

export type HostedOrg = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type HostedAuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

export type CreateHostedClientOptions = {
  storage?: HostedAuthStorage;
  /** Default true on web; set false for React Native. */
  detectSessionInUrl?: boolean;
  /** Prefer pkce for native OAuth redirects. */
  flowType?: 'pkce' | 'implicit';
};

export function createHostedClient(
  url: string,
  anonKey: string,
  options?: CreateHostedClientOptions,
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? true,
      storage: options?.storage,
      flowType: options?.flowType,
    },
  });
}
