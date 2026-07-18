import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnvironment(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function createAuraAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnvironment(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnvironment(supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot write cookies. Proxy handles refreshes.
          }
        },
      },
      db: { schema: 'aura_core' },
    }
  );
}

export const createAuraServerClient = () =>
  createClient(
    requireEnvironment(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnvironment(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      db: {
        schema: 'aura_core',
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
