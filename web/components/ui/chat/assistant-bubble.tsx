type AssistantBubbleProps = {
  children: React.ReactNode
}

export function AssistantBubble({ children }: AssistantBubbleProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] rounded-[1rem_1rem_1rem_0.3125rem] border border-line bg-surface-raised px-3.5 py-2.5 font-prose text-sm leading-relaxed text-ink">
        {children}
      </div>
    </div>
  )
}
