import React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  full?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, full, children, disabled, ...props }, ref) => {
    const v = {
      primary:  'dls-btn dls-btn-primary',
      secondary:'dls-btn dls-btn-secondary',
      ghost:    'dls-btn dls-btn-ghost',
      danger:   'dls-btn dls-btn-danger',
      gold:     'dls-btn dls-btn-gold',
      outline:  'dls-btn dls-btn-secondary',
    }[variant]

    const s = { sm: 'dls-btn-sm', md: '', lg: 'dls-btn-lg' }[size]

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(v, s, full && 'dls-btn-full', className)}
        {...props}
      >
        {loading && <span className="dls-spinner dls-spinner-sm" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
export default Button
