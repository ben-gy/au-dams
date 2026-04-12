# AU Dams — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages (works now):** https://ben-gy.github.io/au-dams/
- **Custom domain (requires DNS setup):** https://au-dams.benrichardson.dev

## DNS setup required

Add a CNAME record in Cloudflare for `benrichardson.dev`:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `au-dams` | `ben-gy.github.io` | DNS only (grey cloud) |

Once the DNS record is live, run this to trigger TLS cert issuance:
```bash
gh api repos/ben-gy/au-dams/pages -X PUT -f cname=""
gh api repos/ben-gy/au-dams/pages -X PUT -f cname="au-dams.benrichardson.dev"
```
