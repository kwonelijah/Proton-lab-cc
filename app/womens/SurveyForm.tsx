'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// ─── QUESTIONS — edit everything in this block ───────────────────────────────

const RIDING_OPTIONS = ['Road', 'Gravel', 'MTB', 'Indoor', 'Racing']

const WARDROBE_OPTIONS = [
  { key: 'womens-only', label: "Yes, I only use women's kit" },
  { key: 'mix', label: "Yes, I use a mix of women's and unisex" },
  { key: 'unisex-only', label: 'No, I currently only use unisex cycling kit' },
]

// Two photo slots — swap `src` for your length photos as they're ready;
// tiles with src: null render as a grey "photo coming" placeholder.
const BIB_LENGTH_OPTIONS: { key: string; label: string; sub: string; src: string | null }[] = [
  { key: 'above-knee', label: 'Just above the knee', sub: 'Traditional unisex short length', src: '/images/womens/bib-above-knee.jpg' },
  { key: 'short', label: 'Short', sub: '4cm shorter inseam', src: '/images/womens/bib-short.jpg' },
]
// Third, open option under the two photos.
const BIB_CUSTOM_PROMPT = 'Shorter or longer? You tell us.'

// Strap styles — tap tiles in order of preference (first tap = favourite).
// Swap `src` for your strap-style photos as they're ready.
const STRAP_RANK_OPTIONS: { key: string; label: string; src: string | null }[] = [
  { key: 'traditional', label: 'Traditional', src: '/images/womens/strap-traditional.jpg' },
  { key: 'clip', label: 'Clip', src: '/images/womens/strap-clip.jpg' },
  { key: 'cross-back', label: 'Cross-back', src: '/images/womens/strap-cross-back.jpg' },
  { key: 'drop-tail', label: 'Drop-Tail', src: '/images/womens/strap-drop-tail.jpg' },
]

// Sleeve slider — a real arm photo, shoulder at the top. Swap `src` to change
// the photo. The anchors below name points down the arm: top / left / width
// are % of the image. The slider moves smoothly between the first and last
// anchor in SLEEVE_INCREMENTS steps; the chip shows the nearest anchor label.
const SLEEVE_IMAGE: string | null = '/images/womens/sleeve-arm.jpg'
const SLEEVE_STOPS = [
  { label: 'Short', top: 35.5, left: 27, width: 40 },
  { label: 'Mid bicep', top: 58, left: 30.5, width: 32 },
  { label: 'Elbow length', top: 74.5, left: 34, width: 25.5 },
]
const SLEEVE_INCREMENTS = 15

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

// ─── END QUESTIONS ───────────────────────────────────────────────────────────

const inputClasses =
  'w-full bg-transparent border-b border-proton-mid text-proton-black text-sm py-3 outline-none focus:border-proton-black focus-visible:ring-1 focus-visible:ring-proton-black focus-visible:ring-offset-1 transition-colors duration-200 placeholder:text-proton-grey'

const textareaClasses =
  'w-full bg-transparent border border-proton-mid text-proton-black text-sm p-4 leading-relaxed outline-none focus:border-proton-black focus-visible:ring-1 focus-visible:ring-proton-black focus-visible:ring-offset-1 transition-colors duration-200 placeholder:text-proton-grey'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs md:text-sm font-bold uppercase tracking-widest text-proton-black mb-4">
      {children}
    </p>
  )
}

