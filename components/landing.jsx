'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Sparkles, ShieldCheck, Zap, ClipboardCheck, Stethoscope, HeartPulse, IndianRupee,
  BarChart3, Users, Building2, Calendar, FileText, Wallet, Bell, QrCode, Smartphone, Star,
  CheckCircle2, Play, ChevronDown, Menu, X, TrendingUp, Globe, Lock, Sun, Moon,
  Truck, ShieldAlert, Sparkle, HardHat, ClipboardList, Rocket, Award, Clock, LineChart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

// ================= Brand Logo =================
function Logo({ size = 32 }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
          <defs>
            <linearGradient id="dotBrandGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#A855F7" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#dotBrandGrad)" />
          <path d="M12 20 L18 26 L28 14" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="31" cy="9" r="3" fill="#FCD34D" stroke="white" strokeWidth="1.5" />
        </svg>
        <div className="absolute inset-0 blur-xl opacity-60 bg-gradient-to-br from-cyan-400 to-purple-500 -z-10 rounded-2xl" />
      </div>
      <div className="leading-tight">
        <div className="font-bold text-base tracking-tight text-white">DutyOnTrack</div>
        <div className="text-[9px] uppercase tracking-widest text-white/50 -mt-0.5">Staffing SaaS</div>
      </div>
    </div>
  )
}

