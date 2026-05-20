import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useStorage } from '../hooks/useStorage'
import saudiFoods from '../data/saudiFoods.json'
import '../components/FoodSearch.css'
import './FoodSearchPage.css'

const EMOJI_PRESETS = ['🍗','🥩','🐟','🥚','🥛','🍚','🥦','🍎','🥜','🍫']

const EMPTY_FORM = { name: '', nameAr: '', emoji: '🍽️', calories: '', protein: '', carbs: '', fat: '', defaultPortion: '100' }

function calcMacros(per100g, portionG) {
  const ratio = portionG / 100
  return {
    calories: Math.round(per100g.calories * ratio),
    protein:  Math.round(per100g.protein  * ratio),
    carbs:    Math.round(per100g.carbs    * ratio),
    fat:      Math.round(per100g.fat      * ratio),
  }
}

export default function FoodSearchPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [customFoods, setCustomFoods] = useStorage('motaz_custom_foods', [])

  const [query, setQuery] = useState('')
  const [customResults, setCustomResults] = useState([])
  const [localResults, setLocalResults] = useState([])
  const [remoteResults, setRemoteResults] = useState([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [portionG, setPortionG] = useState(100)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)

  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const q = query.toLowerCase().trim()

    // Custom foods — always filter (empty query shows all for browsing)
    setCustomResults(
      customFoods
        .filter(f => !q || f.name.toLowerCase().includes(q) || (f.nameAr && f.nameAr.includes(q)))
        .map(f => ({ ...f, _source: 'custom' }))
    )

    // Local foods — only when query is non-empty
    setLocalResults(
      q
        ? saudiFoods
            .filter(f => f.name.toLowerCase().includes(q) || (f.nameAr && f.nameAr.includes(q)))
            .slice(0, 10)
            .map(f => ({ ...f, _source: 'local' }))
        : []
    )

    setRemoteResults([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q) { setRemoteLoading(false); return }

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
  }, [query, customFoods])

  // ── Form helpers ──────────────────────────────────────────────────────────

  function openForm(food = null) {
    setEditingId(food ? food.id : null)
    setFormData(food ? {
      name:          food.name,
      nameAr:        food.nameAr || '',
      emoji:         food.emoji || '🍽️',
      calories:      String(food.per100g.calories),
      protein:       String(food.per100g.protein),
      carbs:         String(food.per100g.carbs),
      fat:           String(food.per100g.fat),
      defaultPortion: String(food.defaultPortion || 100),
    } : EMPTY_FORM)
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
  }

  function setField(key, val) {
    setFormData(d => ({ ...d, [key]: val }))
  }

  function validateForm() {
    if (!formData.name.trim()) return t('cf.validation_name')
    const nums = [formData.calories, formData.protein, formData.carbs, formData.fat]
    if (nums.some(v => v === '' || isNaN(Number(v)) || Number(v) < 0))
      return t('cf.validation_macros')
    return null
  }

  function saveCustomFood() {
    const err = validateForm()
    if (err) { setFormError(err); return }

    const foodObj = {
      id: editingId || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: formData.name.trim(),
      ...(formData.nameAr.trim() ? { nameAr: formData.nameAr.trim() } : {}),
      category: 'custom',
      emoji: formData.emoji || '🍽️',
      per100g: {
        calories: parseInt(formData.calories) || 0,
        protein:  parseInt(formData.protein)  || 0,
        carbs:    parseInt(formData.carbs)    || 0,
        fat:      parseInt(formData.fat)      || 0,
      },
      defaultPortion: parseInt(formData.defaultPortion) || 100,
      _isCustom: true,
    }

    if (editingId) {
      setCustomFoods(prev => prev.map(f => f.id === editingId ? foodObj : f))
    } else {
      setCustomFoods(prev => [foodObj, ...prev])
    }
    closeForm()
  }

  function deleteCustomFood(food) {
    if (!window.confirm(t('cf.delete_confirm', { name: food.name }))) return
    setCustomFoods(prev => prev.filter(f => f.id !== food.id))
  }

  // ── Food add helpers ──────────────────────────────────────────────────────

  function selectFood(food) {
    setSelected(food)
    setPortionG(food.defaultPortion ?? 100)
  }

  function addAndReturn(entry) {
    navigate('/nutrition', { state: { quickLog: entry } })
  }

  function quickAdd(food) {
    const portion = food.defaultPortion ?? 100
    const macros = calcMacros(food.per100g, portion)
    addAndReturn({
      id: `search_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: food.name,
      emoji: food.emoji ?? '🍽️',
      portionG: portion,
      ...macros,
    })
  }

  function handleAdd() {
    if (!selected) return
    const macros = calcMacros(selected.per100g, portionG)
    addAndReturn({
      id: `search_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: selected.name,
      emoji: selected.emoji ?? '🍽️',
      portionG,
      ...macros,
    })
  }

  // ── Results assembly ──────────────────────────────────────────────────────

  const allResults = [
    ...customResults,
    ...localResults,
    ...remoteResults
      .filter(r =>
        !localResults.some(l => l.name.toLowerCase() === r.name.toLowerCase()) &&
        !customResults.some(c => c.name.toLowerCase() === r.name.toLowerCase())
      )
      .map(r => ({ ...r, emoji: '🛒', _source: 'remote' })),
  ]

  const macrosPreview = selected ? calcMacros(selected.per100g, portionG) : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fpage">
      <div className="fpage-header">
        <button className="fpage-back" onClick={() => selected ? setSelected(null) : navigate(-1)}>←</button>
        <span className="fpage-title">{selected ? selected.name : t('nu.search_food')}</span>
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

          {/* Add custom food button */}
          <button className="fcf-add-btn" onClick={() => openForm()}>
            {t('cf.add_btn')}
          </button>

          {/* Inline create / edit form */}
          {showForm && (
            <div className="fcf-form-panel">
              <div className="fcf-form-title">
                {editingId ? t('cf.form_title_edit') : t('cf.form_title_new')}
              </div>

              {/* Emoji picker */}
              <div className="fcf-form-field fcf-form-full" style={{ marginBottom: 10 }}>
                <span className="fcf-form-label">{t('cf.field_emoji')}</span>
                <div className="fcf-emoji-row">
                  {EMOJI_PRESETS.map(e => (
                    <button
                      key={e}
                      type="button"
                      className={`fcf-emoji-btn${formData.emoji === e ? ' fcf-emoji-btn--selected' : ''}`}
                      onClick={() => setField('emoji', e)}
                    >{e}</button>
                  ))}
                  <input
                    className="fcf-form-input"
                    style={{ width: 52, textAlign: 'center' }}
                    maxLength={2}
                    value={EMOJI_PRESETS.includes(formData.emoji) ? '' : formData.emoji}
                    placeholder="✏️"
                    onChange={e => setField('emoji', e.target.value || '🍽️')}
                  />
                </div>
              </div>

              <div className="fcf-form-grid">
                <div className="fcf-form-field fcf-form-full">
                  <span className="fcf-form-label">{t('cf.field_name')}</span>
                  <input
                    className="fcf-form-input"
                    type="text"
                    value={formData.name}
                    placeholder={t('cf.field_name_ph')}
                    onChange={e => setField('name', e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="fcf-form-field fcf-form-full">
                  <span className="fcf-form-label">{t('cf.field_name_ar')}</span>
                  <input
                    className="fcf-form-input"
                    type="text"
                    value={formData.nameAr}
                    placeholder={t('cf.field_name_ar_ph')}
                    dir="rtl"
                    onChange={e => setField('nameAr', e.target.value)}
                  />
                </div>
                {[
                  ['calories', 'cf.field_cal'],
                  ['protein',  'cf.field_protein'],
                  ['carbs',    'cf.field_carbs'],
                  ['fat',      'cf.field_fat'],
                  ['defaultPortion', 'cf.field_portion'],
                ].map(([key, label]) => (
                  <div key={key} className="fcf-form-field">
                    <span className="fcf-form-label">{t(label)}</span>
                    <input
                      className="fcf-form-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={formData[key]}
                      onChange={e => setField(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {formError && <p className="fcf-form-error">{formError}</p>}

              <div className="fcf-form-actions">
                <button className="fcf-form-cancel" onClick={closeForm}>{t('cf.cancel')}</button>
                <button className="fcf-form-save" onClick={saveCustomFood}>{t('cf.save')}</button>
              </div>
            </div>
          )}

          <div className="fsearch-results">
            {/* Empty query state */}
            {!query && customFoods.length === 0 && (
              <>
                <p className="fsearch-hint">{t('nu.search_ph')}</p>
                <p className="fcf-empty-hint">{t('cf.empty_hint')}</p>
              </>
            )}
            {!query && customFoods.length > 0 && (
              <p className="fcf-section-header">{t('cf.my_foods_title')}</p>
            )}

            {/* No results on active query */}
            {query && allResults.length === 0 && !remoteLoading && (
              <p className="fsearch-empty">{t('nu.no_results')}</p>
            )}

            {/* Results */}
            {allResults.map(food => (
              food._source === 'custom' ? (
                <div key={food.id} className="fsearch-result-item">
                  <button className="fsearch-result-main" onClick={() => selectFood(food)}>
                    <span className="fsearch-result-emoji">{food.emoji ?? '🍽️'}</span>
                    <div className="fsearch-result-body">
                      <span className="fsearch-result-name">{food.name}</span>
                      <span className="fcustom-badge">{t('cf.badge')}</span>
                    </div>
                    <span className="fsearch-result-kcal">{food.per100g.calories} kcal/100g</span>
                  </button>
                  <div className="fcf-row-actions">
                    <button className="fcf-row-btn" onClick={() => openForm(food)} aria-label="Edit">✏️</button>
                    <button className="fcf-row-btn fcf-row-btn--delete" onClick={() => deleteCustomFood(food)} aria-label="Delete">🗑</button>
                    <button className="fcf-row-btn fcf-row-btn--add" onClick={() => quickAdd(food)} aria-label="Quick add">+</button>
                  </div>
                </div>
              ) : (
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
              )
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

          <button className="fpage-add-btn" onClick={handleAdd}>{t('nu.add_to_today')}</button>
        </div>
      )}
    </div>
  )
}
