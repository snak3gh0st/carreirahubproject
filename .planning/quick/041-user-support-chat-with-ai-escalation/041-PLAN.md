---
phase: quick
plan: 041
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - lib/services/support-chat.service.ts
  - lib/prompts/support-chat.ts
  - app/api/support/chat/route.ts
  - app/api/support/tickets/route.ts
  - app/api/support/tickets/[id]/route.ts
  - app/api/support/tickets/[id]/messages/route.ts
  - app/dashboard/support/page.tsx
  - app/dashboard/support/[id]/page.tsx
  - components/support/support-chat-widget.tsx
  - components/support/support-chat-bubble.tsx
  - components/support/ticket-list.tsx
  - components/support/ticket-chat-view.tsx
  - app/dashboard/layout.tsx
autonomous: true

must_haves:
  truths:
    - "Logged-in user can open a support chat and send messages"
    - "AI responds to user messages with contextual help"
    - "User can request human help, triggering escalation"
    - "Sigma team sees all support tickets in /dashboard/support"
    - "Sigma team can reply to escalated tickets and user sees responses"
    - "Messages persist across page refresh"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "SupportTicket and SupportMessage models"
      contains: "model SupportTicket"
    - path: "lib/services/support-chat.service.ts"
      provides: "AI chat + escalation logic"
    - path: "app/dashboard/support/page.tsx"
      provides: "Sigma team support ticket list"
    - path: "components/support/support-chat-widget.tsx"
      provides: "User-facing chat widget"
  key_links:
    - from: "components/support/support-chat-widget.tsx"
      to: "/api/support/chat"
      via: "fetch POST for sending messages"
      pattern: "fetch.*api/support/chat"
    - from: "app/dashboard/support/[id]/page.tsx"
      to: "/api/support/tickets/[id]/messages"
      via: "fetch for reading and sending team replies"
      pattern: "fetch.*api/support/tickets"
---

<objective>
Build a complete user support chat system with AI-first responses and human escalation.

Purpose: Let users get instant AI help for common questions, with seamless handoff to Sigma team when needed. Reduces support load while ensuring no user is left without help.

