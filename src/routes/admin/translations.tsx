/** Admin "Translations" sections. One <form> per language block (HTML forbids nested forms). */
import type { FC } from 'hono/jsx'
import { Field } from './layout'
import { TRANSLATABLE_LANGS, codeForLanguageName, type Lang, type LangCode } from '../../lib/langs'
import type { DoctorTranslation, ClinicTranslation } from '../../lib/translations'

const label = (l: Lang) => `${l.name} (${l.native})`

/** Site languages (minus English) the doctor speaks, in LANGS order. */
export function doctorTranslationLangs(languages: readonly string[]): Lang[] {
  const codes = new Set<LangCode>()
  for (const name of languages) {
    const c = codeForLanguageName(name)
    if (c && c !== 'en') codes.add(c)
  }
  return TRANSLATABLE_LANGS.filter((l) => codes.has(l.code))
}

export const DoctorTranslations: FC<{ doctorId: string; languages: string[]; rows: DoctorTranslation[] }> = ({ doctorId, languages, rows }) => {
  const langs = doctorTranslationLangs(languages)
  const hidden = rows.filter((r) => !langs.some((l) => l.code === r.lang))
  return (
    <div class="card">
      <h2 style="margin-top:0">Translations</h2>
      <p class="help" style="margin-top:0">Typed by hand, no machine translation. Only the languages listed under "Languages" in the profile are shown; a language page falls back to the English text for any empty field.</p>
      {langs.length === 0 ? <p class="muted">Add the doctor's languages above to enable translations</p> : null}
      {langs.map((l) => {
        const r = rows.find((x) => x.lang === l.code)
        return (
          <form method="post" action={`/admin/doctors/${doctorId}/translations/${l.code}`} style="border-top:1px solid #eef0f3;padding-top:10px;margin-top:10px">
            <h3 style="font-size:15px;margin:0">{label(l)} {r?.is_reviewed ? <span class="badge ok">reviewed</span> : r ? <span class="badge warn">draft</span> : <span class="badge">none</span>}</h3>
            <div class="grid-2">
              <Field label="Name"><input type="text" name="tr_name" value={r?.name ?? ''} maxlength={160} lang={l.code} /></Field>
              <Field label="Qualifications note" help="Optional short line shown under the qualifications"><input type="text" name="tr_qualifications_note" value={r?.qualifications_note ?? ''} maxlength={300} lang={l.code} /></Field>
            </div>
            <Field label="Bio"><textarea name="tr_bio" lang={l.code}>{r?.bio ?? ''}</textarea></Field>
            <div class="actions">
              <label class="check" style="margin:0"><input type="checkbox" name="tr_is_reviewed" checked={r?.is_reviewed === 1} />Reviewed</label>
              <button class="btn small" type="submit">Save {l.name}</button>
              {r ? <span class="muted">Updated {r.updated_at}</span> : null}
            </div>
          </form>
        )
      })}
      {hidden.length ? <p class="muted" style="margin-top:12px">Kept but not shown (doctor no longer lists the language): {hidden.map((h) => h.lang).join(', ')}</p> : null}
    </div>
  )
}

export const ClinicTranslations: FC<{ clinicId: string; rows: ClinicTranslation[] }> = ({ clinicId, rows }) => (
  <div class="card">
    <h2 style="margin-top:0">Translations</h2>
    <p class="help" style="margin-top:0">Clinic name, address and locality in each site language. Empty fields fall back to English on that language's pages.</p>
    {TRANSLATABLE_LANGS.map((l) => {
      const r = rows.find((x) => x.lang === l.code)
      return (
        <form method="post" action={`/admin/clinics/${clinicId}/translations/${l.code}`} style="border-top:1px solid #eef0f3;padding-top:10px;margin-top:10px">
          <h3 style="font-size:15px;margin:0">{label(l)} {r ? <span class="badge ok">saved</span> : <span class="badge">none</span>}</h3>
          <div class="grid-2">
            <Field label="Name"><input type="text" name="tr_name" value={r?.name ?? ''} maxlength={160} lang={l.code} /></Field>
            <Field label="Locality"><input type="text" name="tr_locality" value={r?.locality ?? ''} maxlength={120} lang={l.code} /></Field>
          </div>
          <Field label="Address"><textarea name="tr_address" lang={l.code} style="min-height:56px">{r?.address ?? ''}</textarea></Field>
          <div class="actions"><button class="btn small" type="submit">Save {l.name}</button>{r ? <span class="muted">Updated {r.updated_at}</span> : null}</div>
        </form>
      )
    })}
  </div>
)

/** Nine inputs (`name_<code>`) rendered inside an existing city/area form. */
export const NameTranslationInputs: FC<{ names: Map<string, string> }> = ({ names }) => (
  <fieldset>
    <legend>Names in other languages</legend>
    <div class="grid-2">
      {TRANSLATABLE_LANGS.map((l) => (
        <Field label={label(l)}><input type="text" name={`name_${l.code}`} value={names.get(l.code) ?? ''} maxlength={120} lang={l.code} /></Field>
      ))}
    </div>
  </fieldset>
)
