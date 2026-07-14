/**
 * User-handle validation + normalization.
 *
 * Public-facing identifier — Twitter-style:
 *   - 3 to 30 characters
 *   - letters (a-z/A-Z), digits (0-9), underscore (_)
 *   - case-insensitive (always lowercased before storage / comparison)
 *   - reserved set in RESERVED below
 *
 * Storage convention: User.userId stores the *normalized* lowercase form.
 * The original casing the user typed at registration is **not** preserved.
 */

export const HANDLE_MIN = 3
export const HANDLE_MAX = 30

/** Reserved handles — case-insensitive. Block both at registration and at
 *  any future client-side display (so the user can never BE "admin"). */
export const RESERVED = new Set<string>([
  'admin',
  'administrator',
  'support',
  'help',
  'system',
  'root',
  'api',
  'bot',
  'staff',
  'moderator',
  'mod',
  'null',
  'undefined',
  'me',
  'you',
  'index',
  'login',
  'logout',
  'register',
  'verify',
  'dashboard',
  'test',
])

/**
 * Normalize a raw input into the canonical handle form.
 *
 *   normalizeHandle('  Nithesh_99  ') === 'nithesh_99'
 *   normalizeHandle('Nithesh@99')    === 'nithesh99'  // drops non-allowed chars
 *
 * Note: **strips** any character not in [a-z0-9_] rather than rejecting,
 * because most users paste handles with whitespace. The result is still
 * passed through `validateHandleFormat`, which surfaces a warning when
 * the input had to be stripped (e.g. original contained '@' or '.')
 */
export function normalizeHandle(raw: string | null | undefined): string {
  if (!raw) return ''
  // Trim, lowercase, drop anything outside [a-z0-9_]
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
}

/**
 * Validate the *raw* handle string the user typed — before normalization.
 * Returns a human-readable error message, or null if the raw input is OK.
 *
 * Why this exists: we want errors like "must be 3+ characters" to fire on
 * what the user TYPED, not on the stripped/normalized form.
 */
export function validateHandleFormat(raw: string): { ok: true } | { ok: false; error: string } {
  const t = (raw ?? '').trim()
  if (t.length === 0) return { ok: false, error: 'Pick a handle.' }
  if (t.length < HANDLE_MIN) {
    return { ok: false, error: `${HANDLE_MIN}+ characters required.` }
  }
  if (t.length > HANDLE_MAX) {
    return { ok: false, error: `Max ${HANDLE_MAX} characters.` }
  }
  // Character whitelist
  if (!/^[A-Za-z0-9_]+$/.test(t)) {
    return {
      ok: false,
      error:
        'Use only letters, digits, and underscores (no spaces, dots, or symbols).',
    }
  }
  // Must start with a letter or digit (rules out leading underscore)
  if (!/^[A-Za-z0-9]/.test(t)) {
    return { ok: false, error: 'Handle must start with a letter or digit.' }
  }
  // Must end with a letter or digit (no trailing underscore)
  if (!/[A-Za-z0-9]$/.test(t)) {
    return { ok: false, error: 'Handle must end with a letter or digit.' }
  }
  return { ok: true }
}

/**
 * Validate an already-normalized handle (lowercase, [a-z0-9_]). Used by
 * server actions after we've applied `normalizeHandle` so we don't fire
 * the same error twice against the canonical form.
 */
export function validateNormalizedHandle(normalized: string): { ok: true } | { ok: false; error: string } {
  if (normalized.length < HANDLE_MIN || normalized.length > HANDLE_MAX) {
    return { ok: false, error: `Handle must be ${HANDLE_MIN}–${HANDLE_MAX} characters.` }
  }
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    // Should be unreachable if normalizeHandle ran, but defence-in-depth.
    return { ok: false, error: 'Invalid characters in handle.' }
  }
  if (RESERVED.has(normalized)) {
    return { ok: false, error: 'That handle is reserved. Pick another.' }
  }
  return { ok: true }
}

/**
 * Combined: validate raw input, normalize, validate normalized.
 * Returns the normalized form on success, or an error string.
 */
export function coerceHandle(
  raw: string
): { ok: true; normalized: string } | { ok: false; error: string } {
  const fmt = validateHandleFormat(raw)
  if (fmt.ok === false) return { ok: false, error: fmt.error }
  const normalized = normalizeHandle(raw)
  const norm = validateNormalizedHandle(normalized)
  if (norm.ok === false) return { ok: false, error: norm.error }
  return { ok: true, normalized }
}
