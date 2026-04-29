import type { FieldInput } from '@/actions/accounts'

type FieldType = FieldInput['fieldType']

export function detectFieldType(key: string, value: string): FieldType {
  const k = key.toLowerCase()
  if (k.includes('email') || k.includes('e-mail')) return 'email'
  if (k.includes('password') || k.includes('passwd') || k === 'pass') return 'password'
  if (k.includes('pin')) return 'pin'
  if (k.includes('phone') || k.includes('mobile') || k.includes('tel') || k.includes('cell')) return 'phone'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'
  if (/^\+?[\d][\d\s\-().]{6,14}$/.test(value)) return 'phone'
  if (/^\d{4,8}$/.test(value)) return 'pin'
  return 'text'
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cells.push(cur); cur = '' }
      else cur += ch
    }
  }
  cells.push(cur)
  return cells
}

const FUN_NAMES = [
  'Mystery Vault', 'Secret Lair', 'Hidden Gem', 'Silent Key', 'Shadow Box',
  'Unnamed Relic', 'Dusty Archive', 'Lost Scroll', 'Forgotten Door', 'Blank Slate',
]

export function funName(index: number) {
  return FUN_NAMES[index % FUN_NAMES.length] + (index >= FUN_NAMES.length ? ` ${Math.floor(index / FUN_NAMES.length) + 1}` : '')
}
