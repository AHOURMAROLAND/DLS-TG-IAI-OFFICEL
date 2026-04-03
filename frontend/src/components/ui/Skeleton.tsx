import { cn } from '../../lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'title' | 'badge' | 'avatar' | 'row' | 'card'
  width?: string
}

export function Skeleton({ className, variant = 'text', width }: SkeletonProps) {
  return (
    <div
      className={cn('dls-skeleton', `dls-skeleton-${variant}`, className)}
      style={width ? { width } : undefined}
    />
  )
}

/** Squelette d'une ligne de tableau (joueur, match, classement) */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton variant="avatar" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton variant="title" width="50%" />
        <Skeleton variant="text" width="35%" />
      </div>
      <Skeleton variant="badge" />
    </div>
  )
}

/** Squelette d'un tableau de classement */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="dls-card overflow-hidden">
      {/* Header */}
      <div className="flex gap-3 p-3 border-b" style={{ borderColor: 'rgba(91,29,176,0.15)' }}>
        {[20, 40, 10, 10, 10, 10, 10].map((w, i) => (
          <Skeleton key={i} variant="badge" width={`${w}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ borderBottom: '1px solid rgba(91,29,176,0.08)' }}>
          <SkeletonRow />
        </div>
      ))}
    </div>
  )
}

/** Squelette d'une grille de cards */
export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  )
}

/** Squelette d'une liste de matchs */
export function SkeletonMatchList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dls-card p-4 flex items-center gap-3">
          <Skeleton variant="avatar" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton variant="title" width="60%" />
            <Skeleton variant="text" width="40%" />
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Skeleton variant="badge" width="3rem" />
            <Skeleton variant="text" width="2rem" />
          </div>
        </div>
      ))}
    </div>
  )
}
