import { Printer } from 'lucide-react'
import Modal from './Modal'
import { dateTime, money } from '../lib/format'

export default function BillModal({ sale, onClose }) {
  const items = sale.sale_items || sale.items || []
  return (
    <Modal onClose={onClose} wide>
      <h2 className="text-xl font-bold">Bill #{sale.bill_no}</h2>
      <p className="mb-3 text-sm text-steel">
        {dateTime(sale.sold_at)}
        {sale.worker?.full_name ? ` · ${sale.worker.full_name}` : ''}
        {sale.customer_name ? ` · ${sale.customer_name}` : ''}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-line"><th className="th">Item</th><th className="th">Qty</th><th className="th">Price</th><th className="th">Discount</th><th className="th text-right">Total</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-line">
                <td className="td">{i.product_name}<div className="text-xs text-steel">{i.product_code}</div></td>
                <td className="td">{i.quantity}</td>
                <td className="td">{money(i.unit_price)}</td>
                <td className="td">{Number(i.discount_percent)}% ({money(i.discount_amount)})</td>
                <td className="td text-right font-semibold">{money(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 ml-auto grid max-w-xs gap-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>- {money(sale.total_discount)}</span></div>
        <div className="flex justify-between border-t-2 border-copper pt-2 text-lg font-bold"><span>Grand total</span><span>{money(sale.grand_total)}</span></div>
      </div>
      <div className="no-print mt-5 flex gap-2">
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print bill</button>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}
