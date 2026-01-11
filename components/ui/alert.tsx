import React from "react";

export function Alert({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 rounded-lg border ${className}`}>{children}</div>;
}

export function AlertDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-sm ${className}`}>{children}</div>;
}
