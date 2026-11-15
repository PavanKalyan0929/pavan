import React, { useEffect, useState } from 'react';
import { Building2, Camera, ExternalLink, ShieldCheck } from 'lucide-react';

interface InstitutionalPhotoFrameProps {
  src?: string | null;
  alt: string;
  aspectClass?: string;
  className?: string;
  categoryLabel?: string;
  collegeName?: string;
  caption?: string;
  sourceUrl?: string;
  licenseOrPermission?: string;
  isVerified?: boolean;
  showAttributionBar?: boolean;
  compact?: boolean;
}

export function InstitutionalPhotoFrame({
  src,
  alt,
  aspectClass = 'aspect-[16/10]',
  className = '',
  categoryLabel,
  collegeName,
  caption,
  sourceUrl,
  licenseOrPermission,
  isVerified = true,
  showAttributionBar = false,
  compact = false,
}: InstitutionalPhotoFrameProps) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  const hasValidSrc = Boolean(src && src.trim().length > 0 && !errored);

  if (!hasValidSrc) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-50 via-blue-50/40 to-violet-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 flex flex-col items-center justify-center text-center ${
          compact ? 'p-4' : 'p-6'
        } ${aspectClass} ${className}`}
      >
        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-2.5 shadow-sm">
          {categoryLabel ? (
            <Camera className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" />
          ) : (
            <Building2 className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" />
          )}
        </div>
        <div
          className={`font-display font-bold text-slate-800 dark:text-slate-100 ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          Official college photograph coming soon.
        </div>
        {(collegeName || categoryLabel) && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
            {[collegeName, categoryLabel].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col ${className}`}
    >
      <div className={`relative w-full overflow-hidden bg-slate-100 dark:bg-slate-800 ${aspectClass}`}>
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="w-full h-full object-cover"
        />
        {categoryLabel && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-slate-950/75 text-white text-[11px] font-medium backdrop-blur-sm">
            {categoryLabel}
          </div>
        )}
        {isVerified && (
          <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-950/80 text-emerald-200 text-[11px] font-semibold backdrop-blur-sm">
            <ShieldCheck className="w-3 h-3" />
            Verified Source
          </div>
        )}
      </div>

      {showAttributionBar && (caption || sourceUrl || licenseOrPermission || collegeName) && (
        <div className="px-3.5 py-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
          {caption && (
            <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
              {caption}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="truncate">
              {collegeName ? `${collegeName}` : ''}
              {collegeName && licenseOrPermission ? ' · ' : ''}
              {licenseOrPermission || ''}
            </span>
            {sourceUrl && sourceUrl.startsWith('http') && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#1E40AF] dark:text-blue-400 hover:underline shrink-0"
              >
                Source
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