// ================= Particles / grid background =================
function AnimatedBackground() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let w = canvas.width = window.innerWidth
    let h = canvas.height = window.innerHeight
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight }
    window.addEventListener('resize', onResize)
    const N = Math.min(90, Math.floor((w * h) / 22000))
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 0.4,
    }))
    let raf
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(168,197,255,0.55)'
        ctx.fill()
      }
      // connections
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const dx = parts[i].x - parts[j].x
          const dy = parts[i].y - parts[j].y
          const d = Math.hypot(dx, dy)
          if (d < 120) {
            ctx.strokeStyle = `rgba(139,158,255,${0.12 * (1 - d / 120)})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(parts[i].x, parts[i].y)
            ctx.lineTo(parts[j].x, parts[j].y)
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf) }
  }, [])
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#050914]">
      {/* base radial glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-600/25 blur-[120px]" />
      <div className="absolute top-[10%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-cyan-500/25 blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-indigo-600/20 blur-[140px]" />
      {/* grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}

// ================= Navbar =================
function Navbar({ onAuth, onBookDemo }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const links = [
    { label: 'Product', to: '#features' },
    { label: 'Industries', to: '#industries' },
    { label: 'Pricing', to: '#pricing' },
    { label: 'Testimonials', to: '#testimonials' },
    { label: 'FAQ', to: '#faq' },
  ]
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all ${scrolled ? 'backdrop-blur-xl bg-[#050914]/70 border-b border-white/5' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a key={l.to} href={l.to} className="px-3 py-2 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5" onClick={() => onAuth('login')}>Login</Button>
          <Button onClick={() => onAuth('signup')} className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 hover:opacity-90 text-white border-0 shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)]">
            Start Free <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <button className="md:hidden text-white p-2" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="md:hidden bg-[#050914]/95 backdrop-blur-xl border-b border-white/10 px-4 pb-4">
            {links.map((l) => (
              <a key={l.to} href={l.to} onClick={() => setOpen(false)} className="block py-2 text-white/80 hover:text-white">{l.label}</a>
            ))}
            <div className="flex gap-2 pt-3 border-t border-white/10">
              <Button variant="ghost" className="text-white flex-1" onClick={() => { setOpen(false); onAuth('login') }}>Login</Button>
              <Button className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500" onClick={() => { setOpen(false); onAuth('signup') }}>Start Free</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ================= 3D Dashboard Preview (right side of hero) =================
function DashboardPreview() {
  const containerRef = useRef(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const smx = useSpring(mx, { stiffness: 60, damping: 20 })
  const smy = useSpring(my, { stiffness: 60, damping: 20 })

  useEffect(() => {
    const onMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      mx.set(((e.clientX - cx) / rect.width) * 20)
      my.set(((e.clientY - cy) / rect.height) * 20)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [mx, my])

  const float = (delay = 0, dur = 6) => ({
    animate: { y: [0, -12, 0], transition: { duration: dur, delay, repeat: Infinity, ease: 'easeInOut' } },
  })

  return (
    <div ref={containerRef} className="relative h-[560px] md:h-[620px] w-full [perspective:1600px]">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-80 h-80 rounded-full bg-gradient-to-br from-cyan-500/30 via-indigo-500/30 to-purple-500/30 blur-3xl" />
      </div>

      {/* Main dashboard card (tilted) */}
      <motion.div
        style={{ rotateX: smy, rotateY: smx, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute top-8 left-1/2 -translate-x-1/2 w-[92%] max-w-[520px] rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
      >
        {/* window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-3 text-[10px] text-white/40 tracking-wide">app.dutyontrack.in</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">Dashboard</div>
              <div className="text-white text-sm font-semibold">Today&apos;s operations</div>
            </div>
            <div className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Live</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Active Duties', val: '48', tint: 'from-cyan-500/20 to-cyan-500/5', ic: ClipboardList },
              { label: 'Available Staff', val: '112', tint: 'from-indigo-500/20 to-indigo-500/5', ic: Users },
              { label: 'Profit Today', val: '₹64k', tint: 'from-purple-500/20 to-purple-500/5', ic: TrendingUp },
            ].map((k, i) => (
              <div key={i} className={`rounded-xl border border-white/10 p-2 bg-gradient-to-br ${k.tint}`}>
                <k.ic className="h-3 w-3 text-white/60" />
                <div className="text-white font-bold text-lg mt-1">{k.val}</div>
                <div className="text-[9px] text-white/50">{k.label}</div>
              </div>
            ))}
          </div>
          {/* Mini chart */}
          <div className="rounded-xl border border-white/10 p-3 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-white/60">Monthly Revenue</div>
              <div className="text-[10px] text-emerald-300">+ 24%</div>
            </div>
            <svg viewBox="0 0 200 60" className="w-full h-14">
              <defs>
                <linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,45 L20,35 L40,40 L60,25 L80,30 L100,15 L120,20 L140,10 L160,18 L180,8 L200,12 L200,60 L0,60 Z" fill="url(#cg1)" />
              <path d="M0,45 L20,35 L40,40 L60,25 L80,30 L100,15 L120,20 L140,10 L160,18 L180,8 L200,12" stroke="#22D3EE" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 p-2 bg-white/[0.02]">
              <div className="flex items-center gap-2 text-[10px] text-white/60"><Calendar className="h-3 w-3" /> Duty Calendar</div>
              <div className="mt-1 grid grid-cols-7 gap-0.5">
                {Array.from({ length: 21 }).map((_, i) => (
                  <div key={i} className={`h-2.5 rounded-sm ${[3, 5, 6, 10, 12, 13, 17, 20].includes(i) ? 'bg-cyan-400/70' : 'bg-white/10'}`} />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 p-2 bg-white/[0.02]">
              <div className="flex items-center gap-2 text-[10px] text-white/60"><FileText className="h-3 w-3" /> Recent Invoices</div>
              <div className="mt-1 space-y-1">
                <div className="flex justify-between text-[9px]"><span className="text-white/70">INV-2026-102</span><span className="text-emerald-300">₹32,500</span></div>
                <div className="flex justify-between text-[9px]"><span className="text-white/70">INV-2026-101</span><span className="text-emerald-300">₹18,900</span></div>
                <div className="flex justify-between text-[9px]"><span className="text-white/70">INV-2026-100</span><span className="text-amber-300">₹24,000</span></div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating side cards */}
      <motion.div {...float(0.2, 7)} className="absolute -left-4 md:-left-8 top-24 w-52 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"><Users className="h-4 w-4 text-white" /></div>
          <div>
            <div className="text-[9px] uppercase text-white/50 tracking-widest">Staff</div>
            <div className="text-white text-sm font-bold">1,284 <span className="text-[10px] text-emerald-300 font-normal">+18</span></div>
          </div>
        </div>
        <div className="flex mt-2 -space-x-2">
          {['#22D3EE', '#6366F1', '#A855F7', '#EC4899'].map((c, i) => (
            <div key={i} className="h-6 w-6 rounded-full border-2 border-[#0b1220]" style={{ background: c }} />
          ))}
        </div>
      </motion.div>

      <motion.div {...float(0.6, 6)} className="absolute -right-4 md:-right-6 top-16 w-56 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-white/[0.02] backdrop-blur-xl p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-white" /></div>
          <div>
            <div className="text-[9px] uppercase text-white/50 tracking-widest">Revenue</div>
            <div className="text-white text-sm font-bold">₹4.82L <span className="text-[10px] text-emerald-300 font-normal">+24%</span></div>
          </div>
        </div>
        <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: '74%' }} transition={{ duration: 1.6, ease: 'easeOut' }} className="h-full bg-gradient-to-r from-emerald-400 to-teal-400" />
        </div>
      </motion.div>

      <motion.div {...float(1.0, 8)} className="absolute right-2 md:right-6 bottom-24 w-52 rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-white/[0.02] backdrop-blur-xl p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center"><IndianRupee className="h-4 w-4 text-white" /></div>
          <div>
            <div className="text-[9px] uppercase text-white/50 tracking-widest">Agency Profit</div>
            <div className="text-white text-sm font-bold">₹1.62L</div>
          </div>
        </div>
      </motion.div>

      <motion.div {...float(0.4, 7.5)} className="absolute -left-2 md:-left-4 bottom-16 w-52 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center"><QrCode className="h-4 w-4 text-white" /></div>
          <div>
            <div className="text-[9px] uppercase text-white/50 tracking-widest">QR Attendance</div>
            <div className="text-white text-sm font-bold">98.4%</div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-0.5 mt-2">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-sm ${Math.random() > 0.3 ? 'bg-amber-400/80' : 'bg-white/10'}`} />
          ))}
        </div>
      </motion.div>

      <motion.div {...float(0.8, 5.5)} className="absolute left-1/2 -translate-x-1/2 -top-2 w-56 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center"><Bell className="h-4 w-4 text-white" /></div>
          <div>
            <div className="text-[9px] uppercase text-white/50 tracking-widest">New Notification</div>
            <div className="text-white text-xs font-medium truncate w-40">Duty joined: Nurse Priya → Sharma</div>
          </div>
        </div>
      </motion.div>

      <motion.div {...float(1.2, 6.5)} className="absolute -right-2 md:-right-4 bottom-2 w-48 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-white/[0.02] backdrop-blur-xl p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"><Building2 className="h-4 w-4 text-white" /></div>
          <div>
            <div className="text-[9px] uppercase text-white/50 tracking-widest">Clients</div>
            <div className="text-white text-sm font-bold">436 <span className="text-[10px] text-emerald-300 font-normal">active</span></div>
          </div>
        </div>
      </motion.div>

      {/* Phone mockup */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6, duration: 0.9 }}
        {...float(1.4, 8)}
        className="absolute right-0 md:-right-8 top-40 w-32 md:w-36 rounded-[26px] border-4 border-white/10 bg-black/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="h-4 bg-black flex items-center justify-center">
          <div className="w-12 h-1 rounded-full bg-white/20" />
        </div>
        <div className="bg-gradient-to-br from-[#0b1220] to-[#050914] p-2 space-y-2">
          <div className="text-white text-[10px] font-semibold">DutyOnTrack</div>
          <div className="rounded-lg border border-white/10 p-2 bg-white/[0.04]">
            <div className="text-[8px] text-white/50">Today</div>
            <div className="text-white text-xs font-bold">6 Duties</div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="rounded-md h-8 bg-cyan-500/20 border border-cyan-500/30" />
            <div className="rounded-md h-8 bg-purple-500/20 border border-purple-500/30" />
          </div>
          <div className="rounded-lg border border-white/10 p-1.5 bg-white/[0.04]">
            <div className="flex items-center justify-between text-[8px]">
              <span className="text-white/70">Revenue</span><span className="text-emerald-300">₹32k</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ================= Hero =================
