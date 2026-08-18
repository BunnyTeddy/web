# SecSource Dashboard

UI-only implementation for the SecSource scanner wrapper. It uses the three
reports in `../secsource-cli/reports/` as typed fixtures and an in-process
`SecSourceClient` implementation, so every flow can be exercised before the Go
API is connected. It does **not** execute `secsource-cli`, contact a scanner
server, persist credentials, or write to SQLite.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

The production assets are emitted to `dist/` and can be embedded by the future
Go wrapper.

## Routes

- `/dashboard` — security overview and New Scan workflow
- `/scans` — scan history, progress, and job controls
- `/findings/:scanId?/:findingId?` — report details and evidence chain
- `/settings` — connection, authentication, and runtime configuration

The interface is presented as the final operator dashboard. During this UI-only
phase, actions run against the in-process client; a Go API adapter can replace it
without changing the views or stores.
