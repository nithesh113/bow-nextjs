# Docker

Production Docker image for BOW Next.js. Same `Dockerfile` runs on
Docker Desktop locally and on any Linux VPS.

## Quick start (local — Docker Desktop)

```bash
cp .env.example .env       # fill in DATABASE_URL, RESEND_API_KEY, etc.
docker compose up --build  # build image, start container, tail logs
```

Visit http://localhost:3000 when you see `✓ Ready in ...`.

To stop: `docker compose down`. To rebuild after a code change:
`docker compose up --build --force-recreate`.

## Reaching the app from your phone (same WiFi)

1. Find your laptop's local IP: `ipconfig` → look for `IPv4 Address`
   under your WiFi adapter (e.g. `192.168.1.42`).
2. On your phone, open `http://192.168.1.42:3000`.
3. If it doesn't connect, allow Docker Desktop through Windows
   Firewall the first time you run it, and make sure both devices
   are on the same SSID.

## Useful commands

```bash
docker compose logs -f web        # follow app logs
docker compose exec web sh        # shell into the running container
docker compose restart web        # restart just the app
docker compose down -v            # tear down + delete volumes
```

## Production deploy (VPS)

1. `docker build -t your-registry/bow-nextjs:latest .`
2. `docker push your-registry/bow-nextjs:latest`
3. On the VPS, `docker pull` + `docker run -d -p 80:3000 --env-file .env`.
4. Put Cloudflare or nginx in front for HTTPS.

## Image details

- Multi-stage build (Node 20 bookworm-slim) — final image ~150 MB.
- Runs as non-root user (`nextjs`, uid 1001).
- Healthcheck on `/`.
- `HOST_PORT` / `CONTAINER_PORT` configurable in `.env.docker`.
- `.dockerignore` excludes `node_modules`, `.next`, `.env`, IDE files,
  doc files — image is small and never bakes secrets.
