---
type: quick
task: 042-ver-tickets-abertos-e-deletar
wave: 1
autonomous: true
files_modified:
  - components/support/support-chat-widget.tsx
---

<objective>
Add ability for users to view all their open tickets and delete/close individual tickets from the chat widget.

**Purpose:** Give users control over their support history and ability to manage multiple tickets without relying on team members to close tickets.

**Output:** Enhanced chat widget with ticket list view, ticket switching, and self-service ticket closure.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/support/support-chat-widget.tsx
@app/api/support/tickets/route.ts
@app/api/support/tickets/[id]/route.ts
@lib/services/support-chat.service.ts
@components/ui/badge.tsx
</context>

<tasks>

<task type="auto">
  <name>Add ticket list view with delete functionality to chat widget</name>
  <files>components/support/support-chat-widget.tsx</files>
  <action>
Add a ticket list view mode to the chat widget with the following features:

**1. View Mode State:**
- Add state: `view: "welcome" | "chat" | "tickets"` (default: "welcome")
- Show tickets view when user clicks a "Meus Tickets" button in header or welcome screen

**2. Fetch All User Tickets:**
- On mount, fetch ALL user tickets (not just active): `GET /api/support/tickets`
- Store in state: `allTickets: Array<{id, subject, status, createdAt, _count, messages[0]}>`
- Show open tickets first (AI_HANDLING, ESCALATED, IN_PROGRESS), then resolved/closed

**3. Tickets List UI (view="tickets"):**
- Show list of tickets with:
  - Subject (truncated if needed)
  - Status badge (using existing STATUS_LABELS)
  - Message count from `_count.messages`
  - Last message preview from `messages[0].content` (truncated to 50 chars)
  - Timestamp: `createdAt` formatted as relative time (hoje, ontem, X dias atrás)
  - Click ticket card → switch to that ticket's chat (view="chat", load messages)
  - Delete button (Trash2 icon) → PATCH /api/support/tickets/[id] with status="CLOSED"

**4. Ticket List Layout:**
```tsx
<div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
  {openTickets.map(ticket => (
    <div className="bg-gray-50 hover:bg-gray-100 p-3 rounded-lg cursor-pointer relative">
      <div onClick={() => switchToTicket(ticket.id)}>
        <div className="flex items-start justify-between mb-1">
          <span className="font-medium text-sm">{ticket.subject || "Sem assunto"}</span>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
        <p className="text-xs text-gray-500 mb-1">{lastMessage preview}</p>
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>{_count.messages} mensagens</span>
          <span>{relative time}</span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); deleteTicket(ticket.id); }}
        className="absolute top-2 right-2 text-gray-400 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  ))}
  {closedTickets.length > 0 && (
    <div className="pt-2 border-t">
      <h4 className="text-xs font-semibold text-gray-400 mb-2">Encerrados</h4>
      {closedTickets.map(ticket => /* same card but grayed out */)}
    </div>
  )}
</div>
```

**5. Navigation Between Views:**
- Header: Add "Meus Tickets" button (List icon) → shows tickets view
- Tickets view: Add "Voltar" button or show current ticket in header when in chat
- Chat view: Keep existing "Nova Conversa" (Plus icon) button

**6. Delete Ticket Function:**
```tsx
const deleteTicket = async (ticketId: string) => {
  try {
    await fetch(`/api/support/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" })
    });
    // Refresh ticket list
    loadAllTickets();
    // If deleting current ticket, go back to tickets view
    if (ticketId === currentTicketId) {
      setView("tickets");
      setTicketId(null);
      setMessages([]);
    }
  } catch (error) {
    console.error("Failed to close ticket:", error);
    setError("Erro ao fechar ticket");
  }
};
```

**7. Switch to Ticket Function:**
```tsx
const switchToTicket = async (ticketId: string) => {
  setView("chat");
  setTicketId(ticketId);
  const ticket = allTickets.find(t => t.id === ticketId);
  if (ticket) setStatus(ticket.status);
  // Load messages for this ticket
  const res = await fetch(`/api/support/tickets/${ticketId}/messages`);
  const data = await res.json();
  if (data.messages) setMessages(data.messages);
};
```

**8. Update Welcome Screen:**
- Add "Meus Tickets" button alongside "Iniciar Conversa" if user has existing tickets

**9. Import Icons:**
- Add: `import { List, Trash2 } from "lucide-react";`

**Why this approach:**
- Reuses existing API endpoints (no backend changes needed)
- Users can self-service close tickets (reduces support load)
- Multi-ticket management in single widget (no navigation away)
- Maintains existing chat functionality while adding ticket management
- Visual distinction between open/closed tickets guides user behavior
  </action>
  <verify>
Test the enhanced widget:
1. Open chat widget with existing tickets
2. Click "Meus Tickets" → should show list of all tickets
3. Click a ticket card → should load that ticket's conversation
4. Click delete (trash icon) on a ticket → ticket should close and disappear from open list
5. Create new conversation → should create new ticket
6. Switch between tickets → messages should load correctly
7. Close current ticket → should return to tickets view
8. Verify CLOSED tickets show in "Encerrados" section at bottom
  </verify>
  <done>
- Users can view all their tickets (open and closed) in a list view
- Users can switch between tickets by clicking ticket cards
- Users can close/delete any of their tickets via trash icon
- Closed tickets appear in separate "Encerrados" section
- Navigation between welcome/tickets/chat views works smoothly
- Current implementation (single active ticket) remains backward compatible
- All UI text in PT-BR
  </done>
</task>

</tasks>

<verification>
**Manual Testing:**
1. Open browser dev console, log in as user
2. Open support chat widget
3. Send message to create first ticket
4. Close widget, reopen → should show existing conversation
5. Click "Meus Tickets" → should show list with 1 ticket
6. Click "Nova Conversa" → should create second ticket
7. Click "Meus Tickets" → should show 2 tickets
8. Click first ticket card → should load first conversation
9. Click delete on second ticket → should close it and move to "Encerrados"
10. Verify UI is responsive and icons are visible
11. Test with 0 tickets (welcome), 1 ticket, and 5+ tickets (scrolling)

**Expected Behavior:**
- GET /api/support/tickets returns user's tickets
- PATCH /api/support/tickets/[id] with status="CLOSED" closes ticket
- Ticket list shows status badges with correct colors
- Delete button only appears on hover or always visible (design choice)
- Clicking trash prevents ticket card click (event.stopPropagation)
- Deleted ticket removed from view or moved to closed section
</verification>

<success_criteria>
- Users can see all their tickets in a list view
- Users can switch between tickets to view different conversations
- Users can close/delete tickets themselves (no agent needed)
- API returns 200 for GET tickets and PATCH ticket status
- Widget UI remains clean and usable with multiple tickets
- No console errors during ticket operations
- Changes are localized to support-chat-widget.tsx (no API changes)
</success_criteria>

<output>
After completion, create `.planning/quick/042-ver-tickets-abertos-e-deletar/042-SUMMARY.md`
</output>