function Hero({ onAuth, onBookDemo }) {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-white">
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm text-xs text-white/80 mb-6">
            <Sparkle className="h-3 w-3 text-cyan-300" />
            Enterprise-grade Staffing SaaS · 2026
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            India&apos;s Smart{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-indigo-300 to-purple-300 bg-clip-text text-transparent">
              Workforce Management
            </span>{' '}
            Platform
          </h1>
          <p className="mt-6 text-lg text-white/70 max-w-xl leading-relaxed">
            Manage Staff, Clients, Duties, Attendance, Billing and Profit from one intelligent dashboard.
            Built for healthcare, security, housekeeping and driver agencies across India.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={() => onAuth('signup')}
              className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 hover:opacity-90 text-white border-0 shadow-[0_16px_40px_-12px_rgba(99,102,241,0.7)] gap-1">
              Start Free <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={onBookDemo}
              className="border-white/20 bg-white/5 backdrop-blur text-white hover:bg-white/10 gap-1">
              <Play className="h-4 w-4" /> Book Demo
            </Button>
          </div>
          <div className="mt-8 flex items-center gap-6 text-xs text-white/50">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> No credit card</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> Free forever plan</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> 5-min setup</div>
          </div>
          {/* Trust bar */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Trusted by growing agencies</div>
            <div className="flex flex-wrap items-center gap-6 text-white/40">
              {['CarePlus', 'ShieldCorp', 'CleanCo', 'MediServe', 'DriveWell'].map((n) => (
                <div key={n} className="text-sm font-semibold tracking-wide">{n}</div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }}>
          <DashboardPreview />
        </motion.div>
      </div>
    </section>
  )
}

// ================= Section wrapper =================
function SectionShell({ id, eyebrow, title, subtitle, children }) {
  return (
    <section id={id} className="relative py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }} className="text-center max-w-2xl mx-auto mb-14">
          {eyebrow && <div className="text-xs uppercase tracking-widest text-cyan-300 mb-3">{eyebrow}</div>}
          <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight">{title}</h2>
          {subtitle && <p className="mt-4 text-white/60 text-lg leading-relaxed">{subtitle}</p>}
        </motion.div>
        {children}
      </div>
    </section>
  )
}

// ================= Features (3D cards) =================
function FeaturesSection() {
  const items = [
    { Icon: ClipboardList, title: 'Placement Register', text: 'The primary business register — every duty, joining, off and replacement is auto-recorded with staff, client, vendor linked.', tint: 'from-cyan-500 to-blue-600' },
    { Icon: IndianRupee, title: 'Auto Profit Calc', text: 'Client charge − staff salary − vendor commission = live agency profit on every placement.', tint: 'from-emerald-500 to-teal-500' },
    { Icon: BarChart3, title: 'Live Dashboards', text: 'Today\'s duties, revenue, pending payments, 6-month growth charts — updated as you work.', tint: 'from-indigo-500 to-violet-500' },
    { Icon: Stethoscope, title: 'Healthcare Ready', text: 'RT · TT · Oxygen · Catheter · Tracheostomy · Ryles Tube, feeding & medicine instructions per patient.', tint: 'from-rose-500 to-pink-500' },
    { Icon: FileText, title: 'Invoices & Receipts', text: 'Auto-generated professional invoices per placement per month with days-worked calculation.', tint: 'from-amber-500 to-orange-500' },
    { Icon: ShieldCheck, title: 'Multi-Tenant Secure', text: 'Every agency gets a fully isolated workspace. Your data never touches another agency.', tint: 'from-purple-500 to-fuchsia-500' },
  ]
  return (
    <SectionShell id="features" eyebrow="Product" title="Everything your agency needs" subtitle="A unified platform replacing the manual diary, Excel sheets and WhatsApp chaos.">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(({ Icon, title, text, tint }, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6 }}
            whileHover={{ y: -6, rotateX: 2, rotateY: -2 }}
            style={{ transformStyle: 'preserve-3d' }}
            className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-6 overflow-hidden"
          >
            <div className={`absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gradient-to-br ${tint} opacity-0 group-hover:opacity-30 blur-3xl transition-opacity duration-500`} />
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tint} text-white shadow-lg mb-4`}>
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-white text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">{text}</p>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  )
}

// ================= Industries =================
function IndustriesSection() {
  const items = [
    { Icon: HeartPulse, name: 'Healthcare', desc: 'Nurses, attendants, ICU support & home care', tint: 'from-rose-500 to-pink-500' },
    { Icon: ShieldAlert, name: 'Security', desc: 'Guards, supervisors, event security', tint: 'from-amber-500 to-orange-500' },
    { Icon: Sparkle, name: 'Housekeeping', desc: 'Domestic help, cleaners, cooks', tint: 'from-cyan-500 to-blue-500' },
    { Icon: Truck, name: 'Driver Staffing', desc: 'Corporate & personal drivers', tint: 'from-indigo-500 to-violet-500' },
    { Icon: HardHat, name: 'Facility Mgmt', desc: 'Multi-service facility contractors', tint: 'from-emerald-500 to-teal-500' },
  ]
  return (
    <SectionShell id="industries" eyebrow="Industries" title="Built for every staffing vertical" subtitle="Whether you place nurses at hospitals or guards at malls — DutyOnTrack fits.">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map(({ Icon, name, desc, tint }, i) => (
          <motion.div key={name}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
            whileHover={{ y: -6, scale: 1.02 }}
            className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 overflow-hidden group"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${tint} opacity-0 group-hover:opacity-10 transition-opacity`} />
            <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${tint} flex items-center justify-center mb-3 shadow-lg`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="text-white font-semibold">{name}</div>
            <div className="text-xs text-white/50 mt-1">{desc}</div>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  )
}

// ================= Timeline =================
function TimelineSection() {
  const steps = [
    { Icon: Rocket, title: 'Sign up your agency', text: 'Free forever plan — 5 staff & 5 clients included. No credit card.' },
    { Icon: Users, title: 'Onboard your staff', text: 'Add nurses, guards, drivers. Auto-generated staff codes & QR IDs.' },
    { Icon: ClipboardList, title: 'Create placements', text: 'Assign staff to clients. Profit calculates live on every duty.' },
    { Icon: Calendar, title: 'Attendance auto-fills', text: 'When duty starts, attendance backfills as Present daily.' },
    { Icon: LineChart, title: 'Track revenue & profit', text: 'Live P&L, invoices, payments, reports & CSV exports.' },
  ]
  return (
    <SectionShell id="workflow" eyebrow="Workflow" title="From chaos to clarity in 5 minutes" subtitle="A workflow so simple, your office manager onboards it without training.">
      <div className="relative">
        <div className="hidden md:block absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500/0 via-indigo-500/60 to-purple-500/0" />
        <div className="grid md:grid-cols-5 gap-6">
          {steps.map(({ Icon, title, text }, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              className="text-center relative">
              <div className="relative mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(99,102,241,0.7)]">
                <Icon className="h-6 w-6 text-white" />
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white text-[10px] font-bold text-indigo-600 flex items-center justify-center">{i + 1}</div>
              </div>
              <div className="mt-4 text-white font-semibold">{title}</div>
              <div className="mt-1 text-xs text-white/50">{text}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionShell>
  )
}

// ================= Screenshots / preview =================
function ScreenshotsSection() {
  const tabs = ['Dashboard', 'Placements', 'Attendance', 'Invoices']
  const [active, setActive] = useState('Dashboard')
  return (
    <SectionShell id="screenshots" eyebrow="Product Tour" title="Every module. Every device." subtitle="From boardroom to bike-borne field ops — the CRM travels with you.">
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {tabs.map((t) => (
          <button key={t} onClick={() => setActive(t)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-all ${
              active === t ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-transparent shadow-lg' : 'border-white/10 text-white/70 hover:bg-white/5'
            }`}>{t}</button>
        ))}
      </div>
      <motion.div key={active}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative mx-auto max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl overflow-hidden shadow-[0_40px_100px_-30px_rgba(99,102,241,0.5)]">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-3 text-[11px] text-white/40">app.dutyontrack.in / {active.toLowerCase()}</span>
        </div>
        <div className="p-6 grid grid-cols-4 gap-4">
          {active === 'Dashboard' && (
            <>
              {[
                { l: 'Active Duties', v: '48', g: 'from-cyan-500/30' },
                { l: 'Today Joinings', v: '12', g: 'from-emerald-500/30' },
                { l: 'Revenue', v: '₹4.8L', g: 'from-purple-500/30' },
                { l: 'Profit', v: '₹1.6L', g: 'from-amber-500/30' },
              ].map((k, i) => (
                <div key={i} className={`col-span-1 rounded-xl border border-white/10 bg-gradient-to-br ${k.g} to-white/[0.02] p-3`}>
                  <div className="text-[9px] uppercase text-white/50">{k.l}</div>
                  <div className="text-white text-xl font-bold mt-1">{k.v}</div>
                </div>
              ))}
              <div className="col-span-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 h-40">
                <div className="text-white/70 text-xs mb-2">Monthly Revenue & Profit</div>
                <svg viewBox="0 0 400 100" className="w-full h-24">
                  <defs>
                    <linearGradient id="sg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22D3EE" stopOpacity="0.7" /><stop offset="100%" stopColor="#22D3EE" stopOpacity="0" /></linearGradient>
                    <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A855F7" stopOpacity="0.6" /><stop offset="100%" stopColor="#A855F7" stopOpacity="0" /></linearGradient>
                  </defs>
                  <path d="M0,70 L60,55 L120,60 L180,35 L240,45 L300,20 L360,28 L400,15 L400,100 L0,100 Z" fill="url(#sg1)" />
                  <path d="M0,80 L60,72 L120,74 L180,55 L240,60 L300,40 L360,45 L400,30 L400,100 L0,100 Z" fill="url(#sg2)" />
                </svg>
              </div>
            </>
          )}
          {active === 'Placements' && (
            <div className="col-span-4 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="grid grid-cols-6 gap-2 px-3 py-2 border-b border-white/10 text-[10px] uppercase text-white/50">
                <div>Code</div><div className="col-span-2">Staff → Client</div><div>Days</div><div>Bill</div><div>Profit</div>
              </div>
              {[
                ['PLC1042', 'Priya · STF203 → Sharma family', '18', '₹22,500', '₹9,000'],
                ['PLC1041', 'Rakesh · STF187 → Iyer residence', '30', '₹35,000', '₹14,000'],
                ['PLC1040', 'Devi · STF166 → City Hospital', '12', '₹18,000', '₹7,200'],
                ['PLC1039', 'Kumar · STF152 → Villa Verde', '30', '₹40,000', '₹16,500'],
              ].map((r, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 px-3 py-2.5 border-b border-white/5 text-xs text-white/80">
                  <div className="font-mono">{r[0]}</div><div className="col-span-2">{r[1]}</div><div>{r[2]}</div><div>{r[3]}</div><div className="text-emerald-300">{r[4]}</div>
                </div>
              ))}
            </div>
          )}
          {active === 'Attendance' && (
            <div className="col-span-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="grid grid-cols-7 gap-2 mb-2 text-[10px] text-white/50">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => {
                  const s = i % 9 === 0 ? 'A' : (i % 11 === 0 ? 'H' : 'P')
                  const c = s === 'P' ? 'bg-emerald-500' : s === 'H' ? 'bg-amber-500' : 'bg-rose-500'
                  return <div key={i} className={`aspect-square rounded-md ${c} text-white text-xs font-bold flex items-center justify-center opacity-90`}>{s}</div>
                })}
              </div>
            </div>
          )}
          {active === 'Invoices' && (
            <div className="col-span-4 rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-white font-bold text-lg">TAX INVOICE</div>
                  <div className="text-xs text-white/50">INV-2026-00042 · Issued 12-Jul-2026</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-white/50">Bill To</div>
                  <div className="text-white text-sm font-semibold">Sharma Family</div>
                  <div className="text-xs text-white/50">Patient: Mrs. Sharma</div>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between text-white/80"><span>Care service — 30 days @ ₹1,500/day</span><span>₹45,000</span></div>
                <div className="flex justify-between text-white/50"><span>Discount</span><span>-₹1,500</span></div>
                <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2"><span>Total Due</span><span className="text-emerald-300">₹43,500</span></div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </SectionShell>
  )
}