Output: New SupportTicket/SupportMessage schema, support chat service, API routes, user chat widget, and team dashboard for managing tickets.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@prisma/schema.prisma
@lib/services/ai.service.ts
@lib/prompts/customer-service.ts
@app/api/chat/route.ts
@app/dashboard/layout.tsx
@components/ui/card.tsx
@components/ui/button.tsx
@components/ui/input.tsx
@components/ui/badge.tsx
@components/ui/empty-state.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Schema + Service + API routes</name>
  <files>
    prisma/schema.prisma
    lib/services/support-chat.service.ts
    lib/prompts/support-chat.ts
    app/api/support/chat/route.ts
    app/api/support/tickets/route.ts
    app/api/support/tickets/[id]/route.ts
    app/api/support/tickets/[id]/messages/route.ts
  </files>
  <action>
    1. Add new models to prisma/schema.prisma (do NOT modify existing models):

    ```
    model SupportTicket {
      id          String              @id @default(uuid())
      userId      String              // logged-in user who opened ticket
      subject     String?             // auto-generated from first message
      status      SupportTicketStatus @default(AI_HANDLING)
      priority    SupportPriority     @default(MEDIUM)
      assignedToId String?            // Sigma team member
      escalatedAt DateTime?
      resolvedAt  DateTime?
      createdAt   DateTime            @default(now())
      updatedAt   DateTime            @updatedAt
      user        User                @relation("UserSupportTickets", fields: [userId], references: [id])
      assignedTo  User?               @relation("AssignedSupportTickets", fields: [assignedToId], references: [id])
      messages    SupportMessage[]

      @@index([userId])
      @@index([status])
      @@index([assignedToId])
      @@map("support_tickets")
    }

    model SupportMessage {
      id        String              @id @default(uuid())
      ticketId  String
      role      SupportMessageRole
      content   String
      metadata  Json?
      createdAt DateTime            @default(now())
      ticket    SupportTicket       @relation(fields: [ticketId], references: [id])

      @@index([ticketId])
      @@map("support_messages")
    }

    enum SupportTicketStatus {
      AI_HANDLING
      ESCALATED
      IN_PROGRESS
      RESOLVED
      CLOSED
    }

    enum SupportPriority {
      LOW
      MEDIUM
      HIGH
      URGENT
    }

    enum SupportMessageRole {
      USER
      AI
      AGENT
    }
    ```

    Add relations to User model:
    - `supportTickets SupportTicket[] @relation("UserSupportTickets")`
    - `assignedTickets SupportTicket[] @relation("AssignedSupportTickets")`

    Run `npm run db:generate && npm run db:push`.

    2. Create `lib/prompts/support-chat.ts`:
    - System prompt for support AI in PT-BR
    - Context: "Voce e o assistente de suporte da Carreira U.S.A., ajudando alunos e clientes com duvidas sobre programas, processos, pagamentos, documentos, etc."
    - Include escalation detection keywords: "falar com alguem", "atendente", "humano", "reclamacao", "problema grave"
    - Instruct AI to be helpful, concise, and suggest escalation when it cannot resolve

    3. Create `lib/services/support-chat.service.ts`:
    - `createTicket(userId: string): Promise<SupportTicket>` - creates new ticket
    - `sendMessage(ticketId: string, userId: string, content: string): Promise<{userMsg, aiResponse}>` - saves user message, calls AI, saves AI response, checks for escalation triggers
    - `escalateTicket(ticketId: string, reason?: string): Promise<SupportTicket>` - sets status to ESCALATED, sets escalatedAt
    - `sendAgentReply(ticketId: string, agentId: string, content: string): Promise<SupportMessage>` - saves agent message, sets status to IN_PROGRESS and assignedToId if not set
    - `getTicketsByUser(userId: string): Promise<SupportTicket[]>` - user's tickets
    - `getTicketsForTeam(filters: {status?, assignedToId?}): Promise<SupportTicket[]>` - team view with latest message preview
    - `getTicketMessages(ticketId: string): Promise<SupportMessage[]>` - all messages for a ticket
    - `resolveTicket(ticketId: string): Promise<SupportTicket>` - sets status to RESOLVED
    - Use existing `aiService` pattern with circuit breaker. Call OpenAI with support prompt + conversation history. Parse shouldEscalate from AI response.

    4. Create API routes:

    `POST /api/support/chat` - User sends message:
    - Auth required (getServerSession)
    - Body: { ticketId?: string, message: string }
    - If no ticketId, create new ticket
    - Call supportChatService.sendMessage()
    - Return { ticketId, messages: [userMsg, aiResponse], status }

    `GET /api/support/tickets` - List tickets:
    - Auth required
    - If user role is ADMIN/SUPPORT/OPERATIONAL: return all tickets (team view), support query params: ?status=ESCALATED&assignedToId=xxx
    - Else: return only user's own tickets
    - Include last message and message count

    `GET /api/support/tickets/[id]` - Get ticket detail:
    - Auth required, verify ownership or team role
    - Return ticket with all messages

    `POST /api/support/tickets/[id]/messages` - Agent reply:
    - Auth required, must be ADMIN/SUPPORT/OPERATIONAL role
    - Body: { content: string }
    - Call supportChatService.sendAgentReply()

    `PATCH /api/support/tickets/[id]` - Update ticket status:
    - Auth required, must be ADMIN/SUPPORT/OPERATIONAL
    - Body: { status: "RESOLVED" | "CLOSED" | "IN_PROGRESS" }
  </action>
  <verify>
    - `npm run db:generate` succeeds
    - `npm run build` compiles without errors
    - `curl -s localhost:3000/api/support/tickets` returns 401 (auth required)
  </verify>
  <done>Schema created and pushed, service handles AI chat + escalation, all API routes respond correctly with auth checks</done>
</task>

