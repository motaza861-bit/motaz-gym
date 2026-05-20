export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query } = req.body
  if (!query?.trim()) return res.status(400).json({ error: 'Missing query' })

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&json=1&page_size=15&fields=product_name,brands,nutriments,categories_tags&search_simple=1&action=process`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'IronMindApp/1.0 (fitness tracker)' },
      signal: AbortSignal.timeout(6000),
    })

    if (!response.ok) return res.status(200).json({ results: [] })

    const data = await response.json()
    const results = (data.products ?? [])
      .filter(p => {
        const n = p.nutriments
        return p.product_name && n && (n['energy-kcal_100g'] ?? n['energy_100g'])
      })
      .map((p, i) => {
        const n = p.nutriments
        const kcal = Math.round(n['energy-kcal_100g'] ?? (n['energy_100g'] ?? 0) / 4.184)
        return {
          id: `off_${i}_${Date.now()}`,
          name: p.product_name,
          brand: p.brands || null,
          per100g: {
            calories: kcal,
            protein: Math.round(n['proteins_100g'] ?? 0),
            carbs: Math.round(n['carbohydrates_100g'] ?? 0),
            fat: Math.round(n['fat_100g'] ?? 0),
          },
        }
      })
      .slice(0, 12)

    return res.status(200).json({ results })
  } catch {
    return res.status(200).json({ results: [] })
  }
}
