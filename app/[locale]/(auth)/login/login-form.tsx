'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email(),
});

export function LoginForm() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="bg-secondary text-secondary-foreground rounded-md p-4 text-center text-sm">
        {t('magic_link_sent')}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
