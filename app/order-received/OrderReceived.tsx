'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BANK_ORDER_STORAGE_KEY } from '@/components/ui/CartDrawer'
import type { BankOrderReceipt } from '@/lib/checkout'
import { trackMetaEvent } from '@/lib/meta'
import { trackGaEvent } from '@/lib/ga'

// Shows the member what to pay and where, straight after a bank-transfer
// order — the same details the backend emailed. The receipt travels via
// sessionStorage (written by CartDrawer), so a direct visit or a cleared
// session shows the email fallback. Fires the browser Purchase / purchase
// events once per order, like /success does for Stripe; there is no
// server-side Conversions API event for bank orders, so nothing to dedupe.

interface Snapshot {
  receipt: BankOrderReceipt
  items: { id: string; name: string; price: number; quantity: number }[]
  placedAt: string
}

function CopyField({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const [copied, setCopied] = useState(false)
  const valueRef = useRef<HTMLSpanElement>(null)
  function copy() {
    const select = () => {
      const node = valueRef.current
      if (!node) return
      const range = document.createRange()
      range.selectNodeContents(node)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    navigator.clipboard?.writeText(value).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500) },
      select
    ) ?? select()
  }
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-proton-light">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-1">{label}</p>
        <span ref={valueRef} className={`text-sm text-proton-black select-all ${bold ? 'font-semibold' : ''}`}>{value}</span>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-[10px] uppercase tracking-widest text-proton-grey underline underline-offset-4 hover:text-proton-black transition-colors duration-200 p-3 -mr-3"
        aria-label={`Copy ${label}`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function OrderReceived() {
  const [snap, setSnap] = useState<Snapshot | null | undefined>(undefined)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BANK_ORDER_STORAGE_KEY)
      setSnap(raw ? (JSON.parse(raw) as Snapshot) : null)
    } catch {
      setSnap(null)
    }
  }, [])

  useEffect(() => {
    if (!snap) return
    const { receipt, items } = snap
    const guardKey = `pl-purchase-${receipt.id}`
    try { if (sessionStorage.getItem(guardKey)) return } catch { /* storage blocked — fire once anyway */ }
    const value = parseFloat(receipt.amount)
    trackMetaEvent(
      'Purchase',
      {
        value,
        currency: 'GBP',
        content_ids: items.map(i => i.id),
        contents: items.map(i => ({ id: i.id, quantity: i.quantity })),
        content_type: 'product',
        content_category: 'club-shop',
        num_items: items.reduce((n, i) => n + i.quantity, 0),
      },
      receipt.id
    )
    trackGaEvent('purchase', {
      transaction_id: receipt.id,
      value,
      currency: 'GBP',
      items: items.map(i => ({ item_id: i.id, item_name: i.name, item_category: 'club-shop', price: i.price, quantity: i.quantity })),
    })
    try { sessionStorage.setItem(guardKey, '1') } catch { /* ignore */ }
  }, [snap])

  if (snap === undefined) return null

  if (!snap) {
    return (
      <div className="max-w-lg mx-auto px-6 py-32 text-center">
        <p className="font-playfair text-4xl text-proton-black mb-4">Order received.</p>
        <p className="text-sm text-proton-grey leading-relaxed mb-10">
          Thank you for your order. Our account details and your payment reference are in the email we&apos;ve
          sent you — reply to it if anything is unclear.
        </p>
        <Link href="/custom/club" className="text-[10px] uppercase tracking-widest text-proton-grey underline underline-offset-4 hover:text-proton-black transition-colors duration-200">
          Back to club shops
        </Link>
      </div>
    )
  }

  const { receipt } = snap
  const payBy = new Date(receipt.payBy).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const nextStep =
    receipt.delivery === 'club'
      ? `Once your payment arrives your kit joins the ${receipt.club} order and is delivered to the club for collection — nothing to post.`
      : receipt.delivery === 'collection'
        ? `Once your payment arrives your kit joins the ${receipt.club} order and goes to the committee for you to collect.`
        : 'Once your payment arrives your kit joins the club order, and we’ll email you when it ships.'

  return (
    <div className="max-w-lg mx-auto px-6 py-24 md:py-32">
      <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-3">{receipt.ref}</p>
      <p className="font-playfair text-4xl text-proton-black mb-4">Order received.</p>
      <p className="text-sm text-proton-black leading-relaxed mb-8">
        To confirm it, please pay <strong>£{receipt.amount}</strong> by bank transfer by <strong>{payBy}</strong> using
        the reference below. We match payments to orders by that reference, so copy it exactly.
      </p>

      <div className="border-t border-proton-light mb-8">
        <CopyField label="Payment reference" value={receipt.payRef} bold />
        <CopyField label="Amount" value={`£${receipt.amount}`} bold />
        <CopyField label="Account name" value={receipt.bank.accountName} />
        <CopyField label="Sort code" value={receipt.bank.sortCode} />
        <CopyField label="Account number" value={receipt.bank.accountNumber} />
        {receipt.bank.iban && <CopyField label="IBAN" value={receipt.bank.iban} />}
        {receipt.bank.bic && <CopyField label="BIC" value={receipt.bank.bic} />}
      </div>

      <p className="text-sm text-proton-grey leading-relaxed mb-4">
        {receipt.emailed
          ? <>We&apos;ve emailed these details to <span className="text-proton-black">{receipt.email}</span>.</>
          : <>We couldn&apos;t send the confirmation email just now — please keep these details; we&apos;ll resend it shortly.</>}
      </p>
      <p className="text-sm text-proton-grey leading-relaxed mb-10">
        {nextStep} Orders still unpaid after {payBy} may be cancelled.
      </p>

      <Link
        href={receipt.clubHandle ? `/custom/club/${receipt.clubHandle}` : '/custom/club'}
        className="text-[10px] uppercase tracking-widest text-proton-grey underline underline-offset-4 hover:text-proton-black transition-colors duration-200"
      >
        Back to the {receipt.club} shop
      </Link>
    </div>
  )
}
