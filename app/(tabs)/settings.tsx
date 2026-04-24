import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'

const CANVAS_TOKEN_KEY = 'canvas_token'
const CANVAS_DOMAIN_KEY = 'canvas_domain'

function detectEnergy(name: string): 'light' | 'medium' | 'heavy' {
  const lower = name.toLowerCase()
  const heavy = ['exam', 'final', 'midterm', 'essay', 'research', 'thesis', 'report', 'paper', 'project']
  const light = ['quiz', 'reading', 'watch', 'review', 'discussion', 'post', 'reflection']
  if (heavy.some((w) => lower.includes(w))) return 'heavy'
  if (light.some((w) => lower.includes(w))) return 'light'
  return 'medium'
}

type PendingTask = {
  subject: string
  title: string
  due_date: string
  energy_required: 'light' | 'medium' | 'heavy'
}

export default function Settings() {
  const [token, setToken] = useState('')
  const [domain, setDomain] = useState('')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<PendingTask[]>([])
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CANVAS_TOKEN_KEY),
      AsyncStorage.getItem(CANVAS_DOMAIN_KEY),
    ]).then(([savedToken, savedDomain]) => {
      if (savedToken) setToken(savedToken)
      if (savedDomain) setDomain(savedDomain)
      if (savedToken && savedDomain) setConnected(true)
    })
  }, [])

  const handleConnect = async () => {
    if (!token || !domain) return
    setConnecting(true)
    setError('')

    const base = `https://${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`

    const response = await fetch(`${base}/api/v1/courses?enrollment_state=active`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null)

    if (!response || !response.ok) {
      setError('Could not connect to Canvas. Check your domain and token.')
      setConnecting(false)
      return
    }

    let data: any
    try { data = await response.json() } catch {
      setError('Canvas returned an unexpected response.')
      setConnecting(false)
      return
    }

    if (Array.isArray(data)) {
      await AsyncStorage.setItem(CANVAS_TOKEN_KEY, token)
      await AsyncStorage.setItem(CANVAS_DOMAIN_KEY, domain)
      setConnected(true)
    } else {
      setError('Invalid token or Canvas is unavailable.')
    }

    setConnecting(false)
  }

  const handleSync = async () => {
    setSyncing(true)
    setPending([])
    setSavedCount(0)
    setError('')

    const base = `https://${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`

    const response = await fetch(`${base}/api/v1/users/self/todo`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null)

    if (!response || !response.ok) {
      setError('Could not sync assignments.')
      setSyncing(false)
      return
    }

    let assignments: any
    try { assignments = await response.json() } catch {
      setError('Canvas returned an unexpected response.')
      setSyncing(false)
      return
    }

    if (!Array.isArray(assignments)) {
      setError('Unexpected response from Canvas.')
      setSyncing(false)
      return
    }

    const tasks: PendingTask[] = assignments
      .filter((a: any) => a.assignment?.due_at)
      .map((a: any) => ({
        subject: a.context_name || 'Canvas',
        title: a.assignment.name,
        due_date: a.assignment.due_at.split('T')[0],
        energy_required: detectEnergy(a.assignment.name),
      }))

    setPending(tasks)
    setSyncing(false)
  }

  const updateEnergy = (index: number, energy: 'light' | 'medium' | 'heavy') => {
    setPending((prev) => prev.map((t, i) => (i === index ? { ...t, energy_required: energy } : t)))
  }

  const handleSaveAll = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    for (const task of pending) {
      await supabase.from('tasks').insert({ ...task, user_id: user?.id, is_completed: false })
    }

    setSavedCount(pending.length)
    setPending([])
    setSaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.heading}>Connect your apps</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Canvas</Text>
          <Text style={styles.cardSub}>Connect Canvas to import your assignments</Text>

          <TextInput
            style={styles.input}
            placeholder="Canvas domain (e.g. canvas.myschool.edu)"
            placeholderTextColor={Colors.accent}
            value={domain}
            onChangeText={setDomain}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TextInput
            style={styles.input}
            placeholder="Paste your Canvas API token"
            placeholderTextColor={Colors.accent}
            value={token}
            onChangeText={setToken}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, (!token || !domain || connecting) && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={!token || !domain || connecting}
          >
            {connecting
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.buttonText}>{connected ? 'Reconnect Canvas' : 'Connect Canvas'}</Text>
            }
          </TouchableOpacity>
        </View>

        {connected && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sync assignments</Text>
            <Text style={styles.cardSub}>Preview and adjust energy levels before importing</Text>

            {savedCount > 0 && (
              <Text style={styles.savedNote}>Saved {savedCount} assignments to your tasks.</Text>
            )}

            <TouchableOpacity
              style={[styles.button, syncing && styles.buttonDisabled]}
              onPress={handleSync}
              disabled={syncing}
            >
              {syncing
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.buttonText}>Preview assignments</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        {pending.length > 0 && (
          <View>
            <Text style={styles.pendingHeader}>{pending.length} assignments — adjust energy if needed</Text>

            {pending.map((task, i) => (
              <View key={i} style={styles.pendingCard}>
                <Text style={styles.pendingSubject}>{task.subject}</Text>
                <Text style={styles.pendingTitle}>{task.title}</Text>
                <Text style={styles.pendingDue}>Due {task.due_date}</Text>
                <View style={styles.energyRow}>
                  {(['light', 'medium', 'heavy'] as const).map((level) => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => updateEnergy(i, level)}
                      style={[styles.energyBtn, task.energy_required === level && styles.energyBtnActive]}
                    >
                      <Text style={[styles.energyBtnText, task.energy_required === level && styles.energyBtnTextActive]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.button, styles.saveAllButton, saving && styles.buttonDisabled]}
              onPress={handleSaveAll}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.buttonText}>Save all {pending.length} assignments</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 24, paddingBottom: 80 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: Colors.accent, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  heading: { fontSize: 30, fontWeight: '700', color: Colors.text, marginBottom: 24 },
  card: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 18,
    marginBottom: 16,
    shadowColor: '#8B4A35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.secondary, marginBottom: 4 },
  cardSub: { fontSize: 14, color: Colors.accent, marginBottom: 14, lineHeight: 22 },
  input: {
    backgroundColor: Colors.background, borderRadius: 16, padding: 16,
    fontSize: 16, color: Colors.secondary, marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.text, borderRadius: 16, padding: 16, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  savedNote: { fontSize: 14, color: '#6B9E6B', marginBottom: 10 },
  error: { color: '#F87171', fontSize: 14, marginBottom: 12 },
  pendingHeader: { fontSize: 16, fontWeight: '500', color: Colors.secondary, marginBottom: 12 },
  pendingCard: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 16,
    marginBottom: 10,
    shadowColor: '#8B4A35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  pendingSubject: { fontSize: 11, color: Colors.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  pendingTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  pendingDue: { fontSize: 13, color: Colors.accent, marginBottom: 12 },
  energyRow: { flexDirection: 'row', gap: 8 },
  energyBtn: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  energyBtnActive: { backgroundColor: Colors.secondary },
  energyBtnText: { fontSize: 13, fontWeight: '500', color: Colors.accent, textTransform: 'capitalize' },
  energyBtnTextActive: { color: Colors.white },
  saveAllButton: { marginTop: 4, marginBottom: 16 },
  signOutButton: { marginTop: 32, padding: 14, alignItems: 'center' },
  signOutText: { fontSize: 14, color: Colors.accent },
})
