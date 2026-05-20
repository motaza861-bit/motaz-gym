import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'
import saudiFoods from '../data/saudiFoods.json'
import './FoodSearch.css'

function searchLocal(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return saudiFoods.filter(f =>
    f.name.toLowerCase().includes(q) ||
    (f.nameAr && f.nameAr.includes(q))
  ).slice(0, 10)
}

function calcMacros(per100g, portionG) {
  const ratio = portionG / 100
  return {
    calories: Math.round(per100g.calories * ratio),
    protein:  Math.round(per100g.protein  * ratio),
    carbs:    Math.round(per100g.carbs    * ratio),
    fat:      Math.round(per100g.fat      * ratio),
  }
}

export default function FoodSearch({ onAdd, onClose }) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [localResults, setLocalResults] = useState([])
  const [remoteResults, setRemoteResults] = useState([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [selected, setSelected] = useState(null) // the food item chosen
  const [portionG, setPortionG] = useState(100)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    setLocalResults(searchLocal(query))
    setRemoteResults([])

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setRemoteLoading(false); return }

    debounceRef.current = setTimeout(async () => {
      setRemoteLoading(true)
      try {
        const res = await fetch('/api/search-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        const data = await res.json()
        setRemoteResults(data.results ?? [])
      } catch {
        setRemoteResults([])
      } finally {
        setRemoteLoading(false)
      }
    }, 350)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  function selectFood(food) {
    const defaultPortion = food.defaultPortion ?? 100
    setSelected(food)
    setPortionG(defaultPortion)
  }

  function quickAdd(food) {
    const portion = food.defaultPortion ?? 100
    const macros = calcMacros(food.per100g, portion)
    onAdd({
      id: `search_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: food.name,
      emoji: food.emoji ?? '🍽️',
      portionG: portion,
      ...macros,
    })
    onClose()
  }

  function handleAdd() {
    if (!selected) return
    const macros = calcMacros(selected.per100g, portionG)
    onAdd({
      id: `search_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: selected.name,
      emoji: selected.emoji ?? '🍽️',
      portionG,
      ...macros,
    })
    onClose()
  }

  const allResults = [
    ...localResults.map(f => ({ ...f, _source: 'local' })),
    ...remoteResults
      .filter(r => !localResults.some(l => l.name.toLowerCase() === r.name.toLowerCase()))
      .map(r => ({ ...r, emoji: '🛒', _source: 'remote' })),
  ]

  const macrosPreview = selected ? calcMacros(selected.per100g, portionG) : null

  return (
    <div className="fsearch-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fsearch-modal">
        <div className="fsearch-header">
          <span className="fsearch-title">{t('nu.search_food')}</span>
          <button className="fsearch-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!selected ? (
          <>
            <div className="fsearch-input-row">
              <span className="fsearch-input-icon">🔍</span>
              <input
                ref={inputRef}
                className="fsearch-input"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('nu.search_ph')}
                autoComplete="off"
              />
              {query && (
                <button className="fsearch-clear" onClick={() => setQuery('')}>✕</button>
              )}
            </div>

            <div className="fsearch-results">
              {!query && (
                <p className="fsearch-hint">{t('nu.search_ph')}</p>
              )}

              {query && allResults.length === 0 && !remoteLoading && (
                <p className="fsearch-empty">{t('nu.no_results')}</p>
              )}

              {allResults.map(food => (
                <div key={food.id} className="fsearch-result-item">
                  <button className="fsearch-result-main" onClick={() => selectFood(food)}>
                    <span className="fsearch-result-emoji">{food.emoji ?? '🍽️'}</span>
                    <div className="fsearch-result-body">
                      <span className="fsearch-result-name">{food.name}</span>
                      {food.brand && <span className="fsearch-result-brand">{food.brand}</span>}
                    </div>
                    <span className="fsearch-result-kcal">{food.per100g.calories} kcal/100g</span>
                  </button>
                  <button className="fsearch-quick-add" onClick={() => quickAdd(food)} aria-label="Quick add">+</button>
                </div>
              ))}

              {remoteLoading && (
                <div className="fsearch-remote-loading">
                  <span className="fsearch-spinner" />
                  <span className="fsearch-loading-text">Searching…</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="fsearch-portion-scroll">
              <div className="fsearch-portion-food">
                <span className="fsearch-portion-emoji">{selected.emoji ?? '🍽️'}</span>
                <div>
                  <div className="fsearch-portion-name">{selected.name}</div>
                  {selected.brand && <div className="fsearch-portion-brand">{selected.brand}</div>}
                </div>
              </div>

              <div className="fsearch-portion-label">{t('nu.portion_g')}</div>
              <div className="fsearch-portion-row">
                <button className="fsearch-portion-btn" onClick={() => setPortionG(g => Math.max(10, g - 25))}>−25g</button>
                <input
                  className="fsearch-portion-input"
                  type="number"
                  inputMode="numeric"
                  value={portionG}
                  onChange={e => setPortionG(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button className="fsearch-portion-btn" onClick={() => setPortionG(g => g + 25)}>+25g</button>
              </div>

              {macrosPreview && (
                <div className="fsearch-macros">
                  <div className="fsearch-macro">
                    <span className="fsearch-macro-val">{macrosPreview.calories}</span>
                    <span className="fsearch-macro-key">kcal</span>
                  </div>
                  <div className="fsearch-macro">
                    <span className="fsearch-macro-val">{macrosPreview.protein}g</span>
                    <span className="fsearch-macro-key">protein</span>
                  </div>
                  <div className="fsearch-macro">
                    <span className="fsearch-macro-val">{macrosPreview.carbs}g</span>
                    <span className="fsearch-macro-key">carbs</span>
                  </div>
                  <div className="fsearch-macro">
                    <span className="fsearch-macro-val">{macrosPreview.fat}g</span>
                    <span className="fsearch-macro-key">fat</span>
                  </div>
                </div>
              )}

              <div className="fsearch-portion-note">{t('nu.per_100g')}: {selected.per100g.calories} kcal</div>
            </div>

            <div className="fsearch-actions">
              <button className="fsearch-btn-secondary" onClick={() => setSelected(null)}>← Back</button>
              <button className="fsearch-btn-primary" onClick={handleAdd}>{t('nu.add_to_today')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
