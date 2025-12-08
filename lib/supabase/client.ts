import { createBrowserClient } from "@supabase/ssr";

// グローバル変数を使ってHMRでもクライアントを再利用する
const globalForSupabase = typeof window !== 'undefined'
  ? (window as unknown as { __supabaseClient?: ReturnType<typeof createBrowserClient> })
  : {};

export const createClient = () => {
  if (globalForSupabase.__supabaseClient) {
    return globalForSupabase.__supabaseClient;
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    }
  );

  globalForSupabase.__supabaseClient = client;
  return client;
};
