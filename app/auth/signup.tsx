import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()

  const handleSignup = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
      setLoading(false)
    }
  }

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <Text style={styles.doneCheck}>✓</Text>
        <Text style={styles.doneHeading}>Check your email</Text>
        <Text style={styles.doneSub}>
          We sent a confirmation link to {email}. Click it to activate your account.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/auth/login')}>
          <Text style={styles.link}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>Get started</Text>
        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.subheading}>Built for students who need it most</Text>

        <View style={styles.fields}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.accent}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={Colors.accent}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, (!email || !password || loading) && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={!email || !password || loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Create account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/auth/login')}>
          <Text style={styles.link}>
            Already have an account? <Text style={styles.linkBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: Colors.accent, textTransform: 'uppercase', marginBottom: 6 },
  heading: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subheading: { fontSize: 14, color: Colors.accent, marginBottom: 40 },
  fields: { gap: 12, marginBottom: 16 },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: Colors.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  error: { color: '#F87171', fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: Colors.text,
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  link: { textAlign: 'center', fontSize: 13, color: Colors.accent },
  linkBold: { color: Colors.secondary, fontWeight: '600' },
  doneContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  doneCheck: { fontSize: 40, fontWeight: '700', color: '#B0ACC8', marginBottom: 16 },
  doneHeading: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  doneSub: { fontSize: 14, color: Colors.accent, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
})
