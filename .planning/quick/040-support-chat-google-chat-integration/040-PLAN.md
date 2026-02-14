---
phase: quick
plan: 040
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - lib/services/google-chat.service.ts
  - app/api/support/route.ts
  - app/api/support/messages/route.ts
  - app/dashboard/suporte/page.tsx
  - components/dashboard/support-chat.tsx
autonomous: true
must_haves:
  truths:
    - "User can open support chat page in dashboard"
    - "User can type and send a text message"
    - "Message is stored in database with user info"
    - "Message is forwarded to Google Chat space via webhook"
    - "User can see their previous messages"
  artifacts:
    - path: "prisma/schema.prisma"
      contains: "model SupportMessage"
    - path: "lib/services/google-chat.service.ts"
      provides: "Google Chat webhook integration"
    - path: "app/api/support/messages/route.ts"
      exports: ["GET", "POST"]
    - path: "app/dashboard/suporte/page.tsx"
      provides: "Support chat page"
  key_links:
    - from: "components/dashboard/support-chat.tsx"
      to: "/api/support/messages"
      via: "fetch POST/GET"
      pattern: "fetch.*api/support/messages"
    - from: "app/api/support/messages/route.ts"
      to: "lib/services/google-chat.service.ts"
      via: "sendMessage call"
      pattern: "googleChatService.*send"
---

<objective>
Create a support chat system where Hub users can send messages that are stored in the database and forwarded to the Sigma team's Google Chat space via incoming webhook.

Purpose: Enable real-time support communication between Hub users and the Sigma team without requiring external tools.
Output: Working support chat page at /dashboard/suporte with Google Chat webhook forwarding.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@prisma/schema.prisma
@app/dashboard/layout.tsx
@components/dashboard/professional-sidebar.tsx
@lib/auth.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Database model + Google Chat service + API routes</name>
  <files>
    prisma/schema.prisma
    lib/services/google-chat.service.ts
    app/api/support/messages/route.ts
  </files>
  <action>
1. Add SupportMessage model to prisma/schema.prisma:
   - id (String, uuid, @id, @default(uuid()))
   - userId (String, relation to User)
   - userName (String) - denormalized for Google Chat display
   - userEmail (String) - denormalized
   - message (String, @db.Text)
   - sentToGoogleChat (Boolean, default false)
   - createdAt (DateTime, @default(now()))
   Run: npm run db:generate && npm run db:push

2. Create lib/services/google-chat.service.ts:
   - Class GoogleChatService with singleton export
   - Method: sendSupportMessage(userName: string, userEmail: string, message: string): Promise<boolean>
   - Uses env var GOOGLE_CHAT_WEBHOOK_URL
   - POST to webhook URL with JSON body: { text: formatted message string }
   - Format: "**Suporte Hub**\n\n**De:** {userName} ({userEmail})\n**Mensagem:** {message}\n**Horario:** {timestamp}"
   - Returns true on success, false on failure (graceful - don't block user)
   - Log errors to console but don't throw

3. Create app/api/support/messages/route.ts:
   - GET: Return current user's support messages ordered by createdAt desc. Requires auth session.
   - POST: Accept { message: string } (min 1 char, max 2000 chars). Create SupportMessage in DB. Call googleChatService.sendSupportMessage(). Update sentToGoogleChat field. Return created message. Requires auth session.
   - Both routes: validate session via getServerSession(authOptions), return 401 if no session.
  </action>
  <verify>npm run db:generate && npm run build (no type errors)</verify>
  <done>SupportMessage model exists, API accepts POST with message and stores in DB, Google Chat webhook is called</done>
</task>

<task type="auto">
  <name>Task 2: Support chat UI page</name>
  <files>
    components/dashboard/support-chat.tsx
    app/dashboard/suporte/page.tsx
    components/dashboard/professional-sidebar.tsx
  </files>
  <action>
1. Create components/dashboard/support-chat.tsx (client component "use client"):
   - Chat interface with message list and input area
   - On mount: GET /api/support/messages to load history
   - Message list: show each message with timestamp, styled as chat bubbles (user messages on right)
   - Input: textarea + send button. Disable while sending. Clear on success.
   - Use existing design tokens (bg-white, border, rounded-xl, shadow-sm patterns from other pages)
   - Empty state: friendly message "Envie uma mensagem e nossa equipe responderá pelo Google Chat"
   - Show toast/inline success after send: "Mensagem enviada! Nossa equipe foi notificada."
   - Handle errors gracefully with inline error message
   - All text in PT-BR

2. Create app/dashboard/suporte/page.tsx:
   - Server component, simple page wrapper
   - Title "Suporte" with subtitle "Envie mensagens para a equipe Sigma"
   - Render SupportChat component
   - Follow same page layout pattern as other dashboard pages (p-8, max-w, heading styles)

3. Update components/dashboard/professional-sidebar.tsx:
   - Add "Suporte" nav item linking to /dashboard/suporte
   - Use MessageCircle or HelpCircle icon from lucide-react
   - Place it near bottom of nav, before settings if exists
   - Make it available to ALL roles
  </action>
  <verify>npm run build (no errors). Navigate to /dashboard/suporte - page renders with chat interface.</verify>
  <done>Support chat page accessible from sidebar, users can send messages and see history, messages forwarded to Google Chat</done>
</task>

</tasks>

<verification>
- npm run build passes
- /dashboard/suporte page renders
- POST /api/support/messages creates DB record
- Google Chat webhook receives formatted message (requires GOOGLE_CHAT_WEBHOOK_URL env var)
- GET /api/support/messages returns user's message history
</verification>

<success_criteria>
- Hub users can access support chat from sidebar
- Messages are persisted in SupportMessage table
- Messages are forwarded to Google Chat space via webhook
- User sees their message history
- All UI text in PT-BR
</success_criteria>

<output>
After completion, create `.planning/quick/040-support-chat-google-chat-integration/040-SUMMARY.md`
</output>
