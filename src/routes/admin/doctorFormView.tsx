import type { FC } from 'hono/jsx'
import { Field, Select } from './layout'
import { GENDERS, PATIENTS, type SpecialtyOpt, type ConditionOpt } from './common'

export type DoctorFormValues = {
  name?: string | null
  gender?: string | null
  patients_treated?: string | null
  qualifications?: string[]
  registration_number?: string | null
  registration_council?: string | null
  is_verified?: number
  experience_years?: number | null
  languages?: string[]
  bio?: string | null
  video_consult?: number
  video_fee?: number | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  website?: string | null
  google_maps_url?: string | null
  is_published?: number
  specialty_ids?: string[]
  primary_specialty_id?: string | null
  condition_ids?: string[]
}

/** Inline script: disable "Mark as verified" unless registration_number has a value. */
const VERIFY_SCRIPT = `
(function(){var r=document.getElementById('reg_no'),v=document.getElementById('is_verified');if(!r||!v)return;
function sync(){var has=r.value.trim().length>0;v.disabled=!has;if(!has)v.checked=false;}r.addEventListener('input',sync);sync();})();`

/** Doctor fields (prefixed doctor_) used in the doctor edit form and the import review form. */
export const DoctorFields: FC<{ v: DoctorFormValues; specialties: SpecialtyOpt[]; conditions: ConditionOpt[] }> = ({ v, specialties, conditions }) => {
  const sel = new Set(v.specialty_ids ?? [])
  const selC = new Set(v.condition_ids ?? [])
  return (
    <>
      <div class="grid-2">
        <Field label="Full name (with Dr.)"><input type="text" name="doctor_name" value={v.name ?? ''} required minlength={3} /></Field>
        <Field label="Gender"><Select name="doctor_gender" value={v.gender} options={GENDERS} required blank="Select…" /></Field>
        <Field label="Patients treated"><Select name="doctor_patients_treated" value={v.patients_treated ?? 'both'} options={PATIENTS} /></Field>
        <Field label="Experience (years)"><input type="number" name="doctor_experience_years" min={0} max={70} value={v.experience_years ?? ''} /></Field>
        <Field label="Qualifications" help="Comma separated, e.g. MBBS, MD (Psychiatry)"><input type="text" name="doctor_qualifications" value={(v.qualifications ?? []).join(', ')} /></Field>
        <Field label="Languages" help="Comma separated, e.g. Hindi, English"><input type="text" name="doctor_languages" value={(v.languages ?? []).join(', ')} /></Field>
        <Field label="Registration number"><input type="text" id="reg_no" name="doctor_registration_number" value={v.registration_number ?? ''} /></Field>
        <Field label="Registration council" help="e.g. Delhi Medical Council, NMC"><input type="text" name="doctor_registration_council" value={v.registration_council ?? ''} /></Field>
        <Field label="Phone"><input type="tel" name="doctor_phone" value={v.phone ?? ''} /></Field>
        <Field label="WhatsApp"><input type="tel" name="doctor_whatsapp" value={v.whatsapp ?? ''} /></Field>
        <Field label="Email"><input type="email" name="doctor_email" value={v.email ?? ''} /></Field>
        <Field label="Website"><input type="url" name="doctor_website" value={v.website ?? ''} /></Field>
        <Field label="Google Maps URL (sameAs)"><input type="url" name="doctor_google_maps_url" value={v.google_maps_url ?? ''} /></Field>
        <Field label="Video consultation fee (Rs)"><input type="number" name="doctor_video_fee" min={0} value={v.video_fee ?? ''} /></Field>
      </div>
      <Field label="Bio"><textarea name="doctor_bio">{v.bio ?? ''}</textarea></Field>
      <fieldset>
        <legend>Specialties</legend>
        <div class="chips">
          {specialties.map((s) => (
            <label><input type="checkbox" name="doctor_specialties[]" value={s.id} checked={sel.has(s.id)} />{s.name}</label>
          ))}
        </div>
        <Field label="Primary specialty"><Select name="doctor_primary_specialty" value={v.primary_specialty_id} options={specialties.map((s) => ({ value: s.id, label: s.name }))} blank="First selected" /></Field>
      </fieldset>
      <fieldset>
        <legend>Conditions treated</legend>
        <div class="chips">
          {conditions.map((cn) => (
            <label><input type="checkbox" name="doctor_conditions[]" value={cn.id} checked={selC.has(cn.id)} />{cn.name}</label>
          ))}
        </div>
      </fieldset>
      <div class="chips">
        <label class="check"><input type="checkbox" name="doctor_video_consult" checked={v.video_consult === 1} />Offers video consultation</label>
        <label class="check"><input type="checkbox" id="is_verified" name="doctor_is_verified" checked={v.is_verified === 1} />Mark as verified (needs registration number)</label>
        <label class="check"><input type="checkbox" name="doctor_is_published" checked={v.is_published === 1} />Published</label>
      </div>
      <script dangerouslySetInnerHTML={{ __html: VERIFY_SCRIPT }} />
    </>
  )
}
