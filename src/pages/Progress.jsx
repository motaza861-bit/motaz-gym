import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { toLocalDateStr } from '../utils/dateHelpers'
import { getPRs } from '../utils/prDetector'
import { calcVolumeBySession, movingAverage } from '../utils/volumeHelpers'
import { useLanguage } from '../context/LanguageContext'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import './Progress.css'

const CHART_COLORS = ['#ff3c3c', '#ff8c00', '#ffcc00', '#4caf50', '#9c27b0']
const tooltipStyle = { background: '#111', border: '1px solid #333', borderRadius: 8 }
const ORM_PCTS = [100, 95, 90, 85, 80, 75, 70, 65, 60]

function HistoryRow({ log }) {
  const [open, setOpen] = useState(false)
  const duration = log.completedAt && log.startedAt
    ? Math.round((log.completedAt - log.startedAt) / 60000) : null
  const totalSets = (log.exercises ?? []).reduce((n, ex) =>
    n + (ex.sets ?? []).filter(s => s.completed).length, 0)

  return (
    <div className="hist-row">
      <button className="hist-header" onClick={() => setOpen(o => !o)}>
        <div className="hist-info">
          <span className="hist-date">{log.date}</span>
          {log.session && <span className="hist-session-badge">{log.session}</span>}
        </div>
        <div className="hist-meta">
          {duration != null && <span className="hist-tag">{duration}m</span>}
          <span className="hist-tag">{totalSets} sets</span>
          {(log.prs?.length ?? 0) > 0 && <span className="hist-tag hist-pr">🏆 {log.prs.length}</span>}
        </div>
        <span className="hist-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="hist-exercises">
          {(log.exercises ?? []).map(ex => {
            const topSet = [...(ex.sets ?? [])]
              .filter(s => s.completed && (s.weight || 0) > 0)
              .sort((a, b) => b.weight - a.weight)[0]
            return (
              <div key={ex.name} className="hist-ex">
                <span className="hist-ex-name">{ex.name}</span>
                {topSet && <span className="hist-ex-top">{topSet.weight}kg × {topSet.reps}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Progress() {
  const { t } = useLanguage()
  const [workoutLogs] = useStorage('motaz_workout_logs', [])
  const [bodyWeightLogs, setBodyWeightLogs] = useStorage('motaz_body_weight_logs', [])
  const [newWeight, setNewWeight] = useState('')
  const [chartTab, setChartTab] = useState('strength')
  const [ormWeight, setOrmWeight] = useState('')
  const [ormReps, setOrmReps] = useState('')

  const prs = getPRs(workoutLogs)
  const completedLogs = workoutLogs.filter(l => l.completed)

  // Stats
  const totalSessions = completedLogs.length
  const thisMonthStr = new Date().toISOString().slice(0, 7)
  const thisMonthSessions = completedLogs.filter(l => l.date.startsWith(thisMonthStr)).length
  const totalVolumeKg = completedLogs.reduce((sum, log) =>
    sum + (log.exercises ?? []).reduce((es, ex) =>
      es + (ex.sets ?? []).reduce((ss, s) =>
        ss + (s.completed ? (s.weight || 0) * (s.reps || 0) : 0), 0), 0), 0)
  const totalVolumeTons = (Math.round(totalVolumeKg / 100) / 10).toFixed(1)

  // Body weight
  const bwRaw = [...bodyWeightLogs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(l => ({ date: l.date.slice(5), weight: l.weight }))
  const bwData = movingAverage(bwRaw, 'weight', 7)

  // Top exercises by sessions logged with weight — drives the strength chart
  const exCounts = {}
  for (const log of completedLogs) {
    for (const ex of log.exercises ?? []) {
      if ((ex.sets ?? []).some(s => s.completed && (s.weight ?? 0) > 0))
        exCounts[ex.name] = (exCounts[ex.name] ?? 0) + 1
    }
  }
  const chartExercises = Object.entries(exCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name], i) => ({ name, color: CHART_COLORS[i] }))

  // Strength chart
  const strengthData = completedLogs
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(log => {
      const point = { date: log.date.slice(5) }
      for (const { name } of chartExercises) {
        const ex = log.exercises?.find(e => e.name === name)
        if (ex) {
          const max = Math.max(...(ex.sets ?? [])
            .filter(s => s.completed && (!s.type || s.type === 'T' || s.type === 'S'))
            .map(s => s.weight), 0)
          if (max > 0) point[name] = max
        }
      }
      return point
    })

  const volumeData = calcVolumeBySession(workoutLogs)
  const volumeSessionKeys = [...new Set(
    volumeData.flatMap(point => Object.keys(point).filter(k => k !== 'date'))
  )].map((key, i) => ({ key, color: CHART_COLORS[i % CHART_COLORS.length] }))

  // 1RM (Epley formula)
  const wNum = parseFloat(ormWeight)
  const rNum = parseInt(ormReps)
  const oneRM = wNum > 0 && rNum >= 1 && rNum <= 30 ? Math.round(wNum * (1 + rNum / 30)) : null

  function logBodyWeight() {
    const w = parseFloat(newWeight)
    if (!w || w < 30 || w > 300) return
    const todayStr = toLocalDateStr(new Date())
    setBodyWeightLogs(prev => [...prev.filter(l => l.date !== todayStr), { date: todayStr, weight: w }])
    setNewWeight('')
  }

  return (
    <div className="page progress-page">
      <h1 className="progress-title">{t('pr.title')}</h1>

      {totalSessions > 0 && (
        <div className="card stats-grid">
          <div className="stat-item">
            <div className="stat-val">{totalSessions}</div>
            <div className="stat-key">{t('pr.total_sessions')}</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{thisMonthSessions}</div>
            <div className="stat-key">{t('pr.this_month')}</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{totalVolumeTons}t</div>
            <div className="stat-key">{t('pr.total_vol')}</div>
          </div>
        </div>
      )}

      <p className="section-title">{t('pr.body_weight')}</p>
      <div className="card">
        <div className="bw-log-row">
          <input className="bw-input" type="number" inputMode="decimal"
            placeholder={t('pr.weight_ph')} value={newWeight}
            onChange={e => setNewWeight(e.target.value)} />
          <button className="bw-btn" onClick={logBodyWeight}>{t('pr.log')}</button>
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
          <p className="progress-empty">{t('pr.empty_weight')}</p>
        )}
      </div>

      <div className="chart-tab-row">
        {['strength', 'volume', 'history'].map(tab => (
          <button key={tab} className={`chart-tab${chartTab === tab ? ' active' : ''}`}
            onClick={() => setChartTab(tab)}>
            {t(`pr.${tab}`)}
          </button>
        ))}
      </div>

      {chartTab === 'strength' && (
        <div className="card">
          {strengthData.length > 1 && chartExercises.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={strengthData}>
                <CartesianGrid stroke="#1e1e1e" />
                <XAxis dataKey="date" stroke="#444" tick={{ fontSize: 10 }} />
                <YAxis stroke="#444" tick={{ fontSize: 10 }} unit="kg" />
                <Tooltip contentStyle={tooltipStyle} />
                {chartExercises.map(ex => (
                  <Line key={ex.name} type="monotone" dataKey={ex.name} stroke={ex.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="progress-empty">{t('pr.empty_strength')}</p>
          )}
          {chartExercises.length > 0 && (
            <div className="chart-legend">
              {chartExercises.map(ex => (
                <div key={ex.name} className="legend-item">
                  <div className="legend-dot" style={{ background: ex.color }} />
                  <span>{ex.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {chartTab === 'volume' && (
        <div className="card">
          {volumeData.length > 0 && volumeSessionKeys.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={volumeData}>
                <CartesianGrid stroke="#1e1e1e" />
                <XAxis dataKey="date" stroke="#444" tick={{ fontSize: 10 }} />
                <YAxis stroke="#444" tick={{ fontSize: 10 }} unit="kg" />
                <Tooltip contentStyle={tooltipStyle} />
                {volumeSessionKeys.map(({ key, color }) => (
                  <Bar key={key} dataKey={key} fill={color} stackId="a" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="progress-empty">{t('pr.empty_volume')}</p>
          )}
          {volumeSessionKeys.length > 0 && (
            <div className="chart-legend">
              {volumeSessionKeys.map(({ key, color }) => (
                <div key={key} className="legend-item">
                  <div className="legend-dot" style={{ background: color }} /><span>{key}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {chartTab === 'history' && (
        <div>
          {completedLogs.length === 0 ? (
            <p className="progress-empty card">{t('pr.empty_history')}</p>
          ) : (
            [...completedLogs]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(log => <HistoryRow key={log.date} log={log} />)
          )}
        </div>
      )}

      <p className="section-title">{t('pr.one_rm')}</p>
      <div className="card">
        <div className="orm-inputs">
          <div className="orm-field">
            <label className="orm-label">{t('pr.one_rm_weight')}</label>
            <input className="bw-input" type="number" inputMode="decimal" placeholder="kg"
              value={ormWeight} onChange={e => setOrmWeight(e.target.value)} />
          </div>
          <div className="orm-field orm-field--reps">
            <label className="orm-label">{t('pr.one_rm_reps')}</label>
            <input className="bw-input" type="number" inputMode="numeric" placeholder="reps"
              min="1" max="30"
              value={ormReps} onChange={e => setOrmReps(e.target.value)} />
          </div>
        </div>
        {oneRM ? (
          <div className="orm-result">
            <div className="orm-result-header">
              <span className="orm-result-label">{t('pr.one_rm_result')}</span>
              <span className="orm-result-val">{oneRM} kg</span>
            </div>
            <div className="orm-pct-table">
              {ORM_PCTS.map(pct => (
                <div key={pct} className="orm-pct-row">
                  <span className="orm-pct">{pct}%</span>
                  <span className="orm-pct-val">{Math.round(oneRM * pct / 100)} kg</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="progress-empty">{t('pr.one_rm_hint')}</p>
        )}
      </div>

      <p className="section-title">{t('pr.prs')}</p>
      {prs.length === 0 ? (
        <p className="progress-empty card">{t('pr.empty_prs')}</p>
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
