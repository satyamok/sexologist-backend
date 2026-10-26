import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from './env'
import { auth } from './routes/auth'
import { api } from './routes/api'
import { admin } from './routes/admin'

const app = new Hono<AppEnv>()

app.use('/api/*', async (c, next) => {
  const origins = (c.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return cors({
    origin: (origin) => (origins.includes(origin) ? origin : origins.includes('*') ? '*' : null),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })(c, next)
})
app.use('/auth/*', async (c, next) => {
  const origins = (c.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return cors({ origin: (origin) => (origins.includes(origin) ? origin : null), credentials: true, allowHeaders: ['Content-Type', 'Authorization'] })(c, next)
})

app.get('/', (c) => c.json({ ok: true, data: { name: 'sexologistbe', docs: '/api/meta', admin: '/admin' } }))
app.get('/health', (c) => c.json({ ok: true, data: { status: 'up' } }))

app.route('/auth', auth)
app.route('/api', api)
app.route('/admin', admin)

app.notFound((c) => {
  if ((c.req.header('Accept') ?? '').includes('text/html')) return c.text('Not found', 404)
  return c.json({ ok: false, error: 'Not found' }, 404)
})

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const res = err.getResponse()
    if ((c.req.header('Accept') ?? '').includes('text/html')) return res
    return c.json({ ok: false, error: err.message || res.statusText }, res.status as 400)
  }
  console.error('Unhandled error', err)
  const wantsHtml = (c.req.header('Accept') ?? '').includes('text/html')
  if (wantsHtml) return c.text(`Something went wrong: ${err.message}`, 500)
  return c.json({ ok: false, error: 'Internal error' }, 500)
})

export default app
