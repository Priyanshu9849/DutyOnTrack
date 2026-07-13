export default function Loading() {
  return (
    <div className="min-h-screen bg-[#050914] text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-500 opacity-30 blur-xl animate-pulse" />
          <div className="relative h-full w-full rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-500 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <path d="M12 20 L18 26 L28 14" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
        <div className="text-sm text-white/60 tracking-wide">Loading DutyOnTrack...</div>
      </div>
    </div>
  )
}