// ================= Pricing =================
function PricingSection({ onAuth }) {
  const [plans, setPlans] = useState(null)
  const [cycle, setCycle] = useState('monthly')
  useEffect(() => {
    fetch('/api/plans/public').then((r) => r.json()).then((d) => setPlans(Array.isArray(d) ? d : [])).catch(() => setPlans([]))
  }, [])
  const fallback = [
    { code: 'FREE', name: 'Free', monthlyPrice: 0, yearlyPrice: 0, maxStaff: 5, maxClients: 5, maxVendors: 5, maxBranches: 1, features: ['Basic CRM', 'Basic Reports'], recommended: false },
    { code: 'STARTER', name: 'Starter', monthlyPrice: 499, yearlyPrice: 4990, maxStaff: 25, maxClients: 25, maxVendors: 25, maxBranches: 1, features: ['Invoices', 'Salary slips', 'Reports export'], recommended: false },
    { code: 'PROFESSIONAL', name: 'Professional', monthlyPrice: 1499, yearlyPrice: 14990, maxStaff: 100, maxClients: 100, maxVendors: 100, maxBranches: 3, features: ['Multi-branch', 'Priority support', 'Advanced analytics'], recommended: true },
    { code: 'ENTERPRISE', name: 'Enterprise', monthlyPrice: 4999, yearlyPrice: 49990, maxStaff: 10000, maxClients: 10000, maxVendors: 10000, maxBranches: 100, features: ['Unlimited scale', 'Dedicated manager', 'Custom integrations'], recommended: false },
  ]
  const list = (plans && plans.length ? plans : fallback)
  const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`
  return (
    <SectionShell id="pricing" eyebrow="Pricing" title="Simple, transparent pricing" subtitle="Start free. Upgrade when you outgrow — pay by UPI/bank, no cards required.">
      <div className="flex justify-center mb-8">
        <div className="inline-flex p-1 rounded-full border border-white/10 bg-white/5 backdrop-blur">
          {['monthly', 'yearly'].map((c) => (
            <button key={c} onClick={() => setCycle(c)}
              className={`px-4 py-1.5 rounded-full text-sm capitalize ${cycle === c ? 'bg-white text-slate-900 font-semibold' : 'text-white/70'}`}>
              {c} {c === 'yearly' && <span className="text-[10px] text-emerald-500 ml-1">-15%</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {list.map((p, i) => (
          <motion.div key={p.code}
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
            className={`relative rounded-2xl border p-6 backdrop-blur-xl overflow-hidden ${
              p.recommended ? 'border-transparent bg-gradient-to-br from-indigo-500/20 via-white/[0.06] to-purple-500/20 shadow-[0_30px_80px_-20px_rgba(99,102,241,0.6)]' : 'border-white/10 bg-white/[0.03]'
            }`}>
            {p.recommended && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 shadow-lg">Most Popular</div>
            )}
            <div className="text-white font-semibold text-lg">{p.name}</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-white text-4xl font-bold">{inr(cycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice)}</span>
              <span className="text-white/40 text-xs">/{cycle === 'yearly' ? 'yr' : 'mo'}</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-white/70">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300 mt-0.5 shrink-0" /> {p.maxStaff} Staff</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300 mt-0.5 shrink-0" /> {p.maxClients} Clients</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300 mt-0.5 shrink-0" /> {p.maxVendors} Vendors</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300 mt-0.5 shrink-0" /> {p.maxBranches} Branch{p.maxBranches > 1 ? 'es' : ''}</li>
              {(p.features || []).slice(0, 4).map((f, k) => (
                <li key={k} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300 mt-0.5 shrink-0" /> {f}</li>
              ))}
            </ul>
            <Button className={`w-full mt-6 border-0 ${p.recommended ? 'bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              onClick={() => onAuth('signup')}>
              {p.monthlyPrice === 0 ? 'Start Free' : `Choose ${p.name}`}
            </Button>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  )
}

