import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('skeleton', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="card card-md animate-pulse">
      <div className="flex items-start gap-4">
        <Skeleton className="w-10 h-10 rounded-md shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="card card-md animate-pulse">
      <div className="flex items-start gap-4">
        <Skeleton className="w-10 h-10 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16 mt-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-neutral-100 animate-pulse">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkeletonStat key={i} />)}
      </div>
      <div className="card">
        {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  );
}
