# Docs site (static)

This directory contains the built static Foundry docs/marketing site. It is copied from the supervisor-website `artifacts/foundry-site` build.

## Serve locally

```bash
# From this directory (docs/docs-site)
npx serve .
# Or with Python:
python3 -m http.server 8080
```

Then open http://localhost:3000 (serve) or http://localhost:8080 (Python).

## Regenerating

From the **supervisor-website** repo root:

```bash
pnpm --filter @workspace/foundry-site run build
cp -r artifacts/foundry-site/dist/public/* docs/foundry/docs/docs-site/
```

## API

This site is **fully static**. It does not call the API; docs and wiki content are embedded at build time. You do **not** need the API server to view or deploy this docs site.
