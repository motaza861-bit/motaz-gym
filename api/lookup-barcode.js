export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { barcode } = req.body ?? {}
  if (!barcode || typeof barcode !== 'string') {
    return res.status(400).json({ error: 'Missing barcode' })
  }
  if (!/^\d{8,14}$/.test(barcode)) {
    return res.status(400).json({ error: 'Malformed barcode' })
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'IronMindApp/1.0 (fitness tracker)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return res.status(200).json({ found: false })

    const data = await response.json()
    if (data.status !== 1 || !data.product) return res.status(200).json({ found: false })

    const p = data.product
    const n = p.nutriments ?? {}
    const kcalRaw = n['energy-kcal_100g']
    const kcal = kcalRaw != null
      ? Math.round(kcalRaw)
      : n['energy_100g'] != null
        ? Math.round(n['energy_100g'] / 4.184)
        : null
    if (!p.product_name || kcal == null) return res.status(200).json({ found: false })

    return res.status(200).json({
      found: true,
      food: {
        id: `off_barcode_${barcode}`,
        name: p.product_name,
        brand: p.brands || null,
        emoji: '🛒',
        per100g: {
          calories: kcal,
          protein: Math.round(n.proteins_100g ?? 0),
          carbs:   Math.round(n.carbohydrates_100g ?? 0),
          fat:     Math.round(n.fat_100g ?? 0),
        },
        defaultPortion: 100,
        _source: 'barcode',
        barcode,
      },
    })
  } catch {
    return res.status(200).json({ found: false })
  }
}
