import React, { ReactNode, useEffect, useState } from 'react';
import { DataTable } from './DataTable';
import {
    top5Columns,
    closedTradesColumns,
    livePositionsColumns,
    Top5Candidate,
    ClosedTrade,
    LivePosition
} from './DashboardTables';
import { TradeEntryForm } from './TradeEntryForm';
import { supabase } from '../../lib/supabase';

interface WidgetPanelProps {
    title: string;
    subtitle?: string;
    icon: string;
    children?: ReactNode;
    className?: string;
}

const WidgetPanel = ({
    title,
    subtitle,
    icon,
    children,
    className = "",
}: WidgetPanelProps) => {
    return (
        <div className={`flex flex-col bg-panel border border-slate-800 rounded-lg min-h-full p-2 ${className}`}>
            <div className='flex border-b border-slate-700/50 pb-3 items-center gap-2'>
                <span>{icon}</span>
                <div>
                    <h2 className='font-semibold'>{title}</h2>
                    <p className='text-xs text-slate-400'>{subtitle}</p>
                </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        </div>
    );
};

interface DashboardColumnProps {
    title: string;
    icon: string;
    children?: ReactNode;
}

const DashboardColumn = ({
    title,
    icon,
    children,
}: DashboardColumnProps) => {
    return (
        <div className="flex flex-col bg-panel border border-slate-800 rounded-lg min-h-full p-2">
            <div className='flex pb-3 items-center gap-2'>
                <span>{icon}</span>
                <h2 className='font-semibold'>{title}</h2>
            </div>
            <div>{children}</div>
        </div>
    );
};

