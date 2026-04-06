"use client";

import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CheckoutForm() {
  const searchParams = useSearchParams();
  const programName = searchParams.get("program") || "";
  const programSlug = searchParams.get("slug") || "";
  const amount = searchParams.get("amount") || "0";
  const locale = searchParams.get("locale") || "pt";

  const isPt = locale === "pt";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          programName,
          programSlug,
          amount: Number(amount),
          locale,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || (isPt ? "Algo deu errado. Tente novamente." : "Something went wrong. Please try again."));
        setLoading(false);
        return;
      }

      // Redirect to login with next pointing to the portal pay page
      const next = encodeURIComponent(`/hub/pay/${data.invoiceId}`);
      window.location.href = `/hub/login?payment=success&next=${next}`;
    } catch {
      setError(isPt ? "Erro de conexão. Tente novamente." : "Connection error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#2F443F" }}>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "serif" }}>
            {isPt ? "Finalizar Compra" : "Complete Purchase"}
          </h1>
          <p className="text-white/70 text-sm mt-2">
            {programName}
          </p>
          {Number(amount) > 0 && (
            <p className="text-2xl font-bold mt-3" style={{ color: "#FF8142" }}>
              ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>

        {/* Form */}
        <div className="rounded-2xl shadow-sm p-6" style={{ backgroundColor: "#FFF8E8" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2F443F" }}>
                {isPt ? "Nome completo" : "Full name"} *
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-1 transition"
                style={{ color: "#2F443F", borderColor: "#E1C19B" }}
                placeholder={isPt ? "Seu nome completo" : "Your full name"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2F443F" }}>
                {isPt ? "E-mail" : "Email"} *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-1 transition"
                style={{ color: "#2F443F", borderColor: "#E1C19B" }}
                placeholder={isPt ? "seu@email.com" : "your@email.com"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2F443F" }}>
                {isPt ? "Telefone / WhatsApp" : "Phone / WhatsApp"}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-1 transition"
                style={{ color: "#2F443F", borderColor: "#E1C19B" }}
                placeholder={isPt ? "+1 (xxx) xxx-xxxx" : "+1 (xxx) xxx-xxxx"}
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-center text-white font-semibold text-base transition disabled:opacity-60"
              style={{ backgroundColor: "#FF8142" }}
            >
              {loading
                ? (isPt ? "Processando..." : "Processing...")
                : (isPt ? "Ir para pagamento" : "Go to payment")
              }
            </button>
          </form>

          <p className="text-center text-xs mt-4" style={{ color: "#6B6358" }}>
            {isPt
              ? "Seus dados estão seguros. Você será redirecionado para a página de pagamento."
              : "Your data is secure. You will be redirected to the payment page."
            }
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  );
}
