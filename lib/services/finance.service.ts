/**
 * Finance Service
 * 
 * Responsabilidade: Motor de cálculo financeiro proprietário
 * Substitui cálculos manuais de planilhas com lógica determinística
 */
export class FinanceService {
  /**
   * Calcular parcelas com juros
   * 
   * @param amount Valor total
   * @param numberOfInstallments Número de parcelas
   * @param interestRate Taxa de juros mensal (em decimal, ex: 0.02 = 2%)
   * @returns Array de parcelas com valor e data de vencimento
   */
  calculateInstallments(
    amount: number,
    numberOfInstallments: number,
    interestRate: number = 0
  ): Array<{
    installmentNumber: number;
    amount: number;
    principal: number;
    interest: number;
    dueDate: Date;
  }> {
    if (numberOfInstallments <= 0) {
      throw new Error("Number of installments must be greater than 0");
    }

    if (interestRate < 0 || interestRate > 1) {
      throw new Error("Interest rate must be between 0 and 1");
    }

    const installments: Array<{
      installmentNumber: number;
      amount: number;
      principal: number;
      interest: number;
      dueDate: Date;
    }> = [];

    if (interestRate === 0) {
      // Sem juros: parcelas iguais
      const installmentAmount = amount / numberOfInstallments;
      const today = new Date();

      for (let i = 1; i <= numberOfInstallments; i++) {
        const dueDate = new Date(today);
        dueDate.setMonth(dueDate.getMonth() + i);

        installments.push({
          installmentNumber: i,
          amount: installmentAmount,
          principal: installmentAmount,
          interest: 0,
          dueDate,
        });
      }
    } else {
      // Com juros: Sistema de Amortização Constante (SAC)
      const principalPerInstallment = amount / numberOfInstallments;
      const today = new Date();

      for (let i = 1; i <= numberOfInstallments; i++) {
        const remainingPrincipal = amount - (i - 1) * principalPerInstallment;
        const interest = remainingPrincipal * interestRate;
        const installmentAmount = principalPerInstallment + interest;

        const dueDate = new Date(today);
        dueDate.setMonth(dueDate.getMonth() + i);

        installments.push({
          installmentNumber: i,
          amount: installmentAmount,
          principal: principalPerInstallment,
          interest,
          dueDate,
        });
      }
    }

    return installments;
  }

  /**
   * Calcular multa por atraso
   * 
   * @param amount Valor da parcela
   * @param daysOverdue Dias de atraso
   * @param feeRate Taxa de multa (em decimal, ex: 0.02 = 2%)
   * @returns Valor da multa
   */
  calculateLateFee(
    amount: number,
    daysOverdue: number,
    feeRate: number = 0.02
  ): number {
    if (daysOverdue <= 0) {
      return 0;
    }

    if (feeRate < 0 || feeRate > 1) {
      throw new Error("Fee rate must be between 0 and 1");
    }

    return amount * feeRate;
  }

  /**
   * Calcular juros de mora
   * 
   * @param principal Valor principal
   * @param rate Taxa de juros mensal (em decimal)
   * @param days Número de dias
   * @returns Valor dos juros
   */
  calculateInterest(
    principal: number,
    rate: number,
    days: number
  ): number {
    if (days <= 0) {
      return 0;
    }

    if (rate < 0 || rate > 1) {
      throw new Error("Interest rate must be between 0 and 1");
    }

    // Juros simples: (principal * taxa * dias) / 30
    const monthlyRate = rate;
    const dailyRate = monthlyRate / 30;
    return principal * dailyRate * days;
  }

  /**
   * Gerar número de invoice sequencial
   * 
   * @param prefix Prefixo (ex: "INV")
   * @param year Ano (opcional, usa ano atual se não fornecido)
   * @param lastNumber Último número usado (para continuidade)
   * @returns Número de invoice formatado (ex: "INV-2024-0001")
   */
  generateInvoiceNumber(
    prefix: string = "INV",
    year?: number,
    lastNumber: number = 0
  ): string {
    const currentYear = year || new Date().getFullYear();
    const nextNumber = lastNumber + 1;
    const paddedNumber = nextNumber.toString().padStart(4, "0");
    return `${prefix}-${currentYear}-${paddedNumber}`;
  }

  /**
   * Calcular valor total com juros e multa
   * 
   * @param principal Valor principal
   * @param daysOverdue Dias de atraso
   * @param interestRate Taxa de juros mensal
   * @param lateFeeRate Taxa de multa
   * @returns Objeto com breakdown de valores
   */
  calculateTotalWithFees(
    principal: number,
    daysOverdue: number,
    interestRate: number = 0.01,
    lateFeeRate: number = 0.02
  ): {
    principal: number;
    interest: number;
    lateFee: number;
    total: number;
  } {
    const interest = this.calculateInterest(principal, interestRate, daysOverdue);
    const lateFee = this.calculateLateFee(principal, daysOverdue, lateFeeRate);
    const total = principal + interest + lateFee;

    return {
      principal,
      interest,
      lateFee,
      total,
    };
  }

  /**
   * Validar se data de vencimento está vencida
   */
  isOverdue(dueDate: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }

  /**
   * Calcular dias de atraso
   */
  calculateDaysOverdue(dueDate: Date): number {
    if (!this.isOverdue(dueDate)) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }
}

export const financeService = new FinanceService();

