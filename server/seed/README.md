Development seed data for the **local** database only.

- `women.json`: verified, active women members.
- `photos/`: one or more images per member, named `<key>-1`, `<key>-2` … (`.jpg`, `.png` or `.webp`).
  AI-generated images only, never photos of real people, since these become fake dating profiles.

Run `npm run seed:local` from `server/`. It is safe to re-run: seed members (ids starting `seed-`) are
updated in place, so chats and interests with them are kept. Their emails are `@example.com`, a domain reserved for examples, so nothing can reach a real inbox.