function TapGroup({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
  multi?: boolean
}) {
  const toggle = (opt: string) => {
    if (multi) onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])
    else onChange(value.includes(opt) ? [] : [opt])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(opt)}
            className={cn(
              'h-11 px-4 border text-xs uppercase tracking-widest transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2',
              selected
                ? 'bg-proton-black text-proton-white border-proton-black'
                : 'bg-transparent text-proton-black border-proton-mid hover:border-proton-black'
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// Full-width option cards, with an optional sub-description line.
function ChoiceCards({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; sub?: string }[]
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="space-y-3">
      {options.map((opt) => {
        const selected = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? '' : opt.key)}
            className={cn(
              'w-full text-left border px-5 py-4 transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2',
              selected
                ? 'bg-proton-black border-proton-black'
                : 'bg-transparent border-proton-mid hover:border-proton-black'
            )}
          >
            <span
              className={cn(
                'block text-xs uppercase tracking-widest',
                opt.sub && 'mb-1',
                selected ? 'text-proton-white' : 'text-proton-black'
              )}
            >
              {opt.label}
            </span>
            {opt.sub && (
              <span className={cn('block text-sm leading-relaxed', selected ? 'text-proton-mid' : 'text-proton-grey')}>
                {opt.sub}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Photo cards — single select, with a label + description bar under each photo.
function PhotoCards({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; sub: string; src: string | null }[]
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const selected = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? '' : opt.key)}
            className={cn(
              'text-left border transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2',
              selected ? 'border-proton-black' : 'border-proton-light hover:border-proton-mid'
            )}
          >
            {opt.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={opt.src} alt={opt.label} className="block w-full aspect-[4/5] object-cover" />
            ) : (
              <div className="w-full aspect-[4/5] bg-proton-light flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-widest text-proton-grey">
                  Photo coming
                </span>
              </div>
            )}
            <span className={cn('block px-3 py-3', selected ? 'bg-proton-black' : 'bg-transparent')}>
              <span
                className={cn(
                  'block text-[10px] uppercase tracking-widest mb-1',
                  selected ? 'text-proton-white' : 'text-proton-black'
                )}
              >
                {opt.label}
              </span>
              <span
                className={cn(
                  'block text-[11px] leading-snug',
                  selected ? 'text-proton-mid' : 'text-proton-grey'
                )}
              >
                {opt.sub}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Photo tiles ranked by tap order — first tap ranks 1, tap again to remove.
function RankTiles({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; src: string | null }[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key])
  }
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {options.map((tile) => {
          const rank = value.indexOf(tile.key)
          const selected = rank !== -1
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(tile.key)}
              className={cn(
                'relative text-left border transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2',
                selected ? 'border-proton-black' : 'border-proton-light hover:border-proton-mid'
              )}
            >
              {selected && (
                <span className="absolute top-2 left-2 z-10 inline-flex items-center justify-center h-7 w-7 bg-proton-black text-proton-white text-xs">
                  {rank + 1}
                </span>
              )}
              {tile.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.src} alt={tile.label} className="block w-full aspect-[4/5] object-cover" />
              ) : (
                <div className="w-full aspect-[4/5] bg-proton-light flex items-center justify-center">
                  <span className="text-[10px] uppercase tracking-widest text-proton-grey">
                    Photo coming
                  </span>
                </div>
              )}
              <span
                className={cn(
                  'block px-3 py-2.5 text-[10px] uppercase tracking-widest',
                  selected ? 'bg-proton-black text-proton-white' : 'text-proton-black'
                )}
              >
                {tile.label}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-proton-grey mt-3">
        Tap in order of preference. First tap is your favourite, tap again to remove.
      </p>
    </div>
  )
}

// Position of slider increment v: the hem line interpolates smoothly between
// the anchors in SLEEVE_STOPS; the label is the nearest anchor's.
function sleeveAt(v: number) {
  const first = SLEEVE_STOPS[0]
  const last = SLEEVE_STOPS[SLEEVE_STOPS.length - 1]
  const top = first.top + ((last.top - first.top) * v) / SLEEVE_INCREMENTS
  let a = first
  let b = last
  for (let i = 0; i < SLEEVE_STOPS.length - 1; i++) {
    if (top >= SLEEVE_STOPS[i].top && top <= SLEEVE_STOPS[i + 1].top) {
      a = SLEEVE_STOPS[i]
      b = SLEEVE_STOPS[i + 1]
      break
    }
  }
  const f = b.top === a.top ? 0 : (top - a.top) / (b.top - a.top)
  const nearest = SLEEVE_STOPS.reduce((p, c) =>
    Math.abs(c.top - top) < Math.abs(p.top - top) ? c : p
  )
  return {
    top,
    left: a.left + (b.left - a.left) * f,
    width: a.width + (b.width - a.width) * f,
    label: nearest.label,
    pct: Math.round((v / SLEEVE_INCREMENTS) * 100),
  }
}

// Anchor's position on the slider track, for the tappable labels.
function sleeveAnchorValue(stop: (typeof SLEEVE_STOPS)[number]) {
  const first = SLEEVE_STOPS[0]
  const last = SLEEVE_STOPS[SLEEVE_STOPS.length - 1]
  return Math.round(((stop.top - first.top) / (last.top - first.top)) * SLEEVE_INCREMENTS)
}

// Sleeve-length picker — a hem line moves down a real arm photo as the
// slider moves. Slider right = longer sleeve.
function SleeveSlider({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const pos = sleeveAt(value)
  return (
    <div>
      <div className="relative max-w-[280px] md:max-w-[320px] mx-auto">
        {SLEEVE_IMAGE ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={SLEEVE_IMAGE}
            alt="Arm photo showing where each sleeve length ends"
            className="block w-full"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-proton-light flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-widest text-proton-grey">
              Photo coming
            </span>
          </div>
        )}

        {/* hem marker line */}
        <div
          className="absolute pointer-events-none transition-all duration-150 ease-out"
          style={{ top: `${pos.top}%`, left: `${pos.left}%`, width: `${pos.width}%` }}
        >
          <div className="h-[3px] bg-proton-black shadow-[0_0_0_1px_rgba(250,250,250,0.85)]" />
        </div>

        {/* label chip beside the line */}
        <span
          className="absolute pointer-events-none -translate-y-1/2 ml-2 bg-proton-white/90 border border-proton-light px-2 py-1 text-[10px] uppercase tracking-widest text-proton-black whitespace-nowrap transition-all duration-150 ease-out"
          style={{ top: `${pos.top}%`, left: `${pos.left + pos.width}%` }}
        >
          {pos.label}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={SLEEVE_INCREMENTS}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Sleeve length"
        aria-valuetext={pos.label}
        className="w-full mt-4 accent-black cursor-pointer"
      />
      <div className="flex justify-between mt-2">
        {SLEEVE_STOPS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onChange(sleeveAnchorValue(s))}
            className={cn(
              'text-[10px] uppercase tracking-widest transition-colors duration-200',
              s.label === pos.label ? 'text-proton-black' : 'text-proton-grey hover:text-proton-black'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SurveyForm() {
  const [riding, setRiding] = useState<string[]>([])
  const [wardrobe, setWardrobe] = useState('')
  const [bibLength, setBibLength] = useState('')
  const [bibCustom, setBibCustom] = useState('')
  const [strapRank, setStrapRank] = useState<string[]>([])
  const [sleeve, setSleeve] = useState(8) // starts at Classic short
  const [frustrations, setFrustrations] = useState('')
  const [favourites, setFavourites] = useState('')
  // sizing (both optional)
  const [size, setSize] = useState<string[]>([])
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>('cm')
  const [heightCm, setHeightCm] = useState('')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')
  // contact
  const [email, setEmail] = useState('')
  const [optOut, setOptOut] = useState(false)
  const [website, setWebsite] = useState('') // honeypot

  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/womens-survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ridingTypes: riding,
        womensKit: wardrobe,
        bibLength,
        bibLengthCustom: bibCustom,
        strapRank,
        sleeve: sleeveAt(sleeve).label,
        sleevePct: sleeveAt(sleeve).pct,
        frustrations,
        favourites,
        size: size[0] ?? '',
        height:
          heightUnit === 'cm'
            ? heightCm.trim()
              ? `${heightCm.trim()} cm`
              : ''
            : heightFt.trim() || heightIn.trim()
              ? `${heightFt.trim() || '0'} ft ${heightIn.trim() || '0'} in`
              : '',
        email,
        updates: !optOut,
        website,
      }),
    }).catch(() => null)
    setLoading(false)
    if (res?.ok) setSubmitted(true)
    else setError('Something went wrong — please try again.')
  }

  if (submitted) {
    return (
      <div className="py-12">
        <p className="font-playfair text-3xl text-proton-black mb-4">Thank you.</p>
        <p className="text-sm text-proton-grey leading-relaxed">
          Your 20% code is on its way to your inbox.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-14">
      <div>
        <Eyebrow>What type of riding do you do? Pick all that apply</Eyebrow>
        <TapGroup options={RIDING_OPTIONS} value={riding} onChange={setRiding} multi />
      </div>

      <div>
        <Eyebrow>Do you currently have any women&apos;s-specific kit in your wardrobe?</Eyebrow>
        <ChoiceCards options={WARDROBE_OPTIONS} value={wardrobe} onChange={setWardrobe} />
      </div>

      <div>
        <Eyebrow>Preferred bib short length</Eyebrow>
        <PhotoCards options={BIB_LENGTH_OPTIONS} value={bibLength} onChange={setBibLength} />
        <div className="border border-proton-light px-3 py-3 mt-3">
          <span className="block text-[10px] uppercase tracking-widest text-proton-black mb-1">
            {BIB_CUSTOM_PROMPT}
          </span>
          <input
            type="text"
            value={bibCustom}
            onChange={(e) => setBibCustom(e.target.value)}
            placeholder="Tell us the length you actually want"
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <Eyebrow>Preferred strap style, ranked</Eyebrow>
        <RankTiles options={STRAP_RANK_OPTIONS} value={strapRank} onChange={setStrapRank} />
      </div>

      <div>
        <Eyebrow>Sleeve length: slide to where you&apos;d want the hem</Eyebrow>
        <SleeveSlider value={sleeve} onChange={setSleeve} />
      </div>

      <div>
        <Eyebrow>
          Tell us what you&apos;re looking for. What issues and frustrations do
          you have with your current kit?
        </Eyebrow>
        <textarea
          rows={3}
          value={frustrations}
          onChange={(e) => setFrustrations(e.target.value)}
          className={textareaClasses}
        />
      </div>

      <div>
        <Eyebrow>
          Your favourites at the moment. What features do you love and buy
          every time.
        </Eyebrow>
        <textarea
          rows={3}
          value={favourites}
          onChange={(e) => setFavourites(e.target.value)}
          className={textareaClasses}
        />
      </div>

      <div>
        <Eyebrow>What size do you normally wear? (optional)</Eyebrow>
        <TapGroup options={SIZE_OPTIONS} value={size} onChange={setSize} />
      </div>

      <div>
        <Eyebrow>Height (optional)</Eyebrow>
        <div className="flex gap-2 mb-4">
          {(['cm', 'ftin'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              aria-pressed={heightUnit === unit}
              onClick={() => setHeightUnit(unit)}
              className={cn(
                'h-11 px-4 border text-xs uppercase tracking-widest transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2',
                heightUnit === unit
                  ? 'bg-proton-black text-proton-white border-proton-black'
                  : 'bg-transparent text-proton-black border-proton-mid hover:border-proton-black'
              )}
            >
              {unit === 'cm' ? 'cm' : 'ft + in'}
            </button>
          ))}
        </div>
        {heightUnit === 'cm' ? (
          <div className="flex items-baseline gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={100}
              max={230}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              aria-label="Height in centimetres"
              className={cn(inputClasses, 'max-w-[120px]')}
            />
            <span className="text-sm text-proton-grey">cm</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={3}
              max={7}
              value={heightFt}
              onChange={(e) => setHeightFt(e.target.value)}
              aria-label="Height, feet"
              className={cn(inputClasses, 'max-w-[80px]')}
            />
            <span className="text-sm text-proton-grey">ft</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={11}
              value={heightIn}
              onChange={(e) => setHeightIn(e.target.value)}
              aria-label="Height, inches"
              className={cn(inputClasses, 'max-w-[80px]')}
            />
            <span className="text-sm text-proton-grey">in</span>
          </div>
        )}
      </div>

      <div className="border-t border-proton-light pt-10">
        <Eyebrow>Where should we send your 20% code?</Eyebrow>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className={inputClasses}
        />
        <p className="text-sm text-proton-grey leading-relaxed mt-6">
          We&apos;ll keep you posted on the women&apos;s line. First look,
          first sizes.
        </p>
        <label className="flex items-start gap-3 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={optOut}
            onChange={(e) => setOptOut(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-black"
          />
          <span className="text-sm text-proton-grey leading-relaxed">
            I&apos;d rather not receive updates.
          </span>
        </label>
      </div>

      {/* Honeypot — bots fill this, humans never see it */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div>
        <Button type="submit" disabled={loading || !email}>
          {loading ? 'Sending…' : 'Send answers'}
        </Button>
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        <p className="text-[11px] text-proton-grey leading-relaxed mt-8">
          Your answers are stored for product development. Your email is used to
          send the code and, only if ticked, women&apos;s-line updates.
          Unsubscribe any time.
        </p>
      </div>
    </form>
  )
}
