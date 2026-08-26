# PRD: Custom Photobooth

**Status:** Draft
**Owner:** Kahfi R
**Date:** 2026-08-26

## Problem Statement

Event hosts (weddings, parties, small gatherings) want a self-service photobooth that guests can use from their own phone or a shared device, without renting hardware or paying for a per-event SaaS photobooth service. Existing options are either physical booth rentals (expensive, requires setup/staffing) or generic web photobooth tools that don't let the host brand the output (custom frame/strip) or control delivery (custom sender email per event). Without this, hosts fall back to guests taking normal camera-roll photos with no strip/frame and no automatic delivery, losing the "photobooth" experience and the keepsake email.

## Goals

- Guest can complete a full session (capture → preview → email) in under 60 seconds without help.
- Host can spin up a new event workspace (name, frame, shot count, sender) in under 10 minutes.
- 95%+ of started capture sessions result in a successfully delivered email.
- One workspace supports an unlimited/configurable number of guest sessions concurrently during an event without host intervention.

## Non-Goals

- **Multi-tenant SaaS / public signup** — this is host-run, single-admin per deployment. No account system for guests, no marketplace of workspaces. (Different product; revisit if demand shows up.)
- **Dedicated kiosk hardware/app** — v1 targets any browser (guest phone or a shared tablet/iPad running a browser), not a native kiosk application. (Native kiosk mode is a future consideration if attended-booth UX becomes a priority.)
- **Photo editing/filters beyond frame overlay** — no beauty filters, stickers, or manual retouching in v1. (Adds significant scope; frame overlay alone delivers the core "photobooth" feel.)
- **Print output** — v1 is capture + email only, no printer integration. (Printing is hardware-dependent and out of scope until there's a specific event that needs it.)
- **Managed email delivery service (Resend/SendGrid, etc.)** — v1 uses the host's own SMTP credentials per workspace, not a shared transactional email provider. (Avoids the app needing its own sending reputation/domain auth; revisit if SMTP setup proves too high-friction for hosts.)

## User Stories

**Host (event organizer, sole admin)**
- As a host, I want to create a workspace with a custom name so that I can keep multiple events (e.g. "Sarah's Wedding", "Office Party") separate.
- As a host, I want to upload a custom frame/strip design for a workspace so that photos match the event's branding.
- As a host, I want to set how many photos are captured per strip (e.g. 1, 3, 4) so that the output matches the frame layout I designed.
- As a host, I want to configure my own SMTP sender (host, port, username, password, from-name/from-address) per workspace so that delivery emails come from an address guests recognize (e.g. the couple's own email, not a third-party service).
- As a host, I want to send a test email from a workspace before the event so that I can confirm SMTP credentials work before guests rely on it.
- As a host, I want to see whether a workspace's last few sessions delivered successfully so that I can catch a broken SMTP config mid-event.

**Guest (booth user)**
- As a guest, I want to open the workspace link/QR code on my own phone so that I don't need to download anything.
- As a guest, I want to grant camera access and see a live preview so that I know I'm framed correctly before shooting.
- As a guest, I want a countdown before each shot so that I have time to pose.
- As a guest, when the workspace is configured for multiple photos, I want the app to automatically take each shot in sequence (with a countdown between shots) so that I get a complete strip without manually triggering each one.
- As a guest, I want to see a preview of my finished strip (photos composited into the frame) before sending so that I can retake if I don't like it.
- As a guest, I want to retake the whole set if I'm unhappy with the preview so that I'm not stuck with a bad result.
- As a guest, I want to enter my email and receive the finished strip image so that I have a keepsake without needing to screenshot anything.
- As a guest, I want a clear error message if my camera permission is denied or email delivery fails so that I know what went wrong and can retry.

## Requirements

### Must-Have (P0)

**Workspace management**
- Host can create/edit/delete a workspace with: name, frame/strip image (upload, any size/aspect ratio), shot count (integer, min 1), SMTP sender config (host, port, username, password, from-name, from-address).
  - *Acceptance:* Given a host on the admin screen, when they save a workspace with all required fields, then it appears in the workspace list and generates a shareable guest link.
- Host can visually position each photo slot on the uploaded frame using a drag/resize aligner (place and size N rectangles directly over the frame image, N = shot count), and save the resulting slot layout with the workspace.
  - *Acceptance:* Given a workspace with an uploaded frame and shot count N, when host drags/resizes N slot rectangles over the frame preview and saves, then the composited output (see Preview flow) places each captured photo into its corresponding slot at the position/size set.
- Host can send a one-off test email from a workspace's SMTP config to verify it works.
  - *Acceptance:* Given valid SMTP creds, when host clicks "send test", then a test email arrives at the address they specify within 30s, or a clear error is shown if it fails.
- Each workspace has a unique guest-facing URL (and ideally a QR code) that opens directly into the capture flow for that workspace.

**Capture flow**
- Guest can open a workspace link in a mobile or desktop browser and grant camera access.
  - *Acceptance:* Given camera permission granted, when guest opens the link, then a live camera preview renders within 3s.
- App captures exactly the workspace-configured number of photos in sequence, with a visible countdown before each shot.
  - *Acceptance:* Given shot count = 3, when guest starts capture, then 3 photos are taken back-to-back with countdown between each, no manual re-trigger needed.
- If camera permission is denied or no camera is available, guest sees a clear, actionable error state (not a blank screen).

**Preview flow**
- After capture, app composites the photos into the workspace's frame/strip layout and shows a preview.
  - *Acceptance:* Given N captured photos and a frame with N slots, when capture completes, then guest sees a single composited strip image matching the frame design.
- Guest can retake the entire set from the preview screen, discarding the current captures.
- Guest can proceed from preview to the email step.

**Email flow**
- Guest enters an email address and submits; app sends the composited strip image via the workspace's configured SMTP sender.
  - *Acceptance:* Given a valid email and working SMTP config, when guest submits, then an email with the strip image attached/embedded arrives within 60s.
- Guest sees a clear success confirmation, or a clear error with a retry option if sending fails.
- Basic email format validation before submit (not just server-side rejection).

**Reliability baseline**
- Failed email sends are logged (with reason) so the host can diagnose SMTP issues without engaging a developer.

### Nice-to-Have (P1)

- QR code auto-generated per workspace (not just a raw URL) for easy display at the event.
- Workspace list shows recent session count and last delivery status per workspace, so host can eyeball health during an event.
- Configurable countdown duration per workspace.
- Guest can download the strip image directly from the confirmation screen, in addition to email.
- Retry queue for failed sends (auto-retry a few times before surfacing as failed).

### Future Considerations (P2)

- Native kiosk/attended-booth mode (fullscreen app, idle screen, staff controls) for dedicated hardware setups.
- Print integration (send strip to a connected printer).
- Multi-tenant hosting (other people signing up and managing their own workspaces/billing).
- Shared/managed email delivery provider as an alternative to per-workspace SMTP, for hosts who don't want to manage SMTP credentials.
- Filters/stickers/text overlay beyond the static frame.
- Guest gallery per workspace (host can view/download all captured strips from an event after the fact).

## Success Metrics

**Leading indicators**
- **Session completion rate**: % of sessions that reach "email sent" after camera permission granted. Target: ≥90% within first event use.
- **Email delivery success rate**: % of submitted emails that successfully send via SMTP. Target: ≥95%.
- **Time to complete session**: median time from "start capture" to "email sent". Target: <60s.
- **Workspace setup time**: time for host to go from "create workspace" to "have a working shareable link with verified test email". Target: <10 minutes.

**Lagging indicators**
- Number of events successfully run without the host needing manual/developer intervention mid-event.
- Host re-use rate (creates a second workspace for a future event).

*Measurement method:* since this is a self-hosted single-admin tool (no analytics platform assumed in scope), P0 should include basic structured logging of session starts/completions/failures so these metrics can be computed from logs. Revisit if a hosted analytics tool becomes appropriate.

## Decisions (resolved pre-build)

- **Frame format/dimensions:** transparent PNG, any size/aspect ratio the host uploads — no fixed canvas. Composite output matches the uploaded frame's native dimensions. Photo slots are positioned with a visual drag/resize aligner in the admin UI (in the frame's own coordinate space), not manual number fields — see P0 requirements.
- **Compositing location:** client-side, via browser `<canvas>`. No server image pipeline — keeps backend to just workspace CRUD + SMTP send, avoids extra infra for a single-admin, event-scale tool.
- **QR code:** skip for v1. A plain shareable link is enough (text/AirDrop/any external QR generator the host already has). Revisit only if a real event shows it's friction.
- **SMTP credential storage:** encrypted at rest (app-level secret key, e.g. AES via env-provided key). Not skippable — these are real personal email credentials.
- **Concurrent guests:** no queue/backend scaling work for v1. Capture and compositing run client-side per guest; server only handles workspace lookup + outbound email send, which scales fine at typical event volume (tens of concurrent sessions). Revisit only if a specific event needs more.
- **Browser support floor:** modern evergreen browsers only (current + prior major version), iOS Safari 15+. Relies on standard `getUserMedia`; no polyfills for older browsers.

## Timeline Considerations

- No fixed external event date was provided at spec time; this document is being delivered same-day per host request, but implementation should still be phased:
  - **Phase 1 (P0 only):** workspace CRUD, capture → preview → email flow, SMTP-based sending, test email. This is the minimum viable version and should be validated against a real event before adding P1.
  - **Phase 2 (P1):** QR generation, health/status visibility, retry queue.
- Recommend confirming the actual first-event date before finalizing Phase 1 scope, since "today" as an answer suggests urgency that isn't yet reflected in a concrete deadline — worth a quick check-in before implementation starts.

## Technical Approach

Single self-hosted Node process, no external infra — matches the single-admin, event-scale scope. Every choice below maps to a specific PRD constraint rather than a default preference.

- **Framework: Next.js (App Router, TypeScript).** One codebase serves the host admin UI, the guest capture UI, and the API routes (workspace CRUD, upload, send-email, test-email). Avoids standing up a separate frontend/backend for a tool one person deploys.
- **Database: SQLite via `better-sqlite3`, raw SQL (no ORM).** Two tables — `workspaces` and `send_log`. A file-based DB needs no server process, fits self-hosted deployment, and two small tables don't justify an ORM's overhead.
- **File storage: local disk** (`data/uploads/`), served by a Next route. No object storage — single instance, no multi-region requirement in the PRD.
- **Frame handling: stores the uploaded PNG at its native size**, no resizing/cropping on upload — satisfies "any size, no fixed canvas."
- **Slot aligner: hand-rolled React component using native pointer events** (drag to move, corner handle to resize), positions stored as fractions of the frame's native width/height (not pixels) so the same layout composites correctly regardless of the guest device's capture resolution. No drag/resize library — the shape is simple axis-aligned rectangles, not worth a dependency.
- **Capture: `navigator.mediaDevices.getUserMedia` + `<video>`**, native browser API, matches the evergreen-browser floor already decided.
- **Compositing: client-side `<canvas>`.** Draw each captured photo into its slot rect (from the fractional coordinates × frame's native size), draw the frame PNG on top (it's a transparent overlay), export via `canvas.toBlob`. Confirms the earlier client-side compositing decision — no server image pipeline.
- **Email: `nodemailer`**, instantiated per-send with the workspace's own decrypted SMTP creds. Directly satisfies "host's own SMTP creds," no third-party sending service.
- **Credential encryption: Node's built-in `crypto` (AES-256-GCM)**, key from an `ENCRYPTION_KEY` env var, decrypted only in-memory at send time. No extra dependency — satisfies "encrypted at rest" without adding a secrets-management service disproportionate to a single-admin tool.
- **Admin auth: single `ADMIN_PASSWORD` env var + signed HttpOnly session cookie (HMAC via `crypto`).** No user table, no multi-user auth system — there's exactly one admin per PRD scope.
- **Reliability logging: every send attempt (success/failure + reason) writes a row to `send_log`.** Directly satisfies the P0 "failures logged for host diagnosis" requirement and backs the delivery-rate success metric.
- **No queue, no background worker.** Email send happens synchronously in the request that submits the guest's email; matches the "no queue needed at this scale" decision. A retry queue stays P1.
