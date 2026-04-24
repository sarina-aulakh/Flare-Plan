import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export type Task = {
  id: number
  user_id: string
  subject: string
  title: string
  due_date: string
  energy_required: 'light' | 'medium' | 'heavy'
  is_completed: boolean
  is_from_canvas?: boolean
}

export type Checkin = {
  id: number
  user_id: string
  energy_level: 'low' | 'medium' | 'high'
  date: string
  created_at: string
}
