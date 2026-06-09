// src/components/RestTimer.jsx
import { useState, useEffect, useRef } from 'react'
import './RestTimer.css'

function playDoneSignal() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
  } catch {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200])
}

export default function RestTimer({ seconds, onDone }) {
  const [remaining, setRemaining] = useState(seconds)
  const firedRef = useRef(false)

  // Reset when a new rest period starts
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(seconds)
    firedRef.current = false
  }, [seconds])

  // Countdown using setTimeout to avoid setInterval drift
  useEffect(() => {
    if (remaining <= 0) {
      if (!firedRef.current) {
        firedRef.current = true
        playDoneSignal()
        onDone?.()
      }
      return
    }
    const id = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining, onDone])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div className="rest-timer">
      <span className="rest-timer-label">🔴 Rest</span>
      <span className="rest-timer-display">
        {mins}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  )
}
