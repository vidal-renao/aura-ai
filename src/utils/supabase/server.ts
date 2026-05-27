import { createClient } from '@supabase/supabase-js';

export const createAuraServerClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: 'aura_core',
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
