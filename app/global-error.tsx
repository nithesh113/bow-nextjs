'use client'

// Bare-bones global error boundary. Wrapped in <html>/<body> per Next.js spec.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <button onClick={() => reset()}>Reset</button>
      </body>
    </html>
  )
}
