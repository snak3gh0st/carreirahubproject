# Hub-Segmented AI Design

## Summary

CarreiraUSA AI will evolve from a single generic dashboard chat into a set of clean, page-level copilots embedded by business hub. The product goal is to help each team make faster decisions with the right context already loaded, while giving `ADMIN` a separate strategic CEO-style AI.

This design introduces:

- Dedicated AI pages per hub
- Role-aware side menu entries
- Hub-segmented conversation history
- Permanent conversation deletion from the AI sidebar
- A cleaner, more executive chat UI with improved readability

## Goals

- Give each team a focused AI experience for fast, contextual decision support
- Reduce prompt friction by opening each AI already scoped to its hub
- Improve trust and adoption with a cleaner, less cramped UI
- Keep the interaction model simple: page-level AI, segmented history, permanent delete with confirmation

## Non-Goals

- A global AI launcher spanning all hubs
- Recoverable archive or trash bin for deleted chats in this phase
- One shared conversation list across every department
- Rebuilding the tool layer from scratch

## Product Structure

### Hub AI Pages

Each hub gets its own dedicated AI page:

- `Financeiro AI`
- `Comercial AI`
- `Operacional AI`
- `Admin AI`

Recommended route structure:

- `/dashboard/financial/ai`
- `/dashboard/commercial/ai`
- `/dashboard/operational/ai`
- `/dashboard/admin/ai`

Each page opens as a full page, not a slide-over or inline drawer.

### Role Visibility

- Finance users see `Financeiro AI`
- Commercial users see `Comercial AI`
- Operational users see `Operacional AI`
- `ADMIN` users see `Admin AI`

`ADMIN` does not use a generic cross-hub AI entry in this phase. The admin experience is intentionally positioned as a strategic executive copilot.

## Experience Principles

### Clean Executive UI

The AI experience should feel like a premium internal workspace, not a generic public chatbot.

Visual direction:

- calm, clean, executive layout
- strong spacing and reading rhythm
- lightweight surfaces and restrained contrast
- improved typography for long-form analysis
- reduced visual truncation in conversation history and response cards

### Fast Decision Support

Each AI should immediately feel scoped to the user's area. The experience should reduce the need to explain context manually and should bias toward action-oriented outputs.

## Information Architecture

### Side Menu

New side menu entries should be added for the hub-specific AI pages. Labels should be explicit:

- `Financeiro AI`
- `Comercial AI`
- `Operacional AI`
- `Admin AI`

These entries should appear only for roles allowed to access them.

### Page Layout

Each AI page should have:

- a clean page shell
- a conversation sidebar on the left
- the active chat panel on the right
- empty-state guidance and hub-specific prompts

The layout remains familiar to current users, but spacing, width, and visual hierarchy must be improved.

## Conversation Model

### Segmented History

Conversation history must be segmented by hub. A financial conversation should never appear inside the commercial AI sidebar.

Conversations should therefore carry a hub identifier, such as:

- `FINANCIAL`
- `COMMERCIAL`
- `OPERATIONAL`
- `ADMIN_EXECUTIVE`

This hub context should be used in:

- conversation creation
- conversation list queries
- page-level filtering
- titles and empty states where useful

### Conversation Deletion

Users can delete a conversation directly from the left sidebar.

Behavior:

- delete action is available per conversation row
- delete requires explicit confirmation
- deletion is permanent in this phase
- after deletion, the list refreshes immediately
- if the deleted conversation is currently open, the page resets to a new conversation state

No archive or recovery flow is included in this phase.

## Chat Behavior By Hub

### Financeiro AI

Primary tone: analytical and practical.

Focus:

- cash position
- overdue invoices
- collections trends
- revenue changes
- margin and risk
- next financial actions

### Comercial AI

Primary tone: pipeline-driven and tactical.

Focus:

- lead quality
- deal progression
- conversion bottlenecks
- source performance
- follow-up priorities

### Operacional AI

Primary tone: execution-oriented and operationally clear.

Focus:

- pending work
- student/service bottlenecks
- coordination priorities
- operational risk
- next-step clarity

### Admin AI

Primary tone: strategic CEO copilot.

Focus:

- cross-hub business health
- growth and margin tradeoffs
- top operational and financial risks
- prioritization of leadership attention
- executive summaries and recommendations

The Admin AI should speak less like an operator and more like a strategic partner for the CEO.

## UI Design Changes

### Conversation Sidebar

Current issues:

- visually plain
- limited density control
- no per-conversation management
- titles feel cramped

Target improvements:

- more polished spacing and grouping
- clearer active-state treatment
- row-level actions on hover or focus
- visible delete affordance without clutter
- better handling for long titles and metadata

Recommended row content:

- conversation title
- optional relative date or message count
- delete action button

### Chat Reading Surface

Current issues reported by the user:

- responses look truncated
- dense blocks reduce scanability
- hierarchy in analytical answers is weak

Target improvements:

- wider and calmer reading column
- more refined markdown rendering
- better spacing between headings, lists, and paragraphs
- stronger styling for metrics, sections, and action items
- more breathing room around cards and tool-result blocks

### Empty States

Each hub should open with a clean empty state that includes:

- a short explanation of what this AI helps with
- 3-5 hub-specific starter prompts
- a more premium visual treatment than the current basic greeting

## Data and Backend Changes

### Conversation Schema

`aiConversation` should be extended with a hub/context discriminator so the same user can have separate histories per AI page.

Suggested field:

- `hub` or `assistantScope`

The exact enum name can follow existing Prisma conventions.

### API Adjustments

Conversation APIs should support scoped behavior:

- list conversations by current hub
- create conversation with current hub
- delete only within user ownership and current scope rules

Chat requests should include the hub scope so prompt building and tool allowance can adapt appropriately.

## Prompting and Tool Scope

Prompt construction should adapt to the current hub so the assistant knows:

- which business context it is serving
- which style of answer to prefer
- which tools are relevant
- which decisions matter most for that role

Tool access should remain least-privilege. Segmentation is not only navigation; it should shape the AI's reasoning context and suggested actions.

## Permissions

Visibility and access must be role-aware.

Baseline rule:

- users see only the AI page for their own hub
- `ADMIN` sees only `Admin AI` in this phase

If the current codebase already maps multiple roles into broader departments, the implementation should preserve those mappings and derive AI visibility from them.

## Error Handling

- deleting a missing conversation should fail gracefully with a clear toast or inline message
- loading an empty hub should show an intentional empty state
- unauthorized users visiting another hub's AI route should receive the existing dashboard access behavior, not a broken page

## Testing Strategy

Required test coverage:

- role-based menu visibility for hub AI entries
- conversation list filtering by hub
- delete conversation behavior
- reset behavior when deleting the active conversation
- empty state rendering per hub
- prompt/context resolution for each AI page

Visual regression is not required, but component behavior should be covered with targeted tests where practical.

## Rollout Notes

This should be delivered as an incremental evolution of the current dashboard AI, not as a parallel product. Existing shared components can be reused where they still fit, but the final UX should clearly feel segmented and more intentional.

## Open Decisions Resolved

- AI is embedded by hub, not centralized
- each AI uses a dedicated page, not a side drawer
- deletion is permanent with confirmation
- `ADMIN` gets a distinct `Admin AI` with strategic CEO framing

