import React from 'react'
import { cn } from '../../lib/utils'

type DivProps = React.HTMLAttributes<HTMLDivElement>

export const Card = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...p }, ref) => (
    <div ref={ref} className={cn('dls-card', className)} {...p} />
  )
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...p }, ref) => (
    <div ref={ref} className={cn('p-5 border-b', className)}
      style={{ borderColor: 'rgba(91,29,176,0.25)' }} {...p} />
  )
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...p }, ref) => (
    <h3 ref={ref} className={cn('text-base font-semibold text-white', className)} {...p} />
  )
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...p }, ref) => (
    <p ref={ref} className={cn('text-xs mt-0.5', className)}
      style={{ color: '#64748B' }} {...p} />
  )
)
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...p }, ref) => (
    <div ref={ref} className={cn('p-5', className)} {...p} />
  )
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className, ...p }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0 flex items-center gap-3', className)} {...p} />
  )
)
CardFooter.displayName = 'CardFooter'
