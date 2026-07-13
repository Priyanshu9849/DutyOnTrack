import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// ============ MongoDB ============
let client
let db
async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
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
    } catch (e) {}
  }
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
  return { user, agencyId: user.agencyId, role: user.role }
}

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
      if (agency?.plan === 'FREE' && count >= (agency.limits?.maxStaff || 5)) {
        return err('Free plan limit reached (5 staff). Upgrade to add more.', 402)
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
      if (agency?.plan === 'FREE' && count >= (agency.limits?.maxClients || 5)) {
        return err('Free plan limit reached (5 clients). Upgrade to add more.', 402)
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
