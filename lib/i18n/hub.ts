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
    "dashboard.partial": "Partial",
    "dashboard.viewReceipt": "View Receipt",
    "dashboard.noInvoices": "No invoices found",
    "dashboard.noInvoicesYet": "No invoices yet.",
    "dashboard.overview": "Here is an overview of your invoices and payments.",
    "dashboard.total": "total",
    "dashboard.left": "left",
    "dashboard.myProgress": "My Progress",
    "dashboard.documents": "Documents",
    "dashboard.forms": "Forms",
    "dashboard.englishTest": "English Test",
    "dashboard.englishLevel": "English Level",
    "dashboard.notTakenYet": "Not taken yet",
    "dashboard.retake": "Retake",
    "dashboard.takeTest": "Take Test",
    "dashboard.allCompleted": "All completed",
    "dashboard.fillNow": "Fill Now",
    "dashboard.view": "View",

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
    "login.loginTitle": "Client Portal",
    "login.loginSubtitle": "Sign in to your account",
    "login.email": "Email",
    "login.password": "Password",
    "login.signIn": "Sign In",
    "login.signingIn": "Signing in...",
    "login.forgotPassword": "Forgot password?",
    "login.loginError": "Invalid email or password",
    "login.accountLocked": "Too many attempts. Please try again later.",
    "login.tempExpired": "Your temporary password has expired. Please reset your password.",
    "login.accountLockedReset": "Account locked. Please try again later or reset your password.",
    "login.securePortal": "Carreira U.S.A. · Secure Client Portal",

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
    "settings.name": "Name",
    "settings.email": "Email",
    "settings.languageUpdated": "Language updated.",
    "settings.languageUpdateFailed": "Failed to update language.",
    "settings.passwordMinLength": "Password must be at least 8 characters.",
    "settings.passwordsNoMatch": "Passwords don't match.",
    "settings.passwordChangeFailed": "Failed to change password.",
    "settings.passwordChangeSuccess": "Password updated!",
    "settings.updating": "Updating...",
    "settings.updatePassword": "Update Password",

    // Status page
    "status.yourProgress": "Your Progress",
    "status.trackStatus": "Track the status of your process with Carreira U.S.A.",
    "status.overallProgress": "Overall Progress",
    "status.current": "Current",
    "status.contract": "Contract",
    "status.signed": "Signed",
    "status.pendingSignature": "Pending signature",
    "status.payment": "Payment",
    "status.invoicesPaid": "invoices paid",
    "status.awaitingFirstPayment": "Awaiting first payment",
    "status.onboarding": "Onboarding",
    "status.allFormsCompleted": "All forms completed",
    "status.forms": "forms",
    "status.englishTest": "English Test",
    "status.notTakenYet": "Not taken yet",
    "status.inProgress": "In Progress",
    "status.processActive": "Your process is active",
    "status.completePreviousSteps": "Complete previous steps",

    // Documents page
    "documents.title": "Documents",
    "documents.subtitle": "Download your signed contracts and payment receipts.",
    "documents.noDocuments": "No documents available yet.",
    "documents.signedContracts": "Signed Contracts",
    "documents.paymentReceipts": "Payment Receipts",
    "documents.downloadPdf": "Download PDF",
    "documents.contactSupport": "Contact support",
    "documents.signedOn": "Signed",
    "documents.paidOn": "Paid",
    "documents.invoice": "Invoice",

    // Forms page
    "forms.title": "Forms",
    "forms.subtitle": "Complete your onboarding forms below.",
    "forms.noForms": "No forms assigned yet.",
    "forms.assigned": "Assigned",
    "forms.submitted": "Submitted",
    "forms.fillNow": "Fill Now",
    "forms.statusPending": "Pending",
    "forms.statusInProgress": "In Progress",
    "forms.statusCompleted": "Completed",

    // Form fill page
    "forms.submitForm": "Submit Form",
    "forms.submitting": "Submitting...",
    "forms.formSubmitted": "This form has been submitted.",
    "forms.formNotFound": "Form not found.",
    "forms.failedToLoad": "Failed to load form.",
    "forms.uploadFailed": "Upload failed.",
    "forms.fileUploaded": "File uploaded",
    "forms.uploading": "Uploading...",
    "forms.select": "Select...",

    // Test page
    "test.title": "English Assessment",
    "test.questionsInfo": "25 questions · ~10-15 minutes",
    "test.description": "This test evaluates your English proficiency level. Answer each question to the best of your ability. Your level will be determined based on your results.",
    "test.startTest": "Start Test",
    "test.sectionOf": "of",
    "test.answered": "answered",
    "test.sectionBasic": "Basic English",
    "test.sectionElementary": "Elementary English",
    "test.sectionIntermediate": "Intermediate English",
    "test.sectionUpperIntermediate": "Upper-Intermediate English",
    "test.sectionAdvanced": "Advanced English",
    "test.previous": "Previous",
    "test.nextSection": "Next Section",
    "test.submitTest": "Submit Test",
    "test.submitting": "Submitting...",
    "test.failedToLoad": "Failed to load test.",
    "test.failedToSubmit": "Failed to submit.",

    // Test result page
    "testResult.yourLevel": "Your English Level",
    "testResult.taken": "Taken",
    "testResult.min": "min",
    "testResult.cefrLevel": "CEFR Level",
    "testResult.score": "Score",
    "testResult.sectionBreakdown": "Section Breakdown",
    "testResult.section": "Section",
    "testResult.backToDashboard": "Back to Dashboard",
    "testResult.retakeTest": "Retake Test",

    // Receipt page
    "receipt.paymentReceipt": "Payment Receipt",
    "receipt.backToDocuments": "Back to Documents",
    "receipt.printSavePdf": "Print / Save PDF",
    "receipt.billTo": "Bill To",
    "receipt.invoiceDetails": "Invoice Details",
    "receipt.number": "Number",
    "receipt.datePaid": "Date Paid",
    "receipt.method": "Method",
    "receipt.description": "Description",
    "receipt.amount": "Amount",
    "receipt.service": "Service",
    "receipt.subtotal": "Subtotal",
    "receipt.amountPaid": "Amount Paid",
    "receipt.footer": "Carreira U.S.A. · Payment processed by QuickBooks Payments",
    "receipt.thankYou": "Thank you for your payment.",

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
    "dashboard.partial": "Parcial",
    "dashboard.viewReceipt": "Ver Recibo",
    "dashboard.noInvoices": "Nenhuma fatura encontrada",
    "dashboard.noInvoicesYet": "Nenhuma fatura ainda.",
    "dashboard.overview": "Aqui está um resumo das suas faturas e pagamentos.",
    "dashboard.total": "total",
    "dashboard.left": "restante",
    "dashboard.myProgress": "Meu Progresso",
    "dashboard.documents": "Documentos",
    "dashboard.forms": "Formulários",
    "dashboard.englishTest": "Teste de Inglês",
    "dashboard.englishLevel": "Nível de Inglês",
    "dashboard.notTakenYet": "Ainda não realizado",
    "dashboard.retake": "Refazer",
    "dashboard.takeTest": "Fazer Teste",
    "dashboard.allCompleted": "Todos concluídos",
    "dashboard.fillNow": "Preencher Agora",
    "dashboard.view": "Ver",

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
    "login.loginTitle": "Portal do Cliente",
    "login.loginSubtitle": "Entre na sua conta",
    "login.email": "E-mail",
    "login.password": "Senha",
    "login.signIn": "Entrar",
    "login.signingIn": "Entrando...",
    "login.forgotPassword": "Esqueceu a senha?",
    "login.loginError": "E-mail ou senha inválidos",
    "login.accountLocked": "Muitas tentativas. Tente novamente mais tarde.",
    "login.tempExpired": "Sua senha temporária expirou. Redefina sua senha.",
    "login.accountLockedReset": "Conta bloqueada. Tente novamente mais tarde ou redefina sua senha.",
    "login.securePortal": "Carreira U.S.A. · Portal Seguro do Cliente",

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
    "settings.name": "Nome",
    "settings.email": "E-mail",
    "settings.languageUpdated": "Idioma atualizado.",
    "settings.languageUpdateFailed": "Falha ao atualizar o idioma.",
    "settings.passwordMinLength": "A senha deve ter pelo menos 8 caracteres.",
    "settings.passwordsNoMatch": "As senhas não coincidem.",
    "settings.passwordChangeFailed": "Falha ao alterar a senha.",
    "settings.passwordChangeSuccess": "Senha atualizada!",
    "settings.updating": "Atualizando...",
    "settings.updatePassword": "Atualizar Senha",

    // Status page
    "status.yourProgress": "Seu Progresso",
    "status.trackStatus": "Acompanhe o status do seu processo com a Carreira U.S.A.",
    "status.overallProgress": "Progresso Geral",
    "status.current": "Atual",
    "status.contract": "Contrato",
    "status.signed": "Assinado",
    "status.pendingSignature": "Aguardando assinatura",
    "status.payment": "Pagamento",
    "status.invoicesPaid": "faturas pagas",
    "status.awaitingFirstPayment": "Aguardando primeiro pagamento",
    "status.onboarding": "Integração",
    "status.allFormsCompleted": "Todos os formulários concluídos",
    "status.forms": "formulários",
    "status.englishTest": "Teste de Inglês",
    "status.notTakenYet": "Ainda não realizado",
    "status.inProgress": "Em Andamento",
    "status.processActive": "Seu processo está ativo",
    "status.completePreviousSteps": "Complete as etapas anteriores",

    // Documents page
    "documents.title": "Documentos",
    "documents.subtitle": "Baixe seus contratos assinados e recibos de pagamento.",
    "documents.noDocuments": "Nenhum documento disponível ainda.",
    "documents.signedContracts": "Contratos Assinados",
    "documents.paymentReceipts": "Recibos de Pagamento",
    "documents.downloadPdf": "Baixar PDF",
    "documents.contactSupport": "Contate o suporte",
    "documents.signedOn": "Assinado",
    "documents.paidOn": "Pago",
    "documents.invoice": "Fatura",

    // Forms page
    "forms.title": "Formulários",
    "forms.subtitle": "Complete seus formulários de integração abaixo.",
    "forms.noForms": "Nenhum formulário atribuído ainda.",
    "forms.assigned": "Atribuído",
    "forms.submitted": "Enviado",
    "forms.fillNow": "Preencher Agora",
    "forms.statusPending": "Pendente",
    "forms.statusInProgress": "Em Andamento",
    "forms.statusCompleted": "Concluído",

    // Form fill page
    "forms.submitForm": "Enviar Formulário",
    "forms.submitting": "Enviando...",
    "forms.formSubmitted": "Este formulário foi enviado.",
    "forms.formNotFound": "Formulário não encontrado.",
    "forms.failedToLoad": "Falha ao carregar o formulário.",
    "forms.uploadFailed": "Falha no upload.",
    "forms.fileUploaded": "Arquivo enviado",
    "forms.uploading": "Enviando...",
    "forms.select": "Selecione...",

    // Test page
    "test.title": "Avaliação de Inglês",
    "test.questionsInfo": "25 perguntas · ~10-15 minutos",
    "test.description": "Este teste avalia seu nível de proficiência em inglês. Responda cada questão da melhor forma possível. Seu nível será determinado com base nos resultados.",
    "test.startTest": "Iniciar Teste",
    "test.sectionOf": "de",
    "test.answered": "respondidas",
    "test.sectionBasic": "Inglês Básico",
    "test.sectionElementary": "Inglês Elementar",
    "test.sectionIntermediate": "Inglês Intermediário",
    "test.sectionUpperIntermediate": "Inglês Intermediário-Avançado",
    "test.sectionAdvanced": "Inglês Avançado",
    "test.previous": "Anterior",
    "test.nextSection": "Próxima Seção",
    "test.submitTest": "Enviar Teste",
    "test.submitting": "Enviando...",
    "test.failedToLoad": "Falha ao carregar o teste.",
    "test.failedToSubmit": "Falha ao enviar.",

    // Test result page
    "testResult.yourLevel": "Seu Nível de Inglês",
    "testResult.taken": "Realizado",
    "testResult.min": "min",
    "testResult.cefrLevel": "Nível CEFR",
    "testResult.score": "Pontuação",
    "testResult.sectionBreakdown": "Detalhamento por Seção",
    "testResult.section": "Seção",
    "testResult.backToDashboard": "Voltar ao Painel",
    "testResult.retakeTest": "Refazer Teste",

    // Receipt page
    "receipt.paymentReceipt": "Recibo de Pagamento",
    "receipt.backToDocuments": "Voltar aos Documentos",
    "receipt.printSavePdf": "Imprimir / Salvar PDF",
    "receipt.billTo": "Cobrar de",
    "receipt.invoiceDetails": "Detalhes da Fatura",
    "receipt.number": "Número",
    "receipt.datePaid": "Data do Pagamento",
    "receipt.method": "Método",
    "receipt.description": "Descrição",
    "receipt.amount": "Valor",
    "receipt.service": "Serviço",
    "receipt.subtotal": "Subtotal",
    "receipt.amountPaid": "Valor Pago",
    "receipt.footer": "Carreira U.S.A. · Pagamento processado pelo QuickBooks Payments",
    "receipt.thankYou": "Obrigado pelo seu pagamento.",

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
