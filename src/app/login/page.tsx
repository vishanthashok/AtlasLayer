'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface AuthState {
  email: string;
  password: string;
  name: string;
}

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [form, setForm] = useState<AuthState>({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseConfigured = !!(supabaseUrl && supabaseKey);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!supabaseConfigured) {
      setError('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable authentication.');
      return;
    }

    if (!form.email || !form.password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl!, supabaseKey!);

      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { display_name: form.name } },
        });
        if (signUpError) { setError(signUpError.message); return; }
        setSuccess('Account created. Check your email to confirm, then sign in.');
        setMode('signin');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (signInError) { setError(signInError.message); return; }
        router.push('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* Classification banner */}
      <div className={styles.classBanner}>
        UNCLASSIFIED // FOR DEMONSTRATION USE ONLY
      </div>

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logoDot} />
          <span className={styles.logoText}>AtlasLayer</span>
        </div>
        <div className={styles.productName}>OPERATOR ACCESS</div>

        <div className={styles.modeTabs}>
          <button
            className={`${styles.modeTab} ${mode === 'signin' ? styles.modeTabActive : ''}`}
            onClick={() => { setMode('signin'); setError(null); }}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`${styles.modeTab} ${mode === 'signup' ? styles.modeTabActive : ''}`}
            onClick={() => { setMode('signup'); setError(null); }}
            type="button"
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === 'signup' && (
            <div className={styles.field}>
              <label className={styles.label}>OPERATOR NAME</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name or alias"
                className={styles.input}
                autoComplete="name"
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>EMAIL ADDRESS</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="operator@example.com"
              className={styles.input}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>PASSWORD</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
              className={styles.input}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
            />
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}
          {success && <div className={styles.successMsg}>{success}</div>}

          {!supabaseConfigured && (
            <div className={styles.warningMsg}>
              Supabase not configured — authentication disabled. Set{' '}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || !supabaseConfigured}
          >
            {loading ? 'AUTHENTICATING…' : mode === 'signin' ? 'AUTHENTICATE' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div className={styles.footer}>
          <Link href="/" className={styles.backLink}>← Return to Hub</Link>
          <Link href="/conflict" className={styles.guestLink}>Continue as Guest →</Link>
        </div>
      </div>

      <div className={styles.pageFooter}>
        AtlasLayer · Land Intelligence Platform · Demo Environment
      </div>
    </div>
  );
}
