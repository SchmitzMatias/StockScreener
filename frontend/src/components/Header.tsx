/// <reference types="vite/client" />
import React, { ReactNode } from 'react';
import logoImg from '../assets/logo.png';
import clockImg from '../assets/clock.png';
import metaData from '../../../data/meta.json';
import SparkLine from './SparkLine';

// 1. define interface
interface MetricCardProps {
    title: string,
    value: ReactNode,
    subText: string,
    children?: ReactNode,
    className?: string;
}

// 2. de-estructure variables & type full object
const MetricCard = ({
    title,
    value,
    subText,
    children,
    className
}: MetricCardProps) => {

    const getColorClass = (text: string) => {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('-')) return 'text-danger';

        if (lowerText.includes('+')) return 'text-accent';

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
                title="Volatility Index"
                value="18.12"
                subText=""

            >
                <div className="mt-4">
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-500/10 text-accent">
                        Risk-On Environment
                    </span>
                </div>
            </MetricCard>

            {/* Card 4 */}
            <MetricCard
                title=""
                value="46.5% > SMA20"
                subText="Bullish participation"
            >
                {/* Forzamos un ancho mínimo (min-w) y usamos block para evitar colapsos de flexbox */}
                <div className="block w-full min-w-[150px] h-2 bg-slate-700 rounded-full mt-3 overflow-hidden">
                    <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: '46.5%' }}
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