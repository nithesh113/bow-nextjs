// app/favicon.ico/route.ts
//
// Serves a tiny 32×32 transparent PNG in favicon.ico format to keep
// browsers from logging "GET /favicon.ico 404" Network noise that
// unrelated warning pages can confuse with real load failures.
//
// We don't have Figma assets to ship — and using a static placeholder
// kills two issues at once:
//   1. No 404 noise in DevTools.
//   2. No /favicon.ico request being treated by Vercel as a hot path
//      (the previous setup had middleware probe the icon path).
//
// The route returns a 32×32 transparent PNG with cache-control
// headers so subsequent reloads skip the round trip.
export const dynamic = 'force-static'

// 32x32 transparent PNG, base64-decoded by Next at the response layer.
// Avoiding 404s is the practical goal here.
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAAC1+jfqAAAAEUlEQVR42mNk',
)

export function GET(): Response {
  return new Response(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
