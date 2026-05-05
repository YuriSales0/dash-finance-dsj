"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    password: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
    pix_key: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Criar conta via API
      const res = await fetch("/api/investor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, invite_code: code }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar conta");
        setLoading(false);
        return;
      }

      // Login automatico
      const supabase = createBrowserSupabaseClient();
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      setLoading(false);

      if (loginErr) {
        router.push("/login");
        return;
      }

      // Redirecionar para landing — investidor fica em status=pending ate
      // admin aprovar. A landing mostra mensagem "aguardando aprovacao".
      router.push(`/invest/${code}?registered=1`);
    } catch (err) {
      setError("Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl mb-3">
            <UserPlus className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Criar conta</h1>
          <p className="text-sm text-slate-500 mt-1">
            Codigo de convite: <strong>{code}</strong>
          </p>
        </div>

        <div className="card card-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                <h3 className="font-semibold text-sm text-slate-700">Dados pessoais</h3>
                <Field label="Nome completo">
                  <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required placeholder="Seu nome completo" />
                </Field>
                <Field label="CPF">
                  <input className="input" value={form.cpf} onChange={(e) => update("cpf", e.target.value)} required placeholder="000.000.000-00" />
                </Field>
                <Field label="Email">
                  <input type="email" className="input" value={form.email} onChange={(e) => update("email", e.target.value)} required placeholder="seu@email.com" />
                </Field>
                <Field label="Telefone">
                  <input className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+55 11 99999-0000" />
                </Field>
                <Field label="Senha">
                  <input type="password" className="input" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={8} placeholder="Minimo 8 caracteres" />
                </Field>
                <button type="button" onClick={() => setStep(2)} className="btn-primary w-full" disabled={!form.name || !form.email || !form.password || !form.cpf}>
                  Proximo: dados bancarios
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="font-semibold text-sm text-slate-700">Dados bancarios (para receber retorno)</h3>
                <Field label="Banco">
                  <input className="input" value={form.bank_name} onChange={(e) => update("bank_name", e.target.value)} placeholder="Ex: Nubank, Itau, Bradesco" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Agencia">
                    <input className="input" value={form.bank_agency} onChange={(e) => update("bank_agency", e.target.value)} placeholder="0001" />
                  </Field>
                  <Field label="Conta">
                    <input className="input" value={form.bank_account} onChange={(e) => update("bank_account", e.target.value)} placeholder="12345-6" />
                  </Field>
                </div>
                <Field label="Chave PIX">
                  <input className="input" value={form.pix_key} onChange={(e) => update("pix_key", e.target.value)} placeholder="CPF, email, telefone ou chave aleatoria" />
                </Field>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">Voltar</button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? "Criando..." : "Criar conta"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck size={12} />
          Dados protegidos. Acesso restrito por convite.
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
