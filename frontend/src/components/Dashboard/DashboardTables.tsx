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

export interface TheoricalTrade {
  Entry_Date: string;
  Ticker: string;
  Entry_Price: number;
  Target: number;
  Stop_Loss: number;
  Exit_Price: number | null;
  Exit_Reason: "TP" | "SL" | null;
  PnL_Percent: number | null;
}

export interface LivePosition {
  ticker: string;
  entry: number;
  floatingPnl: number;
  pnlPercentage: number;
}

export interface TradeHistory {
  ticker: string;
  closeDate: string;
  days: number;
  resultAmount: number;
  resultPercentage: number;
}

// ==========================================
// 2. DEFINICIONES DE COLUMNAS (ColumnDef<T>[])
// ==========================================

export const top5Columns: ColumnDef<Top5Candidate>[] = [
  { header: 'Ticker', accessorKey: 'Ticker', cell: (item) => <span className="font-bold text-gray-100">{item.Ticker}</span> },
  { header: 'Precio Cierre', accessorKey: 'Price', cell: (item) => `$${item.Price.toFixed(2)}` },
  { header: 'Bounce Score', accessorKey: 'Bounce_Score', cell: (item) => item.Bounce_Score.toFixed(2) },
  { header: 'Target', accessorKey: 'Target_FrontRun', cell: (item) => `$${item.Target_FrontRun.toFixed(2)}` }
];

export const discardedColumns: ColumnDef<DiscardedItem>[] = [
  { header: 'Ticker', accessorKey: 'ticker', cell: (item) => <span className="font-bold text-gray-400">{item.ticker}</span> },
  { header: 'Motivo del descarte', accessorKey: 'reason', cell: (item) => <span className="text-sm text-gray-500">{item.reason}</span> },
];

export const theoricalTradesColumns: ColumnDef<TheoricalTrade>[] = [
  { header: 'Ticker', accessorKey: 'Ticker', cell: (item) => <span className="font-bold text-gray-100">{item.Ticker}</span> },
  { header: 'Entry', accessorKey: 'Entry_Price', cell: (item) => `$${item.Entry_Price.toFixed(2)}` },
  { 
    header: 'Exit', 
    accessorKey: 'Exit_Price', 
    cell: (item) => {
      if (item.Exit_Price === null || item.Exit_Reason === null) return <span className="text-gray-500">-</span>;
      const color = item.Exit_Reason === 'TP' ? 'text-accent' : 'text-danger';
      return (
        <span className={color}>
          ${item.Exit_Price.toFixed(2)} ({item.Exit_Reason})
        </span>
      );
    }
  },
  { 
    header: 'PnL', 
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
  { header: 'Ticker', accessorKey: 'ticker', cell: (item) => <span className="font-bold text-gray-100">{item.ticker}</span> },
  { header: 'Entry Real', accessorKey: 'entry', cell: (item) => `$${item.entry.toFixed(2)}` },
  { 
    header: 'PnL Flotante', 
    accessorKey: 'floatingPnl', 
    cell: (item) => (
      <span className={item.floatingPnl >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
        {item.floatingPnl > 0 ? '+' : ''}${item.floatingPnl.toFixed(2)}
      </span>
    ) 
  },
  { 
    header: '% PNL', 
    accessorKey: 'pnlPercentage', 
    cell: (item) => (
      <span className={item.pnlPercentage >= 0 ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
        {item.pnlPercentage > 0 ? '+' : ''}{item.pnlPercentage.toFixed(2)}%
      </span>
    ) 
  },
];

export const tradeHistoryColumns: ColumnDef<TradeHistory>[] = [
  { header: 'Ticker', accessorKey: 'ticker', cell: (item) => <span className="font-bold text-gray-100">{item.ticker}</span> },
  { header: 'Fecha Cierre', accessorKey: 'closeDate', cell: (item) => <span className="text-sm text-gray-400">{item.closeDate}</span> },
  { header: 'Días', accessorKey: 'days' },
  { 
    header: 'Resultado ($)', 
    accessorKey: 'resultAmount', 
    cell: (item) => (
      <span className={item.resultAmount >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
        {item.resultAmount > 0 ? '+' : ''}${item.resultAmount.toFixed(2)}
      </span>
    ) 
  },
  { 
    header: 'Resultado (%)', 
    accessorKey: 'resultPercentage', 
    cell: (item) => (
      <span className={item.resultPercentage >= 0 ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
        {item.resultPercentage > 0 ? '+' : ''}{item.resultPercentage.toFixed(2)}%
      </span>
    ) 
  },
];
