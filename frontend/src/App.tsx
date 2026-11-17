import { useState } from 'react'
import Dashboard from './components/Dashboard/Dashboard'
import { StrategyType } from './components/Dashboard/DashboardTables'
import Header from './components/Header'

export default function App() {
    const [activeStrategy, setActiveStrategy] = useState<StrategyType>('kotegawa')

    return (
        <div className='min-h-screen md:h-screen md:overflow-hidden flex flex-col p-3 box-border'>
            <Header
                activeStrategy={activeStrategy}
                onStrategyChange={setActiveStrategy}
            />
            <Dashboard activeStrategy={activeStrategy} />
        </div>
    )
}