import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { all, one, run, uuid, str, toInt } from '../../lib/db'
import { AdminLayout, Field } from './layout'
import { redirectWithFlash, ID_RE } from './common'

export const faqsAdmin = new Hono<AppEnv>()

type Faq = { id: string; page_key: string; question: string; answer: string; sort_order: number }
const KEY_RE = /^[a-z0-9:_-]{3,160}$/

faqsAdmin.get('/', async (c) => {
  const pageKey = (c.req.query('page_key') ?? '').trim()
  const keys = await all<{ page_key: string; n: number }>(c.env.DB, 'SELECT page_key, COUNT(*) n FROM page_faqs GROUP BY page_key ORDER BY page_key')
  const faqs = pageKey && KEY_RE.test(pageKey) ? await all<Faq>(c.env.DB, 'SELECT * FROM page_faqs WHERE page_key = ? ORDER BY sort_order, rowid', pageKey) : []
  return c.html(
    <AdminLayout title="FAQs" user={c.get('user')} flash={c.req.query('flash')} error={c.req.query('error')}>
      <h1>Page FAQs</h1>
      <p class="muted">Page keys: <code>city:delhi:sexologist</code>, <code>area:delhi:sexologist:lajpat-nagar</code>, <code>city:delhi:cond:erectile-dysfunction</code>, <code>doctor:&lt;slug&gt;</code>. Pages without FAQs use the built-in template.</p>
      <form method="get" class="card filters">
        <div><label>Page key</label><input type="text" name="page_key" value={pageKey} list="keys" placeholder="city:delhi:sexologist" required pattern="[a-z0-9:_-]+" /></div>
        <datalist id="keys">{keys.map((k) => <option value={k.page_key}>{`${k.page_key} (${k.n})`}</option>)}</datalist>
        <div style="flex:0"><button class="btn" type="submit">Open</button></div>
      </form>
      {pageKey ? (
        <>
          <h2>{pageKey} ({faqs.length})</h2>
          {faqs.map((f) => (
            <form method="post" action={`/admin/faqs/${f.id}`} class="card">
              <input type="hidden" name="page_key" value={pageKey} />
              <div class="grid-2">
                <Field label="Question"><input type="text" name="question" value={f.question} required /></Field>
                <Field label="Sort order"><input type="number" name="sort_order" value={f.sort_order} /></Field>
              </div>
              <Field label="Answer"><textarea name="answer" required>{f.answer}</textarea></Field>
              <div class="actions">
                <button class="btn" type="submit">Save</button>
                <button class="btn danger" type="submit" formaction={`/admin/faqs/${f.id}/delete`} formnovalidate>Delete</button>
              </div>
            </form>
          ))}
          <h2>Add FAQ</h2>
          <form method="post" action="/admin/faqs" class="card">
            <input type="hidden" name="page_key" value={pageKey} />
            <div class="grid-2">
              <Field label="Question"><input type="text" name="question" required /></Field>
              <Field label="Sort order"><input type="number" name="sort_order" value={faqs.length + 1} /></Field>
            </div>
            <Field label="Answer"><textarea name="answer" required></textarea></Field>
            <div class="actions"><button class="btn" type="submit">Add</button></div>
          </form>
        </>
      ) : null}
    </AdminLayout>,
  )
})

function parseFaq(b: Record<string, string | File>): { page_key: string; question: string; answer: string; sort_order: number } | string {
  const page_key = str(b.page_key) ?? ''
  if (!KEY_RE.test(page_key)) return 'Invalid page key.'
  const question = str(b.question), answer = str(b.answer)
  if (!question || question.length > 300) return 'Question is required (max 300 chars).'
  if (!answer || answer.length > 4000) return 'Answer is required (max 4000 chars).'
  return { page_key, question, answer, sort_order: toInt(b.sort_order) ?? 0 }
}

faqsAdmin.post('/', async (c) => {
  const parsed = parseFaq(await c.req.parseBody())
  if (typeof parsed === 'string') return c.redirect(`/admin/faqs?error=${encodeURIComponent(parsed)}`)
  await run(c.env.DB, 'INSERT INTO page_faqs (id, page_key, question, answer, sort_order) VALUES (?, ?, ?, ?, ?)', uuid(), parsed.page_key, parsed.question, parsed.answer, parsed.sort_order)
  return c.redirect(redirectWithFlash(`/admin/faqs?page_key=${encodeURIComponent(parsed.page_key)}`, 'FAQ added.'))
})

faqsAdmin.post('/:id', async (c) => {
  const id = c.req.param('id')
  if (!ID_RE.test(id)) return c.notFound()
  const parsed = parseFaq(await c.req.parseBody())
  if (typeof parsed === 'string') return c.redirect(`/admin/faqs?error=${encodeURIComponent(parsed)}`)
  await run(c.env.DB, 'UPDATE page_faqs SET question = ?, answer = ?, sort_order = ? WHERE id = ?', parsed.question, parsed.answer, parsed.sort_order, id)
  return c.redirect(redirectWithFlash(`/admin/faqs?page_key=${encodeURIComponent(parsed.page_key)}`, 'FAQ saved.'))
})

faqsAdmin.post('/:id/delete', async (c) => {
  const id = c.req.param('id')
  if (!ID_RE.test(id)) return c.notFound()
  const row = await one<{ page_key: string }>(c.env.DB, 'SELECT page_key FROM page_faqs WHERE id = ?', id)
  await run(c.env.DB, 'DELETE FROM page_faqs WHERE id = ?', id)
  return c.redirect(redirectWithFlash(`/admin/faqs?page_key=${encodeURIComponent(row?.page_key ?? '')}`, 'FAQ deleted.'))
})
