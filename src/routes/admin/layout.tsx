import type { FC, PropsWithChildren } from 'hono/jsx'
import type { SessionUser } from '../../env'

const CSS = `
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;background:#f6f7f9}
a{color:#0b5fa5}header{background:#0b3d5c;color:#fff;padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center}
header .logo{font-weight:700;font-size:17px;color:#fff;text-decoration:none;margin-right:auto}header nav a{color:#dbeafe;text-decoration:none;font-size:14px}
header nav a:hover{color:#fff;text-decoration:underline}header .user{font-size:13px;color:#cbd5e1}
main{max-width:1100px;margin:0 auto;padding:20px 16px}h1{font-size:22px;margin:0 0 16px}h2{font-size:17px;margin:24px 0 10px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px 20px}
.stat{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px}.stat b{display:block;font-size:26px;color:#0b3d5c}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid #eef0f3;text-align:left;vertical-align:top;font-size:14px}th{background:#f1f5f9;font-weight:600}
.tbl-wrap{overflow-x:auto}label{display:block;font-size:13px;font-weight:600;color:#374151;margin:10px 0 4px}
input[type=text],input[type=email],input[type=password],input[type=number],input[type=url],input[type=tel],input[type=search],input[type=date],select,textarea{width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font:inherit;background:#fff}
textarea{min-height:80px}input[type=checkbox]{width:16px;height:16px;vertical-align:middle;margin-right:6px}
.check{font-weight:500;display:flex;align-items:center;gap:4px}.check input{margin:0 6px 0 0}
.btn{display:inline-block;padding:8px 14px;border-radius:6px;border:1px solid #0b5fa5;background:#0b5fa5;color:#fff;font:inherit;cursor:pointer;text-decoration:none;font-size:14px}
.btn.secondary{background:#fff;color:#0b5fa5}.btn.danger{background:#b91c1c;border-color:#b91c1c}.btn.small{padding:4px 9px;font-size:13px}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;align-items:center}.inline{display:inline}
.badge{display:inline-block;padding:1px 7px;border-radius:999px;font-size:12px;background:#e5e7eb;color:#374151}.badge.ok{background:#dcfce7;color:#166534}.badge.warn{background:#fef3c7;color:#92400e}
.flash{padding:10px 14px;border-radius:6px;margin-bottom:14px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0}.flash.error{background:#fee2e2;color:#991b1b;border-color:#fecaca}
.muted{color:#6b7280;font-size:13px}.help{color:#6b7280;font-size:12px;margin-top:3px}code,pre{background:#f1f5f9;border-radius:4px;padding:2px 5px;font-size:13px}pre{padding:10px;overflow-x:auto}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:end}.filters label{margin:0 0 4px}.filters>div{flex:1 1 160px}
#map{height:320px;border-radius:8px;border:1px solid #cbd5e1;margin-top:8px}.login{max-width:380px;margin:60px auto}
fieldset{border:1px solid #e5e7eb;border-radius:8px;padding:6px 14px 14px;margin:0 0 14px}legend{font-weight:600;font-size:14px;padding:0 6px}
.chips{display:flex;flex-wrap:wrap;gap:6px 14px}.chips label{font-weight:500;display:flex;align-items:center;margin:4px 0}
@media (max-width:640px){main{padding:14px 10px}th,td{padding:6px}}
`

type LayoutProps = PropsWithChildren<{ title: string; user?: SessionUser | null; flash?: string | null; error?: string | null }>

export const AdminLayout: FC<LayoutProps> = ({ title, user, flash, error, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex,nofollow" />
      <title>{title} · SexologistIndia Admin</title>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </head>
    <body>
      <header>
        <a class="logo" href="/admin">SexologistIndia Admin</a>
        {user ? (
          <>
            <nav style="display:flex;flex-wrap:wrap;gap:14px">
              <a href="/admin/doctors">Doctors</a>
              <a href="/admin/clinics">Clinics</a>
              <a href="/admin/import">Import</a>
              <a href="/admin/cities">Cities</a>
              <a href="/admin/faqs">FAQs</a>
              <a href="/admin/bookings">Bookings</a>
              <a href="/admin/sales">Sales</a>
              {user.role === 'master_admin' ? <a href="/admin/users">Users</a> : null}
            </nav>
            <span class="user">{user.name}</span>
            <form method="post" action="/auth/logout" class="inline">
              <button class="btn small secondary" type="submit">Logout</button>
            </form>
          </>
        ) : null}
      </header>
      <main>
        {flash ? <div class="flash">{flash}</div> : null}
        {error ? <div class="flash error">{error}</div> : null}
        {children}
      </main>
    </body>
  </html>
)

export const Field: FC<PropsWithChildren<{ label: string; help?: string }>> = ({ label, help, children }) => (
  <div>
    <label>{label}</label>
    {children}
    {help ? <div class="help">{help}</div> : null}
  </div>
)

export const Select: FC<{ name: string; value: string | null | undefined; options: { value: string; label: string }[]; id?: string; required?: boolean; blank?: string }> = ({ name, value, options, id, required, blank }) => (
  <select name={name} id={id} required={required}>
    {blank !== undefined ? <option value="">{blank}</option> : null}
    {options.map((o) => (
      <option value={o.value} selected={o.value === (value ?? '')}>{o.label}</option>
    ))}
  </select>
)

export function yesNo(v: number | boolean | null | undefined): string {
  return v === 1 || v === true ? 'Yes' : 'No'
}

export function fmtDate(s: string | null | undefined): string {
  return s ? s.slice(0, 16).replace('T', ' ') : ''
}