// ================= Testimonials =================
function TestimonialsSection() {
  const items = [
    { name: 'Rahul Mehta', role: 'Owner · CarePlus Nursing', color: 'from-cyan-500 to-blue-600', quote: 'We replaced 3 notebooks and 2 Excel files with DutyOnTrack. Profit tracking became automatic — and we hired 40% more staff last quarter.' },
    { name: 'Priya Sharma', role: 'HR · ShieldCorp Security', color: 'from-purple-500 to-fuchsia-500', quote: 'The placement register is a game-changer. Every duty, every rupee, every replacement — one glance and we know everything.' },
    { name: 'Ajay Patel', role: 'Director · CleanCo Facilities', color: 'from-emerald-500 to-teal-500', quote: 'Our clients are impressed with the professional invoices. Payments started arriving 12 days faster.' },
    { name: 'Sunita Rao', role: 'Owner · DriveWell Staffing', color: 'from-amber-500 to-orange-500', quote: 'Attendance auto-fills the moment a driver starts — no more calling supervisors for confirmations. Absolute time-saver.' },
  ]
  return (
    <SectionShell id="testimonials" eyebrow="Testimonials" title="Loved by agencies across India" subtitle="Real stories from healthcare, security, housekeeping and driver staffing owners.">
      <div className="grid md:grid-cols-2 gap-5">
        {items.map((t, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-xl p-6">
            <div className="flex mb-3">
              {Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-4 w-4 text-amber-400 fill-amber-400" />)}
            </div>
            <p className="text-white/80 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-5 flex items-center gap-3">
              <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold`}>{t.name.split(' ').map(s => s[0]).join('')}</div>
              <div>
                <div className="text-white font-semibold text-sm">{t.name}</div>
                <div className="text-white/50 text-xs">{t.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionShell>
  )
}

// ================= FAQ =================
function FaqSection() {
  const items = [
    { q: 'Is there really a free plan forever?', a: 'Yes. Every registered agency starts on the Free plan (5 staff + 5 clients) with no expiry, no credit card and no auto-charge.' },
    { q: 'Which industries does DutyOnTrack support?', a: 'Healthcare (nurses, attendants), Security (guards), Housekeeping (domestic help, cooks), Driver staffing and Facility Management contractors. The Placement Register works for any staff-to-client assignment.' },
    { q: 'How does the multi-tenant data isolation work?', a: 'Every record — staff, client, placement, invoice, attendance — is scoped by your unique agency ID. Your data is completely invisible to other agencies. Only Super Admin sees platform-wide metrics.' },
    { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. Upgrade instantly via UPI/bank transfer (manual approval by our team, usually within 2 hours). Downgrade takes effect at next renewal.' },
    { q: 'Do you have a mobile app?', a: 'The web app is fully responsive and PWA-ready. Native iOS/Android apps are on our roadmap.' },
    { q: 'What about GST invoicing?', a: 'Every invoice can include your GST number, tax percentage, and generates a professional PDF you can print or email. Tax settings are configurable.' },
  ]
  return (
    <SectionShell id="faq" eyebrow="FAQ" title="Frequently asked questions" subtitle="Everything owners want to know before switching.">
      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
          {items.map((it, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-b border-white/10 last:border-0 px-5">
              <AccordionTrigger className="text-white hover:no-underline text-left">{it.q}</AccordionTrigger>
              <AccordionContent className="text-white/60 leading-relaxed">{it.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </SectionShell>
  )
}

// ================= CTA =================
function CTASection({ onAuth, onBookDemo }) {
  return (
    <section className="relative py-24">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-purple-500/20 p-10 md:p-16 text-center">
          <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-cyan-500/40 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-purple-500/40 blur-3xl" />
          <div className="relative">
            <Award className="mx-auto h-10 w-10 text-white/80 mb-4" />
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">Ready to transform your agency?</h2>
            <p className="mt-4 text-white/70 max-w-xl mx-auto">Join hundreds of staffing agencies replacing manual registers with intelligent workflows.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={() => onAuth('signup')} className="bg-white text-slate-900 hover:bg-white/90 gap-1 font-semibold">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={onBookDemo} className="border-white/30 text-white hover:bg-white/10 gap-1">
                <Play className="h-4 w-4" /> Book a Demo
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ================= Footer =================
function PremiumFooter() {
  const [year] = useState(new Date().getFullYear())
  return (
    <footer className="relative border-t border-white/10 bg-[#050914]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 grid md:grid-cols-6 gap-8">
        <div className="md:col-span-2 space-y-4">
          <Logo />
          <p className="text-sm text-white/50 max-w-xs">India&apos;s smart workforce management platform for staffing agencies. Replace manual registers with intelligent workflows.</p>
          <div className="flex items-center gap-3 text-white/50 text-xs">
            <Globe className="h-3.5 w-3.5" /> Made in India · Serving globally
          </div>
        </div>
        <div>
          <div className="text-white text-sm font-semibold mb-3">Product</div>
          <ul className="space-y-2 text-sm text-white/60">
            <li><a href="#features" className="hover:text-white">Features</a></li>
            <li><a href="#industries" className="hover:text-white">Industries</a></li>
            <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
            <li><a href="#screenshots" className="hover:text-white">Screenshots</a></li>
          </ul>
        </div>
        <div>
          <div className="text-white text-sm font-semibold mb-3">Solutions</div>
          <ul className="space-y-2 text-sm text-white/60">
            <li>Healthcare Staffing</li>
            <li>Security Guard</li>
            <li>Housekeeping</li>
            <li>Driver Staffing</li>
            <li>Facility Management</li>
          </ul>
        </div>
        <div>
          <div className="text-white text-sm font-semibold mb-3">Company</div>
          <ul className="space-y-2 text-sm text-white/60">
            <li><a href="#faq" className="hover:text-white">FAQ</a></li>
            <li><a href="#testimonials" className="hover:text-white">Testimonials</a></li>
            <li>Privacy</li>
            <li>Terms</li>
          </ul>
        </div>
        <div>
          <div className="text-white text-sm font-semibold mb-3">Contact</div>
          <ul className="space-y-2 text-sm text-white/60">
            <li>hello@dutyontrack.in</li>
            <li>WhatsApp support</li>
            <li>+91 · 24×7 chat</li>
          </ul>
          <div className="flex gap-2 mt-4">
            {['𝕏', 'in', 'f', 'ig'].map((s) => (
              <div key={s} className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/70 text-xs cursor-pointer hover:bg-white/10">{s}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-white/40">
          <div>© {year} DutyOnTrack. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> SOC-2 ready</span>
            <span>Made with ♥ for staffing agencies</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ================= Book Demo Dialog (super light) =================
function BookDemoOverlay({ open, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b1220] to-[#050914] p-6 relative"
        onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/60 hover:text-white"><X className="h-5 w-5" /></button>
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center mb-4"><Play className="h-5 w-5 text-white" /></div>
        <h3 className="text-white text-2xl font-bold">Book a live demo</h3>
        <p className="text-white/60 text-sm mt-2">Get a 20-minute personalized walkthrough with a product expert.</p>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-cyan-300" /> Usually replied within 2 hours</li>
          <li className="flex items-center gap-2"><Globe className="h-4 w-4 text-cyan-300" /> Available in English & Hindi</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> No obligation, no card</li>
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          <a href="https://wa.me/919999999999?text=Hi%20I%20want%20a%20DutyOnTrack%20demo" target="_blank" rel="noreferrer">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white gap-2">💬 Chat on WhatsApp</Button>
          </a>
          <a href="mailto:hello@dutyontrack.in?subject=Book%20a%20demo">
            <Button variant="outline" className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 gap-2">✉ Email us</Button>
          </a>
        </div>
      </motion.div>
    </div>
  )
}

// ================= Landing (default export) =================
export function Landing({ onAuth }) {
  const [demoOpen, setDemoOpen] = useState(false)
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => { document.documentElement.style.scrollBehavior = 'auto' }
  }, [])
  return (
    <div className="min-h-screen text-white relative">
      <AnimatedBackground />
      <Navbar onAuth={onAuth} onBookDemo={() => setDemoOpen(true)} />
      <Hero onAuth={onAuth} onBookDemo={() => setDemoOpen(true)} />
      <FeaturesSection />
      <IndustriesSection />
      <TimelineSection />
      <ScreenshotsSection />
      <PricingSection onAuth={onAuth} />
      <TestimonialsSection />
      <FaqSection />
      <CTASection onAuth={onAuth} onBookDemo={() => setDemoOpen(true)} />
      <PremiumFooter />
      <BookDemoOverlay open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  )
}
