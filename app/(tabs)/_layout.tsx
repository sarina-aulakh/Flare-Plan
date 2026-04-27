import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(name: IoniconsName, focusedName: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={22} color={color} />
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          paddingTop: 6,
          paddingBottom: 4,
          height: 62,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planner',
          tabBarIcon: tabIcon('calendar-outline', 'calendar'),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: tabIcon('bar-chart-outline', 'bar-chart'),
        }}
      />
      <Tabs.Screen
        name="recovery"
        options={{
          title: 'Recovery',
          tabBarIcon: tabIcon('heart-outline', 'heart'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: tabIcon('settings-outline', 'settings'),
        }}
      />
      <Tabs.Screen name="tasks" options={{ href: null }} />
    </Tabs>
  )
}
