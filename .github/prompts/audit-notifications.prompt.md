---
name: "Audit Notifications"
description: "Comprehensively audit project notifications and alerts: email, SMS, WhatsApp, push, recipients, triggers, timing, providers, and working or broken status."
argument-hint: "Optional focus: all | email | sms | whatsapp | push | orders | auth | crm"
agent: "agent"
---
Audit the notification system for this workspace.

Focus: ${input:focus:all notification channels and flows}

Goal:
Determine what notifications exist, what they send, who receives them, when they are triggered, how they are wired, and what is working versus broken.

Start by reading [AGENTS.md](../../AGENTS.md) for project conventions, then inspect the notification-related areas of the codebase, including but not limited to:
- `lib/notifications.ts`, `lib/notify.ts`, and any nearby notification utilities
- `lib/integrations/**` for provider wiring
- `app/api/notifications/**`, `app/api/push/**`, `app/api/email/**`, and related routes
- `public/sw.js` and any push subscription or service worker logic
- order, auth, CRM, chatbot, admin, webhook, cron, and customer flows that trigger notifications

Coverage requirements:
- Include every notification channel you can find: email, SMS, WhatsApp, push/browser push, in-app/admin/system notifications, and cron or webhook-triggered notifications
- Trace each flow end to end: trigger -> business logic -> provider or integration -> recipient selection -> payload or template -> delivery path
- Identify gating conditions: feature flags, environment variables, auth checks, role checks, city or country logic, rate limits, retries, deduplication, fallbacks, and error handling
- Distinguish between `verified working`, `implemented but unverified`, `partially wired`, `broken`, and `dead or unused`
- Never claim runtime success without evidence; if runtime verification is not possible, state exactly what is missing

Output in Arabic with concise technical wording.

Use this structure:
1. `ملخص تنفيذي`
2. `جدول القنوات`
   Include: channel, sender or service, recipients, trigger or timing, key files, status, and evidence
3. `تفصيل كل تدفق`
   Explain what is sent, to whom, when, and how it works
4. `شو شغال وشو مش شغال`
   Separate confirmed, likely working, broken, and unclear items
5. `المشاكل الجذرية`
   Highlight missing env vars, dead code, inconsistent provider wiring, missing routes, unreachable logic, missing templates, and missing tests
6. `خطوات الإصلاح`
   List prioritized fixes with concrete file references
7. `الفجوات بالتحقق`
   State what still needs runtime credentials, external services, seeded data, or manual testing

Rules:
- Prefer code evidence over assumptions
- Reference concrete files and functions for every important claim
- If you run checks, summarize the result and the limitation of each check
- If the focus input narrows the scope, keep the same report format but limit the audit to that area
- If the user asks for fixes after the audit, propose the smallest safe implementation plan first