/// <reference types="vite/client" />
import React, { ReactNode, useEffect, useState } from 'react';
import logoImg from '../assets/logo.png';
import clockImg from '../assets/clock.png';
import SparkLine from './SparkLine';
import { supabase } from '../lib/supabase';
import { StrategyType } from './Dashboard/DashboardTables';

interface HeaderProps {
    activeStrategy: StrategyType;
    onStrategyChange: (strategy: StrategyType) => void;
}

interface MetricCardProps {
    title: ReactNode;
    value: ReactNode;
    subText: string;
    invertColors?: boolean;
    children?: ReactNode;
    className?: string;
    subTextClassName?: string;
}

interface MarketMetadata {
    id?: number;
    last_run?: string | null;
    updated_at?: string | null;
    spy_price?: number | null;
    spy_change?: number | null;
    spy_history?: number[] | string | null;
    vix_price?: number | null;
    vix_change?: number | null;
    sma20_bull_pct?: number | null;
}

const MetricCard = ({
    title,
    value,
    subText,
    invertColors,
    children,
    className,
    subTextClassName
}: MetricCardProps) => {

    const getColorClass = (text: string) => {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('-')) return invertColors ? 'text-accent' : 'text-danger';

        if (lowerText.includes('+')) return invertColors ? 'text-danger' : 'text-accent';

        return 'text-slate-400';
    };

    return (
        <div className={`bg-panel border border-slate-800 rounded-lg flex flex-wrap justify-around items-center gap-1.5 2xl:gap-2 p-2 2xl:p-3 shadow-sm ${className || ''}`}>
            <div className='min-w-0'>
                {title && (
                    <span className='block text-xs xl:text-sm 2xl:text-xl text-slate-300 leading-tight'>
                        {title}
                    </span>
                )}
                <div className='text-base xl:text-lg 2xl:text-2xl font-semibold leading-tight whitespace-nowrap'>
                    {value}
                </div>
                {subText && (
                    <div className={`text-xs 2xl:text-sm leading-tight ${getColorClass(subText)} ${subTextClassName || ''}`}>
                        {subText}
                    </div>
                )}
            </div>
            {children && <div className='shrink-0'>{children}</div>}
        </div>
    );
};

