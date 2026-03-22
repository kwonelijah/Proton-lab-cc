'use client'

import { useCartStore } from '@/stores/cart'

export default function CartButton() {
  const { openCart, totalItems } = useCartStore()
  const itemCount = totalItems()

  return (
    <button
      className="relative p-2 hover:opacity-60 transition-opacity duration-200"
      aria-label={`Shopping cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
      onClick={openCart}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>

      {itemCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-proton-black text-proton-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center leading-none">
          {itemCount}
        </span>
      )}
    </button>
  )
}
