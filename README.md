# AI-Powered Women Safety Assistant | Conversational Safety & Emergency Response System

**Next.js · Python (FastAPI) · Supabase (PostgreSQL) · OpenRouter (Gemini 2.0 Flash) · NLP**

---

## Executive Snapshot (3-Minute Read)

**Problem Context** Existing safety tools depend on manual action — dialing a number, opening an app, explaining a situation to someone in real time. That works when a person is calm and has time. It breaks down in the moments it matters most. This project explores whether a conversational assistant can shorten the gap between "something is wrong" and "someone is notified."

## Key Design Decisions

- Every message is classified into one of three categories — **Everyday Wellbeing**, **Immediate Safety Response**, **Emotional Support** — before any response is generated. Classification happens first because the three categories require different response strategies, not just different tone.
- SOS is a standalone action, not part of the conversation flow. It does not require the user to finish answering questions first.
- Conversation state (name, age, concern, current step) is stored server-side per session, not held only in the browser — a dropped connection or refreshed tab doesn't lose progress.
- Location is requested only at the moment of SOS, not on page load, and a denied permission still lets the alert fire without coordinates.

## What This Demonstrates

- A working LLM-based routing layer: one classification call decides both what to say and what information (if any) still needs to be collected
- Alert delivery abstracted behind a webhook (Relay.app) rather than hardcoded to one provider — swapping in SMS/email later doesn't touch the core logic
- Full session logging to Supabase, which in a real deployment would support auditing response quality over time

> *This is a portfolio project, not a certified emergency service. Classification is LLM-based and has not been clinically or legally validated.*

---

## 📌 Project Overview

A full-stack conversational safety assistant — Next.js frontend, Python/FastAPI backend — built around one question: how do you design a system that helps in the first thirty seconds, when the person experiencing a distressing situation may not have the time or composure to navigate a typical app?

Three things were prioritized: real-time intent classification so the right kind of support is offered without the user needing to ask for it explicitly, a near-zero-friction path to an emergency alert, and a conversation flow that only collects information actually needed for that specific situation type.

---

## 🧩 System Architecture

```
Next.js (chat UI, SOS button, emergency contacts, geolocation)
        │  POST /api/chat   (server-side proxy)
        ▼
FastAPI (Python backend)
        │
        ├─ Classification  → OpenRouter / Gemini 2.0 Flash sorts the concern into
        │                     Everyday Wellbeing / Immediate Safety / Emotional Support
        ├─ Info collection → asks for name + age only when the flow needs them
        └─ Response         → category-specific reply
        │
        ▼
Supabase (PostgreSQL)         Relay.app Webhook
  session + state persisted     SOS / completion alert dispatch
```

The frontend never talks to Supabase or OpenRouter directly. One Next.js API route proxies every request to the backend, so credentials stay server-side and CORS isn't an issue.

---

## 📊 Feature Breakdown

### Intent Classification

- First message in a session is classified before any reply is generated
- Classifier is constrained to a single-word category output — deterministic routing, not open-ended generation
- Category chosen determines which downstream prompt generates the final response

### SOS & Location Alerting

- Bypasses classification and info-collection entirely — always available, one tap
- Requests browser geolocation at trigger time; attaches coordinates + accuracy if granted, fires without them if denied
- Alerts dispatched via Relay.app webhook, decoupled from the app's core logic

### Fake Call

- Simulated incoming call screen — gives a plausible reason to step away from a situation without explaining why

### Session Persistence

- Every turn is written to Supabase, keyed by session ID, including which field (name / age / none) the assistant is currently waiting on
- Lets a conversation resume correctly after a reload instead of restarting

---

## 🧠 Key Engineering Decisions

*Judgment calls behind the build — not just what was done, but why.*

- **Classification kept as a separate step, not folded into the response prompt** — one combined "classify and respond" call is cheaper, but couples routing to wording and makes either one harder to test in isolation. Splitting them keeps the classifier swappable later without touching response generation.

- **All backend calls proxied server-side** — an earlier version called Supabase and OpenRouter directly from the browser, which leaked API keys client-side and broke on CORS in production. One proxy route fixed both.

- **`current_node` / `awaiting_field` persisted explicitly, not inferred** — early state logic tried to guess "what step are we on" from which fields were filled in. It broke on edge cases. Persisting explicit stage fields removed the ambiguity — a bug from skipping this taught the lesson directly (missing DB columns silently broke multi-turn conversations).

- **Rule-based state transitions, not a fully autonomous agent loop** — the LLM's role is scoped to classification and final response wording. Flow control (ask name → ask age → respond) is deterministic code, prioritizing predictability over flexibility for a safety-context flow.

- **Notification channel abstracted behind a webhook** — hardcoding a specific SMS/email provider into the alert path would work today but locks in that vendor. A webhook lets "who gets notified and how" live outside the application.

---

## 🐛 Notable Bug Fixed

During deployment, conversations would restart and re-ask for the user's name instead of progressing to age. Root cause: `current_node` and `awaiting_field` were missing from the Supabase write in `save_conversation()`, so every new request reloaded a session that looked like it had never started — even mid-conversation. Fixed by persisting both fields explicitly and adding the corresponding columns to the `conversations` table.

---

## 🛠️ Tools Used

- **Next.js** — frontend UI and the backend proxy layer
- **FastAPI (Python)** — classification, state transitions, response generation
- **OpenRouter (Gemini 2.0 Flash)** — intent classification and response generation
- **Supabase (PostgreSQL)** — session and conversation persistence
- **Relay.app (Webhooks)** — SOS and completion alert dispatch
- **Tailwind CSS + Radix UI** — interface components
- **Render / Vercel** — backend / frontend deployment

---

## ⚠️ Assumptions & Caveats

- Portfolio project, not a validated safety product — do not rely on this over contacting emergency services directly
- LLM classification can misread ambiguous or sarcastic input; production use would need human review and a much larger evaluation set
- Location accuracy depends on device/browser permissions and is not guaranteed
- Webhook delivery is best-effort — no retry or dead-letter handling implemented
- Classifier uses a general-purpose LLM, not one fine-tuned for safety-context triage

---