export default function Header({ activeStrategy, onStrategyChange }: HeaderProps) {
    const [metaData, setMetaData] = useState<MarketMetadata | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let isMounted = true;

        async function fetchMetadata() {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('market_metadata')
                    .select('*')
                    .order('id', { ascending: true })
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    console.error('[Header] Error al consultar market_metadata:', error.message);
                } else if (isMounted && data) {
                    setMetaData(data as MarketMetadata);
                }
            } catch (err) {
                console.error('[Header] Excepción inesperada consultando market_metadata:', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchMetadata();
        return () => {
            isMounted = false;
        };
    }, []);

    const parseSpyHistory = (raw?: number[] | string | null): number[] => {
        let parsed: unknown = raw;
        if (typeof raw === 'string') {
            try {
                parsed = JSON.parse(raw);
            } catch {
                return [];
            }
        }
        if (!Array.isArray(parsed)) return [];
        return parsed.map(Number).filter((val) => Number.isFinite(val));
    };

    const spyHistory = parseSpyHistory(metaData?.spy_history);
    const spyChartData = spyHistory.map(val => ({ value: val }));
    const baseline = spyChartData.length > 0 ? spyChartData[0].value : 0;

    const spyPrice =
        metaData?.spy_price != null
            ? Number(metaData.spy_price)
            : spyChartData.length > 0
              ? spyChartData[spyChartData.length - 1].value
              : null;
    const spyChange = metaData?.spy_change != null ? Number(metaData.spy_change) : null;

    const vixValue = metaData?.vix_price != null ? Number(metaData.vix_price) : null;
    const vixChange = metaData?.vix_change != null ? Number(metaData.vix_change) : null;

    let vixText = 'N/A';
    let vixClasses = 'bg-slate-700/40 text-slate-400';

    if (vixValue != null && !Number.isNaN(vixValue)) {
        if (vixValue < 15) {
            vixText = 'Risk-On';
            vixClasses = 'bg-emerald-500/10 text-emerald-500';
        } else if (vixValue >= 15 && vixValue <= 20) {
            vixText = 'Neutral';
            vixClasses = 'bg-yellow-500/10 text-yellow-500';
        } else {
            vixText = 'Risk-Off';
            vixClasses = 'bg-rose-500/10 text-rose-500';
        }
    }

    const sma20BullPct = metaData?.sma20_bull_pct != null ? Number(metaData.sma20_bull_pct) : 0;

    const formatLastRun = (raw?: string | null): [string, string] => {
        if (!raw) return [isLoading ? 'Cargando...' : '-', ''];
        if (raw.includes(' ')) {
            const parts = raw.split(' ');
            return [parts[0] || '-', parts[1] || ''];
        }
        if (raw.includes('T')) {
            const [datePart, timePart] = raw.split('T');
            return [datePart || '-', (timePart || '').slice(0, 5)];
        }
        return [raw, ''];
    };

    const [cronDate, cronTime] = formatLastRun(metaData?.last_run || metaData?.updated_at);

    return (
        <header className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 2xl:gap-3 mb-2 2xl:mb-3 shrink-0">
            {/* Card 1 */}
            <div className="col-span-2 md:col-span-1 border border-slate-800 bg-panel flex rounded-lg items-center justify-between lg:justify-start gap-2 p-2 2xl:p-3">
                <div className='w-10 h-10 xl:w-14 xl:h-14 2xl:w-20 2xl:h-20 shrink-0'>
                    <img
                        src={logoImg}
                        alt="Logo"
                        className="w-full h-full object-contain"
                    />
                </div>
                <div className='flex flex-col gap-1 min-w-0'>
                    <div className='hidden lg:block min-w-0'>
                        <h1 className='text-base xl:text-lg 2xl:text-2xl font-bold leading-tight whitespace-nowrap'>Stock Screener</h1>
                        <p className='hidden xl:block text-[11px] 2xl:text-sm text-slate-400 leading-tight truncate'>
                            {activeStrategy === 'turtle' ? 'Trend Following (Turtle)' : 'Mean Reversion (Kotegawa)'}
                        </p>
                    </div>
                    <div
                        className="inline-flex items-center rounded-md bg-slate-900/80 border border-slate-700/80 p-0.5 w-fit"
                        role="group"
                        aria-label="Selector de estrategia"
                    >
                        <button
                            type="button"
                            onClick={() => onStrategyChange('kotegawa')}
                            className={`px-1.5 py-0.5 xl:px-2 text-[10px] xl:text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                                activeStrategy === 'kotegawa'
                                    ? 'bg-accent/20 text-accent border border-accent/40'
                                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                        >
                            Kotegawa
                        </button>
                        <button
                            type="button"
                            onClick={() => onStrategyChange('turtle')}
                            className={`px-1.5 py-0.5 xl:px-2 text-[10px] xl:text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                                activeStrategy === 'turtle'
                                    ? 'bg-accent/20 text-accent border border-accent/40'
                                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                        >
                            Turtle
                        </button>
                    </div>
                </div>
            </div>

            {/* Card 2 */}
            <MetricCard
                className="hidden lg:flex"
                title={
                    <>
                        <span className="2xl:hidden">SPY</span>
                        <span className="hidden 2xl:inline">S&amp;P 500 (SPY)</span>
                    </>
                }
                value={spyPrice != null ? `${spyPrice.toFixed(2)} pts` : (isLoading ? '...' : '-')}
                subText={spyChange != null ? `${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(2)}%` : ''}
            >
                <div className="w-24 h-12 xl:w-28 xl:h-14 2xl:w-40 2xl:h-20 text-accent">
                    {spyChartData.length > 0 ? (
                        <SparkLine data={spyChartData} baseline={baseline} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                            {isLoading ? 'Cargando...' : 'Sin historial'}
                        </div>
                    )}
                </div>
            </MetricCard>

            {/* Card 3 */}
            <MetricCard
                invertColors
                title={
                    <div className="flex items-center gap-1.5 relative group cursor-help w-max">
                        <span className="text-gray-400 text-xs xl:text-sm">
                            <span className="2xl:hidden">VIX</span>
                            <span className="hidden 2xl:inline">Volatility Index</span>
                        </span>
                        <div className="hidden xl:flex text-gray-500 text-[10px] border border-gray-600 rounded-full w-4 h-4 items-center justify-center font-bold hover:bg-gray-700 transition-colors">?</div>

                        {/* Tooltip oculto que aparece en hover */}
                        <div className="hidden xl:block absolute top-6 left-0 w-64 p-3 bg-[#1e293b] border border-slate-700 rounded-lg shadow-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                            <p className="font-bold text-white mb-2">VIX Regimes:</p>
                            <ul className="space-y-1.5">
                                <li><span className="text-emerald-400 font-bold">&lt; 15:</span> Risk-On. Low volatility, swing setups favored.</li>
                                <li><span className="text-yellow-400 font-bold">15 - 20:</span> Neutral. Normal conditions, standard sizing.</li>
                                <li><span className="text-rose-400 font-bold">&gt; 20:</span> Risk-Off. High fear, reduce position sizes.</li>
                            </ul>
                        </div>
                    </div>
                }
                value={vixValue != null ? vixValue.toFixed(2) : (isLoading ? '...' : '-')}
                subText={vixChange != null ? `${vixChange >= 0 ? '+' : ''}${vixChange.toFixed(2)}%` : ''}
            >
                <div className="mt-1 2xl:mt-4">
                    <span className={`px-2 py-0.5 2xl:py-1 text-xs xl:text-sm font-semibold rounded whitespace-nowrap ${vixClasses}`}>
                        {vixText}
                    </span>
                </div>
            </MetricCard>

            {/* Card 4 */}
            <MetricCard
                className="hidden md:flex"
                title=""
                value={metaData?.sma20_bull_pct != null ? `${sma20BullPct}% > SMA20` : (isLoading ? '...' : '-')}
                subText="Bullish participation"
                subTextClassName="hidden xl:block"
            >
                {/* Forzamos un ancho mínimo (min-w) y usamos block para evitar colapsos de flexbox */}
                <div className="block w-full min-w-[90px] xl:min-w-[120px] 2xl:min-w-[150px] h-2 bg-slate-700 rounded-full mt-1.5 2xl:mt-3 overflow-hidden">
                    <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, sma20BullPct))}%` }}
                    ></div>
                </div>
            </MetricCard>

            {/* Card 5 */}
            <MetricCard
                title={<span className="hidden xl:inline">Cronjob</span>}
                value={
                    <>
                        <span className="2xl:hidden">
                            {cronTime ? `${cronDate} ${cronTime}` : cronDate}
                        </span>
                        <span className="hidden 2xl:inline">{cronDate}</span>
                    </>
                }
                subText={cronTime}
                subTextClassName="hidden 2xl:block"
            >
                <div className='hidden xl:flex xl:w-12 xl:h-12 2xl:w-20 2xl:h-20 shrink-0'>
                    <img
                        src={clockImg}
                        alt="cronClock"
                        className="w-full h-full object-contain"
                    />
                </div>
            </MetricCard>
        </header>
    );
}
