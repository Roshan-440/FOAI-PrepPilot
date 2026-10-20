/** Time-of-day greeting used on the dashboard header. `hour` is a 0-23 local hour. */
export function greetingForHour(hour: number): 'Good morning' | 'Good afternoon' | 'Good evening' {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** First word of a display name, so "Alex Johnson" greets as "Alex". */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}
