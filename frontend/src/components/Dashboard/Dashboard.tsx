import react, { ReactNode } from 'react';

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
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DashboardColumn
                title="1. El motor lógico"
                icon="⚙️"
                children={
                    <div className='flex flex-col gap-3'>
                        <WidgetPanel
                            title="Today's top 5"
                            subtitle="Candidates from yesterday's close"
                            icon="🔥"
                        >
                        </WidgetPanel>
                        <WidgetPanel
                            title="Discarded log"
                            subtitle="Discarded candidates from top5"
                            icon="🚮"
                        />
                    </div>
                }
            />
            <DashboardColumn
                title="2. Rendimiento teórico"
                icon="🤖"
                children={
                    <div className='flex flex-col gap-3'>
                        <WidgetPanel
                            title="Theorical Trades"
                            subtitle="Backtest results from candidates"
                            icon="📈"
                        />
                        <WidgetPanel
                            title="Theorical PnL"
                            subtitle='Assuming all trades were taken'
                            icon="🔢"
                        />
                    </div>
                }
            />
            <DashboardColumn
                title="3. Portfolio real"
                icon="💸"
                children={
                    <div className='flex flex-col gap-3'>
                        <WidgetPanel
                            title="Live Positions"
                            subtitle=""
                            icon="🌱"
                        />
                        <WidgetPanel
                            title="Trade History"
                            subtitle=""
                            icon="🎭"
                        />
                    </div>
                }
            />
        </div>
    )
}