<task type="auto">
  <name>Task 2: User chat widget + Team dashboard UI</name>
  <files>
    components/support/support-chat-widget.tsx
    components/support/support-chat-bubble.tsx
    components/support/ticket-list.tsx
    components/support/ticket-chat-view.tsx
    app/dashboard/support/page.tsx
    app/dashboard/support/[id]/page.tsx
    app/dashboard/layout.tsx
  </files>
  <action>
    1. Create `components/support/support-chat-bubble.tsx`:
    - Floating button (bottom-right corner, fixed position) with chat icon (MessageCircle from lucide-react)
    - Badge showing unresolved ticket count
    - onClick toggles the chat widget open/closed
    - Only renders for non-team roles (regular users/students)
    - z-index: 50

    2. Create `components/support/support-chat-widget.tsx`:
    - Slide-up panel (400px wide, 500px tall, bottom-right) when bubble is clicked
    - Header: "Suporte" with close button
    - If no active ticket: show "Como podemos ajudar?" with "Iniciar Conversa" button
    - If active ticket: show message list + input field
    - Messages styled differently by role: USER (right-aligned, blue), AI (left-aligned, gray), AGENT (left-aligned, green with "Equipe Sigma" label)
    - Input field with send button at bottom
    - Poll for new messages every 5 seconds when widget is open (useEffect with setInterval)
    - Show ticket status badge (AI_HANDLING, ESCALATED, etc.)
    - "Falar com um Humano" button that calls PATCH to escalate
    - All text in PT-BR

    3. Create `components/support/ticket-list.tsx`:
    - Table/card list of support tickets for team dashboard
    - Columns: Assunto, Usuario, Status, Prioridade, Ultima Mensagem, Data
    - Status badges with colors: AI_HANDLING (blue), ESCALATED (orange), IN_PROGRESS (yellow), RESOLVED (green), CLOSED (gray)
    - Click row to navigate to /dashboard/support/[id]
    - Filter tabs: Todos, Escalados, Em Andamento, Resolvidos
    - Poll every 10 seconds for new tickets

    4. Create `components/support/ticket-chat-view.tsx`:
    - Full chat view for team members responding to a ticket
    - Show all messages with role indicators
    - Reply input at bottom
    - Actions bar: "Resolver Ticket" button, priority selector
    - User info sidebar (name, email)

    5. Create `app/dashboard/support/page.tsx`:
    - Page title: "Suporte"
    - Render TicketList component
    - Fetch from /api/support/tickets

    6. Create `app/dashboard/support/[id]/page.tsx`:
    - Fetch ticket from /api/support/tickets/[id]
    - Render TicketChatView component
    - Poll for new messages every 5 seconds

    7. Update `app/dashboard/layout.tsx`:
    - Add "Suporte" link to sidebar navigation (use MessageCircle icon from lucide-react)
    - Only show for ADMIN, SUPPORT, OPERATIONAL roles
    - Add SupportChatBubble component for non-team roles (rendered outside sidebar, floating)

    Use existing design system components (Card, Button, Badge, Input) and Tailwind classes matching the existing dashboard style. Follow existing page patterns from other dashboard pages.
  </action>
  <verify>
    - `npm run build` compiles without errors
    - Navigate to /dashboard/support as ADMIN user - see ticket list page
    - Chat bubble appears for non-team users on dashboard pages
  </verify>
  <done>
    - Users see floating chat bubble on dashboard, can open chat, send messages, receive AI responses, and escalate to human
    - Team members see /dashboard/support with ticket list, can click into tickets, reply, and resolve
    - Messages poll for updates (5s for chat, 10s for list)
    - All UI text is in PT-BR
  </done>
</task>

</tasks>

<verification>
1. Full flow test:
   - Log in as regular user -> see chat bubble -> click -> start conversation -> send message -> receive AI response
   - Click "Falar com um Humano" -> ticket status changes to ESCALATED
   - Log in as ADMIN -> go to /dashboard/support -> see escalated ticket -> click into it -> send reply
   - Switch back to regular user -> see agent reply in chat widget
   - As ADMIN -> click "Resolver Ticket" -> status changes to RESOLVED
2. `npm run build` passes
3. No TypeScript errors
</verification>

<success_criteria>
- Users can chat with AI support and receive helpful responses in PT-BR
- Escalation triggers (manual button or AI-detected) move ticket to ESCALATED status
- Sigma team can view, respond to, and resolve support tickets from /dashboard/support
- Messages persist and are visible on refresh
- Polling keeps conversations updated without WebSockets
</success_criteria>

<output>
After completion, create `.planning/quick/041-user-support-chat-with-ai-escalation/041-SUMMARY.md`
</output>
