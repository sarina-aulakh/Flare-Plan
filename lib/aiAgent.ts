import { Task } from './supabase'

export type TaskWithTip = Task & { tip: string }

const cache: { [energyLevel: string]: { data: TaskWithTip[]; ts: number } } = {}
const CACHE_TTL = 30 * 60 * 1000

function detectEnergy(title: string): 'light' | 'medium' | 'heavy' {
  const lower = title.toLowerCase()
  const heavy = ['exam', 'final', 'midterm', 'essay', 'research', 'thesis', 'report', 'paper', 'project']
  const light = ['quiz', 'reading', 'watch', 'review', 'discussion', 'post', 'reflection']
  if (heavy.some((w) => lower.includes(w))) return 'heavy'
  if (light.some((w) => lower.includes(w))) return 'light'
  return 'medium'
}

export { detectEnergy }

function energyMatches(taskEnergy: string, userEnergy: string): boolean {
  const map: Record<string, string[]> = {
    low: ['light'],
    medium: ['light', 'medium'],
    high: ['light', 'medium', 'heavy'],
  }
  return map[userEnergy]?.includes(taskEnergy) ?? true
}

function fallbackTips(tasks: Task[], energyLevel: string): TaskWithTip[] {
  return tasks
    .filter((t) => energyMatches(t.energy_required, energyLevel))
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .map((t) => ({ ...t, tip: 'Break this into smaller steps and start with the easiest part.' }))
}

export async function organizeTasks(
  tasks: Task[],
  energyLevel: string
): Promise<TaskWithTip[]> {
  const cached = cache[energyLevel]
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) return fallbackTips(tasks, energyLevel)

  const filtered = tasks.filter((t) => energyMatches(t.energy_required, energyLevel))
  if (filtered.length === 0) return []

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You help students with chronic illness manage their academic tasks. The student's energy today is: ${energyLevel}.

For each task below, write one short, warm, practical tip (one sentence). No pressure language. Return ONLY valid JSON: an array of objects with "id" and "tip".

Tasks:
${JSON.stringify(
  filtered.map((t) => ({ id: t.id, title: t.title, subject: t.subject, due: t.due_date })),
  null,
  2
)}`,
          },
        ],
      }),
    })

    if (!response.ok) return fallbackTips(tasks, energyLevel)

    const json = await response.json()
    const text: string = json.content[0].text
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return fallbackTips(tasks, energyLevel)

    const tips: { id: number; tip: string }[] = JSON.parse(match[0])
    const tipMap = Object.fromEntries(tips.map((t) => [t.id, t.tip]))

    const result: TaskWithTip[] = filtered.map((t) => ({
      ...t,
      tip: tipMap[t.id] ?? 'Start small and be kind to yourself.',
    }))

    cache[energyLevel] = { data: result, ts: Date.now() }
    return result
  } catch {
    return fallbackTips(tasks, energyLevel)
  }
}

export function clearAICache() {
  for (const key in cache) delete cache[key]
}
