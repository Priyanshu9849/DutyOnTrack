'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
  LayoutDashboard, Users, Building2, Store, ClipboardList, LogOut, Plus,
  Search, TrendingUp, IndianRupee, UserCheck, UserX, CalendarDays, Activity,
  Trash2, Edit3, Check, X, Menu, Moon, Sun, ArrowRight, Sparkles, ShieldCheck,
  BarChart3, Zap, ClipboardCheck, Stethoscope
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

// ============================= Utilities =============================
const TOKEN_KEY = 'dot_token'
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null)
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function api(path, opts = {}) {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0))

// ============================= Logo =============================
function Logo({ size = 32, showText = true }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dotGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#dotGrad)" />
        <path d="M12 20 L18 26 L28 14" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="31" cy="9" r="3" fill="#F59E0B" stroke="white" strokeWidth="1.5" />
      </svg>
      {showText && (
        <div className="leading-tight">
          <div className="font-bold text-base tracking-tight">DutyOnTrack</div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground -mt-0.5">Staffing SaaS</div>
        </div>
      )}
    </div>
  )
}

// ============================= Theme Toggle =============================
function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setDark(isDark)
  }, [])
  const toggle = () => {
    const next = !dark
    setDark(next)
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

// ============================= Landing =============================
function Landing({ onAuth }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/40 backdrop-blur sticky top-0 z-30 bg-background/70">
        <div className="container flex items-center justify-between h-16">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => onAuth('login')}>Login</Button>
            <Button onClick={() => onAuth('signup')} className="gap-1">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="container py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4 gap-1"><Sparkles className="h-3 w-3" /> Enterprise-grade Staffing SaaS</Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            Replace your manual duty register with an intelligent digital one
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            DutyOnTrack is a multi-tenant workforce management platform for staffing agencies — healthcare, security, housekeeping, drivers.
            Track duties, staff, clients and vendors in real-time, with <strong className="text-foreground">auto-calculated agency profit</strong> on every placement.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => onAuth('signup')} className="gap-1">
              Start free — 5 staff, 5 clients <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => onAuth('login')}>Login to your agency</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">No credit card required · Free forever plan</p>
        </div>
      </section>

      <section className="container pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { Icon: ClipboardCheck, title: 'Placement Register', text: 'The primary business register — every duty joining, off, replacement recorded automatically with staff, client & vendor linked.' },
            { Icon: IndianRupee, title: 'Auto Profit Calc', text: 'Client charge minus staff salary minus vendor commission — computed live on every placement. No more Excel headaches.' },
            { Icon: BarChart3, title: 'Live Dashboards', text: 'Today\'s joinings, revenue, expenses, pending payments, monthly growth charts — updated as you work.' },
            { Icon: Stethoscope, title: 'Healthcare Ready', text: 'Patient medical notes: RT, TT, Oxygen, Catheter, Tracheostomy, Ryles tube, medicines, doctor & hospital.' },
            { Icon: ShieldCheck, title: 'Multi-Tenant Isolation', text: 'Every agency gets a fully isolated workspace. Your data never touches another agency.' },
            { Icon: Zap, title: 'Fast & Responsive', text: 'Mobile, tablet, desktop. Dark & light mode. Built for real-world office & field use.' },
          ].map(({ Icon, title, text }, i) => (
            <Card key={i} className="border-border/60">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="mt-3 text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{text}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/40">
        <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Logo size={24} showText /></div>
          <div>© {new Date().getFullYear()} DutyOnTrack. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}

// ============================= Auth =============================
function AuthScreen({ initialMode = 'login', onSuccess, onBack }) {
  const [mode, setMode] = useState(initialMode)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    agencyName: '', ownerName: '', email: '', password: '', phone: '',
    businessType: 'Healthcare Staffing', city: '', state: '',
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login'
      const body = mode === 'signup' ? form : { email: form.email, password: form.password }
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(body) })
      setToken(data.token)
      toast.success(mode === 'signup' ? 'Welcome to DutyOnTrack!' : 'Welcome back!')
      onSuccess(data)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <Logo />
            <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
          </div>
          <CardTitle className="text-2xl">
            {mode === 'signup' ? 'Register your agency' : 'Login to your agency'}
          </CardTitle>
          <CardDescription>
            {mode === 'signup' ? 'Get started with the FREE plan — 5 staff & 5 clients included.' : 'Enter your credentials to access your workspace.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <div>
                  <Label>Agency Name</Label>
                  <Input required value={form.agencyName} onChange={(e) => set('agencyName', e.target.value)} placeholder="e.g., CarePlus Staffing" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Owner Name</Label>
                    <Input required value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10-digit mobile" />
                  </div>
                </div>
                <div>
                  <Label>Business Type</Label>
                  <Select value={form.businessType} onValueChange={(v) => set('businessType', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Healthcare Staffing">Healthcare Staffing</SelectItem>
                      <SelectItem value="Security Guard">Security Guard</SelectItem>
                      <SelectItem value="Housekeeping">Housekeeping</SelectItem>
                      <SelectItem value="Facility Management">Facility Management</SelectItem>
                      <SelectItem value="Driver Staffing">Driver Staffing</SelectItem>
                      <SelectItem value="General Staffing">General Staffing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input value={form.state} onChange={(e) => set('state', e.target.value)} />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label>Email</Label>
              <Input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input required type="password" minLength={6} value={form.password} onChange={(e) => set('password', e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create Agency Account' : 'Login'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'signup' ? 'Already have an agency?' : "Don't have an account yet?"}{' '}
            <button className="text-primary font-medium hover:underline" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
              {mode === 'signup' ? 'Login' : 'Sign up'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================= Sidebar / Shell =============================
const NAV = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'placements', label: 'Placements', Icon: ClipboardList },
  { key: 'staff', label: 'Staff', Icon: Users },
  { key: 'clients', label: 'Clients / Patients', Icon: Building2 },
  { key: 'vendors', label: 'Vendors', Icon: Store },
]

function Shell({ user, agency, onLogout, children, active, setActive }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Logo size={28} />
          </div>
          <GlobalSearch onNavigate={setActive} />
          <div className="flex items-center gap-2">
            <div className="hidden md:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium">{user?.name}</span>
              <span className="text-[10px] text-muted-foreground">{agency?.name} · {agency?.plan}</span>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={onLogout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - desktop */}
        <aside className="hidden md:block w-60 border-r bg-background min-h-[calc(100vh-3.5rem)] p-3 space-y-1">
          {NAV.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active === key ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground/80'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
          <div className="pt-6 mt-6 border-t">
            <div className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Agency</div>
            <div className="px-3 text-sm font-medium truncate">{agency?.name}</div>
            <div className="px-3 text-xs text-muted-foreground">{agency?.businessType}</div>
            <Badge variant="secondary" className="mx-3 mt-2">{agency?.plan} PLAN</Badge>
          </div>
        </aside>

        {/* Sidebar - mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur" onClick={() => setMobileOpen(false)}>
            <div className="absolute left-0 top-0 h-full w-64 bg-background border-r p-3 space-y-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <Logo size={28} />
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
              {NAV.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => { setActive(key); setMobileOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm ${active === key ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
                >
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

// ============================= Global Search =============================
function GlobalSearch({ onNavigate }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!q.trim()) { setResults(null); return }
    const t = setTimeout(async () => {
      try {
        const r = await api(`/search?q=${encodeURIComponent(q)}`)
        setResults(r)
      } catch (e) {}
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const total = results ? (results.staff.length + results.clients.length + results.vendors.length + results.placements.length) : 0

  return (
    <div className="relative w-full max-w-md hidden sm:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search staff, clients, patients, vendors..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="pl-9"
      />
      {open && q && results && total > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-96 overflow-auto z-50">
          {results.staff.length > 0 && <div className="px-3 pt-2 text-[10px] uppercase text-muted-foreground">Staff</div>}
          {results.staff.map((s) => (
            <button key={s.id} onClick={() => onNavigate('staff')} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between">
              <span>{s.name}</span><span className="text-xs text-muted-foreground">{s.staffCode}</span>
            </button>
          ))}
          {results.clients.length > 0 && <div className="px-3 pt-2 text-[10px] uppercase text-muted-foreground">Clients</div>}
          {results.clients.map((c) => (
            <button key={c.id} onClick={() => onNavigate('clients')} className="w-full text-left px-3 py-2 hover:bg-muted text-sm">
              {c.name} {c.patientName && <span className="text-muted-foreground">· patient: {c.patientName}</span>}
            </button>
          ))}
          {results.vendors.length > 0 && <div className="px-3 pt-2 text-[10px] uppercase text-muted-foreground">Vendors</div>}
          {results.vendors.map((v) => (
            <button key={v.id} onClick={() => onNavigate('vendors')} className="w-full text-left px-3 py-2 hover:bg-muted text-sm">{v.name}</button>
          ))}
          {results.placements.length > 0 && <div className="px-3 pt-2 text-[10px] uppercase text-muted-foreground">Placements</div>}
          {results.placements.map((p) => (
            <button key={p.id} onClick={() => onNavigate('placements')} className="w-full text-left px-3 py-2 hover:bg-muted text-sm">{p.code}</button>
          ))}
        </div>
      )}
      {open && q && results && total === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground z-50">No matches found.</div>
      )}
    </div>
  )
}

// ============================= Dashboard =============================
function StatCard({ label, value, Icon, hint, tone = 'default' }) {
  const tones = {
    default: 'from-primary/10 to-primary/5 text-primary',
    green: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    red: 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400',
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400',
    blue: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400',
  }
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${tones[tone]} flex items-center justify-center`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Dashboard({ setActive }) {
  const [data, setData] = useState(null)
  const load = useCallback(async () => {
    try {
      const d = await api('/dashboard')
      setData(d)
    } catch (e) { toast.error(e.message) }
  }, [])
  useEffect(() => { load() }, [load])

  if (!data) return <div className="text-sm text-muted-foreground">Loading...</div>

  const c = data.cards

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live snapshot of your agency operations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setActive('staff')}><Plus className="h-4 w-4 mr-1" /> Add Staff</Button>
          <Button variant="outline" size="sm" onClick={() => setActive('clients')}><Plus className="h-4 w-4 mr-1" /> Add Client</Button>
          <Button size="sm" onClick={() => setActive('placements')}><Plus className="h-4 w-4 mr-1" /> New Placement</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Duties" value={c.activePlacements} Icon={ClipboardList} tone="blue" />
        <StatCard label="Today's Joinings" value={c.todaysJoinings} Icon={UserCheck} tone="green" />
        <StatCard label="Today's Off" value={c.todaysOff} Icon={UserX} tone="red" />
        <StatCard label="Available Staff" value={c.availableStaff} Icon={Users} tone="amber" hint={`${c.busyStaff} on duty · ${c.onLeave} on leave`} />

        <StatCard label="Total Revenue" value={fmtINR(c.totalRevenue)} Icon={TrendingUp} tone="green" hint="across all placements" />
        <StatCard label="Staff Salary" value={fmtINR(c.totalStaffSalary)} Icon={IndianRupee} tone="amber" />
        <StatCard label="Vendor Commission" value={fmtINR(c.totalVendorCommission)} Icon={Store} tone="blue" />
        <StatCard label="Agency Profit" value={fmtINR(c.totalProfit)} Icon={Sparkles} tone="green" hint="auto-calculated live" />

        <StatCard label="Pending Client Payments" value={fmtINR(c.pendingClientPayments)} Icon={IndianRupee} tone="red" />
        <StatCard label="Pending Staff Salary" value={fmtINR(c.pendingSalary)} Icon={IndianRupee} tone="red" />
        <StatCard label="Total Clients" value={c.totalClients} Icon={Building2} tone="default" />
        <StatCard label="Total Vendors" value={c.totalVendors} Icon={Store} tone="default" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Monthly Revenue & Profit</CardTitle>
          <CardDescription>Last 6 months (auto-calculated from placement date ranges)</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthly}>
              <defs>
                <linearGradient id="grev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gpro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(v) => fmtINR(v)} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#6366F1" fill="url(#grev)" strokeWidth={2} />
              <Area type="monotone" dataKey="profit" stroke="#10B981" fill="url(#gpro)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Recent Activities</CardTitle>
          <CardDescription>Digital register — every important action recorded automatically</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentActivities.length === 0 && (
            <p className="text-sm text-muted-foreground">No activities yet. Add staff, clients, and create a placement to see the register in action.</p>
          )}
          <ul className="space-y-2">
            {data.recentActivities.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5"></div>
                <div className="flex-1">
                  <div>{a.message}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</div>
                </div>
                <Badge variant="outline" className="text-xs">{a.type}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================= Reusable list section =============================
function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ============================= Staff =============================
function StaffModule() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')

  const load = async () => {
    try { setItems(await api('/staff')) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [])

  const remove = async (id) => {
    if (!confirm('Delete this staff member?')) return
    try { await api(`/staff/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load() } catch (e) { toast.error(e.message) }
  }

  const filtered = useMemo(() => {
    if (!q) return items
    const rx = new RegExp(q, 'i')
    return items.filter((i) => rx.test(i.name || '') || rx.test(i.phone || '') || rx.test(i.staffCode || ''))
  }, [items, q])

  return (
    <div>
      <SectionHeader
        title="Staff"
        subtitle="Manage your workforce — nurses, guards, drivers, housekeepers"
        action={
          <div className="flex gap-2">
            <Input placeholder="Filter..." value={q} onChange={(e) => setQ(e.target.value)} className="w-40" />
            <Button onClick={() => { setEditing(null); setOpen(true) }} className="gap-1"><Plus className="h-4 w-4" /> Add Staff</Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Skills</th>
                <th className="text-right p-3">Monthly Salary</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No staff yet. Click &quot;Add Staff&quot; to get started.</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{s.staffCode}</td>
                  <td className="p-3 font-medium">{s.name}<div className="text-xs text-muted-foreground">{s.qualification}</div></td>
                  <td className="p-3">{s.phone}</td>
                  <td className="p-3 text-xs text-muted-foreground">{s.skills}</td>
                  <td className="p-3 text-right">{fmtINR(s.monthlySalary)}</td>
                  <td className="p-3"><Badge variant={s.status === 'onduty' ? 'default' : s.status === 'leave' ? 'secondary' : 'outline'}>{s.status}</Badge></td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true) }}><Edit3 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <StaffForm open={open} onOpenChange={setOpen} initial={editing} onSaved={() => { setOpen(false); load() }} />
    </div>
  )
}

function StaffForm({ open, onOpenChange, initial, onSaved }) {
  const [f, setF] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setF(initial || {
      name: '', fatherName: '', phone: '', altPhone: '', email: '', dob: '', gender: '',
      address: '', city: '', state: '', pincode: '',
      aadhaar: '', pan: '', bankName: '', accountNumber: '', ifsc: '', upi: '',
      emergencyContact: '', bloodGroup: '', qualification: '', skills: '',
      experience: '', languages: '', joiningDate: new Date().toISOString().slice(0, 10),
      status: 'available', monthlySalary: 0, notes: '',
    })
  }, [initial, open])

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (initial) await api(`/staff/${initial.id}`, { method: 'PUT', body: JSON.stringify(f) })
      else await api('/staff', { method: 'POST', body: JSON.stringify(f) })
      toast.success('Saved')
      onSaved()
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
          <DialogDescription>Complete profile with personal, professional & banking details</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Tabs defaultValue="personal">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="professional">Professional</TabsTrigger>
              <TabsTrigger value="banking">Banking / KYC</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Full Name *</Label><Input required value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
                <div><Label>Father&apos;s Name</Label><Input value={f.fatherName || ''} onChange={(e) => set('fatherName', e.target.value)} /></div>
                <div><Label>DOB</Label><Input type="date" value={f.dob || ''} onChange={(e) => set('dob', e.target.value)} /></div>
                <div>
                  <Label>Gender</Label>
                  <Select value={f.gender || ''} onValueChange={(v) => set('gender', v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Blood Group</Label><Input value={f.bloodGroup || ''} onChange={(e) => set('bloodGroup', e.target.value)} /></div>
                <div><Label>Languages</Label><Input value={f.languages || ''} onChange={(e) => set('languages', e.target.value)} placeholder="Hindi, English" /></div>
              </div>
            </TabsContent>
            <TabsContent value="contact" className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Mobile *</Label><Input value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
                <div><Label>Alternate Mobile</Label><Input value={f.altPhone || ''} onChange={(e) => set('altPhone', e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
                <div><Label>Emergency Contact</Label><Input value={f.emergencyContact || ''} onChange={(e) => set('emergencyContact', e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={f.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
                <div><Label>City</Label><Input value={f.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
                <div><Label>State</Label><Input value={f.state || ''} onChange={(e) => set('state', e.target.value)} /></div>
                <div><Label>Pincode</Label><Input value={f.pincode || ''} onChange={(e) => set('pincode', e.target.value)} /></div>
              </div>
            </TabsContent>
            <TabsContent value="professional" className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Qualification</Label><Input value={f.qualification || ''} onChange={(e) => set('qualification', e.target.value)} placeholder="GNM / ANM / 12th" /></div>
                <div><Label>Experience</Label><Input value={f.experience || ''} onChange={(e) => set('experience', e.target.value)} placeholder="e.g., 3 years" /></div>
                <div className="md:col-span-2"><Label>Skills</Label><Textarea rows={2} value={f.skills || ''} onChange={(e) => set('skills', e.target.value)} placeholder="Patient care, injections, tracheostomy care..." /></div>
                <div><Label>Joining Date</Label><Input type="date" value={f.joiningDate || ''} onChange={(e) => set('joiningDate', e.target.value)} /></div>
                <div><Label>Monthly Salary (₹)</Label><Input type="number" value={f.monthlySalary || 0} onChange={(e) => set('monthlySalary', e.target.value)} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={f.status || 'available'} onValueChange={(v) => set('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="onduty">On Duty</SelectItem>
                      <SelectItem value="leave">On Leave</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></div>
              </div>
            </TabsContent>
            <TabsContent value="banking" className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Aadhaar</Label><Input value={f.aadhaar || ''} onChange={(e) => set('aadhaar', e.target.value)} /></div>
                <div><Label>PAN</Label><Input value={f.pan || ''} onChange={(e) => set('pan', e.target.value)} /></div>
                <div><Label>Bank Name</Label><Input value={f.bankName || ''} onChange={(e) => set('bankName', e.target.value)} /></div>
                <div><Label>Account Number</Label><Input value={f.accountNumber || ''} onChange={(e) => set('accountNumber', e.target.value)} /></div>
                <div><Label>IFSC</Label><Input value={f.ifsc || ''} onChange={(e) => set('ifsc', e.target.value)} /></div>
                <div><Label>UPI ID</Label><Input value={f.upi || ''} onChange={(e) => set('upi', e.target.value)} /></div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Staff'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================= Clients =============================
function ClientsModule() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const load = async () => { try { setItems(await api('/clients')) } catch (e) { toast.error(e.message) } }
  useEffect(() => { load() }, [])
  const remove = async (id) => {
    if (!confirm('Delete this client?')) return
    try { await api(`/clients/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load() } catch (e) { toast.error(e.message) }
  }

  return (
    <div>
      <SectionHeader
        title="Clients & Patients"
        subtitle="Client billing, patient medical notes, and care instructions"
        action={<Button onClick={() => { setEditing(null); setOpen(true) }} className="gap-1"><Plus className="h-4 w-4" /> Add Client</Button>}
      />
      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3">Patient</th>
                <th className="text-left p-3">Location</th>
                <th className="text-left p-3">Care Type</th>
                <th className="text-right p-3">Monthly Charge</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No clients yet.</td></tr>}
              {items.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{c.code}</td>
                  <td className="p-3 font-medium">{c.name}<div className="text-xs text-muted-foreground">{c.phone}</div></td>
                  <td className="p-3">{c.patientName || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3"><Badge variant="outline">{c.location}</Badge></td>
                  <td className="p-3 text-xs">{c.careType}</td>
                  <td className="p-3 text-right">{fmtINR(c.monthlyCharges)}</td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true) }}><Edit3 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <ClientForm open={open} onOpenChange={setOpen} initial={editing} onSaved={() => { setOpen(false); load() }} />
    </div>
  )
}

function ClientForm({ open, onOpenChange, initial, onSaved }) {
  const [f, setF] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setF(initial || {
      name: '', patientName: '', phone: '', email: '', address: '', city: '',
      location: 'Home', careType: '', emergencyContact: '',
      doctorName: '', hospital: '', medicalNotes: '', feedingInstructions: '',
      medicineNotes: '', specialInstructions: '',
      rtTube: false, ttTube: false, oxygen: false, catheter: false, tracheostomy: false, rylesTube: false,
      monthlyCharges: 0, advance: 0, securityDeposit: 0, discount: 0, notes: '',
    })
  }, [initial, open])
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (initial) await api(`/clients/${initial.id}`, { method: 'PUT', body: JSON.stringify(f) })
      else await api('/clients', { method: 'POST', body: JSON.stringify(f) })
      toast.success('Saved'); onSaved()
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  const flag = (label, key) => (
    <button type="button" onClick={() => set(key, !f[key])}
      className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${f[key] ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>
      {f[key] && <Check className="inline h-3 w-3 mr-1" />}{label}
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Client' : 'Add Client'}</DialogTitle>
          <DialogDescription>Client + patient details, medical care requirements & billing</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Tabs defaultValue="basic">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="basic">Client & Patient</TabsTrigger>
              <TabsTrigger value="medical">Medical Notes</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Client Name *</Label><Input required value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
                <div><Label>Patient Name</Label><Input value={f.patientName || ''} onChange={(e) => set('patientName', e.target.value)} /></div>
                <div><Label>Phone</Label><Input value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
                <div><Label>Email</Label><Input value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
                <div><Label>Emergency Contact</Label><Input value={f.emergencyContact || ''} onChange={(e) => set('emergencyContact', e.target.value)} /></div>
                <div>
                  <Label>Location</Label>
                  <Select value={f.location || 'Home'} onValueChange={(v) => set('location', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Home">Home</SelectItem>
                      <SelectItem value="Hospital">Hospital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={f.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
                <div><Label>City</Label><Input value={f.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
                <div><Label>Care Type / Disease</Label><Input value={f.careType || ''} onChange={(e) => set('careType', e.target.value)} placeholder="Post-op care, elderly care, ICU support" /></div>
              </div>
            </TabsContent>
            <TabsContent value="medical" className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Doctor Name</Label><Input value={f.doctorName || ''} onChange={(e) => set('doctorName', e.target.value)} /></div>
                <div><Label>Hospital</Label><Input value={f.hospital || ''} onChange={(e) => set('hospital', e.target.value)} /></div>
              </div>
              <div>
                <Label>Medical Requirements</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {flag('RT Tube', 'rtTube')}
                  {flag('TT Tube', 'ttTube')}
                  {flag('Oxygen', 'oxygen')}
                  {flag('Catheter', 'catheter')}
                  {flag('Tracheostomy', 'tracheostomy')}
                  {flag('Ryles Tube', 'rylesTube')}
                </div>
              </div>
              <div><Label>Medical Notes</Label><Textarea rows={2} value={f.medicalNotes || ''} onChange={(e) => set('medicalNotes', e.target.value)} /></div>
              <div><Label>Feeding Instructions</Label><Textarea rows={2} value={f.feedingInstructions || ''} onChange={(e) => set('feedingInstructions', e.target.value)} /></div>
              <div><Label>Medicine Notes</Label><Textarea rows={2} value={f.medicineNotes || ''} onChange={(e) => set('medicineNotes', e.target.value)} /></div>
              <div><Label>Special Instructions</Label><Textarea rows={2} value={f.specialInstructions || ''} onChange={(e) => set('specialInstructions', e.target.value)} /></div>
            </TabsContent>
            <TabsContent value="billing" className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Monthly Charges (₹)</Label><Input type="number" value={f.monthlyCharges || 0} onChange={(e) => set('monthlyCharges', e.target.value)} /></div>
                <div><Label>Advance (₹)</Label><Input type="number" value={f.advance || 0} onChange={(e) => set('advance', e.target.value)} /></div>
                <div><Label>Security Deposit (₹)</Label><Input type="number" value={f.securityDeposit || 0} onChange={(e) => set('securityDeposit', e.target.value)} /></div>
                <div><Label>Discount (₹)</Label><Input type="number" value={f.discount || 0} onChange={(e) => set('discount', e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Client'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================= Vendors =============================
function VendorsModule() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const load = async () => { try { setItems(await api('/vendors')) } catch (e) { toast.error(e.message) } }
  useEffect(() => { load() }, [])
  const remove = async (id) => {
    if (!confirm('Delete this vendor?')) return
    try { await api(`/vendors/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load() } catch (e) { toast.error(e.message) }
  }
  return (
    <div>
      <SectionHeader
        title="Vendors"
        subtitle="Partner staffing vendors who supply staff. Commission auto-deducted from placements."
        action={<Button onClick={() => { setEditing(null); setOpen(true) }} className="gap-1"><Plus className="h-4 w-4" /> Add Vendor</Button>}
      />
      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Commission</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No vendors yet.</td></tr>}
              {items.map((v) => (
                <tr key={v.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{v.code}</td>
                  <td className="p-3 font-medium">{v.name}</td>
                  <td className="p-3">{v.phone}</td>
                  <td className="p-3">{v.commissionType === 'percent' ? `${v.commissionAmount}%` : fmtINR(v.commissionAmount)}</td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(v); setOpen(true) }}><Edit3 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <VendorForm open={open} onOpenChange={setOpen} initial={editing} onSaved={() => { setOpen(false); load() }} />
    </div>
  )
}

function VendorForm({ open, onOpenChange, initial, onSaved }) {
  const [f, setF] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setF(initial || {
      name: '', phone: '', email: '', address: '', bankName: '', accountNumber: '', ifsc: '', upi: '',
      commissionType: 'fixed', commissionAmount: 0, notes: '',
    })
  }, [initial, open])
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const submit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (initial) await api(`/vendors/${initial.id}`, { method: 'PUT', body: JSON.stringify(f) })
      else await api('/vendors', { method: 'POST', body: JSON.stringify(f) })
      toast.success('Saved'); onSaved()
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Name *</Label><Input required value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
            <div><Label>Email</Label><Input value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
            <div><Label>UPI</Label><Input value={f.upi || ''} onChange={(e) => set('upi', e.target.value)} /></div>
            <div><Label>Bank Name</Label><Input value={f.bankName || ''} onChange={(e) => set('bankName', e.target.value)} /></div>
            <div><Label>Account No.</Label><Input value={f.accountNumber || ''} onChange={(e) => set('accountNumber', e.target.value)} /></div>
            <div><Label>IFSC</Label><Input value={f.ifsc || ''} onChange={(e) => set('ifsc', e.target.value)} /></div>
            <div>
              <Label>Commission Type</Label>
              <Select value={f.commissionType || 'fixed'} onValueChange={(v) => set('commissionType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed ₹ / month</SelectItem>
                  <SelectItem value="percent">% of client bill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Commission Amount</Label><Input type="number" value={f.commissionAmount || 0} onChange={(e) => set('commissionAmount', e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={f.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Vendor'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================= Placements =============================
function PlacementsModule() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')

  const load = async () => { try { setItems(await api('/placements')) } catch (e) { toast.error(e.message) } }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((p) => p.status === filter)
  }, [items, filter])

  const summary = useMemo(() => {
    return filtered.reduce((acc, p) => ({
      revenue: acc.revenue + (p.calc?.clientBill || 0),
      salary: acc.salary + (p.calc?.staffSalary || 0),
      commission: acc.commission + (p.calc?.vendorCommission || 0),
      profit: acc.profit + (p.calc?.agencyProfit || 0),
    }), { revenue: 0, salary: 0, commission: 0, profit: 0 })
  }, [filtered])

  const endDuty = async (id) => {
    if (!confirm('End this duty today?')) return
    try {
      await api(`/placements/${id}`, { method: 'PUT', body: JSON.stringify({ offDate: new Date().toISOString().slice(0, 10) }) })
      toast.success('Duty ended')
      load()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => {
    if (!confirm('Delete this placement?')) return
    try { await api(`/placements/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load() } catch (e) { toast.error(e.message) }
  }

  return (
    <div>
      <SectionHeader
        title="Placement Register"
        subtitle="The primary business register — every duty tracked with auto profit calculation"
        action={
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditing(null); setOpen(true) }} className="gap-1"><Plus className="h-4 w-4" /> New Placement</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Revenue" value={fmtINR(summary.revenue)} Icon={TrendingUp} tone="green" />
        <StatCard label="Staff Salary" value={fmtINR(summary.salary)} Icon={Users} tone="amber" />
        <StatCard label="Vendor Commission" value={fmtINR(summary.commission)} Icon={Store} tone="blue" />
        <StatCard label="Agency Profit" value={fmtINR(summary.profit)} Icon={Sparkles} tone="green" />
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Client / Patient</th>
                <th className="text-left p-3">Staff</th>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">Duty</th>
                <th className="text-left p-3">Dates</th>
                <th className="text-right p-3">Client Bill</th>
                <th className="text-right p-3">Salary</th>
                <th className="text-right p-3">Comm.</th>
                <th className="text-right p-3">Profit</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">
                  No placements yet. Click &quot;New Placement&quot; to record your first duty and watch the profit calculate live.
                </td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{p.code}</td>
                  <td className="p-3">
                    <div className="font-medium">{p.clientName}</div>
                    <div className="text-xs text-muted-foreground">{p.patientName}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{p.staffName}</div>
                    <div className="text-xs text-muted-foreground">{p.staffCode}</div>
                  </td>
                  <td className="p-3 text-xs">{p.vendorName || '—'}</td>
                  <td className="p-3 text-xs">{p.dutyType} · {p.shift}<div className="text-muted-foreground">{p.location}</div></td>
                  <td className="p-3 text-xs">
                    <div>Join: {p.joinDate}</div>
                    <div className="text-muted-foreground">{p.offDate ? `Off: ${p.offDate}` : `${p.calc?.workingDays} days`}</div>
                  </td>
                  <td className="p-3 text-right">{fmtINR(p.calc?.clientBill)}</td>
                  <td className="p-3 text-right">{fmtINR(p.calc?.staffSalary)}</td>
                  <td className="p-3 text-right">{fmtINR(p.calc?.vendorCommission)}</td>
                  <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmtINR(p.calc?.agencyProfit)}</td>
                  <td className="p-3"><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge></td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {p.status === 'active' && (
                      <Button size="sm" variant="outline" onClick={() => endDuty(p.id)} className="mr-1">End Duty</Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true) }}><Edit3 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <PlacementForm open={open} onOpenChange={setOpen} initial={editing} onSaved={() => { setOpen(false); load() }} />
    </div>
  )
}

function PlacementForm({ open, onOpenChange, initial, onSaved }) {
  const [f, setF] = useState({})
  const [staff, setStaff] = useState([])
  const [clients, setClients] = useState([])
  const [vendors, setVendors] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setF(initial || {
      clientId: '', staffId: '', vendorId: '',
      dutyType: '24 Hr', shift: 'Day', location: 'Home',
      joinDate: new Date().toISOString().slice(0, 10), expectedEndDate: '', offDate: '',
      monthlyClientCharge: 0, monthlyStaffSalary: 0,
      vendorCommission: 0, vendorCommissionType: 'fixed',
      clientPaid: 0, staffPaid: 0, notes: '',
    });
    (async () => {
      try {
        const [s, c, v] = await Promise.all([api('/staff'), api('/clients'), api('/vendors')])
        setStaff(s); setClients(c); setVendors(v)
      } catch (e) {}
    })()
  }, [open, initial])

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  // Auto-populate charges & salary from linked entities
  useEffect(() => {
    if (!f.clientId) return
    const c = clients.find((x) => x.id === f.clientId)
    if (c && !initial && !f.monthlyClientCharge) set('monthlyClientCharge', c.monthlyCharges || 0)
  }, [f.clientId, clients])

  useEffect(() => {
    if (!f.staffId) return
    const s = staff.find((x) => x.id === f.staffId)
    if (s && !initial && !f.monthlyStaffSalary) set('monthlyStaffSalary', s.monthlySalary || 0)
  }, [f.staffId, staff])

  useEffect(() => {
    if (!f.vendorId) { set('vendorCommission', 0); return }
    const v = vendors.find((x) => x.id === f.vendorId)
    if (v) {
      set('vendorCommission', v.commissionAmount || 0)
      set('vendorCommissionType', v.commissionType || 'fixed')
    }
  }, [f.vendorId, vendors])

  // Live profit preview
  const preview = useMemo(() => {
    const start = f.joinDate
    const end = f.offDate
    if (!start) return null
    const s = new Date(start).getTime()
    const e = end ? new Date(end).getTime() : Date.now()
    const days = Math.max(1, Math.round((e - s) / (86400000)))
    const factor = days / 30
    const bill = Math.round(Number(f.monthlyClientCharge || 0) * factor)
    const sal = Math.round(Number(f.monthlyStaffSalary || 0) * factor)
    let comm = 0
    if (f.vendorId) {
      if (f.vendorCommissionType === 'percent') comm = Math.round(bill * (Number(f.vendorCommission || 0) / 100))
      else comm = Math.round(Number(f.vendorCommission || 0) * factor)
    }
    return { days, bill, sal, comm, profit: bill - sal - comm }
  }, [f])

  const submit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (initial) await api(`/placements/${initial.id}`, { method: 'PUT', body: JSON.stringify(f) })
      else await api('/placements', { method: 'POST', body: JSON.stringify(f) })
      toast.success('Placement saved'); onSaved()
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Placement' : 'New Placement'}</DialogTitle>
          <DialogDescription>Assign staff to client — profit calculates live</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Client *</Label>
              <Select value={f.clientId || ''} onValueChange={(v) => set('clientId', v)}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && <div className="p-2 text-xs text-muted-foreground">No clients — add one first</div>}
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} {c.patientName && `(${c.patientName})`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Staff *</Label>
              <Select value={f.staffId || ''} onValueChange={(v) => set('staffId', v)}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staff.length === 0 && <div className="p-2 text-xs text-muted-foreground">No staff — add one first</div>}
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.staffCode} · {s.status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendor (optional)</Label>
              <Select value={f.vendorId || 'none'} onValueChange={(v) => set('vendorId', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (direct placement)</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duty Type</Label>
              <Select value={f.dutyType || '24 Hr'} onValueChange={(v) => set('dutyType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12 Hr">12 Hr</SelectItem>
                  <SelectItem value="24 Hr">24 Hr</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Shift</Label>
              <Select value={f.shift || 'Day'} onValueChange={(v) => set('shift', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Day">Day</SelectItem>
                  <SelectItem value="Night">Night</SelectItem>
                  <SelectItem value="Rotational">Rotational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location</Label>
              <Select value={f.location || 'Home'} onValueChange={(v) => set('location', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Home">Home</SelectItem>
                  <SelectItem value="Hospital">Hospital</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Join Date *</Label><Input type="date" required value={f.joinDate || ''} onChange={(e) => set('joinDate', e.target.value)} /></div>
            <div><Label>Expected End Date</Label><Input type="date" value={f.expectedEndDate || ''} onChange={(e) => set('expectedEndDate', e.target.value)} /></div>
            <div><Label>Off Date (leave blank if active)</Label><Input type="date" value={f.offDate || ''} onChange={(e) => set('offDate', e.target.value)} /></div>

            <div><Label>Monthly Client Charge (₹)</Label><Input type="number" value={f.monthlyClientCharge || 0} onChange={(e) => set('monthlyClientCharge', e.target.value)} /></div>
            <div><Label>Monthly Staff Salary (₹)</Label><Input type="number" value={f.monthlyStaffSalary || 0} onChange={(e) => set('monthlyStaffSalary', e.target.value)} /></div>

            {f.vendorId && (
              <>
                <div>
                  <Label>Vendor Commission Type</Label>
                  <Select value={f.vendorCommissionType || 'fixed'} onValueChange={(v) => set('vendorCommissionType', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed ₹/month</SelectItem>
                      <SelectItem value="percent">% of client bill</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vendor Commission {f.vendorCommissionType === 'percent' ? '(%)' : '(₹/month)'}</Label>
                  <Input type="number" value={f.vendorCommission || 0} onChange={(e) => set('vendorCommission', e.target.value)} />
                </div>
              </>
            )}

            <div><Label>Client Paid so far (₹)</Label><Input type="number" value={f.clientPaid || 0} onChange={(e) => set('clientPaid', e.target.value)} /></div>
            <div><Label>Staff Paid so far (₹)</Label><Input type="number" value={f.staffPaid || 0} onChange={(e) => set('staffPaid', e.target.value)} /></div>

            <div className="md:col-span-2"><Label>Duty Notes</Label><Textarea rows={2} value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></div>
          </div>

          {preview && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Live Profit Preview · {preview.days} working days
              </div>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div><div className="text-muted-foreground text-xs">Client Bill</div><div className="font-semibold">{fmtINR(preview.bill)}</div></div>
                <div><div className="text-muted-foreground text-xs">Staff Salary</div><div className="font-semibold">{fmtINR(preview.sal)}</div></div>
                <div><div className="text-muted-foreground text-xs">Vendor Comm.</div><div className="font-semibold">{fmtINR(preview.comm)}</div></div>
                <div><div className="text-muted-foreground text-xs">Agency Profit</div><div className="font-bold text-emerald-600 dark:text-emerald-400">{fmtINR(preview.profit)}</div></div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Placement'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================= Root App =============================
function App() {
  const [screen, setScreen] = useState('loading') // loading | landing | auth | app
  const [authMode, setAuthMode] = useState('login')
  const [user, setUser] = useState(null)
  const [agency, setAgency] = useState(null)
  const [active, setActive] = useState('dashboard')

  const bootstrap = useCallback(async () => {
    const t = getToken()
    if (!t) { setScreen('landing'); return }
    try {
      const me = await api('/auth/me')
      setUser(me.user); setAgency(me.agency)
      setScreen('app')
    } catch (e) {
      clearToken(); setScreen('landing')
    }
  }, [])

  useEffect(() => { bootstrap() }, [bootstrap])

  const onAuthSuccess = (data) => {
    setUser(data.user); setAgency(data.agency); setScreen('app'); setActive('dashboard')
  }

  const logout = () => {
    clearToken(); setUser(null); setAgency(null); setScreen('landing')
    toast.success('Logged out')
  }

  if (screen === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading DutyOnTrack...</div>
  }
  if (screen === 'landing') {
    return <Landing onAuth={(mode) => { setAuthMode(mode); setScreen('auth') }} />
  }
  if (screen === 'auth') {
    return <AuthScreen initialMode={authMode} onSuccess={onAuthSuccess} onBack={() => setScreen('landing')} />
  }
  return (
    <Shell user={user} agency={agency} onLogout={logout} active={active} setActive={setActive}>
      {active === 'dashboard' && <Dashboard setActive={setActive} />}
      {active === 'staff' && <StaffModule />}
      {active === 'clients' && <ClientsModule />}
      {active === 'vendors' && <VendorsModule />}
      {active === 'placements' && <PlacementsModule />}
    </Shell>
  )
}

export default App
