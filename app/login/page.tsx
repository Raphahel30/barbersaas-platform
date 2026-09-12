'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Scissors, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { signIn } from '@/app/actions/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);

      const res = await signIn(formData);
      if (res && !res.success) {
        setErrorMessage(res.message || 'E-mail ou senha incorretos.');
        setLoading(false);
      }
      // If successful, signIn triggers a server-side redirect
    } catch (err: unknown) {
      // In Next.js, redirect() throws a NEXT_REDIRECT error which is normal
      if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: string }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao processar login.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-amber-500 selection:text-black relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur relative z-10">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-2 mb-4 group">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/branding/navalio-icon-n.jpg" alt="Navalio" className="w-full h-full object-cover" />
            </div>
            <span className="font-cinzel font-black text-xl tracking-wider gold-gradient-text">NAVALIO</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-cinzel">
            Acesso Soberano
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-sans">
            Entre no ecossistema de gestão da sua barbearia
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="email">
              E-mail Profissional
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@barbearia.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300" htmlFor="password">
                Senha de Acesso
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl gold-button text-sm font-bold flex items-center justify-center gap-2 mt-6 shadow-xl shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer actions */}
        <div className="mt-6 text-center space-y-2 text-xs">
          <p className="text-zinc-400">
            Ainda não tem conta?{' '}
            <Link href="/demo" className="text-amber-400 hover:text-amber-300 font-semibold underline">
              Testar Demo Grátis
            </Link>
          </p>
          <div>
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-[11px] transition">
              ← Voltar para a Página Inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
