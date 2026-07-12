import ProductCard from '@/components/ui/ProductCard'
import type { Product } from '@/types/product'

interface ShopGridProps {
  products: Product[]
}

export default function ShopGrid({ products }: ShopGridProps) {
  if (products.length === 0) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < 4} />
      ))}
    </div>
  )
}
