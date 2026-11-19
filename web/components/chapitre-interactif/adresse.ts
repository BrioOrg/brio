/**
 * The one writer of the chapter's address (ADR 0046 §2). The address mirrors the state (the slide
 * shown, the mode); it never navigates: no history entry, no router call.
 *
 * Once Next has patched `history.replaceState` (in the app router's own mount effect), a call with
 * `null` gets Next's state (`__NA` and the tree) copied into the entry, and Next's router follows
 * the new URL. During hydration the call can still reach the native method, which would leave the
 * entry with `history.state === null`: Next's `popstate` handler ignores such an entry, so a back
 * to it would change the address and leave the page as it is. The previous state is then written
 * back on the same URL.
 *
 * Never throws: a failed write (a browser's rate limit, a `SecurityError`) costs the address, never
 * the slide.
 */
export function remplacerAdresse(url: string): void {
  try {
    const avant: unknown = window.history.state
    window.history.replaceState(null, '', url)
    if (window.history.state === null && avant !== null && avant !== undefined) {
      window.history.replaceState(avant, '', url)
    }
  } catch {
    // The address stays behind; the state it mirrors is already right.
  }
}
