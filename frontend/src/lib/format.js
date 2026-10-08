export const CURRENCY = 'Rs'
export const money = (n) =>
  `${CURRENCY} ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
export const dateTime = (iso) => new Date(iso).toLocaleString()
export const stockInfo = (p) =>
  p.quantity === 0
    ? { cls: 'bg-danger', text: 'Out of stock' }
    : p.quantity <= p.low_stock_threshold
      ? { cls: 'bg-warning', text: `Low: ${p.quantity}` }
      : { cls: 'bg-success', text: `In stock: ${p.quantity}` }
