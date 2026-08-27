type StudentBubbleProps = {
  children: React.ReactNode
}

export function StudentBubble({ children }: StudentBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] rounded-[1rem_1rem_0.3125rem_1rem] bg-accent px-3.5 py-2.5 font-prose text-sm font-semibold text-surface-page">
        {children}
      </div>
    </div>
  )
}
