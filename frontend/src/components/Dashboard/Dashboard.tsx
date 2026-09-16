import React, { ReactNode } from 'react';
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
import historyData from '../../../../data/history.json';
import backtestDataRaw from '../../../../data/backtest.json';
import portfolioData from '../../../../data/portfolio.json';
interface WidgetPanelProps {
    title: string,
    subtitle?: string,
    icon: string,
    children?: ReactNode,
}

const WidgetPanel = ({
    title,
    subtitle,
    icon,
    children,
}: WidgetPanelProps) => {
    return (
        <div className="flex flex-col bg-panel border border-slate-800 rounded-lg min-h-full p-2">
            <div className='flex border-b border-slate-700/50 pb-3 items-center gap-2'>
                <span>{icon}</span>
                <div>
                    <h2 className='font-semibold'>{title}</h2>
                    <p className='text-xs text-slate-400'>{subtitle}</p>
                </div>
            </div>
            <div>{children}</div>
        </div>
    )
}

interface DashboardColumnProps {
    title: string,
    icon: string,
    children?: ReactNode,
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
    )
}

export default function Dashboard() {
    const rawData = historyData as Record<string, any>;

    // Extraer la fecha más reciente (llave mayor)
    const dates = Object.keys(rawData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const latestDate = dates.length > 0 ? dates[0] : null;

    // Type casting de la fecha más reciente
    const top5Data = latestDate ? (rawData[latestDate] as Top5Candidate[]) : [];

    // Procesar Backtest (Theorical Trades)
    const backtestList = backtestDataRaw as ClosedTrade[];
    const closedTrades = backtestList.filter(trade => trade.Exit_Reason !== null);

    const theoricalData = [...closedTrades]
        .sort((a, b) => new Date(b.Entry_Date).getTime() - new Date(a.Entry_Date).getTime())
        .slice(0, 7);

    // Cálculos para el Footer
    const totalTrades = closedTrades.length;
    const winTrades = closedTrades.filter(t => t.Exit_Reason === 'TP').length;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.PnL_Percent || 0), 0);
    const rrr = "1 : 0.85";

    // Inicializar las demás tablas con la data real del portfolio
    const liveData: LivePosition[] = portfolioData.livePositions as LivePosition[];
    const historyLog: ClosedTrade[] = portfolioData.tradeHistory as ClosedTrade[];

    const availableTickers = top5Data.map(t => t.Ticker);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DashboardColumn
                title="1. El motor lógico"
                icon="⚙️"
            >
                <div className='flex flex-col gap-3'>
                    <WidgetPanel
                        title="Today's top 5"
                        subtitle="Candidates from yesterday's close"
                        icon="🔥"
                    >
                        <DataTable columns={top5Columns} data={top5Data} />
                    </WidgetPanel>
                    <WidgetPanel title="Journal Operativo" subtitle="Registro de operaciones reales" icon="📝">
                        <TradeEntryForm availableTickers={availableTickers} />
                    </WidgetPanel>
                </div>
            </DashboardColumn>
            <DashboardColumn
                title="2. Rendimiento teórico"
                icon="🤖"
            >
                <div className='flex flex-col gap-3'>
                    <WidgetPanel
                        title="Theorical Trades"
                        subtitle="Backtest results from candidates"
                        icon="📈"
                    >
                        <DataTable columns={closedTradesColumns} data={theoricalData} />
                        <div className="flex justify-between items-center bg-slate-900/50 p-2 border-t border-slate-800 rounded-b-lg text-xs text-slate-400 bg-slate-950/40">
                            <div>
                                Win Rate: <span className={winRate > 50 ? 'text-accent font-semibold' : 'text-danger font-semibold'}>{winRate.toFixed(1)}%</span>
                            </div>
                            <div>
                                RRR Promedio: <span className="font-semibold text-slate-300">{rrr}</span>
                            </div>
                            <div>
                                PnL Acumulado: <span className={totalPnl >= 0 ? 'text-accent font-semibold' : 'text-danger font-semibold'}>{totalPnl > 0 ? '+' : ''}{totalPnl.toFixed(2)}%</span>
                            </div>
                        </div>
                    </WidgetPanel>
                </div>
            </DashboardColumn>
            <DashboardColumn
                title="3. Portfolio real"
                icon="💸"
            >
                <div className='flex flex-col gap-3'>
                    <WidgetPanel
                        title="Live Positions"
                        subtitle=""
                        icon="🌱"
                    >
                        <DataTable columns={livePositionsColumns} data={liveData} />
                    </WidgetPanel>
                    <WidgetPanel
                        title="Trade History"
                        subtitle=""
                        icon="🎭"
                    >
                        <DataTable columns={closedTradesColumns} data={historyLog} />
                    </WidgetPanel>
                </div>
            </DashboardColumn>
        </div>
    )
}