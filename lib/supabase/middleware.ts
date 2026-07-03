import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Retorna també `user` i `supabase` (a més de la `response` amb les cookies
// de sessió refrescades) perquè captainGuardRedirect() pugui reutilitzar-los
// sense haver de tornar a cridar auth.getUser() — aquesta crida fa una
// petició de xarxa real a Supabase Auth, i abans es feia dues vegades en
// cada request a /captain/*.
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { response, user, supabase };
}
