import React from 'react';

interface TradeEntryFormProps {
    availableTickers: string[];
}

export const TradeEntryForm: React.FC<TradeEntryFormProps> = ({ availableTickers }) => {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Form submitted!");
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-slate-300 text-sm">
            <div className="flex flex-col gap-1">
                <label htmlFor="ticker">Ticker</label>
                <select 
                    id="ticker" 
                    className="bg-slate-900/50 border border-slate-700 rounded p-1.5 focus:ring-1 focus:ring-accent focus:outline-none"
                >
                    {availableTickers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            
            <div className="flex flex-col gap-1">
                <label htmlFor="price">Precio de Entrada Real</label>
                <input 
                    type="number" 
                    id="price" 
                    step="0.01" 
                    placeholder="Precio ejecutado en InvertirOnline" 
                    className="bg-slate-900/50 border border-slate-700 rounded p-1.5 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600"
                />
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="notes">Tesis / Notas</label>
                <textarea 
                    id="notes" 
                    rows={2} 
                    placeholder="Tesis, patrón o motivo de la entrada..."
                    className="bg-slate-900/50 border border-slate-700 rounded p-1.5 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600 resize-none"
                />
            </div>

            <button 
                type="submit"
                className="w-full mt-2 py-2 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-semibold"
            >
                Registrar en Portfolio
            </button>
        </form>
    );
};
