import { useEffect } from 'react'
import { darkenHex, hexToRgba } from '../utils/colorUtils'

export const DEFAULT_THEME = {
  accent: '#00E5FF',
  cardStyle: 'glass',
  bgPreset: 'deep',
}

export const BG_PRESETS = {
  abyss: { label: 'Abyss', bg: '#000000', bgCard: '#0d0d0d' },
  deep:  { label: 'Deep',  bg: '#060A12', bgCard: '#0a1220' },
  dark:  { label: 'Dark',  bg: '#0d0d0d', bgCard: '#141414' },
  void:  { label: 'Void',  bg: '#1a1a2e', bgCard: '#1f1f3a' },
}

export const ACCENT_PRESETS = [
  { label: 'Cyan',   hex: '#00E5FF' },
  { label: 'Red',    hex: '#ff3c3c' },
  { label: 'Volt',   hex: '#AAFF00' },
  { label: 'Gold',   hex: '#FFB800' },
  { label: 'Violet', hex: '#BF5AF2' },
  { label: 'Ember',  hex: '#FF6B00' },
]

export function applyTheme(theme) {
  const root = document.documentElement
  const accentDark = darkenHex(theme.accent, 25)
  const accentGlow = hexToRgba(theme.accent, 0.2)
  const preset = BG_PRESETS[theme.bgPreset] ?? BG_PRESETS.deep

  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-dark', accentDark)
  root.style.setProperty('--accent-glow', accentGlow)
  root.style.setProperty('--bg', preset.bg)
  root.style.setProperty('--bg-card', preset.bgCard)
  root.setAttribute('data-card-style', theme.cardStyle)
}

export function readTheme() {
  try {
    const stored = localStorage.getItem('motaz_theme')
    return stored ? { ...DEFAULT_THEME, ...JSON.parse(stored) } : { ...DEFAULT_THEME }
  } catch {
    return { ...DEFAULT_THEME }
  }
}

export function saveTheme(theme) {
  try { localStorage.setItem('motaz_theme', JSON.stringify(theme)) } catch {}
}

export function useTheme() {
  useEffect(() => { applyTheme(readTheme()) }, [])
}
