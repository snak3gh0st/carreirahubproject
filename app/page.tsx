import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Carreira AI Hub</h1>
              <p className="text-sm text-gray-600">Middleware Proprietário</p>
            </div>
            <nav className="flex gap-4">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
              >
                Dashboard
              </Link>
              <Link
                href="/api/docs"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
              >
                API Docs
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            Bem-vindo ao Carreira AI Hub
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Sistema centralizado de gerenciamento de leads, vendas e operações
            para Carreira U.S.A
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* SDR & Leads Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">SDR & Leads</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Qualificação automática de leads com IA e gerenciamento do pipeline
              de vendas
            </p>
            <Link
              href="/dashboard/leads"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
            >
              Ver Leads
            </Link>
          </div>

          {/* Customer Service Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Customer Service AI
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              Chatbot inteligente para atendimento automatizado e qualificação de
              leads
            </p>
            <Link
              href="/dashboard/conversations"
              className="inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition font-medium"
            >
              Ver Conversas
            </Link>
          </div>

          {/* Vendas & Financeiro Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Vendas & Financeiro
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              Gerenciamento de deals, invoices e contratos com integração
              automática
            </p>
            <Link
              href="/dashboard/deals"
              className="inline-block px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition font-medium"
            >
              Ver Deals
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">
            Ações Rápidas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition text-center font-medium"
            >
              Dashboard Principal
            </Link>
            <Link
              href="/dashboard/leads"
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-center font-medium"
            >
              Gerenciar Leads
            </Link>
            <Link
              href="/dashboard/invoices"
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-center font-medium"
            >
              Ver Invoices
            </Link>
            <Link
              href="/dashboard/customers"
              className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition text-center font-medium"
            >
              Ver Customers
            </Link>
          </div>
        </div>

        {/* Status Section */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-8">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">
            Status do Sistema
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">Banco de Dados</p>
                <p className="text-sm text-gray-600">Conectado</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">API Routes</p>
                <p className="text-sm text-gray-600">Operacional</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">Integrações</p>
                <p className="text-sm text-gray-600">Configurar APIs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
