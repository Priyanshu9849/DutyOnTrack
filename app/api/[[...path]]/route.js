import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// ============ MongoDB ============
let client
let db
let clientPromise

async function connectToMongo() {
  if (db) return db
  if (!clientPromise) {
    const uri = process.env.MONGO_URL
    if (!uri || typeof uri !== 'string' || uri.trim() === '') {
      throw new Error('MONGO_URL environment variable is not set. Configure it in your deployment (Vercel: Settings → Environment Variables).')
    }
    if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
      throw new Error('MONGO_URL must start with mongodb:// or mongodb+srv:// — got: ' + uri.slice(0, 40))
    }
    const dbName = process.env.DB_NAME
    if (!dbName || typeof dbName !== 'string' || dbName.trim() === '') {
      throw new Error('DB_NAME environment variable is not set. Configure it in your deployment.')
    }
    clientPromise = (async () => {
      const c = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
      })
      await c.connect()
      client = c
      db = c.db(dbName)
      // Indexes
      try {
        await db.collection('users').createIndex({ email: 1 }, { unique: true })
        await db.collection('agencies').createIndex({ ownerEmail: 1 })
        await db.collection('staff').createIndex({ agencyId: 1 })
        await db.collection('clients').createIndex({ agencyId: 1 })
        await db.collection('vendors').createIndex({ agencyId: 1 })
        await db.collection('placements').createIndex({ agencyId: 1 })
        await db.collection('activities').createIndex({ agencyId: 1, createdAt: -1 })
        await db.collection('attendance').createIndex({ agencyId: 1, staffId: 1, date: 1 }, { unique: true })
        await db.collection('salary_payments').createIndex({ agencyId: 1, staffId: 1, month: 1 })
        await db.collection('expenses').createIndex({ agencyId: 1, date: -1 })
        await db.collection('incomes').createIndex({ agencyId: 1, date: -1 })
        await db.collection('invoices').createIndex({ agencyId: 1, createdAt: -1 })
        await db.collection('platform_settings').createIndex({ id: 1 }, { unique: true })
        await db.collection('plans').createIndex({ id: 1 }, { unique: true })
        await db.collection('payment_requests').createIndex({ agencyId: 1, createdAt: -1 })
        await db.collection('payment_requests').createIndex({ status: 1 })
        await db.collection('receipts').createIndex({ agencyId: 1, createdAt: -1 })
        await db.collection('super_audit').createIndex({ createdAt: -1 })
        await db.collection('support_tickets').createIndex({ agencyId: 1, createdAt: -1 })
      } catch (e) {}
      return db
    })()
  }
  await clientPromise
  return db
}

