import { describe, expect, it } from 'vitest'
import { parseTimings, slotWithinTimings } from '../src/routes/api'

const t = parseTimings(JSON.stringify({ mon: [['12:00', '17:00']], sat: [['10:00', '13:00'], ['17:00', '20:00']] }))!

describe('booking hours', () => {
  it('accepts a slot inside opening hours', () => {
    expect(slotWithinTimings(t, '2026-10-26', '12:30 PM')).toBe(true) // Monday
    expect(slotWithinTimings(t, '2026-10-31', '7:30 PM')).toBe(true) // Saturday evening
  })
  it('rejects closed days and out-of-hours slots', () => {
    expect(slotWithinTimings(t, '2026-10-25', '12:30 PM')).toBe(false) // Sunday: closed
    expect(slotWithinTimings(t, '2026-10-26', '10:00 AM')).toBe(false)
    expect(slotWithinTimings(t, '2026-10-26', '4:45 PM')).toBe(false) // would end after close
  })
  it('treats empty timings as unknown', () => {
    expect(parseTimings('{}')).toBeNull()
    expect(parseTimings(null)).toBeNull()
  })
})
