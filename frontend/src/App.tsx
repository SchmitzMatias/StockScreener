import Dashboard from './components/Dashboard/Dashboard'
import Header from './components/Header'

export default function App() {
    return (
        <div className='min-h-screen md:h-screen md:overflow-hidden flex flex-col p-3 box-border'>
            <Header />
            <Dashboard />
        </div>
    )
}