// ============ Utilities ============
const SECRET = process.env.APP_SECRET || 'dutyontrack-dev-secret-change-me'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'))
}
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/')
  while (input.length % 4) input += '='
  return Buffer.from(input, 'base64').toString()
}
function createToken(payload) {
  const body = b64url(JSON.stringify({ ...payload, iat: Date.now() }))
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${body}.${sig}`
}
function verifyToken(token) {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  if (expected !== sig) return null
  try { return JSON.parse(b64urlDecode(body)) } catch (e) { return null }
}

async function getAuth(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const payload = verifyToken(token)
  if (!payload) return null
  const database = await connectToMongo()
  const user = await database.collection('users').findOne({ id: payload.userId })
  if (!user) return null
  return { user, agencyId: user.agencyId, role: user.role, impersonatorId: payload.impersonatorId || null }
}

async function requireSuperAdmin(request) {
  const auth = await getAuth(request)
  if (!auth || auth.role !== 'super_admin') return null
  return auth
}

async function logSuperAudit(database, actorUserId, action, target, message, meta = {}) {
  await database.collection('super_audit').insertOne({
    id: uuidv4(), actorUserId, action, target, message, meta, createdAt: new Date(),
  })
}

// Default plans seed
const DEFAULT_PLANS = [
  { id: 'plan_free', code: 'FREE', name: 'Free', monthlyPrice: 0, yearlyPrice: 0, maxStaff: 5, maxClients: 5, maxVendors: 5, maxBranches: 1, storageGB: 1, features: ['Basic CRM', 'Basic Reports'], recommended: false, active: true, description: 'Starter plan for small teams' },
  { id: 'plan_starter', code: 'STARTER', name: 'Starter', monthlyPrice: 499, yearlyPrice: 4990, maxStaff: 25, maxClients: 25, maxVendors: 25, maxBranches: 1, storageGB: 10, features: ['All Free features', 'Invoices', 'Salary slips', 'Reports export'], recommended: false, active: true, description: 'For growing agencies' },
  { id: 'plan_pro', code: 'PROFESSIONAL', name: 'Professional', monthlyPrice: 1499, yearlyPrice: 14990, maxStaff: 100, maxClients: 100, maxVendors: 100, maxBranches: 3, storageGB: 50, features: ['All Starter features', 'Multi-branch', 'Priority support', 'Advanced analytics'], recommended: true, active: true, description: 'Most popular — mid-sized agencies' },
  { id: 'plan_ent', code: 'ENTERPRISE', name: 'Enterprise', monthlyPrice: 4999, yearlyPrice: 49990, maxStaff: 10000, maxClients: 10000, maxVendors: 10000, maxBranches: 100, storageGB: 500, features: ['All Pro features', 'Unlimited scale', 'Dedicated manager', 'Custom integrations'], recommended: false, active: true, description: 'For large agencies at scale' },
]

function clean(doc) {
  if (!doc) return doc
  if (Array.isArray(doc)) return doc.map(clean)
  const { _id, passwordHash, ...rest } = doc
  return rest
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

function json(data, status = 200) {
  return handleCORS(NextResponse.json(data, { status }))
}
function err(msg, status = 400) {
  return handleCORS(NextResponse.json({ error: msg }, { status }))
}

async function logActivity(database, agencyId, type, message, meta = {}) {
  await database.collection('activities').insertOne({
    id: uuidv4(),
    agencyId, type, message, meta,
    createdAt: new Date(),
  })
}

// ============ Placement Calculations ============
function daysBetween(start, end) {
  const s = new Date(start).getTime()
  const e = new Date(end || Date.now()).getTime()
  const d = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)))
  return d
}
function calcPlacement(p) {
  // p.monthlyClientCharge, p.monthlyStaffSalary, p.vendorCommission (fixed amount per month or per placement), p.vendorCommissionType ('fixed'|'percent')
  const start = p.joinDate
  const end = p.offDate || null
  const workingDays = daysBetween(start, end)
  const monthFactor = workingDays / 30
  const clientBill = Math.round((Number(p.monthlyClientCharge || 0)) * monthFactor)
  const staffSalary = Math.round((Number(p.monthlyStaffSalary || 0)) * monthFactor)
  let vendorCommission = 0
  if (p.vendorId && p.monthlyClientCharge) {
    if (p.vendorCommissionType === 'percent') {
      vendorCommission = Math.round(clientBill * (Number(p.vendorCommission || 0) / 100))
    } else {
      vendorCommission = Math.round((Number(p.vendorCommission || 0)) * monthFactor)
    }
  }
  const agencyProfit = clientBill - staffSalary - vendorCommission
  return { workingDays, clientBill, staffSalary, vendorCommission, agencyProfit }
}

// Backfill attendance from joinDate to today (or offDate) as Present unless already present
async function backfillAttendance(database, placement) {
  if (!placement?.joinDate || !placement?.staffId) return
  const start = new Date(placement.joinDate)
  const endRaw = placement.offDate ? new Date(placement.offDate) : new Date()
  const end = endRaw > new Date() ? new Date() : endRaw
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return
  const days = []
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur <= stop) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
    if (days.length > 400) break // safety
  }
  if (!days.length) return
  const ops = days.map((date) => ({
    updateOne: {
      filter: { agencyId: placement.agencyId, staffId: placement.staffId, date },
      update: { $setOnInsert: { id: uuidv4(), agencyId: placement.agencyId, staffId: placement.staffId, date, status: 'P', placementId: placement.id, notes: '', createdAt: new Date() } },
      upsert: true,
    },
  }))
  try { await database.collection('attendance').bulkWrite(ops, { ordered: false }) } catch (e) {}
}

// Get attendance days count for a staff+month with weights
function attendanceStats(entries) {
  let present = 0, absent = 0, half = 0, leave = 0, paidLeave = 0, late = 0, effective = 0
  for (const a of entries) {
    if (a.status === 'P') { present++; effective += 1 }
    else if (a.status === 'A') { absent++ }
    else if (a.status === 'H') { half++; effective += 0.5 }
    else if (a.status === 'LATE') { late++; effective += 1 }
    else if (a.status === 'LEAVE_PAID') { paidLeave++; effective += 1 }
    else if (a.status === 'LEAVE') { leave++ }
  }
  return { present, absent, half, leave, paidLeave, late, effective, total: entries.length }
}

// ============ Route Handler ============
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const database = await connectToMongo()

    // Health
    if ((route === '/' || route === '/root') && method === 'GET') {
      return json({ message: 'DutyOnTrack API', status: 'ok' })
    }

    // ============ SETUP (first-time, no auth) ============
    if (route === '/setup/status' && method === 'GET') {
      const superAdmin = await database.collection('users').findOne({ role: 'super_admin' })
      const settings = await database.collection('platform_settings').findOne({ id: 'platform_settings' })
      return json({ hasSuperAdmin: !!superAdmin, hasSettings: !!settings, needsSetup: !superAdmin })
    }
    if (route === '/setup/complete' && method === 'POST') {
      const existing = await database.collection('users').findOne({ role: 'super_admin' })
      if (existing) return err('Super admin already exists', 409)
      const b = await request.json()
      const required = ['name', 'email', 'password']
      for (const f of required) if (!b[f]) return err(`${f} is required`)
      const userId = uuidv4()
      const user = {
        id: userId, agencyId: null, name: b.name, email: b.email.toLowerCase(), phone: b.phone || '',
        role: 'super_admin', passwordHash: hashPassword(b.password), createdAt: new Date(),
      }
      await database.collection('users').insertOne(user)

      const settings = {
        id: 'platform_settings',
        platformName: b.platformName || 'DutyOnTrack',
        logoUrl: b.logoUrl || '',
        faviconUrl: b.faviconUrl || '',
        supportWhatsapp: b.supportWhatsapp || '',
        supportEmail: b.supportEmail || '',
        supportPhone: b.supportPhone || '',
        companyName: b.companyName || 'DutyOnTrack',
        companyAddress: b.companyAddress || '',
        gstNumber: b.gstNumber || '',
        invoicePrefix: b.invoicePrefix || 'INV',
        receiptPrefix: b.receiptPrefix || 'RCP',
        currency: b.currency || 'INR',
        taxPercentage: Number(b.taxPercentage || 0),
        timezone: b.timezone || 'Asia/Kolkata',
        dateFormat: b.dateFormat || 'DD-MM-YYYY',
        // Bank / payment
        accountHolderName: b.accountHolderName || '',
        bankName: b.bankName || '',
        accountNumber: b.accountNumber || '',
        ifscCode: b.ifscCode || '',
        upiId: b.upiId || '',
        qrCodeUrl: b.qrCodeUrl || '',
        defaultMessage: b.defaultMessage || 'Hello DutyOnTrack Team, I need help with my CRM.',
        updatedAt: new Date(), createdAt: new Date(),
      }
      await database.collection('platform_settings').insertOne(settings)

      // Seed default plans if none
      const planCount = await database.collection('plans').countDocuments({})
      if (planCount === 0) {
        await database.collection('plans').insertMany(DEFAULT_PLANS.map((p) => ({ ...p, createdAt: new Date() })))
      }

      await logSuperAudit(database, userId, 'setup_complete', 'platform', 'Initial setup completed')
      const token = createToken({ userId, agencyId: null, role: 'super_admin' })
      return json({ token, user: clean(user), settings })
    }

    // Public settings for payment page (no auth)
    if (route === '/settings/public' && method === 'GET') {
      const s = await database.collection('platform_settings').findOne({ id: 'platform_settings' })
      if (!s) return json({})
      const { _id, ...rest } = s
      return json(rest)
    }
    if (route === '/plans/public' && method === 'GET') {
      const plans = await database.collection('plans').find({ active: true }).sort({ monthlyPrice: 1 }).toArray()
      return json(clean(plans))
    }

    // ============ AUTH ============
    if (route === '/auth/signup' && method === 'POST') {
      const b = await request.json()
      const required = ['agencyName', 'ownerName', 'email', 'password', 'phone']
      for (const f of required) if (!b[f]) return err(`${f} is required`)
      const existing = await database.collection('users').findOne({ email: b.email.toLowerCase() })
      if (existing) return err('Email already registered', 409)

      const agencyId = uuidv4()
      const userId = uuidv4()
      const now = new Date()

      const agency = {
        id: agencyId,
        name: b.agencyName,
        ownerName: b.ownerName,
        ownerEmail: b.email.toLowerCase(),
        phone: b.phone,
        businessType: b.businessType || 'General Staffing',
        gst: b.gst || '',
        address: b.address || '',
        city: b.city || '',
        state: b.state || '',
        pincode: b.pincode || '',
        logo: b.logo || '',
        plan: 'FREE',
        status: 'active',
        limits: { maxStaff: 5, maxClients: 5, maxVendors: 5 },
        referralCode: (b.agencyName.replace(/\s+/g, '').toUpperCase().slice(0, 4) + Math.random().toString(36).slice(2, 6).toUpperCase()),
        createdAt: now,
      }
      await database.collection('agencies').insertOne(agency)

      const user = {
        id: userId,
        agencyId,
        name: b.ownerName,
        email: b.email.toLowerCase(),
        phone: b.phone,
        role: 'agency_owner',
        passwordHash: hashPassword(b.password),
        createdAt: now,
      }
      await database.collection('users').insertOne(user)
      await logActivity(database, agencyId, 'agency_created', `Agency ${agency.name} created`)

      const token = createToken({ userId, agencyId, role: 'agency_owner' })
      return json({ token, user: clean(user), agency: clean(agency) })
    }

    if (route === '/auth/login' && method === 'POST') {
      const b = await request.json()
      if (!b.email || !b.password) return err('email and password required')
      const user = await database.collection('users').findOne({ email: b.email.toLowerCase() })
      if (!user) return err('Invalid credentials', 401)
      if (!verifyPassword(b.password, user.passwordHash)) return err('Invalid credentials', 401)
      const agency = await database.collection('agencies').findOne({ id: user.agencyId })
      const token = createToken({ userId: user.id, agencyId: user.agencyId, role: user.role })
      return json({ token, user: clean(user), agency: clean(agency) })
    }

    if (route === '/auth/me' && method === 'GET') {
      const auth = await getAuth(request)
      if (!auth) return err('Unauthorized', 401)
      const agency = await database.collection('agencies').findOne({ id: auth.agencyId })
      return json({ user: clean(auth.user), agency: clean(agency) })
    }

    // All below require auth
    const auth = await getAuth(request)
    if (!auth) return err('Unauthorized', 401)
    const { agencyId } = auth

    // ============ DASHBOARD ============
    if (route === '/dashboard' && method === 'GET') {
      const [staff, clients, vendors, placements, activities] = await Promise.all([
        database.collection('staff').find({ agencyId }).toArray(),
        database.collection('clients').find({ agencyId }).toArray(),
        database.collection('vendors').find({ agencyId }).toArray(),
        database.collection('placements').find({ agencyId }).toArray(),
        database.collection('activities').find({ agencyId }).sort({ createdAt: -1 }).limit(15).toArray(),
      ])

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayIso = today.toISOString().slice(0, 10)

      const activePlacements = placements.filter(p => p.status === 'active')
      const todaysJoinings = placements.filter(p => (p.joinDate || '').slice(0, 10) === todayIso)
      const todaysOff = placements.filter(p => (p.offDate || '').slice(0, 10) === todayIso)

      let totalRevenue = 0, totalStaffSalary = 0, totalVendorCommission = 0, totalProfit = 0
      let pendingClientPayments = 0, pendingSalary = 0
      for (const p of placements) {
        const c = calcPlacement(p)
        totalRevenue += c.clientBill
        totalStaffSalary += c.staffSalary
        totalVendorCommission += c.vendorCommission
        totalProfit += c.agencyProfit
        pendingClientPayments += Math.max(0, c.clientBill - (Number(p.clientPaid || 0)))
        pendingSalary += Math.max(0, c.staffSalary - (Number(p.staffPaid || 0)))
      }

      const busyStaffIds = new Set(activePlacements.map(p => p.staffId).filter(Boolean))
      const availableStaff = staff.filter(s => !busyStaffIds.has(s.id) && s.status !== 'inactive' && s.status !== 'leave').length
      const busyStaff = busyStaffIds.size
      const onLeave = staff.filter(s => s.status === 'leave').length

      // Monthly revenue chart (last 6 months)
      const monthly = []
      const nowD = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1)
        const nd = new Date(nowD.getFullYear(), nowD.getMonth() - i + 1, 1)
        let rev = 0, prof = 0
        for (const p of placements) {
          const s = new Date(p.joinDate)
          const e = p.offDate ? new Date(p.offDate) : new Date()
          const overlapStart = Math.max(s.getTime(), d.getTime())
          const overlapEnd = Math.min(e.getTime(), nd.getTime())
          if (overlapEnd > overlapStart) {
            const days = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)
            const revShare = (Number(p.monthlyClientCharge || 0)) * (days / 30)
            const salShare = (Number(p.monthlyStaffSalary || 0)) * (days / 30)
            let comm = 0
            if (p.vendorId) {
              if (p.vendorCommissionType === 'percent') comm = revShare * (Number(p.vendorCommission || 0) / 100)
              else comm = (Number(p.vendorCommission || 0)) * (days / 30)
            }
            rev += revShare
            prof += (revShare - salShare - comm)
          }
        }
        monthly.push({
          month: d.toLocaleString('en-US', { month: 'short' }),
          revenue: Math.round(rev),
          profit: Math.round(prof),
        })
      }

      return json({
        cards: {
          activePlacements: activePlacements.length,
          todaysJoinings: todaysJoinings.length,
          todaysOff: todaysOff.length,
          totalStaff: staff.length,
          availableStaff, busyStaff, onLeave,
          totalClients: clients.length,
          totalVendors: vendors.length,
          totalRevenue, totalStaffSalary, totalVendorCommission, totalProfit,
          pendingClientPayments, pendingSalary,
        },
        monthly,
        recentActivities: clean(activities),
      })
    }

    // ============ STAFF ============
    if (route === '/staff' && method === 'GET') {
      const items = await database.collection('staff').find({ agencyId }).sort({ createdAt: -1 }).toArray()
      return json(clean(items))
    }
    if (route === '/staff' && method === 'POST') {
      const agency = await database.collection('agencies').findOne({ id: agencyId })
      const count = await database.collection('staff').countDocuments({ agencyId })
      const maxStaff = agency?.limits?.maxStaff ?? 5
      if (count >= maxStaff) {
        return err(`Plan limit reached (${maxStaff} staff). Upgrade your plan to add more.`, 402)
      }
      const b = await request.json()
      if (!b.name) return err('name required')
      const staffId = uuidv4()
      const shortId = 'STF' + Math.floor(1000 + Math.random() * 9000)
      const doc = {
        id: staffId, agencyId, staffCode: shortId,
        name: b.name, fatherName: b.fatherName || '',
        photo: b.photo || '',
        dob: b.dob || '', gender: b.gender || '',
        phone: b.phone || '', altPhone: b.altPhone || '', email: b.email || '',
        address: b.address || '', city: b.city || '', state: b.state || '', pincode: b.pincode || '',
        aadhaar: b.aadhaar || '', pan: b.pan || '',
        bankName: b.bankName || '', accountNumber: b.accountNumber || '', ifsc: b.ifsc || '', upi: b.upi || '',
        emergencyContact: b.emergencyContact || '',
        bloodGroup: b.bloodGroup || '',
        qualification: b.qualification || '', skills: b.skills || '',
        experience: b.experience || '', languages: b.languages || '',
        joiningDate: b.joiningDate || new Date().toISOString().slice(0, 10),
        status: b.status || 'available',
        monthlySalary: Number(b.monthlySalary || 0),
        notes: b.notes || '',
        createdAt: new Date(),
      }
      await database.collection('staff').insertOne(doc)
      await logActivity(database, agencyId, 'staff_added', `New staff added: ${doc.name} (${doc.staffCode})`)
      return json(clean(doc))
    }
    if (route.startsWith('/staff/') && method === 'PUT') {
      const id = route.split('/')[2]
      const b = await request.json()
      delete b.id; delete b.agencyId; delete b._id
      await database.collection('staff').updateOne({ id, agencyId }, { $set: b })
      const updated = await database.collection('staff').findOne({ id, agencyId })
      return json(clean(updated))
    }
    if (route.startsWith('/staff/') && method === 'DELETE') {
      const id = route.split('/')[2]
      await database.collection('staff').deleteOne({ id, agencyId })
      return json({ ok: true })
    }

    // ============ CLIENTS ============
    if (route === '/clients' && method === 'GET') {
      const items = await database.collection('clients').find({ agencyId }).sort({ createdAt: -1 }).toArray()
      return json(clean(items))
    }
    if (route === '/clients' && method === 'POST') {
      const agency = await database.collection('agencies').findOne({ id: agencyId })
      const count = await database.collection('clients').countDocuments({ agencyId })
      const maxClients = agency?.limits?.maxClients ?? 5
      if (count >= maxClients) {
        return err(`Plan limit reached (${maxClients} clients). Upgrade your plan to add more.`, 402)
      }
      const b = await request.json()
      if (!b.name) return err('name required')
      const doc = {
        id: uuidv4(), agencyId,
        code: 'CLT' + Math.floor(1000 + Math.random() * 9000),
        name: b.name,
        patientName: b.patientName || '',
        phone: b.phone || '', email: b.email || '',
        address: b.address || '', city: b.city || '',
        emergencyContact: b.emergencyContact || '',
        location: b.location || 'Home', // Home / Hospital
        careType: b.careType || '',
        // Patient medical
        doctorName: b.doctorName || '', hospital: b.hospital || '',
        medicalNotes: b.medicalNotes || '',
        rtTube: !!b.rtTube, ttTube: !!b.ttTube, oxygen: !!b.oxygen,
        catheter: !!b.catheter, tracheostomy: !!b.tracheostomy, rylesTube: !!b.rylesTube,
        feedingInstructions: b.feedingInstructions || '',
        medicineNotes: b.medicineNotes || '',
        specialInstructions: b.specialInstructions || '',
        // Billing
        monthlyCharges: Number(b.monthlyCharges || 0),
        advance: Number(b.advance || 0),
        securityDeposit: Number(b.securityDeposit || 0),
        discount: Number(b.discount || 0),
        status: 'active',
        notes: b.notes || '',
        createdAt: new Date(),
      }
      await database.collection('clients').insertOne(doc)
      await logActivity(database, agencyId, 'client_added', `New client added: ${doc.name}`)
      return json(clean(doc))
    }
    if (route.startsWith('/clients/') && method === 'PUT') {
      const id = route.split('/')[2]
      const b = await request.json()
      delete b.id; delete b.agencyId; delete b._id
      await database.collection('clients').updateOne({ id, agencyId }, { $set: b })
      const updated = await database.collection('clients').findOne({ id, agencyId })
      return json(clean(updated))
    }
    if (route.startsWith('/clients/') && method === 'DELETE') {
      const id = route.split('/')[2]
      await database.collection('clients').deleteOne({ id, agencyId })
      return json({ ok: true })
    }

    // ============ VENDORS ============
    if (route === '/vendors' && method === 'GET') {
      const items = await database.collection('vendors').find({ agencyId }).sort({ createdAt: -1 }).toArray()
      return json(clean(items))
    }
    if (route === '/vendors' && method === 'POST') {
      const agency = await database.collection('agencies').findOne({ id: agencyId })
      const count = await database.collection('vendors').countDocuments({ agencyId })
      const maxVendors = agency?.limits?.maxVendors ?? 5
      if (count >= maxVendors) {
        return err(`Plan limit reached (${maxVendors} vendors). Upgrade your plan to add more.`, 402)
      }
      const b = await request.json()
      if (!b.name) return err('name required')
      const doc = {
        id: uuidv4(), agencyId,
        code: 'VND' + Math.floor(1000 + Math.random() * 9000),
        name: b.name,
        phone: b.phone || '', email: b.email || '', address: b.address || '',
        bankName: b.bankName || '', accountNumber: b.accountNumber || '',
        ifsc: b.ifsc || '', upi: b.upi || '',
        commissionType: b.commissionType || 'fixed', // fixed | percent
        commissionAmount: Number(b.commissionAmount || 0),
        notes: b.notes || '',
        createdAt: new Date(),
      }
      await database.collection('vendors').insertOne(doc)
      await logActivity(database, agencyId, 'vendor_added', `New vendor added: ${doc.name}`)
      return json(clean(doc))
    }
    if (route.startsWith('/vendors/') && method === 'PUT') {
      const id = route.split('/')[2]
      const b = await request.json()
      delete b.id; delete b.agencyId; delete b._id
      await database.collection('vendors').updateOne({ id, agencyId }, { $set: b })
      const updated = await database.collection('vendors').findOne({ id, agencyId })
      return json(clean(updated))
    }
    if (route.startsWith('/vendors/') && method === 'DELETE') {
      const id = route.split('/')[2]
      await database.collection('vendors').deleteOne({ id, agencyId })
      return json({ ok: true })
    }

    // ============ PLACEMENTS ============
    if (route === '/placements' && method === 'GET') {
      const items = await database.collection('placements').find({ agencyId }).sort({ createdAt: -1 }).toArray()
      const enriched = await Promise.all(items.map(async (p) => {
        const [staffDoc, clientDoc, vendorDoc] = await Promise.all([
          p.staffId ? database.collection('staff').findOne({ id: p.staffId, agencyId }) : null,
          p.clientId ? database.collection('clients').findOne({ id: p.clientId, agencyId }) : null,
          p.vendorId ? database.collection('vendors').findOne({ id: p.vendorId, agencyId }) : null,
        ])
        const calc = calcPlacement(p)
        return {
          ...clean(p),
          staffName: staffDoc?.name || '',
          staffCode: staffDoc?.staffCode || '',
          clientName: clientDoc?.name || '',
          patientName: clientDoc?.patientName || '',
          vendorName: vendorDoc?.name || '',
          calc,
        }
      }))
      return json(enriched)
    }
    if (route === '/placements' && method === 'POST') {
      const b = await request.json()
      if (!b.clientId || !b.staffId || !b.joinDate) return err('clientId, staffId, joinDate required')

      // If vendor selected, snapshot commission
      let vendorCommission = 0, vendorCommissionType = 'fixed'
      if (b.vendorId) {
        const v = await database.collection('vendors').findOne({ id: b.vendorId, agencyId })
        vendorCommission = Number(b.vendorCommission ?? v?.commissionAmount ?? 0)
        vendorCommissionType = b.vendorCommissionType ?? v?.commissionType ?? 'fixed'
      }

      const doc = {
        id: uuidv4(), agencyId,
        code: 'PLC' + Math.floor(1000 + Math.random() * 9000),
        clientId: b.clientId,
        staffId: b.staffId,
        vendorId: b.vendorId || null,
        dutyType: b.dutyType || '24 Hr', // 12 Hr / 24 Hr
        shift: b.shift || 'Day', // Day / Night
        location: b.location || 'Home', // Home / Hospital
        joinDate: b.joinDate,
        expectedEndDate: b.expectedEndDate || '',
        offDate: b.offDate || '',
        monthlyClientCharge: Number(b.monthlyClientCharge || 0),
        monthlyStaffSalary: Number(b.monthlyStaffSalary || 0),
        vendorCommission,
        vendorCommissionType,
        clientPaid: Number(b.clientPaid || 0),
        staffPaid: Number(b.staffPaid || 0),
        status: b.offDate ? 'completed' : 'active',
        notes: b.notes || '',
        createdAt: new Date(),
      }
      await database.collection('placements').insertOne(doc)
      // Update staff status
      await database.collection('staff').updateOne({ id: b.staffId, agencyId }, { $set: { status: 'onduty', currentPlacementId: doc.id } })

      // Auto-backfill attendance as Present for every day from joinDate to today (or offDate)
      await backfillAttendance(database, doc)

      const client = await database.collection('clients').findOne({ id: b.clientId, agencyId })
      const staff = await database.collection('staff').findOne({ id: b.staffId, agencyId })
      await logActivity(database, agencyId, 'duty_join', `Duty joined: ${staff?.name} → ${client?.name}`)

      return json(clean(doc))
    }
    if (route.startsWith('/placements/') && method === 'PUT') {
      const id = route.split('/')[2]
      const b = await request.json()
      delete b.id; delete b.agencyId; delete b._id
      if (b.offDate) b.status = 'completed'
      await database.collection('placements').updateOne({ id, agencyId }, { $set: b })
      const updated = await database.collection('placements').findOne({ id, agencyId })
      // Backfill attendance up to offDate (or today) whenever placement is edited
      if (updated) await backfillAttendance(database, updated)
      // If completed, free staff
      if (updated?.status === 'completed' && updated.staffId) {
        await database.collection('staff').updateOne({ id: updated.staffId, agencyId }, { $set: { status: 'available', currentPlacementId: null } })
        await logActivity(database, agencyId, 'duty_off', `Duty ended for placement ${updated.code}`)
      }
      return json(clean(updated))
    }
    if (route.startsWith('/placements/') && method === 'DELETE') {
      const id = route.split('/')[2]
      const p = await database.collection('placements').findOne({ id, agencyId })
      await database.collection('placements').deleteOne({ id, agencyId })
      if (p?.staffId) {
        await database.collection('staff').updateOne({ id: p.staffId, agencyId }, { $set: { status: 'available', currentPlacementId: null } })
      }
      return json({ ok: true })
    }

    // ============ ATTENDANCE ============
    // GET /attendance?staffId=&month=YYYY-MM
    if (route === '/attendance' && method === 'GET') {
      const url = new URL(request.url)
      const staffId = url.searchParams.get('staffId')
      const month = url.searchParams.get('month') // YYYY-MM
      const q = { agencyId }
      if (staffId) q.staffId = staffId
      if (month) q.date = { $regex: `^${month}` }
      const items = await database.collection('attendance').find(q).sort({ date: 1 }).toArray()
      return json(clean(items))
    }
    // POST /attendance -> mark or update a single day
    if (route === '/attendance' && method === 'POST') {
      const b = await request.json()
      if (!b.staffId || !b.date) return err('staffId and date required')
      const allowed = ['P', 'A', 'H', 'LATE', 'LEAVE', 'LEAVE_PAID']
      const status = allowed.includes(b.status) ? b.status : 'P'
      const existing = await database.collection('attendance').findOne({ agencyId, staffId: b.staffId, date: b.date })
      if (existing) {
        await database.collection('attendance').updateOne({ id: existing.id, agencyId }, { $set: { status, notes: b.notes || '' } })
        const upd = await database.collection('attendance').findOne({ id: existing.id, agencyId })
        return json(clean(upd))
      }
      const doc = {
        id: uuidv4(), agencyId, staffId: b.staffId, date: b.date, status,
        placementId: b.placementId || null, notes: b.notes || '', createdAt: new Date(),
      }
      await database.collection('attendance').insertOne(doc)
      return json(clean(doc))
    }
    // POST /attendance/bulk -> [{staffId, date, status}]
    if (route === '/attendance/bulk' && method === 'POST') {
      const b = await request.json()
      const rows = Array.isArray(b?.rows) ? b.rows : []
      if (!rows.length) return json({ ok: true, upserted: 0 })
      const ops = rows.filter((r) => r.staffId && r.date).map((r) => ({
        updateOne: {
          filter: { agencyId, staffId: r.staffId, date: r.date },
          update: { $set: { status: r.status || 'P', notes: r.notes || '' }, $setOnInsert: { id: uuidv4(), agencyId, staffId: r.staffId, date: r.date, createdAt: new Date() } },
          upsert: true,
        },
      }))
      await database.collection('attendance').bulkWrite(ops, { ordered: false })
      return json({ ok: true, upserted: ops.length })
    }

    // ============ SALARY ============
    // GET /salary?staffId=&month=YYYY-MM  -> compute payslip
    if (route === '/salary' && method === 'GET') {
      const url = new URL(request.url)
      const staffId = url.searchParams.get('staffId')
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7)
      if (!staffId) return err('staffId required')
      const staff = await database.collection('staff').findOne({ id: staffId, agencyId })
      if (!staff) return err('staff not found', 404)
      const attendance = await database.collection('attendance').find({ agencyId, staffId, date: { $regex: `^${month}` } }).toArray()
      const stats = attendanceStats(attendance)
      const perDay = (Number(staff.monthlySalary || 0)) / 30
      const gross = Math.round(perDay * stats.effective)
      const payments = await database.collection('salary_payments').find({ agencyId, staffId, month }).toArray()
      const advance = payments.filter((p) => p.type === 'advance').reduce((a, b) => a + Number(b.amount || 0), 0)
      const deduction = payments.filter((p) => p.type === 'deduction').reduce((a, b) => a + Number(b.amount || 0), 0)
      const paid = payments.filter((p) => p.type === 'paid').reduce((a, b) => a + Number(b.amount || 0), 0)
      const net = gross - advance - deduction
      return json({
        staff: clean(staff),
        month,
        attendance: clean(attendance),
        stats,
        perDay: Math.round(perDay),
        gross, advance, deduction, paid, pending: net - paid, net,
        payments: clean(payments),
      })
    }
    // GET /salary/all?month=YYYY-MM  -> summary for all staff
    if (route === '/salary/all' && method === 'GET') {
      const url = new URL(request.url)
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7)
      const staffList = await database.collection('staff').find({ agencyId }).toArray()
      const results = []
      for (const s of staffList) {
        const attendance = await database.collection('attendance').find({ agencyId, staffId: s.id, date: { $regex: `^${month}` } }).toArray()
        const stats = attendanceStats(attendance)
        const perDay = (Number(s.monthlySalary || 0)) / 30
        const gross = Math.round(perDay * stats.effective)
        const payments = await database.collection('salary_payments').find({ agencyId, staffId: s.id, month }).toArray()
        const advance = payments.filter((p) => p.type === 'advance').reduce((a, b) => a + Number(b.amount || 0), 0)
        const deduction = payments.filter((p) => p.type === 'deduction').reduce((a, b) => a + Number(b.amount || 0), 0)
        const paid = payments.filter((p) => p.type === 'paid').reduce((a, b) => a + Number(b.amount || 0), 0)
        const net = gross - advance - deduction
        results.push({
          staffId: s.id, staffName: s.name, staffCode: s.staffCode,
          monthlySalary: s.monthlySalary || 0, perDay: Math.round(perDay),
          workingDays: stats.effective, present: stats.present, absent: stats.absent, half: stats.half, leave: stats.leave,
          gross, advance, deduction, paid, pending: net - paid, net,
        })
      }
      return json({ month, rows: results })
    }
    // POST /salary/payment  { staffId, month, amount, type: advance|deduction|paid, notes }
    if (route === '/salary/payment' && method === 'POST') {
      const b = await request.json()
      if (!b.staffId || !b.month || !b.amount || !b.type) return err('staffId, month, amount, type required')
      const doc = {
        id: uuidv4(), agencyId, staffId: b.staffId, month: b.month,
        amount: Number(b.amount), type: b.type, notes: b.notes || '',
        paidVia: b.paidVia || 'Cash', paidOn: b.paidOn || new Date().toISOString().slice(0, 10),
        createdAt: new Date(),
      }
      await database.collection('salary_payments').insertOne(doc)
      const staff = await database.collection('staff').findOne({ id: b.staffId, agencyId })
      await logActivity(database, agencyId, 'salary_' + b.type, `${b.type === 'paid' ? 'Salary paid' : b.type === 'advance' ? 'Advance given' : 'Deduction applied'} to ${staff?.name}: ₹${b.amount} (${b.month})`)
      return json(clean(doc))
    }
    if (route.startsWith('/salary/payment/') && method === 'DELETE') {
      const id = route.split('/')[3]
      await database.collection('salary_payments').deleteOne({ id, agencyId })
      return json({ ok: true })
    }

    // ============ EXPENSES ============
    if (route === '/expenses' && method === 'GET') {
      const url = new URL(request.url)
      const month = url.searchParams.get('month')
      const q = { agencyId }
      if (month) q.date = { $regex: `^${month}` }
      const items = await database.collection('expenses').find(q).sort({ date: -1 }).toArray()
      return json(clean(items))
    }
    if (route === '/expenses' && method === 'POST') {
      const b = await request.json()
      if (!b.category || !b.amount) return err('category and amount required')
      const doc = {
        id: uuidv4(), agencyId,
        code: 'EXP' + Math.floor(1000 + Math.random() * 9000),
        category: b.category, amount: Number(b.amount),
        date: b.date || new Date().toISOString().slice(0, 10),
        vendor: b.vendor || '', paidVia: b.paidVia || 'Cash',
        billUrl: b.billUrl || '', notes: b.notes || '',
        createdAt: new Date(),
      }
      await database.collection('expenses').insertOne(doc)
      await logActivity(database, agencyId, 'expense_added', `Expense: ${doc.category} ₹${doc.amount}`)
      return json(clean(doc))
    }
    if (route.startsWith('/expenses/') && method === 'PUT') {
      const id = route.split('/')[2]
      const b = await request.json()
      delete b.id; delete b.agencyId; delete b._id
      await database.collection('expenses').updateOne({ id, agencyId }, { $set: b })
      const updated = await database.collection('expenses').findOne({ id, agencyId })
      return json(clean(updated))
    }
    if (route.startsWith('/expenses/') && method === 'DELETE') {
      const id = route.split('/')[2]
      await database.collection('expenses').deleteOne({ id, agencyId })
      return json({ ok: true })
    }

    // ============ INCOMES (Client Payments) ============
    if (route === '/incomes' && method === 'GET') {
      const url = new URL(request.url)
      const clientId = url.searchParams.get('clientId')
      const month = url.searchParams.get('month')
      const q = { agencyId }
      if (clientId) q.clientId = clientId
      if (month) q.date = { $regex: `^${month}` }
      const items = await database.collection('incomes').find(q).sort({ date: -1 }).toArray()
      const enriched = await Promise.all(items.map(async (i) => {
        const client = i.clientId ? await database.collection('clients').findOne({ id: i.clientId, agencyId }) : null
        return { ...clean(i), clientName: client?.name || '' }
      }))
      return json(enriched)
    }
    if (route === '/incomes' && method === 'POST') {
      const b = await request.json()
      if (!b.clientId || !b.amount) return err('clientId and amount required')
      const doc = {
        id: uuidv4(), agencyId,
        code: 'INC' + Math.floor(1000 + Math.random() * 9000),
        clientId: b.clientId, placementId: b.placementId || null, invoiceId: b.invoiceId || null,
        amount: Number(b.amount),
        date: b.date || new Date().toISOString().slice(0, 10),
        method: b.method || 'Cash',
        reference: b.reference || '', notes: b.notes || '',
        createdAt: new Date(),
      }
      await database.collection('incomes').insertOne(doc)
      // Update placement.clientPaid if linked
      if (doc.placementId) {
        const p = await database.collection('placements').findOne({ id: doc.placementId, agencyId })
        if (p) {
          await database.collection('placements').updateOne({ id: p.id, agencyId }, { $set: { clientPaid: Number(p.clientPaid || 0) + doc.amount } })
        }
      }
      // Update invoice if linked
      if (doc.invoiceId) {
        const inv = await database.collection('invoices').findOne({ id: doc.invoiceId, agencyId })
        if (inv) {
          const newPaid = Number(inv.paidAmount || 0) + doc.amount
          const status = newPaid >= inv.totalAmount ? 'paid' : (newPaid > 0 ? 'partial' : 'pending')
          await database.collection('invoices').updateOne({ id: inv.id, agencyId }, { $set: { paidAmount: newPaid, status, paidAt: status === 'paid' ? new Date() : inv.paidAt || null } })
        }
      }
      const c = await database.collection('clients').findOne({ id: doc.clientId, agencyId })
      await logActivity(database, agencyId, 'payment_received', `Payment received from ${c?.name}: ₹${doc.amount}`)
      return json(clean(doc))
    }
    if (route.startsWith('/incomes/') && method === 'DELETE') {
      const id = route.split('/')[2]
      const inc = await database.collection('incomes').findOne({ id, agencyId })
      await database.collection('incomes').deleteOne({ id, agencyId })
      if (inc?.placementId) {
        const p = await database.collection('placements').findOne({ id: inc.placementId, agencyId })
        if (p) await database.collection('placements').updateOne({ id: p.id, agencyId }, { $set: { clientPaid: Math.max(0, Number(p.clientPaid || 0) - Number(inc.amount || 0)) } })
      }
      if (inc?.invoiceId) {
        const iv = await database.collection('invoices').findOne({ id: inc.invoiceId, agencyId })
        if (iv) {
          const newPaid = Math.max(0, Number(iv.paidAmount || 0) - Number(inc.amount || 0))
          const status = newPaid >= iv.totalAmount ? 'paid' : (newPaid > 0 ? 'partial' : 'pending')
          await database.collection('invoices').updateOne({ id: iv.id, agencyId }, { $set: { paidAmount: newPaid, status } })
        }
      }
      return json({ ok: true })
    }

    // ============ INVOICES ============
    if (route === '/invoices' && method === 'GET') {
      const items = await database.collection('invoices').find({ agencyId }).sort({ createdAt: -1 }).toArray()
      const enriched = await Promise.all(items.map(async (i) => {
        const [c, p] = await Promise.all([
          i.clientId ? database.collection('clients').findOne({ id: i.clientId, agencyId }) : null,
          i.placementId ? database.collection('placements').findOne({ id: i.placementId, agencyId }) : null,
        ])
        return { ...clean(i), clientName: c?.name || '', patientName: c?.patientName || '', placementCode: p?.code || '' }
      }))
      return json(enriched)
    }
    // POST /invoices { clientId, placementId, month (YYYY-MM) OR days manual, extras, discount }
    if (route === '/invoices' && method === 'POST') {
      const b = await request.json()
      if (!b.clientId || !b.placementId || !b.month) return err('clientId, placementId, month required')
      const placement = await database.collection('placements').findOne({ id: b.placementId, agencyId })
      if (!placement) return err('placement not found', 404)
      const client = await database.collection('clients').findOne({ id: b.clientId, agencyId })
      const agency = await database.collection('agencies').findOne({ id: agencyId })

      // Determine days worked in that month based on placement date range
      const [y, m] = b.month.split('-').map(Number)
      const monthStart = new Date(y, m - 1, 1)
      const monthEnd = new Date(y, m, 0)
      const pStart = new Date(placement.joinDate)
      const pEnd = placement.offDate ? new Date(placement.offDate) : new Date()
      const startEff = new Date(Math.max(monthStart.getTime(), pStart.getTime()))
      const endEff = new Date(Math.min(monthEnd.getTime(), pEnd.getTime()))
      let daysWorked = 0
      if (endEff >= startEff) {
        daysWorked = Math.round((endEff.getTime() - startEff.getTime()) / 86400000) + 1
      }
      const daysInMonth = monthEnd.getDate()
      const perDay = (Number(placement.monthlyClientCharge || 0)) / 30
      const subTotal = Math.round(perDay * daysWorked)
      const extras = Number(b.extras || 0)
      const discount = Number(b.discount || 0)
      const taxable = subTotal + extras - discount
      const taxPct = Number(b.taxPct || 0)
      const tax = Math.round(taxable * (taxPct / 100))
      const totalAmount = taxable + tax

      const seq = (await database.collection('invoices').countDocuments({ agencyId })) + 1
      const number = `INV-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`
      const doc = {
        id: uuidv4(), agencyId, number,
        clientId: b.clientId, placementId: b.placementId,
        month: b.month, daysWorked, daysInMonth, perDay: Math.round(perDay),
        subTotal, extras, discount, taxPct, tax, totalAmount,
        paidAmount: 0, status: 'pending',
        issuedOn: new Date().toISOString().slice(0, 10),
        dueOn: b.dueOn || new Date(y, m - 1, 15).toISOString().slice(0, 10),
        notes: b.notes || '',
        snapshot: {
          agencyName: agency?.name, agencyPhone: agency?.phone, agencyAddress: agency?.address, agencyCity: agency?.city, agencyState: agency?.state,
          clientName: client?.name, patientName: client?.patientName, clientPhone: client?.phone, clientAddress: client?.address, clientCity: client?.city,
        },
        createdAt: new Date(),
      }
      await database.collection('invoices').insertOne(doc)
      await logActivity(database, agencyId, 'invoice_generated', `Invoice ${number} generated for ${client?.name}: ₹${totalAmount}`)
      return json(clean(doc))
    }
    if (route.startsWith('/invoices/') && method === 'GET') {
      const id = route.split('/')[2]
      const inv = await database.collection('invoices').findOne({ id, agencyId })
      if (!inv) return err('not found', 404)
      const client = inv.clientId ? await database.collection('clients').findOne({ id: inv.clientId, agencyId }) : null
      const placement = inv.placementId ? await database.collection('placements').findOne({ id: inv.placementId, agencyId }) : null
      return json({ ...clean(inv), client: clean(client), placement: clean(placement) })
    }
    if (route.startsWith('/invoices/') && method === 'DELETE') {
      const id = route.split('/')[2]
      await database.collection('invoices').deleteOne({ id, agencyId })
      return json({ ok: true })
    }

    // ============ REPORTS ============
    // GET /reports/pnl?month=YYYY-MM
    if (route === '/reports/pnl' && method === 'GET') {
      const url = new URL(request.url)
      const month = url.searchParams.get('month') // optional
      const filterMonth = (dateStr) => {
        if (!month) return true
        return (dateStr || '').startsWith(month)
      }
      const [placements, expenses, incomes, salaryPayments] = await Promise.all([
        database.collection('placements').find({ agencyId }).toArray(),
        database.collection('expenses').find({ agencyId }).toArray(),
        database.collection('incomes').find({ agencyId }).toArray(),
        database.collection('salary_payments').find({ agencyId }).toArray(),
      ])
      // Revenue based on month share of each placement
      let revenue = 0, staffCost = 0, vendorCommission = 0
      const [y, m] = (month || '').split('-').map(Number)
      const monthStart = month ? new Date(y, m - 1, 1) : null
      const monthEnd = month ? new Date(y, m, 0, 23, 59, 59) : null
      for (const p of placements) {
        const s = new Date(p.joinDate)
        const e = p.offDate ? new Date(p.offDate) : new Date()
        const os = monthStart ? Math.max(s.getTime(), monthStart.getTime()) : s.getTime()
        const oe = monthEnd ? Math.min(e.getTime(), monthEnd.getTime()) : e.getTime()
        if (oe < os) continue
        const days = Math.round((oe - os) / 86400000) + 1
        const factor = days / 30
        const rev = Math.round((Number(p.monthlyClientCharge || 0)) * factor)
        const sal = Math.round((Number(p.monthlyStaffSalary || 0)) * factor)
        let comm = 0
        if (p.vendorId) {
          if (p.vendorCommissionType === 'percent') comm = Math.round(rev * (Number(p.vendorCommission || 0) / 100))
          else comm = Math.round((Number(p.vendorCommission || 0)) * factor)
        }
        revenue += rev; staffCost += sal; vendorCommission += comm
      }
      const expenseTotal = expenses.filter((e) => filterMonth(e.date)).reduce((a, b) => a + Number(b.amount || 0), 0)
      const incomeCollected = incomes.filter((i) => filterMonth(i.date)).reduce((a, b) => a + Number(b.amount || 0), 0)
      const salaryPaid = salaryPayments.filter((p) => (!month || p.month === month) && p.type === 'paid').reduce((a, b) => a + Number(b.amount || 0), 0)

      // Category breakdown for expenses
      const categoryMap = {}
      for (const ex of expenses.filter((e) => filterMonth(e.date))) {
        categoryMap[ex.category] = (categoryMap[ex.category] || 0) + Number(ex.amount || 0)
      }

      const netProfit = revenue - staffCost - vendorCommission - expenseTotal
      return json({
        month: month || 'all-time',
        revenue, staffCost, vendorCommission, expenseTotal, netProfit,
        incomeCollected, salaryPaid,
        pendingClientCollection: revenue - incomeCollected,
        expenseByCategory: Object.entries(categoryMap).map(([category, amount]) => ({ category, amount })),
      })
    }
    // GET /reports/placement -> summary of all placements
    if (route === '/reports/placement' && method === 'GET') {
      const placements = await database.collection('placements').find({ agencyId }).toArray()
      const rows = await Promise.all(placements.map(async (p) => {
        const [s, c, v] = await Promise.all([
          p.staffId ? database.collection('staff').findOne({ id: p.staffId, agencyId }) : null,
          p.clientId ? database.collection('clients').findOne({ id: p.clientId, agencyId }) : null,
          p.vendorId ? database.collection('vendors').findOne({ id: p.vendorId, agencyId }) : null,
        ])
        const calc = calcPlacement(p)
        return {
          code: p.code, status: p.status,
          staffName: s?.name || '', clientName: c?.name || '', patientName: c?.patientName || '', vendorName: v?.name || '',
          joinDate: p.joinDate, offDate: p.offDate || '',
          ...calc,
          clientPaid: p.clientPaid || 0, staffPaid: p.staffPaid || 0,
          pendingClient: calc.clientBill - (p.clientPaid || 0),
          pendingSalary: calc.staffSalary - (p.staffPaid || 0),
        }
      }))
      return json(rows)
    }
    // GET /reports/staff -> staff report with placements count
    if (route === '/reports/staff' && method === 'GET') {
      const [staff, placements] = await Promise.all([
        database.collection('staff').find({ agencyId }).toArray(),
        database.collection('placements').find({ agencyId }).toArray(),
      ])
      const rows = staff.map((s) => {
        const my = placements.filter((p) => p.staffId === s.id)
        const active = my.filter((p) => p.status === 'active').length
        const completed = my.filter((p) => p.status === 'completed').length
        return {
          staffCode: s.staffCode, name: s.name, phone: s.phone, status: s.status,
          monthlySalary: s.monthlySalary || 0, qualification: s.qualification || '', joiningDate: s.joiningDate || '',
          totalPlacements: my.length, activePlacements: active, completedPlacements: completed,
        }
      })
      return json(rows)
    }
    // GET /reports/client -> client report
    if (route === '/reports/client' && method === 'GET') {
      const [clients, placements, incomes] = await Promise.all([
        database.collection('clients').find({ agencyId }).toArray(),
        database.collection('placements').find({ agencyId }).toArray(),
        database.collection('incomes').find({ agencyId }).toArray(),
      ])
      const rows = clients.map((c) => {
        const my = placements.filter((p) => p.clientId === c.id)
        const totalBilled = my.reduce((a, p) => a + (calcPlacement(p).clientBill), 0)
        const paid = incomes.filter((i) => i.clientId === c.id).reduce((a, i) => a + Number(i.amount || 0), 0)
        return {
          code: c.code, name: c.name, patientName: c.patientName, phone: c.phone, city: c.city, location: c.location,
          monthlyCharges: c.monthlyCharges || 0, totalPlacements: my.length,
          totalBilled, totalPaid: paid, pending: totalBilled - paid,
        }
      })
      return json(rows)
    }
    // GET /reports/attendance?month=YYYY-MM
    if (route === '/reports/attendance' && method === 'GET') {
      const url = new URL(request.url)
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7)
      const staffList = await database.collection('staff').find({ agencyId }).toArray()
      const rows = []
      for (const s of staffList) {
        const attendance = await database.collection('attendance').find({ agencyId, staffId: s.id, date: { $regex: `^${month}` } }).toArray()
        const stats = attendanceStats(attendance)
        const pct = stats.total ? Math.round((stats.effective / stats.total) * 100) : 0
        rows.push({
          staffCode: s.staffCode, name: s.name,
          present: stats.present, absent: stats.absent, half: stats.half, leave: stats.leave, paidLeave: stats.paidLeave, late: stats.late,
          workingDays: stats.effective, totalDays: stats.total, percentage: pct,
        })
      }
      return json({ month, rows })
    }

    // ============ CSV EXPORT ============
    // POST /export/csv  { name, headers, rows }
    if (route === '/export/csv' && method === 'POST') {
      const b = await request.json()
      const headers = b.headers || []
      const rows = b.rows || []
      const esc = (v) => {
        if (v === null || v === undefined) return ''
        const s = String(v).replace(/"/g, '""')
        return /[",\n]/.test(s) ? `"${s}"` : s
      }
      const csv = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
      return handleCORS(new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${b.name || 'export'}.csv"` } }))
    }

    // ============ DIGITAL REGISTER ============
    // GET /register?date=YYYY-MM-DD & type
    if (route === '/register' && method === 'GET') {
      const url = new URL(request.url)
      const date = url.searchParams.get('date')
      const type = url.searchParams.get('type')
      const q = { agencyId }
      if (type) q.type = type
      if (date) {
        const start = new Date(date + 'T00:00:00Z')
        const end = new Date(date + 'T23:59:59Z')
        q.createdAt = { $gte: start, $lte: end }
      }
      const items = await database.collection('activities').find(q).sort({ createdAt: -1 }).limit(500).toArray()
      return json(clean(items))
    }

    // ============ SUBSCRIPTION (agency side) ============
    if (route === '/subscription/plans' && method === 'GET') {
      const plans = await database.collection('plans').find({ active: true }).sort({ monthlyPrice: 1 }).toArray()
      return json(clean(plans))
    }
    if (route === '/subscription/me' && method === 'GET') {
      const agency = await database.collection('agencies').findOne({ id: agencyId })
      const [staffCount, clientCount, vendorCount] = await Promise.all([
        database.collection('staff').countDocuments({ agencyId }),
        database.collection('clients').countDocuments({ agencyId }),
        database.collection('vendors').countDocuments({ agencyId }),
      ])
      const requests = await database.collection('payment_requests').find({ agencyId }).sort({ createdAt: -1 }).toArray()
      const receipts = await database.collection('receipts').find({ agencyId }).sort({ createdAt: -1 }).toArray()
      return json({
        agency: clean(agency),
        usage: { staffCount, clientCount, vendorCount },
        requests: clean(requests), receipts: clean(receipts),
      })
    }
    if (route === '/subscription/request' && method === 'POST') {
      const b = await request.json()
      if (!b.planId || !b.amount) return err('planId and amount required')
      const plan = await database.collection('plans').findOne({ id: b.planId })
      if (!plan) return err('Plan not found', 404)
      const doc = {
        id: uuidv4(), agencyId, planId: b.planId, planCode: plan.code, planName: plan.name,
        billingCycle: b.billingCycle || 'monthly',
        amount: Number(b.amount),
        utrNumber: b.utrNumber || '',
        screenshotUrl: b.screenshotUrl || '', // base64 data URL
        transactionDate: b.transactionDate || new Date().toISOString().slice(0, 10),
        remarks: b.remarks || '',
        status: 'pending', // pending | approved | rejected | more_info
        superAdminNote: '',
        createdAt: new Date(),
      }
      await database.collection('payment_requests').insertOne(doc)
      await logActivity(database, agencyId, 'subscription_request', `Payment request submitted: ${plan.name} ₹${b.amount} UTR:${b.utrNumber}`)
      return json(clean(doc))
    }
    if (route.startsWith('/subscription/request/') && method === 'PUT') {
      // Agency can edit their own pending request (e.g., after more_info request)
      const id = route.split('/')[3]
      const b = await request.json()
      const existing = await database.collection('payment_requests').findOne({ id, agencyId })
      if (!existing) return err('not found', 404)
      if (existing.status === 'approved' || existing.status === 'rejected') return err('Cannot edit finalized request', 400)
      const upd = {
        utrNumber: b.utrNumber ?? existing.utrNumber,
        screenshotUrl: b.screenshotUrl ?? existing.screenshotUrl,
        amount: b.amount != null ? Number(b.amount) : existing.amount,
        transactionDate: b.transactionDate ?? existing.transactionDate,
        remarks: b.remarks ?? existing.remarks,
        status: 'pending',
      }
      await database.collection('payment_requests').updateOne({ id, agencyId }, { $set: upd })
      return json({ ok: true })
    }

    // Support tickets (both agency and super admin)
    if (route === '/support/tickets' && method === 'GET') {
      let items
      if (auth.role === 'super_admin') items = await database.collection('support_tickets').find({}).sort({ createdAt: -1 }).toArray()
      else items = await database.collection('support_tickets').find({ agencyId }).sort({ createdAt: -1 }).toArray()
      // Enrich with agency name for super admin
      if (auth.role === 'super_admin') {
        const agencies = await database.collection('agencies').find({}).toArray()
        const map = Object.fromEntries(agencies.map((a) => [a.id, a.name]))
        return json(items.map((t) => { const c = clean(t); return { ...c, agencyName: map[c.agencyId] || '' } }))
      }
      return json(clean(items))
    }
    if (route === '/support/tickets' && method === 'POST') {
      const b = await request.json()
      if (!b.subject) return err('subject required')
      const doc = {
        id: uuidv4(), agencyId: agencyId || null,
        code: 'TKT' + Math.floor(1000 + Math.random() * 9000),
        subject: b.subject, message: b.message || '',
        priority: b.priority || 'normal', // low, normal, high, urgent
        status: 'open', // open, in_progress, resolved, closed
        createdBy: auth.user.name,
        replies: [],
        createdAt: new Date(), updatedAt: new Date(),
      }
      await database.collection('support_tickets').insertOne(doc)
      return json(clean(doc))
    }
    if (route.startsWith('/support/tickets/') && route.endsWith('/reply') && method === 'POST') {
      const id = route.split('/')[3]
      const b = await request.json()
      const ticket = await database.collection('support_tickets').findOne({ id })
      if (!ticket) return err('not found', 404)
      if (auth.role !== 'super_admin' && ticket.agencyId !== agencyId) return err('forbidden', 403)
      const reply = {
        id: uuidv4(), by: auth.user.name, role: auth.role,
        message: b.message || '', at: new Date(),
      }
      await database.collection('support_tickets').updateOne(
        { id },
        { $push: { replies: reply }, $set: { updatedAt: new Date(), status: b.status || ticket.status } }
      )
      return json({ ok: true })
    }
    if (route.startsWith('/support/tickets/') && method === 'PUT') {
      const id = route.split('/')[3]
      const b = await request.json()
      const ticket = await database.collection('support_tickets').findOne({ id })
      if (!ticket) return err('not found', 404)
      if (auth.role !== 'super_admin' && ticket.agencyId !== agencyId) return err('forbidden', 403)
      const upd = {}
      if (b.status) upd.status = b.status
      if (b.priority) upd.priority = b.priority
      if (b.assignedTo) upd.assignedTo = b.assignedTo
      upd.updatedAt = new Date()
      await database.collection('support_tickets').updateOne({ id }, { $set: upd })
      return json({ ok: true })
    }

    // ============ SUPER ADMIN ============
    // ALL /admin/* routes require super_admin
    if (route.startsWith('/admin/') || route === '/settings/platform' || route.startsWith('/plans')) {
      if (auth.role !== 'super_admin') return err('Forbidden - Super Admin only', 403)
    }

    // Platform settings
    if (route === '/settings/platform' && method === 'GET') {
      const s = await database.collection('platform_settings').findOne({ id: 'platform_settings' })
      return json(s ? clean(s) : {})
    }
    if (route === '/settings/platform' && method === 'PUT') {
      const b = await request.json()
      delete b.id; delete b._id
      b.updatedAt = new Date()
      await database.collection('platform_settings').updateOne({ id: 'platform_settings' }, { $set: b }, { upsert: true })
      const s = await database.collection('platform_settings').findOne({ id: 'platform_settings' })
      await logSuperAudit(database, auth.user.id, 'settings_updated', 'platform_settings', 'Platform settings updated')
      return json(clean(s))
    }

    // Plans management
    if (route === '/plans' && method === 'GET') {
      const items = await database.collection('plans').find({}).sort({ monthlyPrice: 1 }).toArray()
      return json(clean(items))
    }
    if (route === '/plans' && method === 'POST') {
      const b = await request.json()
      if (!b.name || !b.code) return err('name and code required')
      const doc = {
        id: uuidv4(), code: b.code, name: b.name,
        monthlyPrice: Number(b.monthlyPrice || 0), yearlyPrice: Number(b.yearlyPrice || 0),
        maxStaff: Number(b.maxStaff || 5), maxClients: Number(b.maxClients || 5), maxVendors: Number(b.maxVendors || 5),
        maxBranches: Number(b.maxBranches || 1), storageGB: Number(b.storageGB || 1),
        features: Array.isArray(b.features) ? b.features : (b.features || '').split(',').map((s) => s.trim()).filter(Boolean),
        description: b.description || '', recommended: !!b.recommended, active: b.active !== false,
        createdAt: new Date(),
      }
      await database.collection('plans').insertOne(doc)
      await logSuperAudit(database, auth.user.id, 'plan_created', doc.id, `Plan ${doc.name} created`)
      return json(clean(doc))
    }
    if (route.startsWith('/plans/') && method === 'PUT') {
      const id = route.split('/')[2]
      const b = await request.json()
      delete b.id; delete b._id
      if (b.features && !Array.isArray(b.features)) b.features = b.features.split(',').map((s) => s.trim()).filter(Boolean)
      await database.collection('plans').updateOne({ id }, { $set: b })
      const p = await database.collection('plans').findOne({ id })
      await logSuperAudit(database, auth.user.id, 'plan_updated', id, `Plan ${p?.name} updated`)
      return json(clean(p))
    }
    if (route.startsWith('/plans/') && method === 'DELETE') {
      const id = route.split('/')[2]
      await database.collection('plans').deleteOne({ id })
      await logSuperAudit(database, auth.user.id, 'plan_deleted', id, `Plan deleted`)
      return json({ ok: true })
    }

    // Admin dashboard (platform-wide metrics)
    if (route === '/admin/dashboard' && method === 'GET') {
      const [agencies, allStaff, allClients, allVendors, allPlacements, requests, receipts, tickets] = await Promise.all([
        database.collection('agencies').find({}).toArray(),
        database.collection('staff').countDocuments({}),
        database.collection('clients').countDocuments({}),
        database.collection('vendors').countDocuments({}),
        database.collection('placements').countDocuments({ status: 'active' }),
        database.collection('payment_requests').find({}).toArray(),
        database.collection('receipts').find({}).toArray(),
        database.collection('support_tickets').find({}).toArray(),
      ])
      const todayIso = new Date().toISOString().slice(0, 10)
      const now = new Date()

      const trialAgencies = agencies.filter((a) => a.plan === 'FREE').length
      const paidAgencies = agencies.filter((a) => a.plan !== 'FREE' && (!a.expiryDate || new Date(a.expiryDate) >= now)).length
      const expiredAgencies = agencies.filter((a) => a.expiryDate && new Date(a.expiryDate) < now).length
      const todayRegistrations = agencies.filter((a) => a.createdAt && new Date(a.createdAt).toISOString().slice(0, 10) === todayIso).length

      const totalRevenue = receipts.reduce((a, r) => a + Number(r.amount || 0), 0)
      const pendingApprovals = requests.filter((r) => r.status === 'pending').length
      const openTickets = tickets.filter((t) => t.status === 'open').length

      // Platform growth: agencies created per month, last 6 months
      const growth = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const nd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        const c = agencies.filter((a) => a.createdAt && new Date(a.createdAt) >= d && new Date(a.createdAt) < nd).length
        const rev = receipts.filter((r) => r.createdAt && new Date(r.createdAt) >= d && new Date(r.createdAt) < nd).reduce((s, r) => s + Number(r.amount || 0), 0)
        growth.push({ month: d.toLocaleString('en-US', { month: 'short' }), agencies: c, revenue: rev })
      }

      return json({
        cards: {
          totalAgencies: agencies.length, trialAgencies, paidAgencies, expiredAgencies, todayRegistrations,
          totalStaff: allStaff, totalClients: allClients, totalVendors: allVendors, activeDuties: allPlacements,
          totalRevenue, pendingApprovals, openTickets,
          mrr: agencies.reduce((s, a) => s + (a.monthlyPrice || 0), 0),
        },
        growth,
      })
    }

    // Agency management
    if (route === '/admin/agencies' && method === 'GET') {
      const agencies = await database.collection('agencies').find({}).sort({ createdAt: -1 }).toArray()
      const staffAgg = await database.collection('staff').aggregate([{ $group: { _id: '$agencyId', count: { $sum: 1 } } }]).toArray()
      const clientAgg = await database.collection('clients').aggregate([{ $group: { _id: '$agencyId', count: { $sum: 1 } } }]).toArray()
      const placementAgg = await database.collection('placements').aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$agencyId', count: { $sum: 1 } } }]).toArray()
      const receiptsAgg = await database.collection('receipts').aggregate([{ $group: { _id: '$agencyId', total: { $sum: '$amount' } } }]).toArray()
      const owners = await database.collection('users').find({ role: 'agency_owner' }).toArray()
      const mapS = Object.fromEntries(staffAgg.map((r) => [r._id, r.count]))
      const mapC = Object.fromEntries(clientAgg.map((r) => [r._id, r.count]))
      const mapP = Object.fromEntries(placementAgg.map((r) => [r._id, r.count]))
      const mapR = Object.fromEntries(receiptsAgg.map((r) => [r._id, r.total]))
      const mapU = Object.fromEntries(owners.map((u) => [u.agencyId, u]))
      const rows = agencies.map((a) => ({
        ...clean(a),
        staffCount: mapS[a.id] || 0,
        clientCount: mapC[a.id] || 0,
        activePlacements: mapP[a.id] || 0,
        totalPaid: mapR[a.id] || 0,
        ownerEmail: mapU[a.id]?.email || a.ownerEmail,
      }))
      return json(rows)
    }
    if (route.startsWith('/admin/agencies/') && route.endsWith('/suspend') && method === 'POST') {
      const id = route.split('/')[3]
      await database.collection('agencies').updateOne({ id }, { $set: { status: 'suspended' } })
      await logSuperAudit(database, auth.user.id, 'agency_suspended', id, `Agency suspended`)
      return json({ ok: true })
    }
    if (route.startsWith('/admin/agencies/') && route.endsWith('/activate') && method === 'POST') {
      const id = route.split('/')[3]
      await database.collection('agencies').updateOne({ id }, { $set: { status: 'active' } })
      await logSuperAudit(database, auth.user.id, 'agency_activated', id, `Agency activated`)
      return json({ ok: true })
    }
    if (route.startsWith('/admin/agencies/') && route.endsWith('/change-plan') && method === 'POST') {
      const id = route.split('/')[3]
      const b = await request.json()
      const plan = await database.collection('plans').findOne({ id: b.planId })
      if (!plan) return err('plan not found', 404)
      const days = (b.billingCycle || 'monthly') === 'yearly' ? 365 : 30
      const expiryDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
      await database.collection('agencies').updateOne({ id }, { $set: {
        plan: plan.code, planId: plan.id, planName: plan.name,
        limits: { maxStaff: plan.maxStaff, maxClients: plan.maxClients, maxVendors: plan.maxVendors, maxBranches: plan.maxBranches },
        monthlyPrice: plan.monthlyPrice,
        activatedOn: new Date().toISOString().slice(0, 10),
        expiryDate,
        status: 'active',
      } })
      await logSuperAudit(database, auth.user.id, 'plan_changed', id, `Plan changed to ${plan.name}`)
      return json({ ok: true })
    }
    if (route.startsWith('/admin/agencies/') && route.endsWith('/reset-password') && method === 'POST') {
      const id = route.split('/')[3]
      const b = await request.json()
      if (!b.newPassword) return err('newPassword required')
      await database.collection('users').updateOne({ agencyId: id, role: 'agency_owner' }, { $set: { passwordHash: hashPassword(b.newPassword) } })
      await logSuperAudit(database, auth.user.id, 'password_reset', id, `Password reset for agency`)
      return json({ ok: true })
    }
    if (route.startsWith('/admin/agencies/') && route.endsWith('/login-as') && method === 'POST') {
      const id = route.split('/')[3]
      const owner = await database.collection('users').findOne({ agencyId: id, role: 'agency_owner' })
      if (!owner) return err('owner not found', 404)
      const token = createToken({ userId: owner.id, agencyId: id, role: 'agency_owner', impersonatorId: auth.user.id })
      await logSuperAudit(database, auth.user.id, 'impersonate', id, `Logged in as agency`)
      return json({ token, user: clean(owner) })
    }
    if (route.startsWith('/admin/agencies/') && method === 'DELETE') {
      const id = route.split('/')[3]
      // Cascade delete (agency-scoped collections)
      const collections = ['staff', 'clients', 'vendors', 'placements', 'attendance', 'salary_payments', 'expenses', 'incomes', 'invoices', 'activities', 'payment_requests', 'receipts', 'support_tickets']
      for (const c of collections) await database.collection(c).deleteMany({ agencyId: id })
      await database.collection('users').deleteMany({ agencyId: id })
      await database.collection('agencies').deleteOne({ id })
      await logSuperAudit(database, auth.user.id, 'agency_deleted', id, `Agency and all data deleted`)
      return json({ ok: true })
    }

    // Payment request management
    if (route === '/admin/payment-requests' && method === 'GET') {
      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const q = status ? { status } : {}
      const items = await database.collection('payment_requests').find(q).sort({ createdAt: -1 }).toArray()
      const agencies = await database.collection('agencies').find({}).toArray()
      const map = Object.fromEntries(agencies.map((a) => [a.id, a]))
      return json(items.map((r) => {
        const c = clean(r); const a = map[c.agencyId]
        return { ...c, agencyName: a?.name || '', ownerName: a?.ownerName || '', phone: a?.phone || '', email: a?.ownerEmail || '' }
      }))
    }
    if (route.startsWith('/admin/payment-requests/') && route.endsWith('/approve') && method === 'POST') {
      const id = route.split('/')[3]
      const approveBody = await request.json().catch(() => ({}))
      const req = await database.collection('payment_requests').findOne({ id })
      if (!req) return err('not found', 404)
      if (req.status === 'approved') return err('Already approved', 400)
      const plan = await database.collection('plans').findOne({ id: req.planId })
      if (!plan) return err('plan gone', 500)
      const days = req.billingCycle === 'yearly' ? 365 : 30
      const now = new Date()
      const agency = await database.collection('agencies').findOne({ id: req.agencyId })
      const base = agency?.expiryDate && new Date(agency.expiryDate) > now ? new Date(agency.expiryDate) : now
      const expiryDate = new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10)
      const activatedOn = now.toISOString().slice(0, 10)
      await database.collection('agencies').updateOne({ id: req.agencyId }, { $set: {
        plan: plan.code, planId: plan.id, planName: plan.name,
        limits: { maxStaff: plan.maxStaff, maxClients: plan.maxClients, maxVendors: plan.maxVendors, maxBranches: plan.maxBranches },
        monthlyPrice: plan.monthlyPrice,
        activatedOn, expiryDate, status: 'active',
      } })
      const seq = (await database.collection('receipts').countDocuments({})) + 1
      const settings = await database.collection('platform_settings').findOne({ id: 'platform_settings' })
      const prefix = settings?.receiptPrefix || 'RCP'
      const number = `${prefix}-${now.getFullYear()}-${String(seq).padStart(5, '0')}`
      const receipt = {
        id: uuidv4(), number, agencyId: req.agencyId, paymentRequestId: req.id,
        planId: plan.id, planName: plan.name, billingCycle: req.billingCycle || 'monthly',
        amount: Number(req.amount), utrNumber: req.utrNumber, method: 'Manual (Bank/UPI)',
        activatedOn, expiryDate,
        snapshot: {
          agencyName: agency?.name, agencyPhone: agency?.phone, agencyAddress: agency?.address,
          platformName: settings?.platformName, companyName: settings?.companyName, companyAddress: settings?.companyAddress,
          gstNumber: settings?.gstNumber, supportEmail: settings?.supportEmail,
        },
        createdAt: now,
      }
      await database.collection('receipts').insertOne(receipt)
      await database.collection('payment_requests').updateOne({ id }, { $set: { status: 'approved', receiptId: receipt.id, approvedAt: now, superAdminNote: approveBody?.note || '' } })
      await logActivity(database, req.agencyId, 'plan_activated', `Plan ${plan.name} activated · Expires ${expiryDate}`)
      await logSuperAudit(database, auth.user.id, 'payment_approved', id, `Approved ₹${req.amount} for agency ${agency?.name} → ${plan.name}`)
      return json({ ok: true, receipt: clean(receipt) })
    }
    if (route.startsWith('/admin/payment-requests/') && route.endsWith('/reject') && method === 'POST') {
      const id = route.split('/')[3]
      const b = await request.json().catch(() => ({}))
      const req = await database.collection('payment_requests').findOne({ id })
      if (!req) return err('not found', 404)
      await database.collection('payment_requests').updateOne({ id }, { $set: { status: 'rejected', superAdminNote: b.note || '', rejectedAt: new Date() } })
      await logActivity(database, req.agencyId, 'plan_rejected', `Payment request rejected: ${b.note || ''}`)
      await logSuperAudit(database, auth.user.id, 'payment_rejected', id, `Rejected payment request`)
      return json({ ok: true })
    }
    if (route.startsWith('/admin/payment-requests/') && route.endsWith('/request-info') && method === 'POST') {
      const id = route.split('/')[3]
      const b = await request.json().catch(() => ({}))
      await database.collection('payment_requests').updateOne({ id }, { $set: { status: 'more_info', superAdminNote: b.note || '' } })
      return json({ ok: true })
    }

    // Audit log
    if (route === '/admin/audit' && method === 'GET') {
      const items = await database.collection('super_audit').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      return json(clean(items))
    }
    // Users (super admin manages)
    if (route === '/admin/users' && method === 'GET') {
      const items = await database.collection('users').find({}).sort({ createdAt: -1 }).toArray()
      return json(clean(items))
    }

    // ============ RECEIPTS (agency-facing) ============
    if (route === '/receipts' && method === 'GET') {
      const items = await database.collection('receipts').find({ agencyId }).sort({ createdAt: -1 }).toArray()
      return json(clean(items))
    }
    if (route.startsWith('/receipts/') && method === 'GET') {
      const id = route.split('/')[2]
      const r = await database.collection('receipts').findOne({ id, agencyId })
      if (!r) return err('not found', 404)
      return json(clean(r))
    }

    // ============ SEARCH ============
    if (route === '/search' && method === 'GET') {
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()
      if (!q) return json({ staff: [], clients: [], vendors: [], placements: [] })
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      const [staff, clients, vendors, placements] = await Promise.all([
        database.collection('staff').find({ agencyId, $or: [{ name: rx }, { staffCode: rx }, { phone: rx }] }).limit(10).toArray(),
        database.collection('clients').find({ agencyId, $or: [{ name: rx }, { patientName: rx }, { phone: rx }, { code: rx }] }).limit(10).toArray(),
        database.collection('vendors').find({ agencyId, $or: [{ name: rx }, { phone: rx }, { code: rx }] }).limit(10).toArray(),
        database.collection('placements').find({ agencyId, $or: [{ code: rx }, { notes: rx }] }).limit(10).toArray(),
      ])
      return json({ staff: clean(staff), clients: clean(clients), vendors: clean(vendors), placements: clean(placements) })
    }

    return err(`Route ${route} not found`, 404)
  } catch (e) {
    console.error('API Error:', e)
    return err('Internal server error', 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
