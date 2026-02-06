"use client";

import { useParams } from "next/navigation";
import { TicketChatView } from "@/components/support/ticket-chat-view";

export default function SupportTicketPage() {
  const params = useParams();
  const ticketId = params.id as string;

  return (
    <div className="p-8">
      <TicketChatView ticketId={ticketId} />
    </div>
  );
}
