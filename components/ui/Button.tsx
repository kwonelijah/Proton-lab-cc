import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  onClick?: () => void
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const variants = {
  primary:
    'bg-proton-black text-proton-white border border-proton-black hover:bg-proton-grey hover:border-proton-grey',
  secondary:
    'bg-transparent text-proton-black border border-proton-black hover:bg-proton-black hover:text-proton-white',
  ghost:
    'bg-transparent text-proton-black underline-offset-4 hover:underline p-0',
}

const sizes = {
  sm: 'px-4 py-2 text-xs tracking-widest',
  md: 'px-6 py-3 text-xs tracking-widest',
  lg: 'px-8 py-4 text-sm tracking-widest',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  onClick,
  className,
  disabled,
  type = 'button',
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center uppercase font-inter transition-all duration-300',
    variant !== 'ghost' && sizes[size],
    variants[variant],
    disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
    className
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  )
}
