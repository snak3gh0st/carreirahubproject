"use client";

import { HeadphonesIcon } from "lucide-react";
import { TicketList } from "@/components/support/ticket-list";

export default function SupportPage() {
  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-brand-creme rounded-lg flex items-center justify-center">
          <HeadphonesIcon className="h-5 w-5 text-brand-verde" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">
            Suporte
          </h1>
          <p className="text-sm text-gray-500">
            Gerencie tickets de suporte dos usuarios
          </p>
        </div>
      </div>

      <TicketList />
    </div>
  );
}
