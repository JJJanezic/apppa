import { TIME_ZONE } from '@/lib/locale'

export type Greeting = 'greetingMorning' | 'greetingDay' | 'greetingEvening'

// Stunde in der Zeitzone der App (nicht der des Servers)
export function hourIn(date: Date, timeZone: string = TIME_ZONE): number {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date)
  return Number(hour)
}

// 5–10 Uhr „Guten Morgen“, 11–17 Uhr „Guten Tag“, sonst „Guten Abend“
export function greetingFor(date: Date, timeZone: string = TIME_ZONE): Greeting {
  const hour = hourIn(date, timeZone)
  if (hour >= 5 && hour < 11) return 'greetingMorning'
  if (hour >= 11 && hour < 18) return 'greetingDay'
  return 'greetingEvening'
}
