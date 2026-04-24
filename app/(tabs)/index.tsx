import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../lib/store'
import { Colors, EnergyColors } from '../../constants/colors'

const LEVELS = [
  {
    value: 'low' as const,
    label: 'Low energy',
    description: 'Take it easy — small wins only.',
    emoji: '🌱',
  },
  {
    value: 'medium' as const,
    label: 'Medium energy',
    description: 'Steady work with focus blocks.',
    emoji: '🌤',
  },
  {
    value: 'high' as const,
    label: 'High energy',
    description: 'Good day for bigger tasks.',
    emoji: '⚡',
  },
]

export default function CheckIn() {
  const [selected, setSelected] = useState<'low' | 'medium' | 'high' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setEnergyLevel = useAppStore((s) => s.setEnergyLevel)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!selected) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('checkins').insert({
      energy_level: selected,
      date: new Date().toISOString().split('T')[0],
      user_id: user?.id,
    })

    if (error) {
      setError('Could not save check-in. Try again.')
      setLoading(false)
      return
    }

    setEnergyLevel(selected)
    router.replace('/tasks')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Daily check-in</Text>
          <Text style={styles.heading}>How are you feeling today?</Text>
          <Text style={styles.sub}>No wrong answers — this shapes your task list.</Text>
        </View>

        <View style={styles.options}>
          {LEVELS.map((level) => {
            const active = selected === level.value
            const ec = EnergyColors[level.value]
            return (
              <TouchableOpacity
                key={level.value}
                onPress={() => setSelected(level.value)}
                style={[
                  styles.option,
                  active && { borderColor: ec.dot, borderWidth: 2, backgroundColor: ec.bg },
                ]}
                accessibilityLabel={`${level.label}: ${level.description}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.dot, { backgroundColor: ec.dot }]} />
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{level.label}</Text>
                  <Text style={styles.optionDesc}>{level.description}</Text>
                </View>
                <Text style={styles.emoji}>{level.emoji}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {selected && (
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Start my day"
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.buttonText}>Start my day</Text>
            }
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { marginBottom: 32 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: Colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  heading: { fontSize: 30, fontWeight: '700', color: Colors.secondary, lineHeight: 38, marginBottom: 6 },
  sub: { fontSize: 16, color: Colors.accent, lineHeight: 26 },
  options: { gap: 12, marginBottom: 32 },
  option: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 72,
    shadowColor: '#8B4A35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 14 },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  optionDesc: { fontSize: 14, color: Colors.accent, lineHeight: 22 },
  emoji: { fontSize: 20 },
  error: { color: '#F87171', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  button: {
    backgroundColor: Colors.text,
    borderRadius: 50,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
})
