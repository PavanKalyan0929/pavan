import React from 'react';

interface AcademicProgressBarProps {
  value: number;
  max?: number;
  thresholdPct?: number;
  tone?: 'emerald' | 'amber' | 'red' | 'blue' | 'violet';
  label?: string;
  heightClass?: string;
}

const TONE_FILL: Record<NonNullable<AcademicProgressBarProps['tone']>, string> = {
  emerald: 'bg-emerald-600 dark:bg-emerald-500',
  amber: 'bg-amber-500 dark:bg-amber-400',
  red: 'bg-red-600 dark:bg-red-500',
  blue: 'bg-[#1E40AF] dark:bg-blue-500',
  violet: 'bg-[#5B21B6] dark:bg-violet-500',
};

export function AcademicProgressBar({
  value,
  max = 100,
  thresholdPct,
  tone = 'blue',
  label,
  heightClass = 'h-2',
}: AcademicProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const clampedPct = Math.max(0, Math.min(100, (value / safeMax) * 100));

  return (
    <div
      role="progressbar"
      aria-label={label || 'Academic progress'}
      aria-valuenow={Math.round(clampedPct * 10) / 10}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`relative w-full ${heightClass} rounded-full bg-slate-100 dark:bg-slate-800 overflow-visible`}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${TONE_FILL[tone]}`}
        style={{ width: `${clampedPct}%` }}
      />
      {typeof thresholdPct === 'number' && thresholdPct > 0 && thresholdPct < 100 && (
        <span
          title={`Minimum threshold: ${thresholdPct}%`}
          aria-hidden="true"
          className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-slate-700 dark:bg-slate-200 opacity-75"
          style={{ left: `${thresholdPct}%` }}
        />
      )}
    </div>
  );
}
