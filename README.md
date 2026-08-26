# Custom Photobooth

Self-hosted photobooth for events. Guests open a link on their own phone, take a
strip of photos, preview it, and get it emailed to them. Each event is a
"workspace" with its own name, frame, photo count, and email sender.

See [docs/prd-custom-photobooth.md](docs/prd-custom-photobooth.md) for the full spec.

## Setup

```bash
npm install
```

Create `.env.local` (see `.env.example`):

```bash
node -e "const c=require('crypto');console.log('ADMIN_PASSWORD=change-me\nENCRYPTION_KEY='+c.randomBytes(32).toString('hex')+'\nSESSION_SECRET='+c.randomBytes(32).toString('hex'))" > .env.local
```

| Variable | What it does |
| --- | --- |
| `ADMIN_PASSWORD` | Password for the single admin (there are no user accounts). |
| `ENCRYPTION_KEY` | 32-byte hex key encrypting workspace SMTP passwords at rest. |
| `SESSION_SECRET` | Signs the admin session cookie. |

**Do not lose `ENCRYPTION_KEY`** — changing it makes every saved SMTP password
undecryptable, and each workspace's password has to be re-entered.

Then:

```bash
npm run dev
```

Admin is at `/admin`, and data lives in `data/` (SQLite, uploaded frames, and
saved strips), which is gitignored. Back that folder up if the events matter.

## Running an event

1. **New workspace** → name it after the event.
2. **Photos per strip** → how many shots the booth takes, back to back.
3. **Frame** → upload a transparent PNG of any size. Wherever the PNG is
   transparent, the photo shows through.
4. **Photo slots** → drag the numbered boxes onto the frame's windows and resize
   them by the corner handle. Positions are stored as fractions of the frame, so
   they hold up regardless of the guest's camera resolution.
5. **Email sender** → your own SMTP details. With Gmail, use an
   [app password](https://support.google.com/accounts/answer/185833), not your
   login password.
6. **Save**, then **send a test email** to yourself. Do this before the event —
   it is the only way to know the credentials work.
7. Share the **booth link** with guests.

The workspace list shows how many emails each booth has sent and how many failed,
and each workspace page lists recent sends with the SMTP error for any failure.

### Scan-to-download QR and Share/AirDrop

The preview screen (and the confirmation screen after emailing) also offers
two more ways to get the strip, no email required:

- **Share / AirDrop** — on a browser that supports sharing files (iOS Safari,
  most mobile browsers), opens the native share sheet with the strip already
  attached.
- **A QR code** a phone scans to download the strip directly — useful when
  the booth itself is a shared/kiosk device (a tablet, say) and the guest
  wants the file on their *own* phone.

The QR needs a real URL a phone can fetch — `blob:` URLs only exist inside
the booth's own browser tab. The strip is saved to `data/strips/` (same as
uploaded frames) and served back from this app itself, so whatever already
makes the booth reachable to guests (a reverse proxy, ngrok, etc.) is what
makes the QR link work too — no extra setup or third-party storage.

## Production

```bash
npm run build
npm start
```

Serve it over **HTTPS** — browsers only grant camera access on secure origins, so
the booth will not work over plain HTTP on anything but `localhost`. The session
cookie is also marked `secure` in production.

## Tests

```bash
npm test
```

Covers credential encryption, session signing, email/slot validation, and the
compositing geometry (photos landing on their slots, cover-cropping without
distortion, frame drawn last).

## How it works

- **Next.js** app serving admin UI, guest booth, and API routes.
- **SQLite** (`better-sqlite3`) — two tables, `workspaces` and `send_log`.
- **Capture and compositing run in the guest's browser** (`getUserMedia` +
  `<canvas>`), so there is no server-side image pipeline. The composite is
  rendered at the frame's native size.
- **`nodemailer`** sends through each workspace's own SMTP, using credentials
  decrypted in memory only at send time (AES-256-GCM at rest).
- Sends are synchronous and every attempt is logged. There is no retry queue yet.
