---
phase: 260414-mmm-quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/ai/MessageBubble.tsx
  - components/ai/MessageList.tsx
  - components/ai/ChatPanel.tsx
  - components/ai/ComplianceGate.tsx
  - app/api/dashboard/ai/messages/[id]/route.ts
autonomous: true
requirements:
  - QUICK-MMM-01  # Delete button per AI chat message (user + assistant)
  - QUICK-MMM-02  # Compliance "termo de compromisso" modal, accepted once per session, gates AI usage

must_haves:
  truths:
    - "Internal user (ADMIN/SALES/SDR/FINANCE) sees compliance modal on first open of ChatBubble in a session and must accept before chatting."
    - "After acceptance, the modal does not show again in the same session (sessionStorage persists within tab)."
    - "Each message (user and assistant) in the chat has a trash/delete icon visible on hover."
    - "Clicking delete removes the message from the UI list AND from the AiMessage DB row (if persisted)."
    - "Refreshing and reloading the conversation does not re-show deleted messages."
  artifacts:
    - path: "components/ai/ComplianceGate.tsx"
      provides: "Modal that blocks ChatPanel until user accepts terms; stores acceptance in sessionStorage."
    - path: "components/ai/MessageBubble.tsx"
      provides: "Per-message delete button (trash icon) with onDelete callback."
    - path: "components/ai/MessageList.tsx"
      provides: "Passes onDelete handler down to MessageBubble."
    - path: "components/ai/ChatPanel.tsx"
      provides: "Wraps chat in ComplianceGate; implements handleDelete (API + setMessages filter)."
    - path: "app/api/dashboard/ai/messages/[id]/route.ts"
      provides: "DELETE endpoint — auth'd, ownership-checked via conversation.userId; removes AiMessage row."
  key_links:
    - from: "components/ai/ChatPanel.tsx"
      to: "components/ai/ComplianceGate.tsx"
      via: "Wraps children; renders modal overlay until accepted."
      pattern: "ComplianceGate"
    - from: "components/ai/MessageBubble.tsx"
      to: "ChatPanel handleDelete"
      via: "onDelete prop invoked by trash button click."
      pattern: "onDelete"
    - from: "ChatPanel handleDelete"
      to: "DELETE /api/dashboard/ai/messages/[id]"
      via: "fetch DELETE then setMessages(prev => prev.filter)"
      pattern: "fetch.*messages.*DELETE"
---

<objective>
Add two trust/compliance UX affordances to the internal AI Copilot (ChatBubble):
1. A delete button on each chat message so internal users can remove specific entries from their history.
2. A one-time-per-session "Termo de Compromisso" (compliance acceptance) modal the user must accept before sending any message.

Purpose: Give the internal team control over their AI history (privacy/cleanup) and a clear acceptable-use acknowledgment before using the copilot.
Output: Updated ChatBubble flow with gated entry and per-message deletion.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@components/ai/ChatBubble.tsx
@components/ai/ChatPanel.tsx
@components/ai/MessageList.tsx
@components/ai/MessageBubble.tsx
@app/api/dashboard/ai/conversations/[id]/route.ts

<interfaces>
From components/ai/MessageList.tsx — current props:
```ts
{ messages: any[]; isStreaming: boolean }
// Each message: { id: string; role: 'user'|'assistant'; parts: [{type:'text', text}|{type:'tool-*', ...}] }
```

From components/ai/MessageBubble.tsx — current props:
```ts
{ role: 'user' | 'assistant'; content: string }
```

From components/ai/ChatPanel.tsx — uses @ai-sdk/react useChat:
```ts
const { messages, sendMessage, status, setMessages } = useChat({ transport });
// setMessages available for local mutation (needed for delete UX)
```

From app/api/dashboard/ai/conversations/[id]/route.ts — ownership check pattern:
```ts
const conversation = await prisma.aiConversation.findFirst({ where: { id, userId } });
```

