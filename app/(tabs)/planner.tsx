import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator,
} from 'react-native'
import { supabase, Task, Checkin } from '../../lib/supabase'
import { Colors, EnergyColors } from '../../constants/colors'

const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getWeekDays(): Date[] {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function timeEstimate(energy: 'light' | 'medium' | 'heavy'): number {
  return { light: 30, medium: 60, heavy: 90 }[energy]
}

export default function Planner() {
  const weekDays = getWeekDays()
  const todayIdx = new Date().getDay()
  const [selectedIdx, setSelectedIdx] = useState(todayIdx)
  const [tasks, setTasks] = useState<Task[]>([])
  const [checkins, setCheckins] = useState<Record<string, 'low' | 'medium' | 'high'>>({})
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const weekStart = toDateStr(weekDays[0])
    const weekEnd = toDateStr(weekDays[6])

    const [{ data: taskData }, { data: checkinData }] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id)
        .gte('due_date', weekStart).lte('due_date', weekEnd)
        .order('due_date', { ascending: true }),
      supabase.from('checkins').select('date, energy_level').eq('user_id', user.id)
        .gte('date', weekStart).lte('date', weekEnd),
    ])

    setTasks((taskData as Task[]) ?? [])

    const checkinMap: Record<string, 'low' | 'medium' | 'high'> = {}
    for (const c of (checkinData as Checkin[]) ?? []) {
      checkinMap[c.date] = c.energy_level as 'low' | 'medium' | 'high'
    }
    setCheckins(checkinMap)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleComplete = async (task: Task) => {
    setCompleting(task.id)
    await supabase.from('tasks').update({ is_completed: !task.is_completed }).eq('id', task.id)
    await fetchData()
    setCompleting(null)
  }

  const selectedDate = weekDays[selectedIdx]
  const selectedDateStr = toDateStr(selectedDate)
  const dayTasks = tasks.filter(t => t.due_date === selectedDateStr)
  const dayEnergy = checkins[selectedDateStr]

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

      <View style={s.titleRow}>
        <Text style={s.eyebrow}>THIS WEEK</Text>
        <Text style={s.heading}>Planner</Text>
      </View>

      {/* Week strip */}
      <View style={s.weekStrip}>
        {weekDays.map((day, i) => {
          const dateStr = toDateStr(day)
          const energy = checkins[dateStr]
          const isSelected = i === selectedIdx
          const isToday = i === todayIdx
          const hasTasks = tasks.some(t => t.due_date === dateStr)

          return (
            <TouchableOpacity
              key={i}
              style={[s.dayCell, isSelected && s.dayCellActive]}
              onPress={() => setSelectedIdx(i)}
            >
              <Text style={[s.dayAbbr, isSelected && s.dayAbbrActive]}>{DAY_SHORT[i]}</Text>
              <Text style={[s.dayNum, isSelected && s.dayNumActive, isToday && !isSelected && s.dayNumToday]}>
                {day.getDate()}
              </Text>
              <View style={[
                s.energyBar,
                energy
                  ? { backgroundColor: EnergyColors[energy].bar }
                  : hasTasks
                    ? { backgroundColor: Colors.border }
                    : { backgroundColor: 'transparent' },
              ]} />
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Day header */}
            <View style={s.dayHeader}>
              <View>
                <Text style={s.dayName}>
                  {DAY_FULL[selectedIdx]}{' '}
                  <Text style={s.dayDate}>{selectedDate.getDate()} {MONTH_SHORT[selectedDate.getMonth()]}</Text>
                </Text>
              </View>
              {dayEnergy && (
                <View style={[s.energyPill, { backgroundColor: EnergyColors[dayEnergy].bg }]}>
                  <View style={[s.energyDot, { backgroundColor: EnergyColors[dayEnergy].dot }]} />
                  <Text style={[s.energyPillText, { color: EnergyColors[dayEnergy].text }]}>
                    {dayEnergy.charAt(0).toUpperCase() + dayEnergy.slice(1)} energy
                  </Text>
                </View>
              )}
            </View>

            {dayTasks.length === 0 ? (
              <View style={s.emptyDay}>
                <Text style={s.emptyText}>Nothing due this day.</Text>
              </View>
            ) : (
              <View style={s.taskList}>
                {dayTasks.map(task => (
                  <PlannerTaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleComplete}
                    completing={completing === task.id}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function PlannerTaskRow({
  task,
  onToggle,
  completing,
}: {
  task: Task
  onToggle: (t: Task) => void
  completing: boolean
}) {
  const mins = timeEstimate(task.energy_required)

  return (
    <TouchableOpacity style={s.taskRow} onPress={() => onToggle(task)} activeOpacity={0.7}>
      <View style={[s.circle, task.is_completed && s.circleActive]}>
        {completing && <ActivityIndicator size="small" color={Colors.accent} />}
        {!completing && task.is_completed && (
          <Text style={s.checkmark}>✓</Text>
        )}
      </View>
      <Text style={[s.taskTitle, task.is_completed && s.taskDone]} numberOfLines={2}>
        {task.title}
      </Text>
      <Text style={s.taskMins}>{mins} min</Text>
    </TouchableOpacity>
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
  titleRow: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: Colors.accent, textTransform: 'uppercase', marginBottom: 4 },
  heading: { fontSize: 34, fontWeight: '800', color: Colors.text },
  weekStrip: {
    flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  dayCell: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 16, gap: 4,
  },
  dayCellActive: { backgroundColor: Colors.text },
  dayAbbr: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: Colors.accent },
  dayAbbrActive: { color: 'rgba(255,253,249,0.7)' },
  dayNum: { fontSize: 18, fontWeight: '700', color: Colors.secondary },
  dayNumActive: { color: Colors.white },
  dayNumToday: { color: Colors.highlight },
  energyBar: { height: 4, width: '60%', borderRadius: 2 },
  scroll: { padding: 24, paddingBottom: 80 },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  dayName: { fontSize: 24, fontWeight: '700', color: Colors.text },
  dayDate: { fontSize: 16, fontWeight: '400', color: Colors.accent },
  energyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 50, paddingVertical: 6, paddingHorizontal: 12,
  },
  energyDot: { width: 8, height: 8, borderRadius: 4 },
  energyPillText: { fontSize: 12, fontWeight: '600' },
  emptyDay: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.accent },
  taskList: { gap: 2 },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    marginBottom: 8,
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  circle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  circleActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  checkmark: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.text, lineHeight: 22 },
  taskDone: { textDecorationLine: 'line-through', color: Colors.accent },
  taskMins: { fontSize: 13, color: Colors.accent, fontWeight: '500' },
})
