# Production Deploy

## Problem This Prevents

Building from `/opt/carreirahub/app` on the server can silently ship stale files when that checkout is behind local `HEAD`. That is exactly how UI regressions like an older Ops Hub layout can come back.

## Safe Rule

Always deploy an immutable git revision.

- Do not hot-build from a long-lived server checkout.
- Do not copy a few files into `/opt/carreirahub/app` and rebuild in place.
- Do build from a versioned release directory tied to a git SHA.

## Recommended Command

```bash
./scripts/deploy-swarm-release.sh carreirausa carreirahub_hub
```

What it does:

- refuses to deploy if the worktree is dirty
- archives the exact current `HEAD`
- uploads that snapshot to `/opt/carreirahub/releases/<full-sha>`
- builds `carreirahub-local:<short-sha>` from that release directory
- updates the Swarm service to that exact image tag

## Why This Is Better

- production always maps to a real commit
- no stale checkout drift on the host
- easier rollback because each release lives in its own directory and image tag
- build cache still helps on the host, but the source tree is deterministic

## Build Speed Notes

The Dockerfile now uses BuildKit cache mounts for:

- `npm ci`
- `.next/cache`

That speeds up repeated builds on the same server substantially, especially when dependencies did not change.

## If You Want It Even Faster

The next step is moving image builds to CI and only doing `docker service update --image ...` on the server. That removes server-side Next.js builds from the critical path almost entirely.
