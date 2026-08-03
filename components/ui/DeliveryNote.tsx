import Link from 'next/link'

// Short delivery & customs line for product pages. Rates live in
// protonlab-backend/config/shipping.js — keep this in sync with /delivery.
export default function DeliveryNote() {
  return (
    <p className="text-xs text-proton-grey leading-relaxed">
      UK &amp; Ireland delivery from £2.99 — free over £100. Europe £5.99 — customs charges
      may apply on arrival.{' '}
      <Link
        href="/delivery"
        className="underline underline-offset-2 hover:text-proton-black transition-colors duration-200"
      >
        Delivery details
      </Link>
    </p>
  )
}
