'use client'

import { useState } from 'react'

interface AccordionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-proton-light">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center justify-between w-full py-4 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
        aria-expanded={isOpen}
      >
        <span className="text-[10px] uppercase tracking-widest text-proton-grey group-hover:text-proton-black transition-colors duration-200">
          {title}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={`text-proton-grey group-hover:text-proton-black transition-all duration-300 shrink-0 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
          aria-hidden="true"
        >
          <polyline points="2,4 6,8 10,4" />
        </svg>
      </button>

      {/* Smooth expand/collapse using CSS grid trick */}
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
