import React from 'react';
import { ColumnDef } from './DataTable';

// ==========================================
// 1. INTERFACES (snake_case relacional)
// ==========================================
export interface Top5Candidate {
  id?: number | string;
  created_at?: string;
  ticker: string;
  strategy?: string;
  close_price: number;
  score: number;
  target: number;
  stop_loss: number;
  strategy_props?: {
    rsi?: number | null;
    z_score?: number | null;
    atr_14?: number | null;
    [key: string]: any;
  };
}

export interface DiscardedItem {
  ticker: string;
  reason: string;
}

export interface ClosedTrade {
  id?: number | string;
  entry_date: string;
  ticker: string;
  strategy?: string;
  taken?: boolean;
  entry_price: number;
  target: number;
  stop_loss: number;
  status?: string;
  exit_date?: string | null;
  exit_price: number | null;
  exit_reason: string | null;
  pnl_percent: number | null;
  days_held: number | null;
  strategy_props?: Record<string, any>;
}

export interface LivePosition {
  id?: number | string;
  entry_date: string;
  ticker: string;
  strategy?: string;
  taken?: boolean;
  entry_price: number;
  target: number;
  stop_loss: number;
  status?: string;
  exit_price: number | null;
  exit_reason: string | null;
  pnl_percent: number | null;
  current_price?: number | null;
  days_held: number | null;
  strategy_props?: Record<string, any>;
}

// ==========================================
// 2. DEFINICIONES DE COLUMNAS (ColumnDef<T>[])
// ==========================================

export const top5Columns: ColumnDef<Top5Candidate>[] = [
  {
    header: 'Ticker',
    accessorKey: 'ticker',
    cell: (item) => <span className="font-bold text-gray-100">{item.ticker}</span>,
  },
  {
    header: 'CLOSE PRICE',
    accessorKey: 'close_price',
    cell: (item) => (item.close_price != null ? `$${Number(item.close_price).toFixed(2)}` : '-'),
  },
  {
    header: 'Bounce Score',
    accessorKey: 'score',
    cell: (item) => (item.score != null ? Number(item.score).toFixed(2) : '-'),
  },
  {
    header: 'Target',
    accessorKey: 'target',
    cell: (item) => (item.target != null ? `$${Number(item.target).toFixed(2)}` : '-'),
  },
];

export const discardedColumns: ColumnDef<DiscardedItem>[] = [
  { header: 'Ticker', accessorKey: 'ticker', cell: (item) => <span className="font-bold text-gray-400">{item.ticker}</span> },
  { header: 'Motivo del descarte', accessorKey: 'reason', cell: (item) => <span className="text-sm text-gray-500">{item.reason}</span> },
];

export const closedTradesColumns: ColumnDef<ClosedTrade>[] = [
  {
    header: 'Ticker',
    accessorKey: 'ticker',
    cell: (item) => <span className="font-bold text-gray-100">{item.ticker}</span>,
  },
  {
    header: 'Entry',
    accessorKey: 'entry_price',
    cell: (item) => (item.entry_price != null ? `$${Number(item.entry_price).toFixed(2)}` : '-'),
  },
  {
    header: 'Exit',
    accessorKey: 'exit_price',
    cell: (item) => {
      if (item.exit_price == null || item.pnl_percent == null) return <span className="text-gray-500">-</span>;
      const color = Number(item.pnl_percent) >= 0 ? 'text-accent' : 'text-danger';
      return <span className={color}>${Number(item.exit_price).toFixed(2)}</span>;
    },
  },
  { header: 'REASON', accessorKey: 'exit_reason' },
  { header: 'DAYS HELD', accessorKey: 'days_held' },
  {
    header: 'PNL (%)',
    accessorKey: 'pnl_percent',
    cell: (item) => {
      if (item.pnl_percent == null) return <span className="text-gray-500">-</span>;
      const pnlVal = Number(item.pnl_percent);
      return (
        <span className={pnlVal >= 0 ? 'text-accent font-medium' : 'text-danger font-medium'}>
          {pnlVal > 0 ? '+' : ''}
          {pnlVal.toFixed(2)}%
        </span>
      );
    },
  },
];

export const livePositionsColumns: ColumnDef<LivePosition>[] = [
  {
    header: 'Ticker',
    accessorKey: 'ticker',
    cell: (item) => <span className="font-bold text-gray-100">{item.ticker}</span>,
  },
  {
    header: 'ENTRY DATE',
    accessorKey: 'entry_date',
    cell: (item) => (
      <span className="text-slate-400">
        {item.entry_date ? String(item.entry_date).slice(0, 10) : '-'}
      </span>
    ),
  },
  {
    header: 'ACTUAL ENTRY',
    accessorKey: 'entry_price',
    cell: (item) => (item.entry_price != null ? `$${Number(item.entry_price).toFixed(2)}` : '-'),
  },
  {
    header: 'TARGET',
    accessorKey: 'target',
    cell: (item) => (item.target != null ? `$${Number(item.target).toFixed(2)}` : '-'),
  },
  {
    header: 'STOP LOSS',
    accessorKey: 'stop_loss',
    cell: (item) => (item.stop_loss != null ? `$${Number(item.stop_loss).toFixed(2)}` : '-'),
  },
];

// ==========================================
// 3. FACTORÍAS DE COLUMNAS INTERACTIVAS
// ==========================================

export function getTop5Columns(
  onQuickAdd?: (candidate: Top5Candidate) => void
): ColumnDef<Top5Candidate>[] {
  if (!onQuickAdd) {
    return top5Columns;
  }

  return [
    ...top5Columns,
    {
      header: 'ACTION',
      accessorKey: 'ticker',
      cell: (item) => (
        <button
          type="button"
          onClick={() => onQuickAdd(item)}
          className="px-2 py-1 rounded bg-accent/15 hover:bg-accent/30 border border-accent/40 text-accent font-semibold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
          title={`Pre-cargar ${item.ticker} en Trading Journal`}
        >
          + Tomar
        </button>
      ),
    },
  ];
}

export function getLivePositionsColumns(
  onCloseTrade?: (position: LivePosition) => void
): ColumnDef<LivePosition>[] {
  if (!onCloseTrade) {
    return livePositionsColumns;
  }

  return [
    ...livePositionsColumns,
    {
      header: 'ACTION',
      accessorKey: 'ticker',
      cell: (item) => (
        <button
          type="button"
          onClick={() => onCloseTrade(item)}
          className="px-2 py-1 rounded bg-danger/15 hover:bg-danger/30 border border-danger/40 text-danger font-semibold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
          title={`Cerrar posición de ${item.ticker}`}
        >
          Cerrar
        </button>
      ),
    },
  ];
}
