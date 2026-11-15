import React, { useMemo } from 'react';

interface QrMatrixSvgProps {
  value: string;
  size?: number;
  label?: string;
}

/**
 * Deterministic 21x21 verification matrix SVG with standard 7x7 corner finder squares.
 * Zero external image dependencies.
 */
export function QrMatrixSvg({ value, size = 104, label = 'Verification QR Code' }: QrMatrixSvgProps) {
  const cells = useMemo(() => {
    const dim = 21;
    const grid: boolean[][] = Array.from({ length: dim }, () => Array(dim).fill(false));

    const drawFinder = (top: number, left: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[top + r][left + c] = onBorder || inCore;
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, dim - 7);
    drawFinder(dim - 7, 0);

    // Timing patterns
    for (let i = 8; i < dim - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Deterministic FNV-1a-like seeded fill for data region
    let seed = 2166136261;
    for (let i = 0; i < value.length; i++) {
      seed ^= value.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }

    const isFinderZone = (r: number, c: number) =>
      (r < 8 && c < 8) ||
      (r < 8 && c >= dim - 8) ||
      (r >= dim - 8 && c < 8) ||
      r === 6 ||
      c === 6;

    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        if (isFinderZone(r, c)) continue;
        seed ^= (r * 31 + c * 17 + 7) & 0xff;
        seed = Math.imul(seed, 16777619);
        grid[r][c] = ((seed >>> 24) & 1) === 1;
      }
    }

    const rects: Array<{ x: number; y: number }> = [];
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        if (grid[r][c]) rects.push({ x: c, y: r });
      }
    }
    return rects;
  }, [value]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 23 23"
      role="img"
      aria-label={label}
      className="rounded-lg bg-white p-1.5 border border-slate-200 dark:border-slate-700 shrink-0"
    >
      <rect width="23" height="23" fill="#ffffff" />
      <g transform="translate(1,1)" fill="#0F172A">
        {cells.map((cell, idx) => (
          <rect key={idx} x={cell.x} y={cell.y} width={0.92} height={0.92} rx={0.12} />
        ))}
      </g>
    </svg>
  );
}
