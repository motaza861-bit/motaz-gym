import { useEffect, useRef, useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useExercises } from '../hooks/useExercises'
import { useTargets } from '../hooks/useTargets'
import { toLocalDateStr } from '../utils/dateHelpers'
import { applyModifyWorkout, applyLogFood } from '../lib/coachTools'
import ChatBubble from '../components/ChatBubble'
import ProposalCard from '../components/ProposalCard'
import Paywall from '../components/Paywall'
import { useSubscription } from '../hooks/useSubscription'
import { hasTier, TIER_2 } from '../lib/tiers'
import { useLanguage } from '../context/LanguageContext'
import './Coach.css'

const MAX_HISTORY = 200
const SEND_HISTORY_WINDOW = 30

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function Coach() {
  const { effectiveTier } = useSubscription()
  const { t } = useLanguage()
  if (!hasTier(effectiveTier, TIER_2)) {
    return (
      <div className="coach-page">
        <div className="coach-header">
          <span className="coach-title">🤖 {t('coach.title')}</span>
        </div>
        <Paywall feature="coach" />
      </div>
    )
  }
  return <CoachInner />
}

function CoachInner() {
  const { t } = useLanguage()
  const [history, setHistory] = useStorage('chat_history', [])
  const [program, setProgram] = useExercises()
  const [targets] = useTargets()
  const [profile] = useStorage('profile', {})
  const [nutritionLogs, setNutritionLogs] = useStorage('nutrition_logs', [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const feedRef = useRef(null)

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [history, busy])

  function append(msg) {
    setHistory(prev => {
      const next = [...prev, msg]
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setError('')
    setInput('')
    const userMsg = { id: newId('msg'), role: 'user', type: 'text', content: text, timestamp: new Date().toISOString() }
    append(userMsg)
    setBusy(true)

    try {
      const recent = history.slice(-SEND_HISTORY_WINDOW)
      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: recent,
          message: text,
          context: { program, targets, profile },
        }),
      })
      if (!res.ok) throw new Error('Coach unavailable')
      const data = await res.json()
      const reply = data.reply
      if (reply.type === 'tool_proposal') {
        append({
          id: newId('msg'), role: 'assistant', type: 'tool_proposal',
          proposal: reply.proposal,
          timestamp: new Date().toISOString(),
        })
      } else {
        append({
          id: newId('msg'), role: 'assistant', type: 'text',
          content: reply.content,
          timestamp: new Date().toISOString(),
        })
      }
    } catch {
      setError(t('coach.error_unreachable'))
    } finally {
      setBusy(false)
    }
  }

  function applyProposal(msg) {
    const { proposal } = msg
    if (proposal.tool === 'modifyWorkout') {
      setProgram(prev => applyModifyWorkout(prev, proposal.params))
    } else if (proposal.tool === 'logFood') {
      const today = toLocalDateStr(new Date())
      setNutritionLogs(prev => applyLogFood(prev, today, proposal.params))
    }
    setHistory(prev => prev.map(m => m.id === msg.id ? { ...m, type: 'tool_applied', appliedAt: new Date().toISOString() } : m))
  }

  function cancelProposal(msg) {
    setHistory(prev => prev.map(m => m.id === msg.id ? { ...m, type: 'tool_cancelled' } : m))
  }

  function clearChat() {
    if (!window.confirm(t('coach.clear_confirm'))) return
    setHistory([])
  }

  return (
    <div className="coach-page">
      <div className="coach-header">
        <span className="coach-title">🤖 {t('coach.title')}</span>
        <button className="coach-menu-btn" aria-label={t('coach.clear_aria')} onClick={clearChat}>⋯</button>
      </div>

      <div className="coach-feed" ref={feedRef}>
        {history.length === 0 && (
          <div className="coach-empty">
            {t('coach.empty')}
          </div>
        )}
        {history.map(msg => {
          if (msg.type === 'text') {
            return <ChatBubble key={msg.id} role={msg.role} type="text" content={msg.content} />
          }
          if (msg.type === 'tool_proposal') {
            return (
              <ProposalCard
                key={msg.id}
                proposal={msg.proposal}
                applied={false}
                onApply={() => applyProposal(msg)}
                onCancel={() => cancelProposal(msg)}
              />
            )
          }
          if (msg.type === 'tool_applied') {
            return (
              <ProposalCard
                key={msg.id}
                proposal={msg.proposal}
                applied={true}
                onApply={() => {}}
                onCancel={() => {}}
              />
            )
          }
          if (msg.type === 'tool_cancelled') {
            return <ChatBubble key={msg.id} role="assistant" type="text" content={`${t('coach.cancelled_prefix')} ${msg.proposal?.summary ?? ''}`} />
          }
          return null
        })}
        {busy && <ChatBubble role="assistant" type="typing" content="" />}
      </div>

      {error && <div className="coach-error">{error}</div>}

      <div className="coach-input-row">
        <input
          className="coach-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('coach.placeholder')}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
        />
        <button className="coach-send" onClick={send} disabled={!input.trim() || busy}>▶</button>
      </div>
    </div>
  )
}
