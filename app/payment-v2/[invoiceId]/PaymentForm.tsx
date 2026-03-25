"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t, Language } from "@/lib/i18n/hub";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  dueDate: string;
  isOverdue: boolean;
  daysUntilDue: number;
  language?: string;
  chargeEndpoint?: string;
  onSuccessRedirect?: string;
}

type PaymentMethod = "card" | "ach";

function formatCardNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length === 2 && value.endsWith("/")) return `${digits}/`;
  return digits;
}

function getCardBrand(number: string): string {
  const n = number.replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6(?:011|5)/.test(n)) return "Discover";
  return "";
}

import { BRAND_COLORS } from "@/lib/constants/brand";

const GOLD = BRAND_COLORS.TANGERINA;
const GOLD_HOVER = "#E0713A";
const GOLD_LIGHT = BRAND_COLORS.CREME;

function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  inputMode?: "numeric" | "text";
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none transition"
        onFocus={(e) => (e.target.style.borderColor = GOLD)}
        onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
      />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function PaymentForm({
  invoiceId,
  invoiceNumber,
  amount,
  customerName,
  customerEmail,
  dueDate,
  isOverdue,
  daysUntilDue,
  language = "en",
  chargeEndpoint,
  onSuccessRedirect,
}: Props) {
  const lang = language as Language;
  const endpoint = chargeEndpoint || `/api/payment-v2/${invoiceId}/charge`;
  const successUrl = onSuccessRedirect || `/payment/success?invoice_id=${invoiceId}`;
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card state
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardZip, setCardZip] = useState("");

  // ACH state
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("CHECKING");
  const [phone, setPhone] = useState("");

  // ── Card / ACH submit ───────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body: Record<string, string> =
        method === "card"
          ? {
              paymentMethod: "card",
              cardNumber: cardNumber.replace(/\s/g, ""),
              expMonth: cardExpiry.split("/")[0]?.trim(),
              expYear: `20${cardExpiry.split("/")[1]?.trim()}`,
              cvc: cardCvc,
              cardholderName: cardName,
              postalCode: cardZip,
            }
          : {
              paymentMethod: "ach",
              routingNumber,
              accountNumber,
              accountName,
              accountType,
              phone,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t(lang, "errors.paymentDeclined"));
        return;
      }
      router.push(successUrl);
    } catch {
      setError(t(lang, "errors.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  const brand = getCardBrand(cardNumber);
  const formattedAmount = amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  const formattedDue = new Date(dueDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen py-10 px-4" style={{ backgroundColor: "#FBF8F0" }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: GOLD }}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Carreira U.S.A.</h1>
          <p className="text-gray-500 text-sm mt-1">{t(lang, "payment.securePayment")}</p>
        </div>

        {/* Invoice Summary */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="p-6" style={{ backgroundColor: GOLD }}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: GOLD_LIGHT }}>{t(lang, "payment.invoice")}</p>
                <p className="text-xl font-bold text-white mt-0.5">#{invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: GOLD_LIGHT }}>Total</p>
                <p className="text-3xl font-bold text-white mt-0.5">{formattedAmount}</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t(lang, "payment.client")}</span>
              <span className="font-medium text-gray-900">{customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-900">{customerEmail}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t(lang, "payment.dueDate")}</span>
              <span className={`font-medium ${isOverdue ? "text-red-600" : "text-gray-900"}`}>
                {formattedDue}
                {isOverdue
                  ? ` (${Math.abs(daysUntilDue)}d ${t(lang, "payment.overdue")})`
                  : daysUntilDue <= 7
                  ? ` (${daysUntilDue}d ${t(lang, "payment.remaining")})`
                  : ""}
              </span>
            </div>
          </div>
          {isOverdue && (
            <div className="mx-6 mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              {t(lang, "payment.overdueWarning")}
            </div>
          )}
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-2xl shadow-sm p-6">

          {/* ── Card / ACH Tabs ── */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              type="button"
              onClick={() => { setMethod("card"); setError(null); }}
              className="flex-1 pb-3 text-sm font-medium transition-colors relative"
              style={{ color: method === "card" ? GOLD : "#9CA3AF" }}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                {t(lang, "payment.cardTab")}
              </div>
              {method === "card" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: GOLD }} />
              )}
            </button>
            <button
              type="button"
              onClick={() => { setMethod("ach"); setError(null); }}
              className="flex-1 pb-3 text-sm font-medium transition-colors relative"
              style={{ color: method === "ach" ? GOLD : "#9CA3AF" }}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                {t(lang, "payment.achTab")}
              </div>
              {method === "ach" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: GOLD }} />
              )}
            </button>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {method === "card" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t(lang, "payment.cardNumber")}</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none transition"
                      onFocus={(e) => (e.target.style.borderColor = GOLD)}
                      onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                    />
                    {brand && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                        {brand}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label={t(lang, "payment.expiry")} value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/AA" inputMode="numeric" />
                  <InputField label="CVC" value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="•••" inputMode="numeric" />
                </div>
                <InputField label={t(lang, "payment.cardName")} value={cardName}
                  onChange={(e) => setCardName(e.target.value)} placeholder="Como aparece no cartão" />
                <InputField label={t(lang, "payment.zip")} value={cardZip}
                  onChange={(e) => setCardZip(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="ZIP do endereço de cobrança" inputMode="numeric" />
              </>
            ) : (
              <>
                <InputField label={t(lang, "payment.routingNumber")} value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="9 dígitos" inputMode="numeric" />
                <InputField label={t(lang, "payment.accountNumber")} value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 17))}
                  placeholder="Número da conta" inputMode="numeric" />
                <InputField label={t(lang, "payment.accountHolder")} value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Nome como registrado no banco" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t(lang, "payment.accountType")}</label>
                  <select value={accountType} onChange={(e) => setAccountType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none transition bg-white"
                    onFocus={(e) => (e.target.style.borderColor = GOLD)}
                    onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}>
                    <option value="CHECKING">{t(lang, "payment.checking")}</option>
                    <option value="SAVINGS">{t(lang, "payment.savings")}</option>
                  </select>
                </div>
                <InputField label={t(lang, "payment.phone")} value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="(000) 000-0000" inputMode="numeric" />
              </>
            )}

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-center text-white font-semibold text-base transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ backgroundColor: loading ? "#E0713A" : GOLD }}
              onMouseEnter={(e) => {
                if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = GOLD_HOVER;
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = GOLD;
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {t(lang, "payment.processing")}
                </span>
              ) : (
                `Pagar ${formattedAmount}`
              )}
            </button>
          </form>

          {/* Security Footer */}
          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              {t(lang, "payment.securePayment")}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {method === "card"
                ? t(lang, "payment.cardSavedNote")
                : t(lang, "payment.achSavedNote")}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Dúvidas?{" "}
          <a href="mailto:support@carreirausa.com" className="underline">
            support@carreirausa.com
          </a>
        </p>
      </div>
    </div>
  );
}
