import react, { ReactNode } from 'react';
import logoImg from '../assets/logo.png';
import clockImg from '../assets/clock.png';
import metaData from '../../../data/meta.json';
import Sparkline from './SparkLine';

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

    const [runDate, runTime] = metaData.last_run.split(' ');

    return (
        <div className={`bg-panel border border-slate-800 rounded-lg p-3 flex justify-around items-center shadow-sm ${className}`}>
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
                value="7606 pts"
                subText="-0.4%"

            >
                <div className="w-20 h-10">
                    <Sparkline
                        data={[7659, 7711, 7693, 7670, 7618, 7651, 7730, 7700, 7659, 7620]}
                        colorClass="text-accent"
                    />
                </div>
            </MetricCard>

            {/* Card 3 */}
            <MetricCard
                title="VIX"
                value="18.12"
                subText="-12%"

            >
            </MetricCard>

            {/* Card 4 */}
            <MetricCard
                className="hidden lg:flex"
                title="Stocks > SMA20"
                value="46.5%"
                subText=""

            >
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