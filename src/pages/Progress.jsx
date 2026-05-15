// src/pages/Progress.jsx
import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { toLocalDateStr } from '../utils/dateHelpers'
import { getPRs } from '../utils/prDetector'
import { calcVolumeBySession, movingAverage } from '../utils/volumeHelpers'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import './Progress.css'

const CHART_EXERCISES = ['Barbell Back Squat', 'Bench Press', 'Conventional Deadlift', 'Overhead Press']
const tooltipStyle = { background: '#111', border: '1px solid #333', borderRadius: 8 }

export default function Progress() {
  const [workoutLogs] = useStorage('motaz_workout_logs', [])
  const [bodyWeightLogs, setBodyWeightLogs] = useStorage('motaz_body_weight_logs', [])
  const [newWeight, setNewWeight] = useState('')
  const [strengthTab, setStrengthTab] = useState('strength') // 'strength' | 'volume'

  const prs = getPRs(workoutLogs)

  // Body weight: raw points + 7-day moving average
  const bwRaw = [...bodyWeightLogs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(l => ({ date: l.date.slice(5), weight: l.weight }))
  const bwData = movingAverage(bwRaw, 'weight', 7) // adds `avg` field

  // Strength chart: max working-set weight per exercise per session
  const strengthData = workoutLogs
    .filter(l => l.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(log => {
      const point = { date: log.date.slice(5) }
      for (const exName of CHART_EXERCISES) {
        const ex = log.exercises?.find(e => e.name === exName)
        if (ex) {
          const max = Math.max(
            ...(ex.sets ?? [])
              .filter(s => s.completed && (!s.type || s.type === 'T' || s.type === 'S'))
              .map(s => s.weight),
            0
          )
          if (max > 0) point[exName] = max
        }
      }
      return point
    })

  // Volume chart: sets × reps × weight per muscle group per session
  const volumeData = calcVolumeBySession(workoutLogs)

  function logBodyWeight() {
    const w = parseFloat(newWeight)
    if (!w || w < 30 || w > 300) return
    const todayStr = toLocalDateStr(new Date())
    setBodyWeightLogs(prev => [...prev.filter(l => l.date !== todayStr), { date: todayStr, weight: w }])
    setNewWeight('')
  }

  return (
    <div className="page progress-page">
      <h1 className="progress-title">Progress 📈</h1>

      {/* Body Weight */}
      <p className="section-title">Body Weight</p>
      <div className="card">
        <div className="bw-log-row">
          <input
            className="bw-input"
            type="number"
            inputMode="decimal"
            placeholder="Today's weight (kg)"
            value={newWeight}
            onChange={e => setNewWeight(e.target.value)}
          />
          <button className="bw-btn" onClick={logBodyWeight}>Log</button>
        </div>
        {bwData.length > 1 ? (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={bwData}>
                <CartesianGrid stroke="#1e1e1e" />
                <XAxis dataKey="date" stroke="#444" tick={{ fontSize: 10 }} />
                <YAxis stroke="#444" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="weight" stroke="#ff3c3c" strokeWidth={2} dot={false} name="Daily" />
                <Line type="monotone" dataKey="avg" stroke="#666" strokeWidth={2} strokeDasharray="4 2" dot={false} name="7-day avg" />
              </LineChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#ff3c3c' }} /><span>Daily</span></div>
              <div className="legend-item"><div className="legend-dash" /><span>7-day avg</span></div>
            </div>
          </>
        ) : (
          <p className="progress-empty">Log your weight for a few days to see the trend.</p>
        )}
      </div>

      {/* Strength / Volume toggle */}
      <div className="chart-tab-row">
        <button
          className={`chart-tab ${strengthTab === 'strength' ? 'active' : ''}`}
          onClick={() => setStrengthTab('strength')}
        >
          Strength
        </button>
        <button
          className={`chart-tab ${strengthTab === 'volume' ? 'active' : ''}`}
          onClick={() => setStrengthTab('volume')}
        >
          Volume
        </button>
      </div>

      {strengthTab === 'strength' && (
        <div className="card">
          {strengthData.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={strengthData}>
                <CartesianGrid stroke="#1e1e1e" />
                <XAxis dataKey="date" stroke="#444" tick={{ fontSize: 10 }} />
                <YAxis stroke="#444" tick={{ fontSize: 10 }} unit="kg" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="Barbell Back Squat"    stroke="#ff3c3c" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Bench Press"           stroke="#ff8c00" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Conventional Deadlift" stroke="#ffcc00" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Overhead Press"        stroke="#4caf50" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="progress-empty">Complete a few workouts to see your strength trend.</p>
          )}
          <div className="chart-legend">
            {[['Squat','#ff3c3c'],['Bench','#ff8c00'],['Deadlift','#ffcc00'],['OHP','#4caf50']].map(([name,color]) => (
              <div key={name} className="legend-item">
                <div className="legend-dot" style={{ background: color }} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {strengthTab === 'volume' && (
        <div className="card">
          {volumeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={volumeData}>
                <CartesianGrid stroke="#1e1e1e" />
                <XAxis dataKey="date" stroke="#444" tick={{ fontSize: 10 }} />
                <YAxis stroke="#444" tick={{ fontSize: 10 }} unit="kg" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Legs"      fill="#ff3c3c" stackId="a" />
                <Bar dataKey="Chest"     fill="#ff8c00" stackId="a" />
                <Bar dataKey="Back"      fill="#ffcc00" stackId="a" />
                <Bar dataKey="Shoulders" fill="#4caf50" stackId="a" />
                <Bar dataKey="Arms"      fill="#9c27b0" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="progress-empty">Complete a workout to see volume data.</p>
          )}
          <div className="chart-legend">
            {[['Legs','#ff3c3c'],['Chest','#ff8c00'],['Back','#ffcc00'],['Shoulders','#4caf50'],['Arms','#9c27b0']].map(([name,color]) => (
              <div key={name} className="legend-item">
                <div className="legend-dot" style={{ background: color }} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PR Log */}
      <p className="section-title">Personal Records 🏆</p>
      {prs.length === 0 ? (
        <p className="progress-empty card">Complete your first workout to start tracking PRs.</p>
      ) : (
        [...prs].sort((a, b) => b.date?.localeCompare(a.date)).map(pr => (
          <div key={pr.exercise} className="pr-row">
            <div className="pr-row-name">{pr.exercise}</div>
            <div className="pr-row-weight">{pr.weight}kg</div>
            <div className="pr-row-date">{pr.date}</div>
          </div>
        ))
      )}
    </div>
  )
}
