import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'

const CANVAS_TOKEN_KEY = 'canvas_token'
const CANVAS_DOMAIN_KEY = 'canvas_domain'

export default function Settings() {
  const [domain, setDomain] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CANVAS_TOKEN_KEY),
      AsyncStorage.getItem(CANVAS_DOMAIN_KEY),
    ]).then(([savedToken, savedDomain]) => {
      if (savedToken) setToken(savedToken)
      if (savedDomain) setDomain(savedDomain)
    })
  }, [])

  const handleSave = async () => {
    if (!token) { setError('Please enter your Canvas access token.'); return }
    setSaving(true)
    setError('')
    setSaved(false)

    const base = `https://${(domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '')}`

    if (domain) {
      const res = await fetch(`${base}/api/v1/courses?enrollment_state=active`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null)

      if (!res || !res.ok) {
        setError('Could not connect to Canvas. Check your URL and token.')
        setSaving(false)
        return
      }
    }

    await AsyncStorage.setItem(CANVAS_TOKEN_KEY, token)
    if (domain) await AsyncStorage.setItem(CANVAS_DOMAIN_KEY, domain)
    setSaved(true)
    setSaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>
            <Text style={s.logoFlare}>flare </Text>
            <Text style={s.logoPlan}>plan</Text>
          </Text>
          <View style={s.avatar} />
        </View>

        <Text style={s.heading}>Settings</Text>
        <Text style={s.subheading}>
          Connect Canvas so flareplan can pull your assignments and shape them around your energy.
        </Text>

        {/* Canvas connection card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Canvas connection</Text>
          <Text style={s.cardSub}>Stored locally on your device. Never sent anywhere except Canvas.</Text>

          <Text style={s.fieldLabel}>
            CANVAS URL <Text style={s.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={s.input}
            placeholder="https://canvas.your-school.edu"
            placeholderTextColor={Colors.accent}
            value={domain}
            onChangeText={setDomain}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={s.fieldLabel}>ACCESS TOKEN</Text>
          <View style={s.tokenRow}>
            <TextInput
              style={[s.input, s.tokenInput]}
              placeholder="Paste your Canvas access token"
              placeholderTextColor={Colors.accent}
              value={token}
              onChangeText={setToken}
              secureTextEntry={!showToken}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowToken(v => !v)}>
              <Ionicons
                name={showToken ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.accent}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.tokenHelpRow}>
            <Text style={s.tokenHelp}>How to generate a Canvas token</Text>
            <Ionicons name="open-outline" size={13} color={Colors.accent} />
          </TouchableOpacity>

          {!!error && <Text style={s.error}>{error}</Text>}
          {saved && <Text style={s.successMsg}>Token saved successfully.</Text>}

          <TouchableOpacity
            style={[s.saveBtn, (!token || saving) && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!token || saving}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.saveBtnText}>Save key</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Security note */}
        <Text style={s.securityNote}>
          Your token stays on this device in browser storage. Treat it like a password — anyone with it can read and write to your Canvas account.
        </Text>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, paddingBottom: 60 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  logo: { fontSize: 18 },
  logoFlare: { fontWeight: '700', color: Colors.text },
  logoPlan: { fontStyle: 'italic', fontWeight: '400', color: Colors.highlight },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.border },
  heading: { fontSize: 34, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  subheading: { fontSize: 14, color: Colors.accent, lineHeight: 22, marginBottom: 28 },
  card: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 20,
    shadowColor: Colors.highlight, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: Colors.accent, lineHeight: 20, marginBottom: 20 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    color: Colors.secondary, textTransform: 'uppercase', marginBottom: 8,
  },
  optional: { fontWeight: '400', color: Colors.muted, textTransform: 'none', letterSpacing: 0 },
  input: {
    backgroundColor: Colors.background, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    fontSize: 15, color: Colors.secondary,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16,
  },
  tokenRow: { position: 'relative', marginBottom: 0 },
  tokenInput: { paddingRight: 50, marginBottom: 0 },
  eyeBtn: {
    position: 'absolute', right: 14, top: 14,
  },
  tokenHelpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, marginBottom: 20,
  },
  tokenHelp: { fontSize: 13, color: Colors.accent, textDecorationLine: 'underline' },
  error: { color: '#F87171', fontSize: 13, marginBottom: 12 },
  successMsg: { color: '#6B9E6B', fontSize: 13, marginBottom: 12, fontWeight: '500' },
  saveBtn: {
    backgroundColor: Colors.highlight, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  securityNote: {
    fontSize: 13, color: Colors.muted, lineHeight: 20,
    marginBottom: 32, paddingHorizontal: 4,
  },
  signOutBtn: { alignItems: 'center', paddingVertical: 14 },
  signOutText: { fontSize: 14, color: Colors.accent },
})
