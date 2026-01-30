# Carreira USA Hub - Gold & White Design System

## 🎨 Brand Overview

O Carreira AI Hub agora utiliza uma paleta **Dourada e Branca** inspirada no site oficial [carreirausa.com](https://carreirausa.com), representando **luxo, sucesso, excelência e conquista profissional**.

---

## 🌟 Color Palette

### Primary - Classic Gold (Ouro Clássico)
Representa sucesso, conquista, excelência e o valor premium dos serviços Carreira USA.

```css
--primary-50:  #FFFBEB  /* Lightest cream */
--primary-100: #FEF3C7  /* Light gold cream */
--primary-200: #FDE68A  /* Soft gold */
--primary-300: #FCD34D  /* Medium gold */
--primary-400: #FBBF24  /* Vibrant gold */
--primary-500: #D4AF37  /* ⭐ Main Brand Color - Classic Gold */
--primary-600: #B8941F  /* Deep gold */
--primary-700: #9C7A19  /* Darker gold */
--primary-800: #806114  /* Rich gold */
--primary-900: #64470F  /* Deepest gold */
```

**Uso:**
- **Buttons primários:** `bg-primary-500 hover:bg-primary-600`
- **Links e CTAs:** `text-primary-600`
- **Badges importantes:** `bg-primary-100 text-primary-700`
- **Bordas de destaque:** `border-primary-300`

---

### Secondary - Dark Contrast (Preto/Cinza Escuro)
Cria contraste elegante com o dourado, transmitindo profissionalismo e sofisticação.

```css
--secondary-dark: #1A1A1A  /* Rich black */
--secondary-gray: #2D2D2D  /* Dark gray */
```

**Uso:**
- **Sidebar background:** `bg-secondary-dark`
- **Headings importantes:** `text-secondary-dark`
- **Footer:** `bg-secondary-gray`

---

### Success - Modern Green
Verde vibrante para pagamentos recebidos, crescimento e resultados positivos.

```css
--success-50:  #F0FDF4
--success-100: #DCFCE7
--success-500: #22C55E  /* ✅ Bright success green */
--success-600: #16A34A
--success-700: #15803D
```

**Uso:**
- **Status badges "PAID":** `bg-success-100 text-success-700`
- **Positive metrics:** `text-success-600`
- **Success icons:** `text-success-500`

---

### Warning - Vibrant Orange
Laranja energético complementando o dourado, para alertas e ações pendentes.

```css
--warning-50:  #FFF7ED
--warning-100: #FFEDD5
--warning-500: #F97316  /* 🔶 Vibrant orange */
--warning-600: #EA580C
--warning-700: #C2410C
```

**Uso:**
- **Status "PENDING":** `bg-warning-100 text-warning-700`
- **Alert badges:** `bg-warning-500 text-white`
- **Important notices:** `border-warning-500`

---

### Error - Bold Red
Vermelho forte para faturas vencidas e situações críticas.

```css
--error-50:  #FEF2F2
--error-100: #FEE2E2
--error-500: #DC2626  /* ⛔ Critical red */
--error-600: #B91C1C
--error-700: #991B1B
```

**Uso:**
- **Status "OVERDUE":** `bg-error-100 text-error-700`
- **Negative values:** `text-error-600`
- **Destructive actions:** `bg-error-500 hover:bg-error-600`

---

### Neutral - Gray Scale
Cinzas otimizados para legibilidade e hierarquia visual.

```css
--gray-50:  #F9FAFB  /* Page background */
--gray-100: #F3F4F6  /* Card background */
--gray-200: #E5E7EB  /* Border subtle */
--gray-300: #D1D5DB  /* Border default */
--gray-400: #9CA3AF  /* Disabled text */
--gray-500: #6B7280  /* Muted text */
--gray-600: #4B5563  /* Secondary text */
--gray-700: #374151  /* Primary text */
--gray-800: #1F2937  /* Headings */
--gray-900: #111827  /* Emphasis */
```

---

## 📐 Component Usage Examples

### KPI Cards (StatCard)
```tsx
<div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
  <div className="flex items-center justify-between mb-2">
    <p className="text-xs font-display font-medium text-gray-500 uppercase tracking-wide">
      Total Revenue
    </p>
    <DollarSign className="h-5 w-5 text-primary-500" />
  </div>
  <p className="text-4xl font-bold text-gray-900 tabular-nums">
    $145,820
  </p>
  <div className="flex items-center gap-2 mt-2">
    <TrendingUp className="h-4 w-4 text-success-600" />
    <p className="text-sm font-semibold text-success-600">+12.5%</p>
  </div>
</div>
```

### Sidebar Navigation
```tsx
<aside className="w-60 bg-secondary-dark text-white flex flex-col">
  <div className="p-6">
    <h1 className="text-2xl font-display font-bold text-primary-400">
      Carreira U.S.A.
    </h1>
  </div>
  
  <nav className="flex-1 px-4 space-y-2">
    <a className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-600 text-white font-medium">
      <Home className="h-5 w-5" />
      Dashboard
    </a>
    <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-secondary-gray hover:text-white transition">
      <FileText className="h-5 w-5" />
      Invoices
    </a>
  </nav>
</aside>
```

### Status Badges
```tsx
{/* PAID - Green */}
<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-success-100 text-success-700">
  PAID
</span>

{/* PENDING - Orange */}
<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-warning-100 text-warning-700">
  PENDING
</span>

{/* OVERDUE - Red */}
<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-error-100 text-error-700">
  OVERDUE
</span>
```

### Primary Buttons
```tsx
{/* Primary Gold Button */}
<button className="px-6 py-3 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 focus:ring-4 focus:ring-primary-200 transition shadow-md hover:shadow-lg">
  Create Invoice
</button>

{/* Secondary Dark Button */}
<button className="px-6 py-3 bg-secondary-dark text-white font-semibold rounded-lg hover:bg-secondary-gray focus:ring-4 focus:ring-gray-300 transition">
  Export Data
</button>

{/* Outline Gold Button */}
<button className="px-6 py-3 border-2 border-primary-500 text-primary-600 font-semibold rounded-lg hover:bg-primary-50 transition">
  View Details
</button>
```

### Professional Tables
```tsx
<table className="min-w-full">
  <thead className="bg-gray-50 border-b border-gray-200">
    <tr>
      <th className="px-6 py-4 text-left text-xs font-display font-semibold text-gray-700 uppercase tracking-wider">
        Invoice #
      </th>
      {/* ... */}
    </tr>
  </thead>
  <tbody className="bg-white divide-y divide-gray-200">
    <tr className="hover:bg-primary-50 transition cursor-pointer">
      <td className="px-6 py-4 text-sm font-medium text-primary-600">
        INV-2024-001
      </td>
      {/* ... */}
    </tr>
  </tbody>
</table>
```

---

## ✨ Design Principles

1. **Gold as Accent, Not Overwhelming**
   - Use dourado em CTAs, ícones importantes e badges de sucesso
   - Evite preencher grandes áreas com dourado sólido

2. **White & Light Backgrounds**
   - Background principal: `bg-gray-50`
   - Cards: `bg-white` com sombras sutis
   - Sidebar: `bg-secondary-dark` (contraste)

3. **Clear Visual Hierarchy**
   - Headings: `text-gray-900` em Space Grotesk bold
   - Body text: `text-gray-700` em Inter
   - Muted text: `text-gray-500`

4. **Professional & Elegant**
   - Bordas arredondadas: `rounded-lg` (8px) ou `rounded-xl` (12px)
   - Sombras sutis: `shadow-sm hover:shadow-md`
   - Transições suaves: `transition-all duration-200`

5. **Accessibility First**
   - Contrast ratio ≥ 4.5:1 para textos
   - Focus states visíveis: `focus:ring-4 focus:ring-primary-200`
   - Hover states claros

---

## 🚀 Implementation Checklist

### Phase 1: Core System ✅
- [x] Update globals.css with gold color palette
- [ ] Update tailwind.config.ts
- [ ] Update StatCard component
- [ ] Update Sidebar component

### Phase 2: Components
- [ ] Update Badge component
- [ ] Update Button variants
- [ ] Update Table styling
- [ ] Update EmptyState component

### Phase 3: Pages
- [ ] Dashboard page
- [ ] Invoices List page
- [ ] Invoice Detail page
- [ ] Customers page
- [ ] Payments page
- [ ] Contracts page
- [ ] Insights page

---

## 🎯 Brand Consistency

**DO:**
- ✅ Use dourado para sucesso, conquistas, valor
- ✅ Combine com preto/cinza escuro para elegância
- ✅ Mantenha backgrounds claros (white/cream)
- ✅ Use ícones dourados em KPIs importantes

**DON'T:**
- ❌ Não use azul (cor antiga do sistema)
- ❌ Não exagere no dourado (use com moderação)
- ❌ Não use backgrounds dourados sólidos em grandes áreas
- ❌ Não misture com cores frias (cyan, blue, purple)

---

**Versão:** 1.0.0  
**Data:** Janeiro 2026  
**Autor:** Design Team - Carreira U.S.A.
