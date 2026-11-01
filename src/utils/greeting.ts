/** Aaji's short hello on Home — warm, and it follows the time of day. No AI, no surprises. */
export function aajiGreeting(name: string, now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return `सुप्रभात ${name}!`;
  if (hour >= 12 && hour < 17) return `नमस्कार ${name}!`;
  if (hour >= 17 && hour < 21) return `ये ${name}, इथे बस!`;
  return `${name}, झोपायची वेळ झाली!`;
}
