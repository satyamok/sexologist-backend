export type Bindings = {
  DB: D1Database
  MEDIA: R2Bucket
  MEDIA_URL: string
  SITE_URL: string
  MIN_DOCTORS_PER_PAGE: string
  CORS_ORIGINS: string
  GOOGLE_PLACES_API_KEY?: string
  SESSION_SECRET?: string
}

export type Role = 'master_admin' | 'admin' | 'doctor' | 'patient'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
  doctor_id: string | null
}

export type Variables = {
  user: SessionUser
  sessionId: string
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }
