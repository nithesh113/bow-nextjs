import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0c14',
        color: '#e4e6eb',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 8 }}>🔍</div>
        <h1
          style={{
            fontSize: 72,
            fontWeight: 800,
            margin: 0,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </h1>
        <h2 style={{ fontSize: 22, marginTop: 8, marginBottom: 12 }}>
          Page not found
        </h2>
        <p style={{ color: '#9aa0a6', marginBottom: 28 }}>
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            textDecoration: 'none',
            padding: '12px 28px',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
