import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator,
} from 'react-native'
import { supabase, Task } from '../../lib/supabase'
import { Colors, EnergyColors } from '../../constants/colors'

const ENERGY_OPTIONS = [
  { value: 'low' as const, emoji: '🌱', label: 'Low', description: 'Running on empty' },
  { value: 'medium' as const, emoji: '🌤', label: 'Medium', description: 'Some energy to work with' },
  { value: 'high' as const, emoji: '⚡', label: 'High', description: 'Feeling okay today' },
]

export default function Recovery() {
  const [step, setStep] = useState(1)
  const [daysLost, setDaysLost] = useState(0)
  const [energyLevel, setEnergyLevel] = useState<'low' | 'medium' | 'high'>('medium')
  const [hoursAvailable, setHoursAvailable] = useState(0)
  const [prioritized, setPrioritized] = useState<Task[]>([])
  const [overflow, setOverflow] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

    const doable = (data as Task[]).filter((t) => energyMap[energyLevel].includes(t.energy_required))

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
  }

  const reset = () => {
    setStep(1)
    setDaysLost(0)
    setEnergyLevel('medium')
    setHoursAvailable(0)
    setPrioritized([])
    setOverflow(0)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {step === 1 && (
          <View>
            <Text style={styles.eyebrow}>Recovery mode</Text>
            <Text style={styles.heading}>You are back.</Text>
            <Text style={styles.sub}>That took a lot. Let's figure out just today.</Text>

            <Text style={styles.question}>How many days did you lose?</Text>
            <View style={styles.grid}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDaysLost(d)}
                  style={[styles.chip, daysLost === d && styles.chipActive]}
                  accessibilityLabel={`${d} day${d > 1 ? 's' : ''}`}
                >
                  <Text style={[styles.chipText, daysLost === d && styles.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {daysLost > 0 && (
              <TouchableOpacity style={styles.nextButton} onPress={() => setStep(2)}>
                <Text style={styles.nextButtonText}>Next →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === 2 && (
          <View>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.back}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.eyebrow}>Recovery mode</Text>
            <Text style={styles.heading}>How are you feeling?</Text>
            <Text style={styles.sub}>Be honest. No judgment here.</Text>

            <View style={styles.energyOptions}>
              {ENERGY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setEnergyLevel(opt.value)}
                  style={[styles.energyOption, energyLevel === opt.value && styles.energyOptionActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: energyLevel === opt.value }}
                >
                  <Text style={styles.energyEmoji}>{opt.emoji}</Text>
                  <View>
                    <Text style={styles.energyLabel}>{opt.label}</Text>
                    <Text style={styles.energyDesc}>{opt.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.nextButton} onPress={() => setStep(3)}>
              <Text style={styles.nextButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View>
            <TouchableOpacity onPress={() => setStep(2)} style={styles.back}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.eyebrow}>Recovery mode</Text>
            <Text style={styles.heading}>How many hours do you have?</Text>
            <Text style={styles.sub}>Be realistic. Not what you wish you had.</Text>

            <View style={styles.grid}>
              {[1, 2, 3, 4, 5, 6].map((h) => (
                <TouchableOpacity
                  key={h}
                  onPress={() => setHoursAvailable(h)}
                  style={[styles.chip, hoursAvailable === h && styles.chipActive]}
                  accessibilityLabel={`${h} hour${h > 1 ? 's' : ''}`}
                >
                  <Text style={[styles.chipText, hoursAvailable === h && styles.chipTextActive]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            {hoursAvailable > 0 && (
              <TouchableOpacity
                style={[styles.nextButton, loading && styles.nextButtonDisabled]}
                onPress={buildPlan}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.nextButtonText}>Show me my plan →</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={styles.eyebrow}>Recovery mode</Text>
            <Text style={styles.heading}>Here is your plan.</Text>
            <Text style={styles.sub}>
              Just {prioritized.length} thing{prioritized.length !== 1 ? 's' : ''} today. Nothing else.
            </Text>

            {prioritized.length === 0 ? (
              <View style={styles.emptyPlan}>
                <Text style={styles.emptyEmoji}>🌿</Text>
                <Text style={styles.emptyTitle}>Nothing urgent right now.</Text>
                <Text style={styles.emptySub}>Rest. You've earned it.</Text>
              </View>
            ) : (
              <View style={styles.planList}>
                {prioritized.map((task, i) => {
                  const ec = EnergyColors[task.energy_required]
                  return (
                    <View key={task.id} style={styles.planCard}>
                      <View style={styles.planCardLeft}>
                        <View style={styles.planNumber}>
                          <Text style={styles.planNumberText}>{i + 1}</Text>
                        </View>
                        <View>
                          <Text style={styles.planSubject}>{task.subject}</Text>
                          <Text style={styles.planTitle}>{task.title}</Text>
                          <View style={styles.planMeta}>
                            <View style={[styles.planDot, { backgroundColor: ec.dot }]} />
                            <Text style={styles.planMetaText}>Due {task.due_date} · {task.energy_required} energy</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}

            {overflow > 0 && (
              <View style={styles.overflowNote}>
                <Text style={styles.overflowText}>+{overflow} other tasks can wait for another day.</Text>
              </View>
            )}

            <TouchableOpacity style={styles.restartButton} onPress={reset}>
              <Text style={styles.restartText}>Start over</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 24, paddingBottom: 80, flexGrow: 1, justifyContent: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: Colors.accent, textTransform: 'uppercase', marginBottom: 6 },
  heading: { fontSize: 30, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  sub: { fontSize: 16, color: Colors.accent, marginBottom: 32, lineHeight: 26 },
  question: { fontSize: 16, fontWeight: '500', color: Colors.secondary, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  chip: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#8B4A35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  chipActive: { backgroundColor: Colors.text },
  chipText: { fontSize: 16, fontWeight: '600', color: Colors.secondary },
  chipTextActive: { color: Colors.white },
  nextButton: { backgroundColor: Colors.text, borderRadius: 24, padding: 17, alignItems: 'center' },
  nextButtonDisabled: { opacity: 0.4 },
  nextButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  back: { marginBottom: 24 },
  backText: { fontSize: 14, color: Colors.accent },
  energyOptions: { gap: 12, marginBottom: 32 },
  energyOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 24, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#8B4A35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  energyOptionActive: { borderColor: Colors.text },
  energyEmoji: { fontSize: 24 },
  energyLabel: { fontSize: 16, fontWeight: '600', color: Colors.text },
  energyDesc: { fontSize: 14, color: Colors.accent, lineHeight: 22 },
  error: { color: '#F87171', fontSize: 14, marginBottom: 12 },
  emptyPlan: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.secondary, marginBottom: 6 },
  emptySub: { fontSize: 16, color: Colors.accent, lineHeight: 26 },
  planList: { gap: 12, marginBottom: 24 },
  planCard: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 16,
    shadowColor: '#8B4A35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  planCardLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  planNumber: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.text, justifyContent: 'center', alignItems: 'center',
  },
  planNumberText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  planSubject: { fontSize: 11, color: Colors.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  planTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planDot: { width: 8, height: 8, borderRadius: 4 },
  planMetaText: { fontSize: 13, color: Colors.accent },
  overflowNote: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 14, marginBottom: 20,
    shadowColor: '#8B4A35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  overflowText: { fontSize: 14, color: Colors.accent, textAlign: 'center', lineHeight: 22 },
  restartButton: { padding: 14, alignItems: 'center' },
  restartText: { fontSize: 14, color: Colors.accent },
})
