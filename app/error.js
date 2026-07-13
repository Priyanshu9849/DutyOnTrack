'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="min-h-screen bg-[#050914] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 items-center justify-center text-rose-300 text-2xl mb-4">!</div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/60">We hit an unexpected error. Try again — if it persists, please contact support.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 text-white text-sm font-medium">Try again</button>
          <a href="/" className="px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white text-sm">Home</a>
        </div>
      </div>
    </div>
  )
}
