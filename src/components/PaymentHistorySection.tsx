import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, IndianRupee, Receipt, TrendingUp } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.tsx';
import type { FeeReceiptPreviewTarget } from './FeeReceiptPreview.tsx';
import type { FeePayment, FeeRecord, StudentProfile } from '../types.ts';

interface PaymentHistorySectionProps {
  student: StudentProfile;
  feeRecords: FeeRecord[];
  feePayments: FeePayment[];
  onPreviewReceipt: (target: FeeReceiptPreviewTarget) => void;
  onDownloadPdf: (payment: FeePayment, feeRecord?: FeeRecord) => void;
  onLoadDemoSample: () => Promise<void> | void;
}

type ChartMode = 'semester' | 'cumulative';

interface SemesterTrendPoint {
  termLabel: string;
  academicYear: string;
  semester: string;
  totalFee: number;
  paidAmount: number;
  pendingAmount: number;
  cumulativePaid: number;
  paymentCount: number;
  isDemo: boolean;
}

interface TransactionTrendPoint {
  termLabel: string;
  receiptNumber: string;
  semester: string;
  paymentMode: string;
  paidAtLabel: string;
  amount: number;
  cumulativePaid: number;
  isDemo: boolean;
}

function getSemesterSortRank(semester: string): number {
  const normalized = semester.toLowerCase();
  const romanMatch = normalized.match(/\b(viii|vii|vi|iv|v|iii|ii|i)\b/);
  if (romanMatch) {
    const map: Record<string, number> = {
      i: 1,
      ii: 2,
      iii: 3,
      iv: 4,
      v: 5,
      vi: 6,
      vii: 7,
      viii: 8,
    };
    return map[romanMatch[1]] ?? 99;
  }
  const numMatch = normalized.match(/\d+/);
  if (numMatch) {
    return Number(numMatch[0]);
  }
  return 99;
}

function getTimestampMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null) {
    const maybeToDate = (ts as { toDate?: () => Date }).toDate;
    if (typeof maybeToDate === 'function') {
      return maybeToDate.call(ts).getTime();
    }
    const maybeSeconds = (ts as { seconds?: unknown }).seconds;
    if (typeof maybeSeconds === 'number') {
      return maybeSeconds * 1000;
    }
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatAxisInr(value: number): string {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }
  if (value >= 1000) {
    return `₹${Math.round(value / 1000)}k`;
  }
  return `₹${value}`;
}

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: SemesterTrendPoint | TransactionTrendPoint;
}

