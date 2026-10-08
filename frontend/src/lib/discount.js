// Same rule as the Supabase API function and SQL function create_sale.
export const discountPercent = (qty, rules) =>
  rules.filter((r) => qty >= r.min_quantity).reduce((best, r) =>
    !best || Number(r.min_quantity) > Number(best.min_quantity) ? r : best, null)?.discount_percent || 0

const r2 = (n) => Math.round(n * 100) / 100

export const calcLine = (price, qty, rules) => {
  const pct = discountPercent(qty, rules)
  const gross = r2(Number(price) * qty)
  const discount = r2((gross * pct) / 100)
  return { pct, gross, discount, total: r2(gross - discount) }
}

export const nextTier = (qty, rules) =>
  [...rules].sort((a, b) => a.min_quantity - b.min_quantity).find((r) => r.min_quantity > qty)