export default function Dashboard() {
    const [top5Data, setTop5Data] = useState<Top5Candidate[]>([]);
    const [mockTrades, setMockTrades] = useState<ClosedTrade[]>([]);
    const [realLivePositions, setRealLivePositions] = useState<LivePosition[]>([]);
    const [realTradeHistory, setRealTradeHistory] = useState<ClosedTrade[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchDashboardData() {
            setIsLoading(true);
            setErrorMsg(null);

            try {
                const [candidatesRes, tradesRes] = await Promise.all([
                    supabase
                        .from('screener_candidates')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .order('score', { ascending: false })
                        .limit(50),
                    supabase
                        .from('trades')
                        .select('*')
                        .order('entry_date', { ascending: false })
                ]);

                if (candidatesRes.error) {
                    throw new Error(`screener_candidates: ${candidatesRes.error.message}`);
                }
                if (tradesRes.error) {
                    throw new Error(`trades: ${tradesRes.error.message}`);
                }

                if (!isMounted) return;

                // 1. Filtrar los candidatos de la fecha más reciente
                const allCandidates = (candidatesRes.data || []) as Top5Candidate[];
                if (allCandidates.length > 0) {
                    const latestDate = allCandidates[0].created_at;
                    const latestCandidates = allCandidates
                        .filter(c => c.created_at === latestDate)
                        .sort((a, b) => Number(b.score) - Number(a.score));
                    setTop5Data(latestCandidates);
                } else {
                    setTop5Data([]);
                }

                // 2. Segregar trades por el flag booleano 'taken'
                const allTrades = (tradesRes.data || []) as ClosedTrade[];
                const theoretical = allTrades.filter(t => !t.taken);
                const real = allTrades.filter(t => t.taken === true);

                setMockTrades(theoretical);

                setRealLivePositions(
                    real.filter(t => t.status === 'OPEN' || (!t.status && t.exit_reason == null)) as LivePosition[]
                );
                setRealTradeHistory(
                    real.filter(t => t.status === 'CLOSED' || t.exit_reason != null)
                );
            } catch (err: any) {
                console.error('[Dashboard] Error cargando datos de Supabase:', err);
                if (isMounted) {
                    setErrorMsg(err?.message || 'Error al conectar con Supabase');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchDashboardData();
        return () => {
            isMounted = false;
        };
    }, []);

    // Procesar Backtest (Theoretical Trades: taken = false)
    const closedTrades = mockTrades.filter(
        trade => trade.status === 'CLOSED' || trade.exit_reason !== null
    );

    const theoricalData = [...closedTrades].sort(
        (a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
    );

    // Cálculos para el Footer de Theoretical Performance
    const openTrades = mockTrades.filter(
        trade => trade.status === 'OPEN' || (!trade.status && !trade.exit_reason)
    );
    const openCount = openTrades.length;

    const today = new Date();
    const totalDaysOpen = openTrades.reduce((sum, trade) => {
        if (!trade.entry_date) return sum;
        const entryDate = new Date(trade.entry_date);
        const diffTime = Math.abs(today.getTime() - entryDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return sum + diffDays;
    }, 0);
    const avgDaysOpen = openCount > 0 ? Math.round(totalDaysOpen / openCount) : 0;

    const totalTrades = closedTrades.length;
    const winTrades = closedTrades.filter(t => t.exit_reason === 'TP').length;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    const totalPnl = closedTrades.reduce((sum, trade) => sum + (Number(trade.pnl_percent) || 0), 0);
    const rrr = "1 : 0.85";

    const availableTickers = top5Data.map(t => t.ticker);

    return (
        <div className="flex flex-col gap-3">
            {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg p-2.5">
                    Error de sincronización con Supabase: {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <DashboardColumn
                    title="1. Screener Engine"
                    icon="⚙️"
                >
                    <div className='flex flex-col gap-3'>
                        <WidgetPanel
                            title="Today's top 5"
                            subtitle={isLoading ? "Cargando candidatos..." : "Candidates from yesterday's close"}
                            icon="🔥"
                        >
                            <DataTable columns={top5Columns} data={top5Data} />
                        </WidgetPanel>
                        <WidgetPanel title="Trading Journal" subtitle="Real trades log" icon="📝">
                            <TradeEntryForm availableTickers={availableTickers} />
                        </WidgetPanel>
                    </div>
                </DashboardColumn>
                <DashboardColumn
                    title="2. Theoretical Performance"
                    icon="🤖"
                >
                    <div className='flex flex-col gap-3 h-full'>
                        <WidgetPanel
                            title="Theoretical Trades"
                            subtitle={isLoading ? "Cargando historial..." : "Backtest results from candidates"}
                            icon="📈"
                            className="flex-1 flex flex-col min-h-0"
                        >
                            <DataTable columns={closedTradesColumns} data={theoricalData} />
                            <div className="flex justify-between items-center bg-slate-900/50 p-2 border-t border-slate-800 rounded-b-lg text-xs text-slate-400 bg-slate-950/40">
                                <div>
                                    Win Rate: <span className={winRate > 50 ? 'text-accent font-semibold' : 'text-danger font-semibold'}>{winRate.toFixed(1)}%</span>
                                </div>
                                <div>
                                    Avg RRR: <span className="font-semibold text-slate-300">{rrr}</span>
                                </div>
                                <div>
                                    Cumulative PNL: <span className={totalPnl >= 0 ? 'text-accent font-semibold' : 'text-danger font-semibold'}>{totalPnl > 0 ? '+' : ''}{totalPnl.toFixed(2)}%</span>
                                </div>
                                <div>
                                    Open Positions: <span className="font-semibold text-slate-300">{openCount}</span>
                                </div>
                                <div>
                                    Avg Days Held: <span className="font-semibold text-slate-300">{avgDaysOpen}</span>
                                </div>
                            </div>
                        </WidgetPanel>
                    </div>
                </DashboardColumn>
                <DashboardColumn
                    title="3. Real Portfolio"
                    icon="💸"
                >
                    <div className='flex flex-col gap-3'>
                        <WidgetPanel
                            title="Live Positions"
                            subtitle=""
                            icon="🌱"
                        >
                            <DataTable columns={livePositionsColumns} data={realLivePositions} />
                        </WidgetPanel>
                        <WidgetPanel
                            title="Trade History"
                            subtitle=""
                            icon="🎭"
                        >
                            <DataTable columns={closedTradesColumns} data={realTradeHistory} />
                        </WidgetPanel>
                    </div>
                </DashboardColumn>
            </div>
        </div>
    );
}
