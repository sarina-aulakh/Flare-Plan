import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native'
import { supabase, Task } from '../../lib/supabase'
import { useAppStore } from '../../lib/store'
import { organizeTasks, detectEnergy, TaskWithTip } from '../../lib/aiAgent'
import { Colors, EnergyColors } from '../../constants/colors'

function EnergyDot({ level }: { level: string }) {
  const color = EnergyColors[level as keyof typeof EnergyColors]?.dot ?? Colors.accent
  return <View style={[styles.energyDot, { backgroundColor: color }]} />
}

function TaskCard({ task, onComplete }: { task: TaskWithTip; onComplete: (t: Task) => void }) {
  const [tipVisible, setTipVisible] = useState(false)

  return (
    <View style={[styles.card, task.is_completed && styles.cardDone]}>
      <View style={styles.cardHeader}>
        <EnergyDot level={task.energy_required} />
        <Text style={styles.subject}>{task.subject}</Text>
      </View>
      <Text style={[styles.taskTitle, task.is_completed && styles.taskTitleDone]}>
        {task.title}
      </Text>
      <Text style={styles.dueDate}>Due {task.due_date}</Text>

      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => setTipVisible((v) => !v)} style={styles.tipButton}>
          <Text style={styles.tipButtonText}>{tipVisible ? 'Hide tip' : 'See tip'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onComplete(task)}
          style={[styles.doneButton, task.is_completed && styles.doneButtonActive]}
          accessibilityRole="button"
          accessibilityLabel={task.is_completed ? 'Mark as incomplete' : 'Mark as done'}
        >
          <Text style={[styles.doneButtonText, task.is_completed && styles.doneButtonTextActive]}>
            {task.is_completed ? 'Undo' : 'Done ✓'}
          </Text>
        </TouchableOpacity>
      </View>

      {tipVisible && (
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>{task.tip}</Text>
        </View>
      )}
    </View>
  )
}

type AddTaskForm = {
  subject: string
  title: string
  due_date: string
  energy_required: 'light' | 'medium' | 'heavy'
}

