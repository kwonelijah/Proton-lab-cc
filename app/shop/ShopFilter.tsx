'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CARD_LABEL } from '@/components/ui/ProductCard'
import { ALL_CATEGORY, type ShopCategory } from '@/lib/shop-categories'

interface ShopFilterProps {
  categories: ShopCategory[]
  value: string
  onChange: (key: string) => void
}

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2'

// "FILTER" trigger with a small category list beneath it, in 12px caps.
// Escape or a click outside closes the list and focus returns to the trigger.
// Trigger and items are 44px tall for touch.
export default function ShopFilter({ categories, value, onChange }: ShopFilterProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  const options: ShopCategory[] = [{ key: ALL_CATEGORY, label: 'All', tags: [] }, ...categories]
  const active = options.find(o => o.key === value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const select = (key: string) => {
    onChange(key)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      {/* px-2 -mr-2 widens the tap area without moving the text off the
          container's right edge. */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(o => !o)}
        className={`${CARD_LABEL} ${RING} inline-flex h-11 items-center gap-2 px-2 -mr-2 text-proton-black hover:opacity-60 transition-opacity duration-200`}
      >
        Filter
        {value !== ALL_CATEGORY && active && (
          <span className="text-proton-grey">· {active.label}</span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="2,4 6,8 10,4" />
        </svg>
      </button>

      {/* The list and the page share proton-white, so the 1px border is what
          separates them. z-20 stays under the fixed navbar (z-50); the list
          opens downward, so it never meets the header. */}
      {open && (
        <ul
          id={listId}
          className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] border border-proton-black bg-proton-white"
        >
          {options.map(o => {
            const selected = o.key === value
            return (
              <li key={o.key}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => select(o.key)}
                  className={`${CARD_LABEL} ${RING} flex h-11 w-full items-center justify-between gap-6 px-4 text-left transition-colors duration-200 hover:bg-proton-light ${
                    selected ? 'text-proton-black' : 'text-proton-grey hover:text-proton-black'
                  }`}
                >
                  {o.label}
                  {selected && <span aria-hidden="true">•</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
