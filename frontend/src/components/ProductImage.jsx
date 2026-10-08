import { useState } from 'react'
import { ImageOff, Zap } from 'lucide-react'

/** Real product photo from Supabase Storage; neat placeholder when missing/broken. */
export default function ProductImage({ product, className = '', size = 36 }) {
  const [failed, setFailed] = useState(false)
  if (product.image_url && !failed)
    return <img src={product.image_url} alt={product.name} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />
  return (
    <div className={`flex items-center justify-center bg-paper text-steel/50 ${className}`} title="No photo yet">
      {failed ? <ImageOff size={size} /> : <Zap size={size} />}
    </div>
  )
}
