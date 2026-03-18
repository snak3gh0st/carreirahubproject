// ---------------------------------------------------------------------------
// Hub i18n – English & Portuguese (BR) translations
// ---------------------------------------------------------------------------

export type Language = "en" | "pt-BR";

const translations = {
  en: {
    // Header
    "header.logout": "Log out",
    "header.settings": "Settings",

    // Dashboard
    "dashboard.welcome": "Welcome",
    "dashboard.totalDue": "Total Due",
    "dashboard.totalPaid": "Total Paid",
    "dashboard.nextDue": "Next Due",
    "dashboard.invoices": "Invoices",
    "dashboard.payNow": "Pay Now",
    "dashboard.paid": "Paid",
    "dashboard.overdue": "Overdue",
    "dashboard.pending": "Pending",
    "dashboard.upcoming": "Upcoming",
    "dashboard.partiallyPaid": "Partially Paid",
    "dashboard.viewReceipt": "View Receipt",
    "dashboard.noInvoices": "No invoices found",

    // Payment form
    "payment.paymentTitle": "Payment",
    "payment.cardTab": "Card",
    "payment.achTab": "Bank Account",
    "payment.cardNumber": "Card Number",
    "payment.expiry": "Expiry",
    "payment.cvc": "CVC",
    "payment.cardName": "Name on Card",
    "payment.zip": "ZIP Code",
    "payment.routingNumber": "Routing Number",
    "payment.accountNumber": "Account Number",
    "payment.accountHolder": "Account Holder",
    "payment.accountType": "Account Type",
    "payment.checking": "Checking",
    "payment.savings": "Savings",
    "payment.phone": "Phone",
    "payment.payAmount": "Pay",
    "payment.processing": "Processing…",
    "payment.securePayment": "Secure payment powered by Stripe",
    "payment.cardSavedNote": "Your card information is stored securely by Stripe.",
    "payment.achSavedNote": "Your bank information is stored securely by Stripe.",

    // Login
    "login.loginTitle": "Client Login",
    "login.loginSubtitle": "Sign in to view your invoices and payments",
    "login.email": "Email",
    "login.password": "Password",
    "login.signIn": "Sign In",
    "login.forgotPassword": "Forgot password?",
    "login.loginError": "Invalid email or password",
    "login.accountLocked": "Too many attempts. Please try again later.",

    // Password
    "password.setPasswordTitle": "Set Your Password",
    "password.resetPasswordTitle": "Reset Password",
    "password.resetPasswordSubtitle": "Enter your email to receive a reset link",
    "password.newPassword": "New Password",
    "password.confirmPassword": "Confirm Password",
    "password.sendResetLink": "Send Reset Link",
    "password.resetLinkSent": "If an account exists for that email, a reset link has been sent.",
    "password.passwordUpdated": "Your password has been updated successfully.",
    "password.passwordMismatch": "Passwords do not match",
    "password.passwordTooShort": "Password must be at least 8 characters",

    // Settings
    "settings.settingsTitle": "Settings",
    "settings.language": "Language",
    "settings.changePassword": "Change Password",
    "settings.currentPassword": "Current Password",
    "settings.profile": "Profile",
    "settings.saved": "Settings saved",

    // Errors
    "errors.connectionError": "Connection error. Please try again.",
    "errors.invalidCard": "Invalid card details",
    "errors.paymentDeclined": "Payment was declined",
    "errors.invoiceNotFound": "Invoice not found",
    "errors.invoiceAlreadyPaid": "This invoice has already been paid",
    "errors.bankDataInvalid": "Invalid bank account information",
  },

  "pt-BR": {
    // Header
    "header.logout": "Sair",
    "header.settings": "Configurações",

    // Dashboard
    "dashboard.welcome": "Bem-vindo",
    "dashboard.totalDue": "Total em Aberto",
    "dashboard.totalPaid": "Total Pago",
    "dashboard.nextDue": "Próximo Vencimento",
    "dashboard.invoices": "Faturas",
    "dashboard.payNow": "Pagar Agora",
    "dashboard.paid": "Pago",
    "dashboard.overdue": "Atrasado",
    "dashboard.pending": "Pendente",
    "dashboard.upcoming": "A Vencer",
    "dashboard.partiallyPaid": "Parcialmente Pago",
    "dashboard.viewReceipt": "Ver Recibo",
    "dashboard.noInvoices": "Nenhuma fatura encontrada",

    // Payment form
    "payment.paymentTitle": "Pagamento",
    "payment.cardTab": "Cartão",
    "payment.achTab": "Conta Bancária",
    "payment.cardNumber": "Número do Cartão",
    "payment.expiry": "Validade",
    "payment.cvc": "CVC",
    "payment.cardName": "Nome no Cartão",
    "payment.zip": "CEP",
    "payment.routingNumber": "Número de Roteamento",
    "payment.accountNumber": "Número da Conta",
    "payment.accountHolder": "Titular da Conta",
    "payment.accountType": "Tipo de Conta",
    "payment.checking": "Corrente",
    "payment.savings": "Poupança",
    "payment.phone": "Telefone",
    "payment.payAmount": "Pagar",
    "payment.processing": "Processando…",
    "payment.securePayment": "Pagamento seguro processado pelo Stripe",
    "payment.cardSavedNote": "As informações do seu cartão são armazenadas com segurança pelo Stripe.",
    "payment.achSavedNote": "As informações bancárias são armazenadas com segurança pelo Stripe.",

    // Login
    "login.loginTitle": "Login do Cliente",
    "login.loginSubtitle": "Entre para visualizar suas faturas e pagamentos",
    "login.email": "E-mail",
    "login.password": "Senha",
    "login.signIn": "Entrar",
    "login.forgotPassword": "Esqueceu a senha?",
    "login.loginError": "E-mail ou senha inválidos",
    "login.accountLocked": "Muitas tentativas. Tente novamente mais tarde.",

    // Password
    "password.setPasswordTitle": "Defina sua Senha",
    "password.resetPasswordTitle": "Redefinir Senha",
    "password.resetPasswordSubtitle": "Insira seu e-mail para receber o link de redefinição",
    "password.newPassword": "Nova Senha",
    "password.confirmPassword": "Confirmar Senha",
    "password.sendResetLink": "Enviar Link de Redefinição",
    "password.resetLinkSent": "Se existir uma conta com esse e-mail, um link de redefinição foi enviado.",
    "password.passwordUpdated": "Sua senha foi atualizada com sucesso.",
    "password.passwordMismatch": "As senhas não coincidem",
    "password.passwordTooShort": "A senha deve ter pelo menos 8 caracteres",

    // Settings
    "settings.settingsTitle": "Configurações",
    "settings.language": "Idioma",
    "settings.changePassword": "Alterar Senha",
    "settings.currentPassword": "Senha Atual",
    "settings.profile": "Perfil",
    "settings.saved": "Configurações salvas",

    // Errors
    "errors.connectionError": "Erro de conexão. Tente novamente.",
    "errors.invalidCard": "Dados do cartão inválidos",
    "errors.paymentDeclined": "Pagamento recusado",
    "errors.invoiceNotFound": "Fatura não encontrada",
    "errors.invoiceAlreadyPaid": "Esta fatura já foi paga",
    "errors.bankDataInvalid": "Informações bancárias inválidas",
  },
} as const;

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------

export type TranslationKey = keyof (typeof translations)["en"];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return a single translated string for the given language and key.
 * Falls back to English when the language is not recognised.
 */
export function t(lang: Language | string, key: TranslationKey): string {
  const locale = lang in translations ? (lang as Language) : "en";
  return translations[locale][key];
}

/**
 * Return the full translation map for a given language.
 * Falls back to English when the language is not recognised.
 */
export function getTranslations(
  lang: Language | string
): Record<TranslationKey, string> {
  const locale = lang in translations ? (lang as Language) : "en";
  return { ...translations[locale] };
}