function PaymentTrendTooltip({
  active,
  payload,
  mode,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  mode: ChartMode;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm text-xs space-y-1.5 min-w-[210px]">
      <div className="font-display font-bold text-slate-900 dark:text-slate-100">
        {row.termLabel}
        {row.isDemo ? ' · DEMO' : ''}
      </div>
      {'academicYear' in row ? (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {row.academicYear} · {row.paymentCount} receipt(s)
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {row.receiptNumber} · {row.paymentMode} ({row.paidAtLabel})
        </div>
      )}
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">{entry.name}</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              ₹{Number(entry.value ?? 0).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
        {mode === 'semester' && 'cumulativePaid' in row && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Cumulative Paid</span>
            <span className="font-mono font-semibold text-[#1E40AF] dark:text-blue-400 tabular-nums">
              ₹{row.cumulativePaid.toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PaymentHistorySection({
  student,
  feeRecords,
  feePayments,
  onPreviewReceipt,
  onDownloadPdf,
  onLoadDemoSample,
}: PaymentHistorySectionProps) {
  const { isDark } = useTheme();
  const [chartMode, setChartMode] = useState<ChartMode>('semester');
  const [semesterFilter, setSemesterFilter] = useState<string>('All');
  const [modeFilter, setModeFilter] = useState<string>('All');

  const gridStroke = isDark ? '#334155' : '#E2E8F0';
  const tickFill = isDark ? '#94A3B8' : '#475569';
  const linePrimary = isDark ? '#60A5FA' : '#1E40AF';
  const linePaid = isDark ? '#4ADE80' : '#15803D';
  const linePending = isDark ? '#FBBF24' : '#D97706';

  const feeRecordById = useMemo(() => {
    const map = new Map<string, FeeRecord>();
    for (const rec of feeRecords) {
      map.set(rec.id, rec);
    }
    return map;
  }, [feeRecords]);

  const sortedFeeRecords = useMemo(() => {
    return [...feeRecords].sort((a, b) => {
      const yearCmp = a.academicYear.localeCompare(b.academicYear);
      if (yearCmp !== 0) return yearCmp;
      const semDiff = getSemesterSortRank(a.semester) - getSemesterSortRank(b.semester);
      if (semDiff !== 0) return semDiff;
      return getTimestampMs(a.createdAt) - getTimestampMs(b.createdAt);
    });
  }, [feeRecords]);

  const sortedPaymentsAsc = useMemo(() => {
    return [...feePayments].sort((a, b) => {
      const recA = feeRecordById.get(a.feeRecordId);
      const recB = feeRecordById.get(b.feeRecordId);
      if (recA && recB) {
        const yearCmp = recA.academicYear.localeCompare(recB.academicYear);
        if (yearCmp !== 0) return yearCmp;
        const semDiff = getSemesterSortRank(recA.semester) - getSemesterSortRank(recB.semester);
        if (semDiff !== 0) return semDiff;
      }
      const timeDiff = getTimestampMs(a.createdAt) - getTimestampMs(b.createdAt);
      if (timeDiff !== 0) return timeDiff;
      return a.receiptNumber.localeCompare(b.receiptNumber);
    });
  }, [feePayments, feeRecordById]);

  const semesterTrendData = useMemo<SemesterTrendPoint[]>(() => {
    let runningPaid = 0;
    const grouped = new Map<
      string,
      {
        academicYear: string;
        semester: string;
        totalFee: number;
        paidAmount: number;
        pendingAmount: number;
        paymentCount: number;
        isDemo: boolean;
      }
    >();

    for (const rec of sortedFeeRecords) {
      const key = `${rec.academicYear}__${rec.semester}`;
      const linkedPayments = feePayments.filter((p) => p.feeRecordId === rec.id);
      const existing = grouped.get(key);
      if (existing) {
        existing.totalFee += rec.totalFee;
        existing.paidAmount += rec.paidAmount;
        existing.pendingAmount += rec.pendingAmount;
        existing.paymentCount += linkedPayments.length;
        existing.isDemo = existing.isDemo || rec.isDemo;
      } else {
        grouped.set(key, {
          academicYear: rec.academicYear,
          semester: rec.semester,
          totalFee: rec.totalFee,
          paidAmount: rec.paidAmount,
          pendingAmount: rec.pendingAmount,
          paymentCount: linkedPayments.length,
          isDemo: rec.isDemo,
        });
      }
    }

    return Array.from(grouped.values()).map((entry) => {
      runningPaid += entry.paidAmount;
      return {
        termLabel: `${entry.semester} (${entry.academicYear})`,
        academicYear: entry.academicYear,
        semester: entry.semester,
        totalFee: entry.totalFee,
        paidAmount: entry.paidAmount,
        pendingAmount: entry.pendingAmount,
        cumulativePaid: runningPaid,
        paymentCount: entry.paymentCount,
        isDemo: entry.isDemo,
      };
    });
  }, [sortedFeeRecords, feePayments]);

  const transactionTrendData = useMemo<TransactionTrendPoint[]>(() => {
    let runningPaid = 0;
    return sortedPaymentsAsc.map((pay, idx) => {
      runningPaid += pay.amount;
      const linked = feeRecordById.get(pay.feeRecordId);
      const semLabel = linked ? linked.semester : `Txn ${idx + 1}`;
      return {
        termLabel: `${semLabel} · #${idx + 1}`,
        receiptNumber: pay.receiptNumber,
        semester: linked ? `${linked.semester} (${linked.academicYear})` : 'Unlinked Term',
        paymentMode: pay.paymentMode,
        paidAtLabel: pay.paidAtLabel,
        amount: pay.amount,
        cumulativePaid: runningPaid,
        isDemo: pay.isDemo,
      };
    });
  }, [sortedPaymentsAsc, feeRecordById]);

  const semesterOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const rec of sortedFeeRecords) {
      unique.add(`${rec.semester} (${rec.academicYear})`);
    }
    return ['All', ...Array.from(unique)];
  }, [sortedFeeRecords]);

  const paymentModeOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const pay of feePayments) {
      unique.add(pay.paymentMode);
    }
    return ['All', ...Array.from(unique)];
  }, [feePayments]);

  const filteredPaymentsDesc = useMemo(() => {
    return [...sortedPaymentsAsc].reverse().filter((pay) => {
      const linked = feeRecordById.get(pay.feeRecordId);
      const termLabel = linked ? `${linked.semester} (${linked.academicYear})` : 'Unlinked Term';
      if (semesterFilter !== 'All' && termLabel !== semesterFilter) return false;
      if (modeFilter !== 'All' && pay.paymentMode !== modeFilter) return false;
      return true;
    });
  }, [sortedPaymentsAsc, feeRecordById, semesterFilter, modeFilter]);

  const totalBilled = feeRecords.reduce((acc, r) => acc + r.totalFee, 0);
  const totalPaid = feeRecords.reduce((acc, r) => acc + r.paidAmount, 0);
  const totalPending = feeRecords.reduce((acc, r) => acc + r.pendingAmount, 0);
  const totalRecordedTxns = feePayments.reduce((acc, p) => acc + p.amount, 0);
  const hasAnyDemo = feeRecords.some((r) => r.isDemo) || feePayments.some((p) => p.isDemo);
  const latestPayment = sortedPaymentsAsc[sortedPaymentsAsc.length - 1];

  if (feeRecords.length === 0 && feePayments.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-4">
        <TrendingUp className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          No payment history available yet
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          Multi-semester fee payment trends and transaction receipts appear automatically as your
          College Administrator records semester ledgers and payments. Andhra Student Hub never
          fabricates official student balances.
        </p>
        <button
          type="button"
          onClick={onLoadDemoSample}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 cursor-pointer"
        >
          Load Clearly-Labelled DEMO Fee Sample
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasAnyDemo && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-300">
          DEMO DATA NOTICE: Entries marked DEMO are illustrative sample records for workflow and
          trend testing, not official institutional fee obligations.
        </div>
      )}

      {/* Financial Overview KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Paid Across Terms</div>
          <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
            ₹{totalPaid.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
            {semesterTrendData.length} semester(s) tracked
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
          <div className="text-xs text-slate-500 dark:text-slate-400">Cumulative Billed</div>
          <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
            ₹{totalBilled.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
            {totalBilled > 0 ? `${Math.round((totalPaid / totalBilled) * 100)}% cleared` : '—'}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
          <div className="text-xs text-slate-500 dark:text-slate-400">Pending Balance</div>
          <div className="font-mono text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
            ₹{totalPending.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Across active ledgers</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
          <div className="text-xs text-slate-500 dark:text-slate-400">Recorded Receipts</div>
          <div className="font-mono text-2xl font-bold text-[#1E40AF] dark:text-blue-400 tabular-nums mt-1">
            {feePayments.length}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
            {latestPayment
              ? `Latest: ${latestPayment.paymentMode} (₹${totalRecordedTxns.toLocaleString('en-IN')})`
              : 'No payment receipts yet'}
          </div>
        </div>
      </div>

      {/* Multi-Semester Line Chart Visualization */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Multi-Semester Fee Payment Trends
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {chartMode === 'semester'
                ? 'Tracks billed fee, paid amount, and pending balance across academic terms.'
                : 'Tracks individual payment amounts and running cumulative payments chronologically.'}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartMode('semester')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-colors ash-btn-press ${
                chartMode === 'semester'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semester Trend
            </button>
            <button
              type="button"
              onClick={() => setChartMode('cumulative')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-colors ash-btn-press ${
                chartMode === 'cumulative'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cumulative Payments
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={chartMode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {chartMode === 'semester' ? (
              semesterTrendData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
              No semester ledger records available to plot.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={semesterTrendData}
                  margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="termLabel" tick={{ fontSize: 11, fill: tickFill }} />
                  <YAxis
                    tickFormatter={formatAxisInr}
                    tick={{ fontSize: 11, fill: tickFill }}
                    width={58}
                  />
                  <Tooltip content={<PaymentTrendTooltip mode="semester" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: tickFill }} />
                  <Line
                    type="monotone"
                    dataKey="totalFee"
                    name="Total Billed (₹)"
                    stroke={linePrimary}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: linePrimary }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="paidAmount"
                    name="Paid Amount (₹)"
                    stroke={linePaid}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: linePaid }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pendingAmount"
                    name="Pending Balance (₹)"
                    stroke={linePending}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: linePending }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )
        ) : transactionTrendData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
            No individual payment receipts recorded yet to plot cumulative transactions.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={transactionTrendData}
                margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="termLabel" tick={{ fontSize: 11, fill: tickFill }} />
                <YAxis
                  tickFormatter={formatAxisInr}
                  tick={{ fontSize: 11, fill: tickFill }}
                  width={58}
                />
                <Tooltip content={<PaymentTrendTooltip mode="cumulative" />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: tickFill }} />
                <Line
                  type="monotone"
                  dataKey="cumulativePaid"
                  name="Cumulative Paid (₹)"
                  stroke={linePrimary}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: linePrimary }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Transaction Amount (₹)"
                  stroke={linePaid}
                  strokeWidth={2}
                  dot={{ r: 4, fill: linePaid }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Filterable Chronological Transaction Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
              Payment Transactions & Official Receipts ({filteredPaymentsDesc.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect payment mode, semester mapping, print-ready preview, or download PDF receipts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              aria-label="Filter payments by semester"
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              {semesterOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'All' ? 'All Semesters' : opt}
                </option>
              ))}
            </select>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              aria-label="Filter payments by mode"
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              {paymentModeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'All' ? 'All Payment Modes' : opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {feePayments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <IndianRupee className="w-6 h-6 text-slate-400 dark:text-slate-500 mx-auto" />
            <div>No payment transactions recorded yet against your semester fee ledgers.</div>
          </div>
        ) : filteredPaymentsDesc.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              No payment receipts match the selected semester or payment mode filter.
            </div>
            <button
              type="button"
              onClick={() => {
                setSemesterFilter('All');
                setModeFilter('All');
              }}
              className="px-3 py-1.5 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">Receipt #</th>
                  <th className="px-4 py-3 font-semibold">Semester & Year</th>
                  <th className="px-4 py-3 font-semibold">Mode & Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount Paid</th>
                  <th className="px-4 py-3 font-semibold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPaymentsDesc.map((pay) => {
                  const linked = feeRecordById.get(pay.feeRecordId);
                  return (
                    <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {pay.receiptNumber}
                        {pay.isDemo ? ' · DEMO' : ''}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                        {linked ? `${linked.semester} · ${linked.academicYear}` : 'Institution Fee'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {pay.paymentMode} · {pay.paidAtLabel}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        ₹{pay.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              onPreviewReceipt({
                                kind: 'fee_receipt',
                                payment: pay,
                                feeRecord: linked,
                                student,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 ash-link-underline cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadPdf(pay, linked)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
