'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

const emailSchema = z.object({ email: z.string().email() });
const codeSchema = z.object({ token: z.string().regex(/^\d{4,8}$/) });

export function LoginForm({ next }: { next?: string | null }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setError(t('email_invalid'));
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      // Enviem el correu amb magic-link + codi OTP de 6 dígits a la vegada
      // (la plantilla de Supabase inclou els dos). Així l'usuari pot escollir.
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${
            next ? `?next=${encodeURIComponent(next)}` : ''
          }`,
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }
      setSent(true);
    });
  }

  function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = codeSchema.safeParse({ token });
    if (!parsed.success) {
      setError(t('code_invalid'));
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.verifyOtp({
        email,
        token: parsed.data.token,
        type: 'email',
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      // Redirigeix segons el rol llegit del client (l'app_metadata es propaga
      // via JWT). El callback server-side ja fa el mateix per a magic-link.
      const { data } = await supabase.auth.getUser();
      const role = (data.user?.app_metadata?.role as string | undefined) ?? null;
      const target = next
        ? next
        : role === 'admin'
          ? '/admin'
          : role === 'captain'
            ? '/captain'
            : '/';
      router.push(target);
      router.refresh();
    });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="bg-secondary text-secondary-foreground rounded-md p-4 text-sm">
          <p className="font-medium">{t('magic_link_sent')}</p>
          <p className="text-muted-foreground mt-1 text-xs">{t('code_fallback_help')}</p>
        </div>

        <form onSubmit={verifyCode} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              {t('code_label')}
            </label>
            <Input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              pattern="\d{4,8}"
              placeholder="12345678"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
              disabled={isPending}
              required
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '…' : t('verify_code')}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setSent(false);
            setToken('');
            setError(null);
          }}
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          {t('use_different_email')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          {t('email_label')}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t('email_placeholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? '…' : t('send_magic_link')}
      </Button>
    </form>
  );
}
