import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { DataTable } from './DataTable';
import {
    closedTradesColumns,
    getTop5Columns,
    getLivePositionsColumns,
    Top5Candidate,
    ClosedTrade,
    LivePosition,
} from './DashboardTables';
import { TradeEntryForm } from './TradeEntryForm';
import { CloseTradeModal } from './CloseTradeModal';
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

    const [session, setSession] = useState<Session | null>(null);
    const [selectedCandidate, setSelectedCandidate] = useState<Top5Candidate | null>(null);
    const [closingTrade, setClosingTrade] = useState<LivePosition | null>(null);
    const [theoreticalTab, setTheoreticalTab] = useState<'CLOSED' | 'OPEN'>('CLOSED');

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Gestión de sesión de Operador Único en Supabase Auth
    useEffect(() => {
        let active = true;

        supabase.auth.getSession().then(({ data }) => {
            if (active) {
                setSession(data.session ?? null);
            }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            if (!active) return;
            setSession(currentSession);
            if (!currentSession) {
                setSelectedCandidate(null);
                setClosingTrade(null);
            }
        });

        return () => {
            active = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    const fetchDashboardData = useCallback(async () => {
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
                    .order('entry_date', { ascending: false }),
            ]);

            if (candidatesRes.error) {
                throw new Error(`screener_candidates: ${candidatesRes.error.message}`);
            }
            if (tradesRes.error) {
                throw new Error(`trades: ${tradesRes.error.message}`);
            }

            if (!isMountedRef.current) return;

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
                real.filter(
                    t => t.status === 'OPEN' || (!t.status && t.exit_reason == null)
                ) as LivePosition[]
            );
            setRealTradeHistory(
                real.filter(t => t.status === 'CLOSED' || t.exit_reason != null)
            );
        } catch (err: any) {
            console.error('[Dashboard] Error cargando datos de Supabase:', err);
            if (isMountedRef.current) {
                setErrorMsg(err?.message || 'Error al conectar con Supabase');
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

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

    // Cálculos para el Footer de Real Portfolio (taken = true & status = 'CLOSED')
    const realTotalClosed = realTradeHistory.length;
    const realWins = realTradeHistory.filter(t => Number(t.pnl_percent) > 0).length;
    const realWinRate = realTotalClosed > 0 ? (realWins / realTotalClosed) * 100 : 0;
    const realTotalPnl = realTradeHistory.reduce(
        (sum, trade) => sum + (Number(trade.pnl_percent) || 0),
        0
    );
    const realAvgDays =
        realTotalClosed > 0
            ? Math.round(
                  realTradeHistory.reduce((sum, t) => sum + (Number(t.days_held) || 0), 0) /
                      realTotalClosed
              )
            : 0;

    const availableTickers = top5Data.map(t => t.ticker);
    const isAuthenticated = Boolean(session);

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
                            <DataTable
                                columns={getTop5Columns(
                                    isAuthenticated ? (cand) => setSelectedCandidate(cand) : undefined
                                )}
                                data={top5Data}
                            />
                        </WidgetPanel>
                        <WidgetPanel title="Trading Journal" subtitle="Real trades log" icon="📝">
                            <TradeEntryForm
                                availableTickers={availableTickers}
                                selectedCandidate={selectedCandidate}
                                isAuthenticated={isAuthenticated}
                                userEmail={session?.user?.email}
                                onTradeCreated={fetchDashboardData}
                                onClearSelectedCandidate={() => setSelectedCandidate(null)}
                            />
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
                            {/* Sub-tabs: Cerrados vs Abiertos */}
                            <div className="flex items-center gap-1.5 py-2 border-b border-slate-800/70 mb-2">
                                <button
                                    type="button"
                                    onClick={() => setTheoreticalTab('CLOSED')}
                                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                                        theoreticalTab === 'CLOSED'
                                            ? 'bg-accent/15 text-accent border border-accent/30'
                                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                    }`}
                                >
                                    Cerrados (Historial) ({closedTrades.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTheoreticalTab('OPEN')}
                                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                                        theoreticalTab === 'OPEN'
                                            ? 'bg-accent/15 text-accent border border-accent/30'
                                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                    }`}
                                >
                                    Abiertos (En Curso) ({openCount})
                                </button>
                            </div>

                            {theoreticalTab === 'CLOSED' ? (
                                <DataTable columns={closedTradesColumns} data={theoricalData} />
                            ) : (
                                <DataTable
                                    columns={getLivePositionsColumns()}
                                    data={openTrades as LivePosition[]}
                                />
                            )}

                            <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-950/40 p-2 border-t border-slate-800 rounded-b-lg text-xs text-slate-400">
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
                            <DataTable
                                columns={getLivePositionsColumns(
                                    isAuthenticated ? (pos) => setClosingTrade(pos) : undefined
                                )}
                                data={realLivePositions}
                            />
                        </WidgetPanel>
                        <WidgetPanel
                            title="Trade History"
                            subtitle=""
                            icon="🎭"
                        >
                            <DataTable columns={closedTradesColumns} data={realTradeHistory} />
                            <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-950/40 p-2 border-t border-slate-800 rounded-b-lg text-xs text-slate-400">
                                <div>
                                    Win Rate: <span className={realWinRate > 50 ? 'text-accent font-semibold' : 'text-danger font-semibold'}>{realWinRate.toFixed(1)}%</span>
                                </div>
                                <div>
                                    Cumulative PNL: <span className={realTotalPnl >= 0 ? 'text-accent font-semibold' : 'text-danger font-semibold'}>{realTotalPnl > 0 ? '+' : ''}{realTotalPnl.toFixed(2)}%</span>
                                </div>
                                <div>
                                    Closed Trades: <span className="font-semibold text-slate-300">{realTotalClosed}</span>
                                </div>
                                <div>
                                    Avg Days Held: <span className="font-semibold text-slate-300">{realAvgDays}</span>
                                </div>
                            </div>
                        </WidgetPanel>
                    </div>
                </DashboardColumn>
            </div>

            <CloseTradeModal
                trade={closingTrade}
                onClose={() => setClosingTrade(null)}
                onTradeClosed={fetchDashboardData}
            />
        </div>
    );
}