DB: AiMessage { id, conversationId, role, content, ... } — conversation.userId is the ownership check.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add DELETE endpoint for AiMessage with ownership check</name>
  <files>app/api/dashboard/ai/messages/[id]/route.ts</files>
  <action>
Create a new Next.js App Router route at `app/api/dashboard/ai/messages/[id]/route.ts` exporting a `DELETE` handler.

Behavior:
1. `getServerSession(authOptions)` — return 401 if no session or no `session.user.id`.
2. Look up `prisma.aiMessage.findUnique({ where: { id: params.id }, include: { conversation: true } })`. If not found, return 404.
3. Ownership: if `message.conversation.userId !== session.user.id`, return 403.
4. Delete: `prisma.aiMessage.delete({ where: { id: params.id } })`.
5. Return `NextResponse.json({ ok: true })`.

Follow the same import style and auth pattern as `app/api/dashboard/ai/conversations/[id]/route.ts`. Cast session.user to `{ id?: string }` as done elsewhere in the codebase.

Do NOT delete TOOL rows cascade here — only the specific message id provided. (If the user deletes an assistant row with associated tool rows for the same step, that's acceptable for this quick feature; we prioritize user-intent delete of what they see.)
  </action>
  <verify>
    <automated>curl -i -X DELETE http://localhost:3000/api/dashboard/ai/messages/nonexistent-id | head -1  # expect 401 without session, 404 with session for missing id</automated>
  </verify>
  <done>DELETE endpoint exists, enforces auth + ownership, removes AiMessage row, returns 200 with {ok:true}.</done>
</task>

<task type="auto">
  <name>Task 2: Wire delete button into MessageBubble + MessageList + ChatPanel</name>
  <files>components/ai/MessageBubble.tsx, components/ai/MessageList.tsx, components/ai/ChatPanel.tsx</files>
  <action>
**MessageBubble.tsx** — extend props:
```ts
{ role: 'user' | 'assistant'; content: string; onDelete?: () => void }
```
Add a trash icon button (lucide-react `Trash2`) next to the existing Copy button (or below for user messages which don't have Copy). Show with `opacity-0 group-hover:opacity-100 transition`. On click: `window.confirm('Remover esta mensagem?')` then call `onDelete()`. Render the button only when `onDelete` is provided. For user messages (right-aligned), place the delete button BELOW the bubble, right-aligned, matching hover pattern.

**MessageList.tsx** — extend props:
```ts
{ messages: any[]; isStreaming: boolean; onDeleteMessage?: (messageId: string) => void }
```
Pass `onDelete={onDeleteMessage ? () => onDeleteMessage(m.id) : undefined}` to each `<MessageBubble>`. Only pass for text parts, not for tool-* parts.

**ChatPanel.tsx** — add `handleDeleteMessage`:
```ts
const handleDeleteMessage = async (messageId: string) => {
  // Optimistic remove from UI
  setMessages((prev: any[]) => prev.filter(m => m.id !== messageId));
  try {
    const res = await fetch(`/api/dashboard/ai/messages/${messageId}`, { method: 'DELETE' });
    if (!res.ok) {
      // On failure, reload conversation to resync (or show a toast)
      console.error('Failed to delete AI message', await res.text());
    }
  } catch (err) {
    console.error('Delete error', err);
  }
};
```
Pass `onDeleteMessage={handleDeleteMessage}` to `<MessageList>`.

**Edge case:** useChat-generated messages (before first refresh) may have synthetic client-side IDs that don't match DB row ids. For this quick feature, the DELETE endpoint will 404 for those and the optimistic UI removal still works for the current session. This is acceptable — deleted synthetic messages will not reappear unless the conversation is reloaded.
  </action>
  <verify>
    <automated>npm run lint -- --file components/ai/MessageBubble.tsx --file components/ai/MessageList.tsx --file components/ai/ChatPanel.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>Hovering a message shows trash icon; clicking confirms then removes from UI and hits DELETE endpoint; assistant + user messages both deletable.</done>
</task>

<task type="auto">
  <name>Task 3: Build ComplianceGate modal and wrap ChatPanel</name>
  <files>components/ai/ComplianceGate.tsx, components/ai/ChatPanel.tsx</files>
  <action>
Create `components/ai/ComplianceGate.tsx` as a client component:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

const STORAGE_KEY = 'carreirausa-ai-compliance-accepted-v1';

export function ComplianceGate({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    try {
      setAccepted(sessionStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      setAccepted(false);
    }
  }, []);

  if (accepted === null) return null; // avoid flash

  if (!accepted) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-5 h-5 text-brand-verde" />
            <h3 className="text-base font-semibold">Termo de Compromisso — CarreiraUSA AI</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-2 mb-4">
            <p>Este copiloto é de <strong>uso exclusivo interno</strong> da equipe CarreiraUSA.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Não compartilhe informações confidenciais de alunos/clientes além do necessário para sua tarefa.</li>
              <li>Respostas do AI podem conter erros — confirme dados sensíveis antes de agir.</li>
              <li>Todas as mensagens são registradas para auditoria.</li>
              <li>Não use o AI para gerar conteúdo que viole políticas internas ou LGPD.</li>
            </ul>
            <p>Ao continuar, você aceita estes termos e se responsabiliza pelo uso.</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                try { sessionStorage.setItem(STORAGE_KEY, 'true'); } catch {}
                setAccepted(true);
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Aceitar e continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

Then wrap the ChatPanel's returned JSX with `<ComplianceGate>` so the whole chat (including suggestions/composer) is blocked until acceptance:

In `components/ai/ChatPanel.tsx`:
- Import: `import { ComplianceGate } from './ComplianceGate';`
- Change the final `return (` to wrap the existing `<div className="flex flex-col h-full bg-background">...</div>` inside `<ComplianceGate>...</ComplianceGate>`.

Storage key uses `-v1` suffix so future wording changes can invalidate prior acceptance by bumping the version. Use `sessionStorage` (not localStorage) so each new browser session re-prompts — per the spec "once per session."
  </action>
  <verify>
    <automated>npm run lint -- --file components/ai/ComplianceGate.tsx --file components/ai/ChatPanel.tsx 2>&1 | tail -20 && npm run build 2>&1 | tail -30</automated>
  </verify>
  <done>Opening ChatBubble for the first time in a tab shows the compliance modal; clicking "Aceitar e continuar" reveals the chat; closing and reopening the bubble in the same tab does NOT re-prompt; opening a new tab re-prompts.</done>
</task>

</tasks>

<verification>
Manual smoke test:
1. Sign in as an ADMIN/SALES/SDR/FINANCE user on /dashboard.
2. Click the AI bubble (bottom-right). Verify compliance modal appears.
3. Click "Aceitar e continuar" — chat UI appears.
4. Send a message, wait for assistant response.
5. Hover over the user message — trash icon appears. Click, confirm — message disappears from UI.
6. Hover over the assistant message — trash icon appears. Click, confirm — disappears. Copy button still works separately.
7. Close bubble, reopen — no compliance prompt (same session).
8. Open new browser tab to /dashboard — compliance prompt appears again.
9. In Prisma Studio (or SQL), verify deleted AiMessage rows no longer exist.
</verification>

<success_criteria>
- DELETE /api/dashboard/ai/messages/[id] exists with NextAuth + ownership check.
- MessageBubble renders a trash icon on hover when onDelete is provided, with confirm() prompt.
- ChatPanel wraps content in ComplianceGate; sessionStorage key `carreirausa-ai-compliance-accepted-v1` persists acceptance per tab session.
- Build passes (`npm run build`), lint clean on changed files.
- No regressions to existing Copy button or streaming behavior.
</success_criteria>

<output>
After completion, create `.planning/quick/260414-mmm-preciso-ter-botao-de-delete-de-msg-e-com/260414-mmm-SUMMARY.md`
</output>
