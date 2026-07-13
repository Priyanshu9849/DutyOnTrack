import Link from 'next/link'

export const metadata = {
  title: '404 — Page not found · DutyOnTrack',
  robots: { index: false },
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050914] text-white relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-600/25 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-500/25 blur-[120px]" />
      <div className="relative text-center max-w-xl">
        <div className="inline-block text-8xl md:text-9xl font-black tracking-tighter bg-gradient-to-r from-cyan-300 via-indigo-300 to-purple-300 bg-clip-text text-transparent">
          404
        </div>
        <h1 className="mt-4 text-2xl md:text-3xl font-bold">This page took an unscheduled day off</h1>
        <p className="mt-3 text-white/60">
          The link you followed may be broken, or the page may have been moved.
          Head back to the dashboard and get back on duty.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 text-white font-medium shadow-lg hover:opacity-90 transition-opacity">
            Back to home
          </Link>
          <a href="mailto:hello@dutyontrack.in" className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-white/20 bg-white/5 backdrop-blur text-white hover:bg-white/10 transition-colors">
            Contact support
          </a>
        </div>
      </div>
    </div>
  )
}
