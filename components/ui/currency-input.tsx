import React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils/cn";

/**
 * CurrencyInput Component
 * 
 * Specialized input for currency values with automatic formatting:
 * - $ prefix (non-editable)
 * - Comma separators for thousands (1,234.56)
 * - Only allows numeric input and one decimal point
 * - Tabular-nums for proper alignment
 */

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
}

/**
 * Format a number string with commas
 * Example: "1234.56" → "1,234.56"
 */
function formatCurrency(value: string): string {
  // Remove any existing commas
  const cleanValue = value.replace(/,/g, '');
  
  // Split into integer and decimal parts
  const parts = cleanValue.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Add commas to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Rejoin with decimal if present
  return decimalPart !== undefined 
    ? `${formattedInteger}.${decimalPart}`
    : formattedInteger;
}

/**
 * Parse formatted currency back to plain number string
 * Example: "1,234.56" → "1234.56"
 */
function parseCurrency(value: string): string {
  return value.replace(/,/g, '');
}

/**
 * Validate that input is a valid number
 */
function isValidCurrencyInput(value: string): boolean {
  // Allow empty string
  if (value === '') return true;
  
  // Allow digits, one decimal point, and one negative sign at start
  const regex = /^-?\d*\.?\d*$/;
  return regex.test(value);
}

export function CurrencyInput({
  label,
  value,
  onChange,
  error,
  helperText,
  className,
  ...props
}: CurrencyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Parse out the formatting
    const cleanValue = parseCurrency(rawValue);
    
    // Validate input
    if (isValidCurrencyInput(cleanValue)) {
      onChange(cleanValue);
    }
  };

  // Format the display value
  const displayValue = value ? formatCurrency(value) : '';

  return (
    <div className="relative w-full">
      <Input
        type="text"
        inputMode="decimal"
        label={label}
        value={displayValue}
        onChange={handleChange}
        state={error ? "error" : "default"}
        errorText={error}
        helperText={helperText}
        className={cn(
          "pl-7 tabular-nums",
          className
        )}
        {...props}
      />
      {/* Dollar sign prefix */}
      <div className="absolute left-3 top-[34px] text-gray-500 pointer-events-none">
        $
      </div>
    </div>
  );
}
