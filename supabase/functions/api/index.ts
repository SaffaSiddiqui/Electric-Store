import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

type UserRole = 'admin' | 'worker'
type UserRecord = {
  id: string
  username: string
  password: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}
type CurrentUser = Pick<UserRecord, 'id' | 'username' | 'full_name' | 'role' | 'is_active'>
type Product = {
  id: string
  code: string
  name: string
  price: number | string
  quantity: number
  low_stock_threshold: number
  category?: string | null
  description?: string | null
  quality?: string | null
  usage?: string | null
  image_url?: string | null
  [key: string]: unknown
}
type DiscountRule = { id: string; min_quantity: number; discount_percent: number; is_active: boolean }
type SaleItemInput = { product_id: string; quantity: number }
type ApiResult<T> = { data: T | null; error: { message: string; code?: string } | null; count?: number | null }

class ApiError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message)
  }
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing required Edge Function secret: ${name}`)
  return value
}

const db: SupabaseClient = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
const jwtSecret = requiredEnv('JWT_SECRET')
const storeTimeZone = Deno.env.get('STORE_TZ') || 'Asia/Karachi'
const tokenLifetimeMinutes = Number(Deno.env.get('JWT_EXPIRE_MINUTES') || 480)
const allowedOrigins = (Deno.env.get('FRONTEND_ORIGIN') || '*').split(',').map((origin: string) => origin.trim()).filter(Boolean)
const loginFailures = new Map<string, { count: number; lockedUntil: number }>()
const encoder = new TextEncoder()

function corsHeaders(request: Request): Record<string, string> {
  const requestOrigin = request.headers.get('origin') || ''
  const allowOrigin = allowedOrigins.includes('*')
    ? '*'
    : allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] || ''

  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    Vary: 'Origin',
  }
}

function json(request: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  })
}

function fail(request: Request, status: number, message: string): Response {
  return json(request, { detail: message }, status)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json()
    if (isRecord(value)) return value
  } catch {
    throw new ApiError('Request body must be valid JSON', 400)
  }
  throw new ApiError('Request body must be a JSON object', 400)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readPositiveInteger(value: unknown, label: string, maximum = 100000): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new ApiError(`${label} must be a positive integer no greater than ${maximum}`, 422)
  }
  return number
}

async function query<T>(request: PromiseLike<ApiResult<T>>): Promise<{ data: T; count: number | null }> {
  const result = await request
  if (result.error) throw new ApiError(result.error.message, result.error.code === '23505' ? 409 : 500)
  return { data: result.data as T, count: result.count ?? null }
}

async function data<T>(request: PromiseLike<ApiResult<T>>): Promise<T> {
  return (await query(request)).data
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(encoder.encode(JSON.stringify(value)))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

async function signToken(user: CurrentUser): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(encoder.encode(jwtSecret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const payload = {
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + tokenLifetimeMinutes * 60,
  }
  const unsignedToken = `${encodeJson({ alg: 'HS256', typ: 'JWT' })}.${encodeJson(payload)}`
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(encoder.encode(unsignedToken)))
  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function readCurrentUser(request: Request): Promise<CurrentUser> {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new ApiError('Please log in again', 401)

  let subject: string
  try {
    const [encodedHeader, encodedPayload, encodedSignature, extra] = token.split('.')
    if (!encodedHeader || !encodedPayload || !encodedSignature || extra) throw new Error('Invalid token')

    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader))) as { alg?: string }
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as { sub?: string; exp?: number }
    if (header.alg !== 'HS256' || typeof claims.sub !== 'string' || typeof claims.exp !== 'number') {
      throw new Error('Invalid token claims')
    }

    const key = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(encoder.encode(jwtSecret)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      toArrayBuffer(base64UrlDecode(encodedSignature)),
      toArrayBuffer(encoder.encode(`${encodedHeader}.${encodedPayload}`)),
    )
    if (!valid || claims.exp <= Date.now() / 1000) throw new Error('Expired or invalid token')
    subject = claims.sub
  } catch {
    throw new ApiError('Please log in again', 401)
  }

  const user = await data<CurrentUser | null>(
    db.from('users')
      .select('id,username,full_name,role,is_active')
      .eq('id', subject)
      .maybeSingle(),
  )
  if (!user?.is_active) throw new ApiError('Please log in again', 401)
  return user
}

function requireAdmin(user: CurrentUser): CurrentUser {
  if (user.role !== 'admin') throw new ApiError('Admin access only', 403)
  return user
}

function cleanFilter(value: string): string {
  return value.replace(/[,()%*\\]/g, ' ').trim()
}

function pageNumber(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value ?? fallback)
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, maximum) : fallback
}

function startOfDay(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError('Date must use YYYY-MM-DD format', 422)
  const [year, month, day] = date.split('-').map(Number)
  const wallClock = Date.UTC(year, month - 1, day)
  let utc = wallClock

  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: storeTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utc)).reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value
      return result
    }, {})

    const representedTime = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    )
    utc = wallClock - (representedTime - utc)
  }

  return new Date(utc).toISOString()
}

function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

function getSaleItems(value: unknown): SaleItemInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    throw new ApiError('A sale must contain between 1 and 100 items', 422)
  }

  return value.map((item) => {
    if (!isRecord(item) || typeof item.product_id !== 'string' || !item.product_id) {
      throw new ApiError('Each sale item must include a product_id', 422)
    }
    return {
      product_id: item.product_id,
      quantity: readPositiveInteger(item.quantity, 'Quantity'),
    }
  })
}

function getDiscountPercent(quantity: number, rules: DiscountRule[]): number {
  return rules
    .filter((rule) => rule.is_active && quantity >= rule.min_quantity)
    .sort((left, right) => right.min_quantity - left.min_quantity)[0]?.discount_percent ?? 0
}

async function uploadProductImage(file: File): Promise<string> {
  const extensionByType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const extension = extensionByType[file.type]
  if (!extension) throw new ApiError('Photo must be a JPG, PNG or WEBP image', 400)
  if (file.size > 2 * 1024 * 1024) throw new ApiError('Photo is larger than 2 MB', 400)

  const path = `${crypto.randomUUID().replaceAll('-', '')}.${extension}`
  const { error } = await db.storage.from('product-images').upload(path, file, { contentType: file.type })
  if (error) throw new ApiError(error.message)
  return db.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

async function login(request: Request): Promise<Response> {
  const body = await readJson(request)
  const username = asString(body.username).trim().toLowerCase()
  const password = asString(body.password)
  if (!username || username.length > 60 || !password || password.length > 200) {
    return fail(request, 422, 'Username and password are required')
  }

  const attempt = loginFailures.get(username) || { count: 0, lockedUntil: 0 }
  if (attempt.lockedUntil > Date.now()) {
    const minutes = Math.ceil((attempt.lockedUntil - Date.now()) / 60000)
    return fail(request, 429, `Too many failed attempts. Try again in ${minutes} minute(s).`)
  }

  const usernamePattern = username.replace(/[\\%_]/g, '\\$&')
  const user = await data<UserRecord | null>(
    db.from('users')
      .select('id,username,password,full_name,role,is_active,created_at')
      .ilike('username', usernamePattern)
      .limit(1)
      .maybeSingle(),
  )
  if (!user?.is_active || user.password !== password) {
    attempt.count += 1
    if (attempt.count >= 5) attempt.lockedUntil = Date.now() + 5 * 60 * 1000
    loginFailures.set(username, attempt)
    return fail(request, 401, 'Wrong username or password')
  }

  loginFailures.delete(username)
  const currentUser: CurrentUser = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
  }
  return json(request, {
    access_token: await signToken(currentUser),
    role: currentUser.role,
    full_name: currentUser.full_name || currentUser.username,
  })
}

async function listProducts(request: Request, url: URL): Promise<Response> {
  const page = pageNumber(url.searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER)
  const pageSize = pageNumber(url.searchParams.get('page_size'), 100, 200)
  let productsQuery = db.from('products').select('*', { count: 'exact' }).eq('is_active', true)
  const search = cleanFilter(url.searchParams.get('search') || '')
  const category = url.searchParams.get('category')
  if (search) productsQuery = productsQuery.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
  if (category) productsQuery = productsQuery.eq('category', category)

  const { data: products, count } = await query<Product[]>(
    productsQuery.order('code').range((page - 1) * pageSize, page * pageSize - 1),
  )
  const totals = await data<{ total_products: number; total_quantity: number }>(db.rpc('inventory_totals'))
  return json(request, {
    items: products,
    count,
    page,
    page_size: pageSize,
    total_products: totals.total_products,
    total_quantity: totals.total_quantity,
  })
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })

  try {
    const url = new URL(request.url)
    const functionPath = '/functions/v1/api'
    const path = (url.pathname.startsWith(functionPath) ? url.pathname.slice(functionPath.length) : url.pathname).replace(/\/$/, '') || '/'
    const method = request.method

    if (path === '/api/auth/login' && method === 'POST') return await login(request)

    const user = await readCurrentUser(request)
    if (path === '/api/auth/me' && method === 'GET') return json(request, user)

    if (path === '/api/products/categories' && method === 'GET') {
      const rows = await data<Array<{ category: string | null }>>(db.from('products').select('category').eq('is_active', true))
      return json(request, [...new Set(rows.map((row) => row.category).filter(Boolean))].sort())
    }

    if (path === '/api/products/search' && method === 'GET') {
      const search = cleanFilter(url.searchParams.get('q') || '')
      if (!search) return json(request, [])
      const products = await data<Product[]>(db.from('products').select('*').eq('is_active', true)
        .or(`name.ilike.%${search}%,code.ilike.%${search}%`).order('code').limit(10))
      return json(request, products)
    }

    if (path === '/api/products' && method === 'GET') return await listProducts(request, url)

    const byCode = path.match(/^\/api\/products\/by-code\/(.+)$/)
    if (byCode && method === 'GET') {
      const code = cleanFilter(decodeURIComponent(byCode[1]))
      const products = await data<Product[]>(db.from('products').select('*').eq('is_active', true).ilike('code', code).limit(1))
      return products[0] ? json(request, products[0]) : fail(request, 404, 'No product with that code')
    }

    const productId = path.match(/^\/api\/products\/([^/]+)$/)
    if (productId && method === 'GET') {
      const products = await data<Product[]>(db.from('products').select('*').eq('id', productId[1]).limit(1))
      return products[0] ? json(request, products[0]) : fail(request, 404, 'Product not found')
    }

    if (path === '/api/discounts' && method === 'GET') {
      const rules = await data<DiscountRule[]>(db.from('discount_rules').select('*').eq('is_active', true).order('min_quantity'))
      return json(request, rules)
    }

    if (path === '/api/discounts/preview' && method === 'POST') {
      const body = await readJson(request)
      const items = getSaleItems(body.items)
      const rules = await data<DiscountRule[]>(db.from('discount_rules').select('*').eq('is_active', true))
      const lines: Array<{
        product_id: string
        code: string
        name: string
        quantity: number
        unit_price: number
        discount_percent: number
        discount_amount: number
        line_total: number
      }> = []

      for (const item of items) {
        const products = await data<Array<{ id: string; code: string; name: string; price: number | string }>>(
          db.from('products').select('id,code,name,price').eq('id', item.product_id).limit(1),
        )
        const product = products[0]
        if (!product) continue
        const discountPercent = getDiscountPercent(item.quantity, rules)
        const gross = Number(product.price) * item.quantity
        const discountAmount = Math.round((gross * discountPercent / 100 + Number.EPSILON) * 100) / 100
        lines.push({
          product_id: item.product_id,
          code: product.code,
          name: product.name,
          quantity: item.quantity,
          unit_price: Number(product.price),
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          line_total: gross - discountAmount,
        })
      }

      const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0)
      const totalDiscount = lines.reduce((sum, line) => sum + line.discount_amount, 0)
      return json(request, { lines, subtotal, total_discount: totalDiscount, grand_total: subtotal - totalDiscount })
    }

    if (path === '/api/discounts' && method === 'POST') {
      requireAdmin(user)
      const body = await readJson(request)
      const minQuantity = readPositiveInteger(body.min_quantity, 'Minimum quantity', 100000)
      const discountPercent = Number(body.discount_percent)
      if (minQuantity < 2 || !Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 90) {
        return fail(request, 422, 'Discount tier values are invalid')
      }
      const saved = await data<DiscountRule[]>(db.from('discount_rules').upsert({
        min_quantity: minQuantity,
        discount_percent: discountPercent,
        is_active: true,
      }, { onConflict: 'min_quantity' }).select())
      return json(request, saved[0])
    }

    const discountId = path.match(/^\/api\/discounts\/([^/]+)$/)
    if (discountId && method === 'PUT') {
      requireAdmin(user)
      const body = await readJson(request)
      const minQuantity = readPositiveInteger(body.min_quantity, 'Minimum quantity', 100000)
      const discountPercent = Number(body.discount_percent)
      if (minQuantity < 2 || !Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 90) {
        return fail(request, 422, 'Discount tier values are invalid')
      }
      const saved = await data<DiscountRule[]>(db.from('discount_rules').update({
        min_quantity: minQuantity,
        discount_percent: discountPercent,
      }).eq('id', discountId[1]).select())
      return json(request, saved[0] || {})
    }
    if (discountId && method === 'DELETE') {
      requireAdmin(user)
      await data(db.from('discount_rules').delete().eq('id', discountId[1]))
      return json(request, { deleted: true })
    }

    if (path === '/api/sales' && method === 'POST') {
      const body = await readJson(request)
      const items = getSaleItems(body.items)
      const customerName = body.customer_name == null ? '' : asString(body.customer_name).trim()
      if (customerName.length > 120) return fail(request, 422, 'Customer name must be 120 characters or fewer')

      const mergedItems = new Map<string, number>()
      for (const item of items) mergedItems.set(item.product_id, (mergedItems.get(item.product_id) || 0) + item.quantity)
      const { data: sale, error } = await db.rpc('create_sale', {
        p_worker_id: user.id,
        p_customer: customerName,
        p_items: [...mergedItems].map(([product_id, quantity]) => ({ product_id, quantity })),
      })
      if (error) return fail(request, 400, error.message)
      return json(request, sale)
    }

    if (path === '/api/sales' && method === 'GET') {
      const isAdmin = user.role === 'admin'
      const page = pageNumber(url.searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER)
      const pageSize = pageNumber(url.searchParams.get('page_size'), 25, 100)
      let salesQuery = db.from('sales').select('*, worker:users(full_name,username), sale_items(*)', { count: 'exact' })

      if (!isAdmin) {
        const today = new Intl.DateTimeFormat('en-US', {
          timeZone: storeTimeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(new Date()).reduce<Record<string, string>>((parts, part) => {
          parts[part.type] = part.value
          return parts
        }, {})
        salesQuery = salesQuery.eq('worker_id', user.id).gte('sold_at', startOfDay(`${today.year}-${today.month}-${today.day}`))
      } else {
        const workerId = url.searchParams.get('worker_id')
        const dateFrom = url.searchParams.get('date_from')
        const dateTo = url.searchParams.get('date_to')
        if (workerId) salesQuery = salesQuery.eq('worker_id', workerId)
        if (dateFrom) salesQuery = salesQuery.gte('sold_at', startOfDay(dateFrom))
        if (dateTo) salesQuery = salesQuery.lt('sold_at', startOfDay(nextDate(dateTo)))
      }

      const productCode = url.searchParams.get('product_code')
      if (productCode) {
        const rows = await data<Array<{ sale_id: string }>>(
          db.from('sale_items').select('sale_id').ilike('product_code', productCode.trim()),
        )
        const saleIds = [...new Set(rows.map((row) => row.sale_id))]
        if (!saleIds.length) return json(request, { items: [], count: 0, page, page_size: pageSize })
        salesQuery = salesQuery.in('id', saleIds)
      }

      const { data: sales, count } = await query<Array<Record<string, unknown>>>(
        salesQuery.order('sold_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
      )
      return json(request, { items: sales, count, page, page_size: pageSize })
    }

    const saleId = path.match(/^\/api\/sales\/([^/]+)$/)
    if (saleId && method === 'GET') {
      const sales = await data<Array<Record<string, unknown> & { worker_id: string }>>(
        db.from('sales').select('*, worker:users(full_name,username), sale_items(*)').eq('id', saleId[1]).limit(1),
      )
      const sale = sales[0]
      if (!sale) return fail(request, 404, 'Bill not found')
      if (user.role !== 'admin' && sale.worker_id !== user.id) return fail(request, 403, 'You can only open your own bills')
      return json(request, sale)
    }

    if (path === '/api/admin/dashboard' && method === 'GET') {
      requireAdmin(user)
      const [today, topProducts, dailySales, products] = await Promise.all([
        data<Record<string, number>>(db.rpc('dashboard_today', { p_tz: storeTimeZone })),
        data<Array<Record<string, unknown>>>(db.rpc('top_products', { p_days: 30 })),
        data<Array<Record<string, unknown>>>(db.rpc('daily_sales', { p_days: 7, p_tz: storeTimeZone })),
        data<Array<{ id: string; code: string; name: string; quantity: number; low_stock_threshold: number }>>(
          db.from('products').select('id,code,name,quantity,low_stock_threshold').eq('is_active', true),
        ),
      ])
      const lowStock = products
        .filter((product) => product.quantity <= product.low_stock_threshold)
        .sort((left, right) => left.quantity - right.quantity)
      return json(request, {
        today,
        low_stock: lowStock,
        top_products: topProducts,
        daily: dailySales,
        as_of: new Date().toISOString(),
      })
    }

    if (path === '/api/admin/workers' && method === 'GET') {
      requireAdmin(user)
      const workers = await data<Array<Omit<CurrentUser, 'is_active'> & { is_active: boolean; created_at: string }>>(
        db.from('users').select('id,username,full_name,role,is_active,created_at').eq('role', 'worker').order('created_at'),
      )
      return json(request, workers)
    }

    if (path === '/api/admin/workers' && method === 'POST') {
      requireAdmin(user)
      const body = await readJson(request)
      const username = asString(body.username).trim().toLowerCase()
      const fullName = asString(body.full_name).trim()
      const password = asString(body.password)
      if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) return fail(request, 422, 'Username must be 3-40 characters and use letters, numbers, _, . or -')
      if (!fullName || fullName.length > 100) return fail(request, 422, 'Full name is required and must be 100 characters or fewer')
      if (password.length < 6 || password.length > 100) return fail(request, 422, 'Password must be between 6 and 100 characters')

      const existing = await data<Array<{ id: string }>>(
        db.from('users').select('id').ilike('username', username).limit(1),
      )
      if (existing.length) return fail(request, 409, 'That username is taken')

      const workers = await data<Array<Record<string, unknown>>>(db.from('users').insert({
        username,
        full_name: fullName,
        password,
        role: 'worker',
      }).select('id,username,full_name,role,is_active,created_at'))
      return json(request, workers[0], 201)
    }

    const workerId = path.match(/^\/api\/admin\/workers\/([^/]+)$/)
    if (workerId && method === 'PUT') {
      requireAdmin(user)
      const body = await readJson(request)
      const update: Record<string, unknown> = {}
      if (body.full_name != null) {
        const fullName = asString(body.full_name).trim()
        if (!fullName || fullName.length > 100) return fail(request, 422, 'Full name must be 1-100 characters')
        update.full_name = fullName
      }
      if (body.is_active != null) {
        if (typeof body.is_active !== 'boolean') return fail(request, 422, 'is_active must be a boolean')
        update.is_active = body.is_active
      }
      if (body.password) {
        const password = asString(body.password)
        if (password.length < 6 || password.length > 100) return fail(request, 422, 'Password must be between 6 and 100 characters')
        update.password = password
      }
      if (!Object.keys(update).length) return fail(request, 400, 'Nothing to change')

      const updated = await data<Array<{ id: string }>>(
        db.from('users').update(update).eq('id', workerId[1]).eq('role', 'worker').select('id'),
      )
      if (!updated.length) return fail(request, 404, 'Worker not found')
      return json(request, { updated: true })
    }

    if (path === '/api/admin/stock-movements' && method === 'GET') {
      requireAdmin(user)
      let movementsQuery = db.from('stock_movements').select('*, product:products(code,name), user:users(full_name,username)')
      const productId = url.searchParams.get('product_id')
      if (productId) movementsQuery = movementsQuery.eq('product_id', productId)
      const movements = await data<Array<Record<string, unknown>>>(movementsQuery.order('created_at', { ascending: false }).limit(100))
      return json(request, movements)
    }

    const restock = path.match(/^\/api\/admin\/products\/([^/]+)\/restock$/)
    if (restock && method === 'POST') {
      const admin = requireAdmin(user)
      const body = await readJson(request)
      const quantity = readPositiveInteger(body.quantity, 'Quantity', 1000000)
      const { data: newQuantity, error } = await db.rpc('restock_product', {
        p_product_id: restock[1],
        p_qty: quantity,
        p_user_id: admin.id,
      })
      if (error) return fail(request, 400, error.message)
      return json(request, { quantity: newQuantity })
    }

    const adminProduct = path.match(/^\/api\/admin\/products(?:\/([^/]+))?$/)
    if (adminProduct && method === 'DELETE' && adminProduct[1]) {
      requireAdmin(user)
      const { error } = await db.from('products').update({ is_active: false }).eq('id', adminProduct[1])
      if (error) throw new ApiError(error.message)
      return json(request, { deactivated: true })
    }

    if (adminProduct && (method === 'POST' || method === 'PUT')) {
      const admin = requireAdmin(user)
      const form = await request.formData()
      const code = asString(form.get('code')).trim()
      const name = asString(form.get('name')).trim()
      const price = Number(form.get('price'))
      const lowStockThreshold = Number(form.get('low_stock_threshold') || 10)
      const imageValue = form.get('image')
      if (!code || code.length > 40 || !name || name.length > 120) return fail(request, 422, 'Product code or name is invalid')
      if (!Number.isFinite(price) || price < 0 || !Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
        return fail(request, 422, 'Product price or low-stock threshold is invalid')
      }

      const collisionQuery = db.from('products').select('id').ilike('code', code)
      const collisions = await data<Array<{ id: string }>>(
        adminProduct[1] ? collisionQuery.neq('id', adminProduct[1]) : collisionQuery,
      )
      if (collisions.length) return fail(request, 409, `Product code ${code} already exists`)

      const product: Record<string, unknown> = {
        code,
        name,
        price,
        category: asString(form.get('category')).trim() || 'General',
        description: asString(form.get('description')),
        quality: asString(form.get('quality')) || 'Standard',
        usage: asString(form.get('usage')),
        low_stock_threshold: lowStockThreshold,
      }
      if (!adminProduct[1]) {
        const quantityValue = Number(form.get('quantity') || 0)
        if (!Number.isInteger(quantityValue) || quantityValue < 0) return fail(request, 422, 'Starting quantity must be a non-negative integer')
        product.quantity = quantityValue
      } else {
        product.updated_at = new Date().toISOString()
      }
      if (imageValue instanceof File && imageValue.size > 0) product.image_url = await uploadProductImage(imageValue)

      if (adminProduct[1]) {
        const saved = await data<Product[]>(db.from('products').update(product).eq('id', adminProduct[1]).select())
        if (!saved[0]) return fail(request, 404, 'Product not found')
        return json(request, saved[0])
      }

      const saved = await data<Product[]>(db.from('products').insert(product).select())
      const created = saved[0]
      if (created.quantity > 0) {
        await data(db.from('stock_movements').insert({
          product_id: created.id,
          change: created.quantity,
          reason: 'restock',
          user_id: admin.id,
        }))
      }
      return json(request, created, 201)
    }

    return fail(request, 404, 'Not found')
  } catch (error) {
    if (error instanceof ApiError) return fail(request, error.status, error.message)
    return fail(request, 500, error instanceof Error ? error.message : 'Something went wrong')
  }
}

export default { fetch: handleRequest }
