import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Modal,
} from 'react-native'
import { supabase, Task } from '../../lib/supabase'
import { useAppStore } from '../../lib/store'
import { Colors, EnergyColors } from '../../constants/colors'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function timeEstimate(energy: 'light' | 'medium' | 'heavy'): number {
  return { light: 30, medium: 60, heavy: 90 }[energy]
}

function formatDue(dueDate: string): string {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const tomorrow = new Date(today.getTime() + 86400000)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  if (dueDate === todayStr) return 'Today'
  if (dueDate === tomorrowStr) return 'Tomorrow'
  const d = new Date(dueDate + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getEndOfWeek(): string {
  const d = new Date()
  d.setDate(d.getDate() + (6 - d.getDay()))
  return d.toISOString().split('T')[0]
}

const ENERGY_OPTS = [
  { value: 'low' as const, label: 'Low energy', emoji: '🌱' },
  { value: 'medium' as const, label: 'Medium energy', emoji: '🌤' },
  { value: 'high' as const, label: 'High energy', emoji: '⚡' },
]

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [showEnergyPicker, setShowEnergyPicker] = useState(false)
  const [savingEnergy, setSavingEnergy] = useState(false)
  const energyLevel = useAppStore((s) => s.energyLevel)
  const setEnergyLevel = useAppStore((s) => s.setEnergyLevel)

  const today = new Date()
  const dateLabel = `${DAY_NAMES[today.getDay()].toUpperCase()} · ${MONTH_NAMES[today.getMonth()].toUpperCase()} ${today.getDate()}`

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const name = user.user_metadata?.full_name?.split(' ')[0]
      || user.user_metadata?.name?.split(' ')[0]
      || user.email?.split('@')[0]
      || ''
    setUserName(name)

    // Check today's checkin
    if (!energyLevel) {
      const todayStr = today.toISOString().split('T')[0]
      const { data: checkin } = await supabase
        .from('checkins')
        .select('energy_level')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle()
      if (checkin?.energy_level) {
        setEnergyLevel(checkin.energy_level as 'low' | 'medium' | 'high')
      }
    }

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .order('due_date', { ascending: true })
    setTasks((data as Task[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleEnergySelect = async (level: 'low' | 'medium' | 'high') => {
    setSavingEnergy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const todayStr = new Date().toISOString().split('T')[0]
    await supabase.from('checkins').upsert(
      { energy_level: level, date: todayStr, user_id: user?.id },
      { onConflict: 'user_id,date' }
    )
    setEnergyLevel(level)
    setSavingEnergy(false)
    setShowEnergyPicker(false)
  }

  const endOfWeek = getEndOfWeek()
  const todayStr = today.toISOString().split('T')[0]
  const dueThisWeek = tasks.filter(t => t.due_date >= todayStr && t.due_date <= endOfWeek).length

  const ec = energyLevel ? EnergyColors[energyLevel] : null

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>
            <Text style={s.logoFlare}>flare </Text>
            <Text style={s.logoPlan}>plan</Text>
          </Text>
          <View style={s.avatar} />
        </View>

        <View style={s.content}>
          <Text style={s.dateLabel}>{dateLabel}</Text>

          <Text style={s.greeting}>
            {getGreeting()},{'\n'}
            <Text style={s.greetingName}>{userName ? `${userName}.` : 'welcome.'}</Text>
          </Text>

          {/* Energy pill */}
          <TouchableOpacity style={s.energyPill} onPress={() => setShowEnergyPicker(true)}>
            <View style={[s.energyDot, { backgroundColor: ec?.dot ?? Colors.muted }]} />
            <Text style={s.energyPillText}>
              Today feels{' '}
              <Text style={s.energyPillBold}>
                {energyLevel ? `${energyLevel} energy` : 'set energy'}
              </Text>
            </Text>
            <Text style={s.energyArrow}>→</Text>
          </TouchableOpacity>

          {/* Canvas tasks section */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>From Canvas</Text>
            {dueThisWeek > 0 && (
              <Text style={s.sectionMeta}>{dueThisWeek} due this week</Text>
            )}
          </View>

          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : tasks.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No upcoming tasks. Connect Canvas in Settings to import assignments.</Text>
            </View>
          ) : (
            <View style={s.taskCard}>
              {tasks.map((task, i) => (
                <View key={task.id}>
                  {i > 0 && <View style={s.divider} />}
                  <TaskRow task={task} />
                </View>
              ))}
            </View>
          )}

          {/* Recovery CTA */}
          <View style={s.recoveryCta}>
            <Text style={s.recoveryEyebrow}>RECOVERY</Text>
            <Text style={s.recoveryHeading}>
              Rough day?{' '}
              <Text style={s.recoveryItalic}>It's okay to pause.</Text>
            </Text>
            <Text style={s.recoveryBody}>
              We'll reshape your week around what you can actually do — no guilt, no catch-up cliff.
            </Text>
            <TouchableOpacity style={s.recoveryButton}>
              <Text style={s.recoveryButtonText}>Enter recovery mode →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Energy picker modal */}
      <Modal visible={showEnergyPicker} transparent animationType="slide">
        <TouchableOpacity style={s.backdrop} onPress={() => setShowEnergyPicker(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>How are you feeling today?</Text>
          {ENERGY_OPTS.map((opt) => {
            const active = energyLevel === opt.value
            const oec = EnergyColors[opt.value]
            return (
              <TouchableOpacity
                key={opt.value}
                style={[s.energyOpt, active && { borderColor: oec.dot, backgroundColor: oec.bg }]}
                onPress={() => handleEnergySelect(opt.value)}
                disabled={savingEnergy}
              >
                <View style={[s.optDot, { backgroundColor: oec.dot }]} />
                <Text style={[s.optLabel, active && { color: oec.text }]}>{opt.label}</Text>
                <Text style={s.optEmoji}>{opt.emoji}</Text>
              </TouchableOpacity>
            )
          })}
          {savingEnergy && <ActivityIndicator style={{ marginTop: 12 }} color={Colors.accent} />}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function TaskRow({ task }: { task: Task }) {
  const mins = timeEstimate(task.energy_required)
  const due = formatDue(task.due_date)
  const isToday = due === 'Today'

  return (
    <View style={s.taskRow}>
      <View style={[s.taskBorder, { backgroundColor: isToday ? Colors.highlight : Colors.border }]} />
      <View style={s.taskMain}>
        <Text style={s.taskMeta} numberOfLines={1}>
          {task.subject.toUpperCase()}
        </Text>
        <Text style={s.taskTitle}>{task.title}</Text>
        <Text style={[s.taskDue, isToday && s.taskDueToday]}>{due}</Text>
      </View>
      <View style={s.taskTime}>
        <Text style={s.taskMins}>{mins}</Text>
        <Text style={s.taskMinLabel}>MIN</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8,
  },
  logo: { fontSize: 18 },
  logoFlare: { fontWeight: '700', color: Colors.text },
  logoPlan: { fontStyle: 'italic', fontWeight: '400', color: Colors.highlight },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.border },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  dateLabel: {
    fontSize: 11, letterSpacing: 2, color: Colors.accent,
    textTransform: 'uppercase', marginBottom: 10, marginTop: 8,
  },
  greeting: { fontSize: 34, fontWeight: '800', color: Colors.text, lineHeight: 42, marginBottom: 20 },
  greetingName: { fontStyle: 'italic', color: Colors.highlight },
  energyPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: Colors.white, borderRadius: 50, paddingVertical: 10,
    paddingHorizontal: 16, gap: 8,
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    marginBottom: 32,
  },
  energyDot: { width: 8, height: 8, borderRadius: 4 },
  energyPillText: { fontSize: 14, color: Colors.accent },
  energyPillBold: { fontWeight: '600', color: Colors.secondary },
  energyArrow: { fontSize: 14, color: Colors.accent },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 14,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  sectionMeta: { fontSize: 13, color: Colors.accent },
  loadingBox: { paddingVertical: 32, alignItems: 'center' },
  emptyBox: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 20,
  },
  emptyText: { fontSize: 14, color: Colors.accent, lineHeight: 22 },
  taskCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    overflow: 'hidden',
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 2,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingRight: 18 },
  taskBorder: { width: 3, alignSelf: 'stretch', marginRight: 16, borderRadius: 2 },
  taskMain: { flex: 1 },
  taskMeta: { fontSize: 11, fontWeight: '600', color: Colors.accent, letterSpacing: 1.5, marginBottom: 3 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 3, lineHeight: 22 },
  taskDue: { fontSize: 13, color: Colors.accent },
  taskDueToday: { color: Colors.highlight, fontWeight: '500' },
  taskTime: { alignItems: 'flex-end', minWidth: 40 },
  taskMins: { fontSize: 26, fontWeight: '700', color: Colors.secondary, lineHeight: 28 },
  taskMinLabel: { fontSize: 10, fontWeight: '600', color: Colors.accent, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 19 },
  recoveryCta: {
    marginTop: 28, backgroundColor: Colors.highlight, borderRadius: 20,
    padding: 22,
  },
  recoveryEyebrow: {
    fontSize: 10, letterSpacing: 2, color: 'rgba(255,253,249,0.6)',
    textTransform: 'uppercase', marginBottom: 6,
  },
  recoveryHeading: { fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 10, lineHeight: 28 },
  recoveryItalic: { fontStyle: 'italic', fontWeight: '400' },
  recoveryBody: { fontSize: 14, color: 'rgba(255,253,249,0.8)', lineHeight: 22, marginBottom: 18 },
  recoveryButton: {
    backgroundColor: 'rgba(255,253,249,0.15)', borderRadius: 50,
    paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'flex-start',
  },
  recoveryButtonText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  // Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(44,24,16,0.4)' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, gap: 10,
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  energyOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.background, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  optDot: { width: 10, height: 10, borderRadius: 5 },
  optLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.secondary },
  optEmoji: { fontSize: 18 },
})
