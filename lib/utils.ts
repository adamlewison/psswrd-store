import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTypeStyle(type: string): { bg: string; text: string } {
  const styles: Record<string, { bg: string; text: string }> = {
    Bank: { bg: 'type-bank-bg', text: 'type-bank-text' },
    Email: { bg: 'type-email-bg', text: 'type-email-text' },
    Investing: { bg: 'type-investing-bg', text: 'type-investing-text' },
    Social: { bg: 'type-social-bg', text: 'type-social-text' },
    Work: { bg: 'type-work-bg', text: 'type-work-text' },
    Streaming: { bg: 'type-streaming-bg', text: 'type-streaming-text' },
    Shopping: { bg: 'type-shopping-bg', text: 'type-shopping-text' },
  }
  return styles[type] ?? { bg: 'type-other-bg', text: 'type-other-text' }
}
