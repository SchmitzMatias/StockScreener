import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LivePosition } from './DashboardTables';

interface CloseTradeModalProps {
    trade: LivePosition | null;
    onClose: () => void;
    onTradeClosed: () => void;
}

type ExitReason = 'TP' | 'SL' | 'TRAILING_STOP' | 'MANUAL' | 'TIME_STOP';

const getTodayISO = () => new Date().toISOString().slice(0, 10);

export const CloseTradeModal: React.FC<CloseTradeModalProps> = ({
    trade,
    onClose,
    onTradeClosed,
}) => {
    const [exitPrice, setExitPrice] = useState('');
    const [exitDate, setExitDate] = useState(getTodayISO);
    const [exitReason, setExitReason] = useState<ExitReason>('TP');
    const [exitNotes, setExitNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!trade) return;
        setExitPrice('');
        setExitDate(getTodayISO());
        setExitReason(trade.strategy === 'turtle' ? 'TRAILING_STOP' : 'TP');
        setExitNotes('');
        setErrorMsg(null);
    }, [trade]);

    if (!trade) {
        return null;
    }

    const entryPriceNum = Number(trade.entry_price);
    const exitPriceNum = Number(exitPrice);
    const hasValidPreview =
        exitPrice.trim() !== '' &&
        Number.isFinite(exitPriceNum) &&
        exitPriceNum > 0 &&
        Number.isFinite(entryPriceNum) &&
        entryPriceNum > 0;

    const previewPnlPct = hasValidPreview
        ? Number((((exitPriceNum - entryPriceNum) / entryPriceNum) * 100).toFixed(2))
        : null;

    const entryDateStr = String(trade.entry_date || '').slice(0, 10);
    const entryDateMs = new Date(entryDateStr).getTime();
    const exitDateMs = new Date(exitDate).getTime();
    const previewDaysHeld =
        Number.isNaN(entryDateMs) || Number.isNaN(exitDateMs)
            ? 0
            : Math.max(0, Math.round((exitDateMs - entryDateMs) / (1000 * 60 * 60 * 24)));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (trade.id == null) {
            setErrorMsg('No se encontró el identificador del trade para actualizar.');
            return;
        }

        if (!Number.isFinite(exitPriceNum) || exitPriceNum <= 0) {
            setErrorMsg('El precio de salida debe ser un número mayor a 0.');
            return;
        }

        if (!exitDate) {
            setErrorMsg('La fecha de salida es obligatoria.');
            return;
        }

        const pnlPercent = Number((((exitPriceNum - entryPriceNum) / entryPriceNum) * 100).toFixed(2));
        const mergedProps = {
            ...(trade.strategy_props || {}),
            ...(exitNotes.trim() ? { exit_notes: exitNotes.trim() } : {}),
        };

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('trades')
                .update({
                    status: 'CLOSED',
                    exit_date: exitDate,
                    exit_price: Number(exitPriceNum.toFixed(2)),
                    exit_reason: exitReason,
                    pnl_percent: pnlPercent,
                    days_held: previewDaysHeld,
                    strategy_props: mergedProps,
                })
                .eq('id', trade.id)
                .eq('taken', true);

            if (error) {
                if (error.code === '42501') {
                    setErrorMsg(
                        'Permiso denegado por política RLS en Supabase. Verifica tu sesión de operador y las políticas de UPDATE.'
                    );
                } else {
                    setErrorMsg(`Error al cerrar el trade: ${error.message}`);
                }
                return;
            }

            onTradeClosed();
            onClose();
        } catch (err: any) {
            setErrorMsg(err?.message || 'Error inesperado al cerrar la posición.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-trade-modal-title"
        >
            <div className="w-full max-w-md bg-panel border border-slate-700 rounded-lg shadow-2xl p-4 text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div>
                        <h3 id="close-trade-modal-title" className="text-sm font-bold text-slate-100">
                            Cerrar Posición Real: <span className="text-accent">{trade.ticker}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">
                            Entrada: {entryDateStr || '-'} · ${entryPriceNum.toFixed(2)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
                        aria-label="Cerrar modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Resumen de niveles de referencia */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/60 border border-slate-800 rounded p-2 mb-3">
                    <div>
                        <span className="block text-[10px] text-slate-500">ENTRY</span>
                        <span className="font-semibold text-slate-200">${entryPriceNum.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-slate-500">TARGET</span>
                        <span className="font-semibold text-accent">
                            {trade.target != null ? `$${Number(trade.target).toFixed(2)}` : '-'}
                        </span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-slate-500">STOP LOSS</span>
                        <span className="font-semibold text-danger">
                            {trade.stop_loss != null ? `$${Number(trade.stop_loss).toFixed(2)}` : '-'}
                        </span>
                    </div>
                </div>

                {errorMsg && (
                    <div className="mb-3 rounded bg-danger/10 border border-danger/30 text-danger p-2 text-[11px]">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                            <label htmlFor="close-exit-price" className="text-slate-400 font-medium">
                                Exit Price (Real)
                            </label>
                            <input
                                id="close-exit-price"
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                autoFocus
                                value={exitPrice}
                                onChange={(e) => setExitPrice(e.target.value)}
                                placeholder={
                                    trade.target != null ? Number(trade.target).toFixed(2) : '0.00'
                                }
                                className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label htmlFor="close-exit-date" className="text-slate-400 font-medium">
                                Fecha de Salida
                            </label>
                            <input
                                id="close-exit-date"
                                type="date"
                                required
                                value={exitDate}
                                onChange={(e) => setExitDate(e.target.value)}
                                className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="close-exit-reason" className="text-slate-400 font-medium">
                            Motivo de Salida
                        </label>
                        <select
                            id="close-exit-reason"
                            value={exitReason}
                            onChange={(e) => setExitReason(e.target.value as ExitReason)}
                            className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none"
                        >
                            <option value="TP">TP — Take Profit</option>
                            <option value="TRAILING_STOP">TRAILING_STOP — Trailing Stop (10d / 2N)</option>
                            <option value="SL">SL — Stop Loss</option>
                            <option value="MANUAL">MANUAL — Cierre Manual</option>
                            <option value="TIME_STOP">TIME_STOP — Time Stop</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="close-exit-notes" className="text-slate-400 font-medium">
                            Notas de Cierre (opcional)
                        </label>
                        <textarea
                            id="close-exit-notes"
                            rows={2}
                            value={exitNotes}
                            onChange={(e) => setExitNotes(e.target.value)}
                            placeholder="Motivo de liquidación, aprendizaje o ejecución..."
                            className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600 resize-none"
                        />
                    </div>

                    {previewPnlPct !== null && (
                        <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded px-3 py-2">
                            <span className="text-slate-400">Resultado estimado:</span>
                            <div className="flex items-center gap-3 font-semibold">
                                <span className={previewPnlPct >= 0 ? 'text-accent' : 'text-danger'}>
                                    {previewPnlPct > 0 ? '+' : ''}
                                    {previewPnlPct.toFixed(2)}%
                                </span>
                                <span className="text-slate-400">{previewDaysHeld} días</span>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-1 pt-2 border-t border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-3 py-1.5 rounded bg-danger/20 hover:bg-danger/30 border border-danger/40 text-danger font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? 'Guardando...' : 'Confirmar Cierre'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
