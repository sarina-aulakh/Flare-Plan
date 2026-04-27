import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator,
} from 'react-native'
import { supabase, Task } from '../../lib/supabase'
import { Colors, EnergyColors } from '../../constants/colors'

type RecoveryEntry = {
  id: number
  days_lost: number
  energy_level: string
  hours_available: number
  created_at: string
}

const ENERGY_OPTIONS = [
  { value: 'low' as const, emoji: '🌱', label: 'Low', description: 'Running on empty' },
  { value: 'medium' as const, emoji: '🌤', label: 'Medium', description: 'Some energy to work with' },
  { value: 'high' as const, emoji: '⚡', label: 'High', description: 'Feeling okay today' },
]

function formatRecoveryDate(isoStr: string, daysLost: number): string {
  const end = new Date(isoStr)
  const start = new Date(end.getTime() - (daysLost - 1) * 86400000)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  return `${fmt(start)} — ${fmt(end)}`
}

export default function Recovery() {
  const [step, setStep] = useState(0) // 0=landing, 1-3=wizard, 4=result
  const [lastRecovery, setLastRecovery] = useState<RecoveryEntry | null>(null)
  const [loadingLanding, setLoadingLanding] = useState(true)

  // Wizard state
  const [daysLost, setDaysLost] = useState(0)
  const [energyLevel, setEnergyLevel] = useState<'low' | 'medium' | 'high'>('medium')
  const [hoursAvailable, setHoursAvailable] = useState(0)
  const [prioritized, setPrioritized] = useState<Task[]>([])
  const [overflow, setOverflow] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchLanding = useCallback(async () => {
    setLoadingLanding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingLanding(false); return }

    const { data } = await supabase
      .from('flare_recoveries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setLastRecovery(data as RecoveryEntry | null)
    setLoadingLanding(false)
  }, [])

  useEffect(() => { fetchLanding() }, [fetchLanding])

  const buildPlan = async () => {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_completed', false)
      .order('due_date', { ascending: true })

    if (fetchError || !data) {
      setError('Could not load tasks. Please try again.')
      setLoading(false)
      return
    }

    const energyMap: Record<string, string[]> = {
      low: ['light'],
      medium: ['light', 'medium'],
      high: ['light', 'medium', 'heavy'],
    }

    const doable = (data as Task[]).filter(t => energyMap[energyLevel].includes(t.energy_required))
    const caps: Record<string, number> = { low: 2, medium: 3, high: 4 }
    const maxTasks = Math.min(caps[energyLevel], Math.max(1, Math.floor(hoursAvailable / 1.5)))
    const plan = doable.slice(0, maxTasks)

    await supabase.from('flare_recoveries').insert({
      days_lost: daysLost,
      energy_level: energyLevel,
      hours_available: hoursAvailable,
      user_id: user?.id,
    })

    setPrioritized(plan)
    setOverflow(doable.length - plan.length)
    setLoading(false)
    setStep(4)
    fetchLanding()
  }

  const reset = () => {
    setStep(0)
    setDaysLost(0)
    setEnergyLevel('medium')
    setHoursAvailable(0)
    setPrioritized([])
    setOverflow(0)
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.logo}>
          <Text style={s.logoFlare}>flare </Text>
          <Text style={s.logoPlan}>plan</Text>
        </Text>
        <View style={s.avatar} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* LANDING */}
        {step === 0 && (
          <>
            <Text style={s.eyebrow}>RECOVERY</Text>
            <Text style={s.heading}>
              Hey. You're back.{' '}
              <Text style={s.headingItalic}>That's what matters.</Text>
            </Text>
            <Text style={s.subheading}>
              No catch-up cliff. No guilt list. We'll look at what's still ahead and trim the week down to what your body can carry.
            </Text>

            {loadingLanding ? (
              <ActivityIndicator color={Colors.accent} style={{ marginTop: 20 }} />
            ) : lastRecovery ? (
              <View style={s.lastRecoveryCard}>
                <View style={s.lastRecoveryTop}>
                  <View>
                    <Text style={s.lastRecoveryEyebrow}>LAST RECOVERY</Text>
                    <Text style={s.lastRecoveryDate}>
                      {formatRecoveryDate(lastRecovery.created_at, lastRecovery.days_lost)}
                    </Text>
                  </View>
                  <View style={s.daysBox}>
                    <Text style={s.daysNum}>{lastRecovery.days_lost}</Text>
                    <Text style={s.daysLabel}>DAYS</Text>
                  </View>
                </View>
                <View style={s.divider} />
                <Text style={s.lastRecoveryNote}>
                  You came back at <Text style={s.bold}>{lastRecovery.energy_level} energy</Text> with{' '}
                  <Text style={s.bold}>{lastRecovery.hours_available}h available</Text>.
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={s.beginCta} onPress={() => setStep(1)}>
              <View>
                <Text style={s.beginEyebrow}>START</Text>
                <Text style={s.beginLabel}>Begin recovery flow</Text>
              </View>
              <Text style={s.beginArrow}>→</Text>
            </TouchableOpacity>
          </>
        )}

        {/* STEP 1 — days lost */}
        {step === 1 && (
          <>
            <Text style={s.eyebrow}>RECOVERY</Text>
            <Text style={s.heading}>How many days did you lose?</Text>
            <Text style={s.subheading}>Be honest — there's no wrong answer here.</Text>

            <View style={s.chipGrid}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDaysLost(d)}
                  style={[s.chip, daysLost === d && s.chipActive]}
                >
                  <Text style={[s.chipText, daysLost === d && s.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {daysLost > 0 && (
              <TouchableOpacity style={s.nextBtn} onPress={() => setStep(2)}>
                <Text style={s.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* STEP 2 — energy */}
        {step === 2 && (
          <>
            <TouchableOpacity onPress={() => setStep(1)} style={s.back}>
              <Text style={s.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.eyebrow}>RECOVERY</Text>
            <Text style={s.heading}>How are you feeling?</Text>
            <Text style={s.subheading}>Be honest. No judgment here.</Text>

            <View style={s.energyOpts}>
              {ENERGY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setEnergyLevel(opt.value)}
                  style={[s.energyOpt, energyLevel === opt.value && s.energyOptActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: energyLevel === opt.value }}
                >
                  <Text style={s.energyEmoji}>{opt.emoji}</Text>
                  <View>
                    <Text style={s.energyLabel}>{opt.label}</Text>
                    <Text style={s.energyDesc}>{opt.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.nextBtn} onPress={() => setStep(3)}>
              <Text style={s.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* STEP 3 — hours */}
        {step === 3 && (
          <>
            <TouchableOpacity onPress={() => setStep(2)} style={s.back}>
              <Text style={s.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.eyebrow}>RECOVERY</Text>
            <Text style={s.heading}>How many hours do you have?</Text>
            <Text style={s.subheading}>Be realistic. Not what you wish you had.</Text>

            <View style={s.chipGrid}>
              {[1, 2, 3, 4, 5, 6].map(h => (
                <TouchableOpacity
                  key={h}
                  onPress={() => setHoursAvailable(h)}
                  style={[s.chip, hoursAvailable === h && s.chipActive]}
                >
                  <Text style={[s.chipText, hoursAvailable === h && s.chipTextActive]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!error && <Text style={s.error}>{error}</Text>}

            {hoursAvailable > 0 && (
              <TouchableOpacity
                style={[s.nextBtn, loading && s.nextBtnDisabled]}
                onPress={buildPlan}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={s.nextBtnText}>Show me my plan →</Text>
                }
              </TouchableOpacity>
            )}
          </>
        )}

        {/* STEP 4 — result */}
        {step === 4 && (
          <>
            <Text style={s.eyebrow}>RECOVERY</Text>
            <Text style={s.heading}>Here is your plan.</Text>
            <Text style={s.subheading}>
              Just {prioritized.length} thing{prioritized.length !== 1 ? 's' : ''} today. Nothing else.
            </Text>

            {prioritized.length === 0 ? (
              <View style={s.emptyPlan}>
                <Text style={s.emptyEmoji}>🌿</Text>
                <Text style={s.emptyTitle}>Nothing urgent right now.</Text>
                <Text style={s.emptySub}>Rest. You've earned it.</Text>
              </View>
            ) : (
              <View style={s.planList}>
                {prioritized.map((task, i) => {
                  const ec = EnergyColors[task.energy_required]
                  return (
                    <View key={task.id} style={s.planCard}>
                      <View style={s.planNumber}>
                        <Text style={s.planNumberText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.planSubject}>{task.subject.toUpperCase()}</Text>
                        <Text style={s.planTitle}>{task.title}</Text>
                        <View style={s.planMeta}>
                          <View style={[s.planDot, { backgroundColor: ec.dot }]} />
                          <Text style={s.planMetaText}>Due {task.due_date} · {task.energy_required} energy</Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}

            {overflow > 0 && (
              <View style={s.overflowNote}>
                <Text style={s.overflowText}>+{overflow} other tasks can wait for another day.</Text>
              </View>
            )}

            <TouchableOpacity style={s.restartBtn} onPress={reset}>
              <Text style={s.restartText}>Start over</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4,
  },
  logo: { fontSize: 18 },
  logoFlare: { fontWeight: '700', color: Colors.text },
  logoPlan: { fontStyle: 'italic', fontWeight: '400', color: Colors.highlight },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.border },
  scroll: { padding: 24, paddingBottom: 80, flexGrow: 1 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: Colors.accent, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  heading: { fontSize: 32, fontWeight: '800', color: Colors.text, lineHeight: 40, marginBottom: 8 },
  headingItalic: { fontStyle: 'italic', color: Colors.highlight },
  subheading: { fontSize: 15, color: Colors.accent, lineHeight: 24, marginBottom: 28 },
  // Landing
  lastRecoveryCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 20,
    marginBottom: 20,
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
  },
  lastRecoveryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  lastRecoveryEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: Colors.accent, marginBottom: 4 },
  lastRecoveryDate: { fontSize: 15, fontWeight: '500', color: Colors.secondary },
  daysBox: { alignItems: 'flex-end' },
  daysNum: { fontSize: 40, fontWeight: '700', color: Colors.text, lineHeight: 40 },
  daysLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: Colors.accent },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  lastRecoveryNote: { fontSize: 14, color: Colors.accent, lineHeight: 22 },
  bold: { fontWeight: '600', color: Colors.secondary },
  beginCta: {
    backgroundColor: Colors.highlight, borderRadius: 20, padding: 22,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  beginEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,253,249,0.6)', marginBottom: 4 },
  beginLabel: { fontSize: 18, fontWeight: '600', color: Colors.white },
  beginArrow: { fontSize: 24, color: Colors.white },
  // Wizard
  back: { marginBottom: 20 },
  backText: { fontSize: 14, color: Colors.accent },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  chip: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
  },
  chipActive: { backgroundColor: Colors.text },
  chipText: { fontSize: 16, fontWeight: '600', color: Colors.secondary },
  chipTextActive: { color: Colors.white },
  nextBtn: { backgroundColor: Colors.text, borderRadius: 50, padding: 17, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  energyOpts: { gap: 10, marginBottom: 28 },
  energyOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 20, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
  },
  energyOptActive: { borderColor: Colors.text },
  energyEmoji: { fontSize: 24 },
  energyLabel: { fontSize: 16, fontWeight: '600', color: Colors.text },
  energyDesc: { fontSize: 14, color: Colors.accent, lineHeight: 22 },
  error: { color: '#F87171', fontSize: 14, marginBottom: 12 },
  // Plan result
  emptyPlan: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.secondary, marginBottom: 6 },
  emptySub: { fontSize: 16, color: Colors.accent, lineHeight: 26 },
  planList: { gap: 10, marginBottom: 20 },
  planCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
  },
  planNumber: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.text, justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  planNumberText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  planSubject: { fontSize: 11, color: Colors.accent, letterSpacing: 1, marginBottom: 3 },
  planTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planDot: { width: 8, height: 8, borderRadius: 4 },
  planMetaText: { fontSize: 13, color: Colors.accent },
  overflowNote: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 14, marginBottom: 16,
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
  },
  overflowText: { fontSize: 14, color: Colors.accent, textAlign: 'center', lineHeight: 22 },
  restartBtn: { padding: 14, alignItems: 'center' },
  restartText: { fontSize: 14, color: Colors.accent },
})
