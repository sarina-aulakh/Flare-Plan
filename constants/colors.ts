export const Colors = {
  background: '#FAF7F2',
  white: '#FFFDF9',
  text: '#2C1810',
  secondary: '#5C3D2E',
  accent: '#A67C6D',
  border: '#E8DDD5',
  muted: '#C4A99A',
  highlight: '#8B4A35',
} as const

export const EnergyColors = {
  low: { bg: '#FDF0EB', dot: '#C4513A', text: '#8B4A35', bar: '#C4513A' },
  medium: { bg: '#FDF5E6', dot: '#C4963A', text: '#7A5C1E', bar: '#C4963A' },
  high: { bg: '#F0F7F0', dot: '#6B9E6B', text: '#2D5A2D', bar: '#6B9E6B' },
  light: { bg: '#F0F7F0', dot: '#6B9E6B', text: '#2D5A2D', bar: '#6B9E6B' },
  heavy: { bg: '#FDF0EB', dot: '#C4513A', text: '#8B4A35', bar: '#C4513A' },
} as const
