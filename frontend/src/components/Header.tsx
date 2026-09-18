/// <reference types="vite/client" />
import React, { ReactNode } from 'react';
import logoImg from '../assets/logo.png';
import clockImg from '../assets/clock.png';
import metaData from '../../../data/meta.json';
import SparkLine from './SparkLine';

// 1. define interface
interface MetricCardProps {
    title: ReactNode,
    value: ReactNode,
    subText: string,
    invertColors?: boolean,
    children?: ReactNode,
    className?: string;
}

// 2. de-estructure variables & type full object
const MetricCard = ({
    title,
    value,
    subText,
    invertColors,
    children,
    className
}: MetricCardProps) => {

    const getColorClass = (text: string) => {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('-')) return invertColors ? 'text-accent' : 'text-danger';

        if (lowerText.includes('+')) return invertColors ? 'text-danger' : 'text-accent';

        return 'text-slate-400';
    };

    return (
        <div className={`bg-panel border border-slate-800 rounded-lg flex justify-around items-center shadow-sm ${className}`}>
            <div>
                <span className='text-xl'>{title}</span>
                <div className='text-2xl font-semibold'>{value}</div>
                <div className={getColorClass(subText)}>{subText}</div>
            </div>
            <div>{children}</div>
        </div>
    )

}

export default function Header() {
    const spyChartData = metaData.spy_history.map(val => ({ value: val }));
    const baseline = metaData.spy_history[0];

    const vixValue = parseFloat(String(metaData.vix_price));
    let vixText = '';
    let vixClasses = '';

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

    return (
        <header className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
            {/* Card 1 */}
            <div className="border border-slate-800 bg-panel flex rounded-lg items-center">
                <div className='w-30 h-30 shrink-0'>
                    <img
                        src={logoImg}
                        alt="Logo"
                        className="w-full h-full object-contain"
                    />
                </div>
                <div className='hidden lg:block ml-3'>
                    <h1 className='text-3xl font-bold'> Stock Screener</h1>
                    <p>Swing trading dashboard</p>
                </div>
            </div>

            {/* Card 2 */}
            <MetricCard
                className="hidden lg:flex"
                title="S&P 500(SPY)"
                value={`${spyChartData[spyChartData.length - 1].value.toFixed(2)} pts`}
                subText={`${metaData.spy_change >= 0 ? '+' : ''}${metaData.spy_change.toFixed(2)}%`}
            >
                <div className="w-40 h-20 text-accent">
                    <SparkLine data={spyChartData} baseline={baseline} />
                </div>
            </MetricCard>

            {/* Card 3 */}
            <MetricCard
                title={
                    <div className="flex items-center gap-2 relative group cursor-help w-max">
                        <span className="text-gray-400 text-sm">Volatility Index</span>
                        <div className="text-gray-500 text-[10px] border border-gray-600 rounded-full w-4 h-4 flex items-center justify-center font-bold hover:bg-gray-700 transition-colors">?</div>

                        {/* Tooltip oculto que aparece en hover */}
                        <div className="absolute top-6 left-0 w-64 p-3 bg-[#1e293b] border border-slate-700 rounded-lg shadow-xl text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                            <p className="font-bold text-white mb-2">VIX Regimes:</p>
                            <ul className="space-y-1.5">
                                <li><span className="text-emerald-400 font-bold">&lt; 15:</span> Risk-On. Low volatility, swing setups favored.</li>
                                <li><span className="text-yellow-400 font-bold">15 - 20:</span> Neutral. Normal conditions, standard sizing.</li>
                                <li><span className="text-rose-400 font-bold">&gt; 20:</span> Risk-Off. High fear, reduce position sizes.</li>
                            </ul>
                        </div>
                    </div>
                }
                value={metaData.vix_price}
                subText={`${metaData.vix_change >= 0 ? '+' : ''}${metaData.vix_change.toFixed(2)}%`}
            >
                <div className="mt-4">
                    <span className={`px-2 py-1 text-l font-semibold rounded ${vixClasses}`}>
                        {vixText}
                    </span>
                </div>
            </MetricCard>

            {/* Card 4 */}
            <MetricCard
                title=""
                value={`${metaData.sma20_bull_pct}% > SMA20`}
                subText="Bullish participation"
            >
                {/* Forzamos un ancho mínimo (min-w) y usamos block para evitar colapsos de flexbox */}
                <div className="block w-full min-w-[150px] h-2 bg-slate-700 rounded-full mt-3 overflow-hidden">
                    <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${metaData.sma20_bull_pct}%` }}
                    ></div>
                </div>
            </MetricCard>

            {/* Card 5 */}
            <MetricCard
                title="Cronjob"
                value={metaData.last_run.split(' ')[0]}
                subText={metaData.last_run.split(' ')[1]}
            >
                <div className='w-30 h-30 shrink-0 hidden lg:flex'>
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