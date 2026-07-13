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
