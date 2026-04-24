import { create } from 'zustand'

type EnergyLevel = 'low' | 'medium' | 'high'

interface AppState {
  energyLevel: EnergyLevel | null
  setEnergyLevel: (level: EnergyLevel) => void
  clearEnergy: () => void
}

export const useAppStore = create<AppState>((set) => ({
  energyLevel: null,
  setEnergyLevel: (level) => set({ energyLevel: level }),
  clearEnergy: () => set({ energyLevel: null }),
}))
