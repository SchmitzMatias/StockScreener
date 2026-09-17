import React from 'react';
import { ColumnDef } from './DataTable';

// ==========================================
// 1. INTERFACES
// ==========================================
export interface Top5Candidate {
  Ticker: string;
  Price: number;
  RSI: number;
  "Z-Score": number;
  Bounce_Score: number;
  Target_FrontRun: number;
  Stop_Loss_Sugerido: number;
}

export interface DiscardedItem {
  ticker: string;
  reason: string;
}

export interface ClosedTrade {
  Entry_Date: string;
  Ticker: string;
  Entry_Price: number;
  Target: number;
  Stop_Loss: number;
  Exit_Price: number | null;
  Exit_Reason: string | null;
  PnL_Percent: number | null;
  Days_Held: number | null;
}

export interface LivePosition {
  Entry_Date: string;
  Ticker: string;
  Entry_Price: number;
  Target: number;
  Stop_Loss: number;
  Exit_Price: number | null;
  Exit_Reason: string | null;
  PnL_Percent: number | null;
  Current_Price: number;
  Days_Held: number | null;
}

// ==========================================
// 2. DEFINICIONES DE COLUMNAS (ColumnDef<T>[])
// ==========================================

export const top5Columns: ColumnDef<Top5Candidate>[] = [
  { header: 'Ticker', accessorKey: 'Ticker', cell: (item) => <span className="font-bold text-gray-100">{item.Ticker}</span> },
  { header: 'CLOSE PRICE', accessorKey: 'Price', cell: (item) => `$${item.Price.toFixed(2)}` },
  { header: 'Bounce Score', accessorKey: 'Bounce_Score', cell: (item) => item.Bounce_Score.toFixed(2) },
  { header: 'Target', accessorKey: 'Target_FrontRun', cell: (item) => `$${item.Target_FrontRun.toFixed(2)}` }
];

export const discardedColumns: ColumnDef<DiscardedItem>[] = [
  { header: 'Ticker', accessorKey: 'ticker', cell: (item) => <span className="font-bold text-gray-400">{item.ticker}</span> },
  { header: 'Motivo del descarte', accessorKey: 'reason', cell: (item) => <span className="text-sm text-gray-500">{item.reason}</span> },
];

export const closedTradesColumns: ColumnDef<ClosedTrade>[] = [
  { header: 'Ticker', accessorKey: 'Ticker', cell: (item) => <span className="font-bold text-gray-100">{item.Ticker}</span> },
  { header: 'Entry', accessorKey: 'Entry_Price', cell: (item) => `$${item.Entry_Price.toFixed(2)}` },
  { 
    header: 'Exit', 
    accessorKey: 'Exit_Price', 
    cell: (item) => {
      if (item.Exit_Price === null || item.PnL_Percent === null) return <span className="text-gray-500">-</span>;
      const color = item.PnL_Percent >= 0 ? 'text-accent' : 'text-danger';
      return (
        <span className={color}>
          ${item.Exit_Price.toFixed(2)}
        </span>
      );
    }
  },
  { header: 'REASON', accessorKey: 'Exit_Reason' },
  { header: 'DAYS HELD', accessorKey: 'Days_Held' },
  { 
    header: 'PNL (%)', 
    accessorKey: 'PnL_Percent', 
    cell: (item) => {
      if (item.PnL_Percent === null) return <span className="text-gray-500">-</span>;
      return (
        <span className={item.PnL_Percent >= 0 ? 'text-accent font-medium' : 'text-danger font-medium'}>
          {item.PnL_Percent > 0 ? '+' : ''}{item.PnL_Percent.toFixed(2)}%
        </span>
      );
    } 
  },
];

export const livePositionsColumns: ColumnDef<LivePosition>[] = [
  { header: 'Ticker', accessorKey: 'Ticker', cell: (item) => <span className="font-bold text-gray-100">{item.Ticker}</span> },
  { header: 'ACTUAL ENTRY', accessorKey: 'Entry_Price', cell: (item) => `$${item.Entry_Price.toFixed(2)}` },
  { 
    header: 'OPEN PNL', 
    accessorKey: 'Current_Price', 
    cell: (item) => {
      const pnlUsd = item.Current_Price - item.Entry_Price;
      return (
        <span className={pnlUsd >= 0 ? 'text-accent font-medium' : 'text-danger font-medium'}>
          {pnlUsd > 0 ? '+' : ''}${pnlUsd.toFixed(2)}
        </span>
      );
    } 
  },
  { 
    header: 'PNL (%)', 
    accessorKey: 'Current_Price', 
    cell: (item) => {
      const pnlPct = ((item.Current_Price - item.Entry_Price) / item.Entry_Price) * 100;
      return (
        <span className={pnlPct >= 0 ? 'text-accent font-bold' : 'text-danger font-bold'}>
          {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </span>
      );
    } 
  },
];

