export function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-label="Le tuteur écrit…" role="status">
      <div className="flex items-center gap-1.5 rounded-[1rem_1rem_1rem_0.3125rem] border border-line bg-surface-raised px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-ink-muted motion-safe:animate-[bounce_1.1s_ease-in-out_infinite]"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  )
}
