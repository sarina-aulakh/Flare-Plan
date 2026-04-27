import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator,
} from 'react-native'
import { supabase, Task, Checkin } from '../../lib/supabase'
import { Colors, EnergyColors } from '../../constants/colors'

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_JS_IDX = [1, 2, 3, 4, 5, 6, 0] // Maps DAY_LABELS order to JS getDay()

const ENERGY_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3 }

function energyPct(score: number): number {
  return Math.round((score / 3) * 100)
}

function barColor(pct: number): string {
  if (pct >= 75) return EnergyColors.high.bar
  if (pct >= 45) return EnergyColors.medium.bar
  return EnergyColors.low.bar
}

type Stats = {
  tasksShippedPct: number
  bestHoursPerDay: number
  strongestDay: string
  recoveryDays: number
  energyByDay: Array<{ label: string; pct: number }>
  nudge: string
}

export default function Insights() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0]

    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0]

    const [
      { data: allCheckins },
      { data: recentTasks },
      { data: recoveries },
    ] = await Promise.all([
      supabase.from('checkins').select('date, energy_level')
        .eq('user_id', user.id).gte('date', fourWeeksAgoStr),
      supabase.from('tasks').select('is_completed, due_date')
        .eq('user_id', user.id).gte('due_date', twoWeeksAgoStr),
      supabase.from('flare_recoveries').select('hours_available, created_at')
        .eq('user_id', user.id),
    ])

    const checkins = (allCheckins as Checkin[]) ?? []
    const tasks = (recentTasks as Pick<Task, 'is_completed' | 'due_date'>[]) ?? []
    const recoveryList = (recoveries as { hours_available: number; created_at: string }[]) ?? []

    // Tasks shipped %
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.is_completed).length
    const tasksShippedPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Best hours per day (average hours_available from recoveries)
    const avgHours = recoveryList.length > 0
      ? Math.round((recoveryList.reduce((sum, r) => sum + (r.hours_available ?? 0), 0) / recoveryList.length) * 10) / 10
      : 0

    // Energy by day of week
    const dayScores: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    for (const c of checkins) {
      const d = new Date(c.date + 'T12:00:00')
      const jsDay = d.getDay()
      const score = ENERGY_SCORE[c.energy_level] ?? 2
      dayScores[jsDay].push(score)
    }

    const energyByDay = DAY_LABELS.map((label, i) => {
      const jsIdx = DAY_JS_IDX[i]
      const scores = dayScores[jsIdx]
      if (scores.length === 0) return { label, pct: 0 }
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      return { label, pct: energyPct(avg) }
    })

    // Strongest day
    const bestDayIdx = energyByDay.reduce((best, d, i) => d.pct > energyByDay[best].pct ? i : best, 0)
    const strongestDay = energyByDay[bestDayIdx].pct > 0 ? DAY_LABELS[bestDayIdx] : '—'

    // Nudge
    const strongestDayFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][bestDayIdx]
    const nudge = energyByDay[bestDayIdx].pct > 0
      ? `${strongestDayFull} mornings are when you do your best deep work. Try protecting them — block essays and problem sets, not errands.`
      : 'Keep checking in daily so Flare Plan can learn your energy patterns.'

    setStats({
      tasksShippedPct,
      bestHoursPerDay: avgHours,
      strongestDay,
      recoveryDays: recoveryList.length,
      energyByDay,
      nudge,
    })
    setLoading(false)
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>
            <Text style={s.logoFlare}>flare </Text>
            <Text style={s.logoPlan}>plan</Text>
          </Text>
          <View style={s.avatar} />
        </View>

        <Text style={s.eyebrow}>INSIGHTS</Text>
        <Text style={s.heading}>
          Your patterns are{' '}
          <Text style={s.headingItalic}>showing.</Text>
        </Text>
        <Text style={s.subheading}>
          The more you check in, the better Flare Plan listens. Here's what the last two weeks said.
        </Text>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : stats ? (
          <>
            {/* Stats grid */}
            <View style={s.grid}>
              <StatCard
                value={`${stats.tasksShippedPct}%`}
                label="TASKS SHIPPED"
                sub="across the last 14 days"
              />
              <StatCard
                value={stats.bestHoursPerDay > 0 ? `${stats.bestHoursPerDay}` : '—'}
                label="BEST HOURS / DAY"
                sub="your sustainable ceiling"
              />
              <StatCard
                value={stats.strongestDay}
                label="STRONGEST DAY"
                sub="consistently high energy"
              />
              <StatCard
                value={`${stats.recoveryDays}`}
                label="RECOVERY DAYS"
                sub="honored, not skipped"
              />
            </View>

            {/* Energy by day chart */}
            <View style={s.chartCard}>
              <View style={s.chartHeader}>
                <Text style={s.chartTitle}>Energy by day</Text>
                <Text style={s.chartMeta}>avg, last 4 weeks</Text>
              </View>
              {stats.energyByDay.map(({ label, pct }) => (
                <View key={label} style={s.barRow}>
                  <Text style={s.barLabel}>{label}</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${pct}%`, backgroundColor: barColor(pct) }]} />
                  </View>
                  <Text style={s.barPct}>{pct > 0 ? `${pct}%` : '—'}</Text>
                </View>
              ))}
            </View>

            {/* Gentle nudge */}
            <View style={s.nudgeCard}>
              <Text style={s.nudgeEyebrow}>A GENTLE NUDGE</Text>
              <Text style={s.nudgeText}>
                <Text style={s.nudgeItalic}>
                  {stats.strongestDay !== '—' ? `${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][DAY_LABELS.indexOf(stats.strongestDay)] ?? ''} mornings` : 'Your best days'}
                </Text>
                {' '}are when you do your best deep work. Try protecting them — block essays and problem sets, not errands.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statSub}>{sub}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, paddingBottom: 80 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  logo: { fontSize: 18 },
  logoFlare: { fontWeight: '700', color: Colors.text },
  logoPlan: { fontStyle: 'italic', fontWeight: '400', color: Colors.highlight },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.border },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: Colors.accent, textTransform: 'uppercase', marginBottom: 6 },
  heading: { fontSize: 34, fontWeight: '800', color: Colors.text, lineHeight: 40, marginBottom: 10 },
  headingItalic: { fontStyle: 'italic', color: Colors.highlight },
  subheading: { fontSize: 15, color: Colors.accent, lineHeight: 24, marginBottom: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.white,
    borderRadius: 20, padding: 18,
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
  },
  statValue: { fontSize: 40, fontWeight: '700', color: Colors.text, lineHeight: 44, marginBottom: 4 },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: Colors.accent, textTransform: 'uppercase', marginBottom: 3 },
  statSub: { fontSize: 12, color: Colors.muted, lineHeight: 18 },
  chartCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 20,
    marginBottom: 20,
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  chartMeta: { fontSize: 12, color: Colors.accent },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  barLabel: { width: 34, fontSize: 12, fontWeight: '600', color: Colors.accent },
  barTrack: { flex: 1, height: 10, backgroundColor: Colors.border, borderRadius: 5, marginHorizontal: 10, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  barPct: { width: 36, fontSize: 12, fontWeight: '600', color: Colors.secondary, textAlign: 'right' },
  nudgeCard: {
    backgroundColor: '#F5EDE8', borderRadius: 20, padding: 20,
    borderLeftWidth: 3, borderLeftColor: Colors.highlight,
  },
  nudgeEyebrow: { fontSize: 10, letterSpacing: 2, color: Colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  nudgeText: { fontSize: 15, color: Colors.secondary, lineHeight: 26 },
  nudgeItalic: { fontStyle: 'italic', color: Colors.highlight, fontWeight: '600' },
})
