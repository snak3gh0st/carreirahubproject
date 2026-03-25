"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { SupportChatWidget } from "./support-chat-widget";

interface SupportChatBubbleProps {
  userId: string;
  userName: string;
}

export function SupportChatBubble({ userId, userName }: SupportChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Chat Widget */}
      {isOpen && (
        <SupportChatWidget
          userId={userId}
          userName={userName}
          onClose={() => setIsOpen(false)}
        />
      )}

      {/* Floating Bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand-tangerina hover:bg-brand-tangerina/90 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        aria-label="Abrir suporte"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
