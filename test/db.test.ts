import { describe, it, expect } from 'vitest'
import { slugify, jsonStringArray, jsonObject, splitList, toInt, toFloat, bool } from '../src/lib/db'

describe('slugify', () => {
  it('lowercases, strips punctuation and collapses dashes', () => {
    expect(slugify('Dr. Rakesh Sharma')).toBe('dr-rakesh-sharma')
    expect(slugify('  Lajpat Nagar II, New Delhi ')).toBe('lajpat-nagar-ii-new-delhi')
    expect(slugify('Men & Women Clinic')).toBe('men-and-women-clinic')
    expect(slugify('Café Médical')).toBe('cafe-medical')
    expect(slugify('---')).toBe('')
  })
  it('caps length', () => {
    expect(slugify('a'.repeat(200)).length).toBe(80)
  })
})

describe('json helpers', () => {
  it('parses string arrays defensively', () => {
    expect(jsonStringArray('["MBBS","MD"]')).toEqual(['MBBS', 'MD'])
    expect(jsonStringArray('[1,"x"]')).toEqual(['x'])
    expect(jsonStringArray('not json')).toEqual([])
    expect(jsonStringArray(null)).toEqual([])
  })
  it('parses objects defensively', () => {
    expect(jsonObject('{"mon":[["10:00","13:00"]]}')).toEqual({ mon: [['10:00', '13:00']] })
    expect(jsonObject('[1]')).toEqual({})
    expect(jsonObject('')).toEqual({})
  })
})

describe('form coercions', () => {
  it('splitList', () => {
    expect(splitList('Hindi, English\nTamil,,')).toEqual(['Hindi', 'English', 'Tamil'])
    expect(splitList(undefined)).toEqual([])
  })
  it('toInt/toFloat/bool', () => {
    expect(toInt('12')).toBe(12)
    expect(toInt('')).toBeNull()
    expect(toInt('abc')).toBeNull()
    expect(toFloat('28.6139')).toBeCloseTo(28.6139)
    expect(bool('on')).toBe(1)
    expect(bool(undefined)).toBe(0)
  })
})