export default function Tasks() {
  const [tasks, setTasks] = useState<TaskWithTip[]>([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<AddTaskForm>({
    subject: '', title: '', due_date: '', energy_required: 'medium',
  })
  const energyLevel = useAppStore((s) => s.energyLevel) ?? 'medium'

  const fetchAndOrganize = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user?.id)
      .order('due_date', { ascending: true })

    if (error || !data) { setLoading(false); return }

    setLoading(false)
    setAiLoading(true)

    try {
      const organized = await organizeTasks(data as Task[], energyLevel)
      setTasks(organized)
    } catch {
      setTasks(data.map((t) => ({ ...(t as Task), tip: '' })))
    } finally {
      setAiLoading(false)
    }
  }, [energyLevel])

  useEffect(() => { fetchAndOrganize() }, [fetchAndOrganize])

  const handleComplete = async (task: Task) => {
    await supabase.from('tasks').update({ is_completed: !task.is_completed }).eq('id', task.id)
    fetchAndOrganize()
  }

  const handleTitleChange = (title: string) => {
    const detected = detectEnergy(title)
    setForm((f) => ({ ...f, title, energy_required: detected }))
  }

  const handleAddTask = async () => {
    if (!form.subject || !form.title || !form.due_date) {
      setFormError('Please fill in all fields.')
      return
    }
    setFormError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('tasks').insert({ ...form, user_id: user?.id, is_completed: false })
    if (error) { setFormError(error.message); return }
    setForm({ subject: '', title: '', due_date: '', energy_required: 'medium' })
    setShowForm(false)
    fetchAndOrganize()
  }

  const incomplete = tasks.filter((t) => !t.is_completed)
  const completed = tasks.filter((t) => t.is_completed)

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.text} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Today</Text>
          <Text style={styles.heading}>Your tasks</Text>
        </View>
        {aiLoading && (
          <View style={styles.aiPill}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.aiPillText}>Organizing…</Text>
          </View>
        )}
      </View>

      <FlatList
        data={incomplete}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TaskCard task={item} onComplete={handleComplete} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {tasks.length === 0 ? 'No tasks yet' : 'All done for now'}
            </Text>
            <Text style={styles.emptySub}>
              {tasks.length === 0
                ? 'Add a task below or sync from Canvas in Settings.'
                : 'Enjoy the breathing room.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          completed.length > 0 ? (
            <View style={styles.completedSection}>
              <Text style={styles.completedLabel}>{completed.length} completed</Text>
              {completed.map((t) => (
                <TaskCard key={t.id} task={t} onComplete={handleComplete} />
              ))}
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)}>
        <Text style={styles.fabText}>+ Add task</Text>
      </TouchableOpacity>

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowForm(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add a task</Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.formFields}>
                <TextInput
                  style={styles.input}
                  placeholder="Course (e.g. Mathematics)"
                  placeholderTextColor={Colors.accent}
                  value={form.subject}
                  onChangeText={(v) => setForm((f) => ({ ...f, subject: v }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Task title"
                  placeholderTextColor={Colors.accent}
                  value={form.title}
                  onChangeText={handleTitleChange}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Due date (YYYY-MM-DD)"
                  placeholderTextColor={Colors.accent}
                  value={form.due_date}
                  onChangeText={(v) => setForm((f) => ({ ...f, due_date: v }))}
                  keyboardType="numbers-and-punctuation"
                />

                <View style={styles.energyRow}>
                  {(['light', 'medium', 'heavy'] as const).map((level) => {
                    const ec = EnergyColors[level]
                    const active = form.energy_required === level
                    return (
                      <TouchableOpacity
                        key={level}
                        onPress={() => setForm((f) => ({ ...f, energy_required: level }))}
                        style={[styles.energyBtn, active && { backgroundColor: ec.bg }]}
                      >
                        <View style={[styles.energyBtnDot, { backgroundColor: ec.dot }]} />
                        <Text style={[styles.energyBtnText, active && { color: ec.text }]}>
                          {level}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <Text style={styles.energyHint}>Energy auto-detected from title — adjust if needed.</Text>

                {!!formError && <Text style={styles.formError}>{formError}</Text>}

                <TouchableOpacity style={styles.submitButton} onPress={handleAddTask}>
                  <Text style={styles.submitButtonText}>Add task</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: Colors.accent, textTransform: 'uppercase', marginBottom: 4 },
  heading: { fontSize: 28, fontWeight: '700', color: Colors.text },
  aiPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: '#8B4A35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  aiPillText: { fontSize: 12, color: Colors.accent },
  list: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#8B4A35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  cardDone: { opacity: 0.45 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  energyDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  subject: { fontSize: 11, fontWeight: '600', color: Colors.accent, textTransform: 'uppercase', letterSpacing: 1 },
  taskTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  taskTitleDone: { textDecorationLine: 'line-through', color: Colors.accent },
  dueDate: { fontSize: 14, color: Colors.accent, marginBottom: 14, lineHeight: 22 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipButton: { paddingVertical: 8, paddingRight: 16 },
  tipButtonText: { fontSize: 14, color: Colors.accent, fontWeight: '500' },
  doneButton: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  doneButtonActive: { backgroundColor: Colors.text },
  doneButtonText: { fontSize: 14, fontWeight: '600', color: Colors.secondary },
  doneButtonTextActive: { color: Colors.white },
  tipBox: {
    marginTop: 12,
    backgroundColor: '#FDF5E6',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#C4963A',
  },
  tipText: { fontSize: 14, color: '#7A5C1E', lineHeight: 24 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.secondary, marginBottom: 6 },
  emptySub: { fontSize: 16, color: Colors.accent, textAlign: 'center', lineHeight: 26 },
  completedSection: { marginTop: 32 },
  completedLabel: { fontSize: 12, color: Colors.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  fab: {
    position: 'absolute',
    bottom: 82,
    alignSelf: 'center',
    backgroundColor: Colors.text,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 50,
    shadowColor: '#8B4A35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  fabText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(44,24,16,0.4)' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 20 },
  formFields: { gap: 12 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: Colors.secondary,
  },
  energyRow: { flexDirection: 'row', gap: 8 },
  energyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 11,
  },
  energyBtnDot: { width: 8, height: 8, borderRadius: 4 },
  energyBtnText: { fontSize: 13, fontWeight: '500', color: Colors.accent, textTransform: 'capitalize' },
  energyHint: { fontSize: 12, color: Colors.accent, marginTop: -4, lineHeight: 20 },
  formError: { color: '#F87171', fontSize: 14 },
  submitButton: {
    backgroundColor: Colors.text,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
})
