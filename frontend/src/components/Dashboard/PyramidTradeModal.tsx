import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LivePosition } from './DashboardTables';

interface PyramidTradeModalProps {
    trade: LivePosition | null;
    onClose: () => void;
    onTradePyramided: () => void;
}

export const PyramidTradeModal: React.FC<PyramidTradeModalProps> = ({
    trade,
    onClose,
    onTradePyramided,
}) => {
    const [fillPrice, setFillPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!trade) return;
        const suggested = trade.strategy_props?.next_pyramid_price;
        setFillPrice(suggested != null ? String(suggested) : '');
        setErrorMsg(null);
    }, [trade]);

    if (!trade) {
        return null;
    }

    const props = trade.strategy_props || {};
    const oldUnits = Number(props.units ?? 1);
    const maxUnits = Number(props.max_units ?? 4);
    const oldEntry = Number(trade.entry_price);
    const oldStop = Number(trade.stop_loss);
    const rawN = props.n_at_entry;
    const isEstimatedN = rawN == null || !Number.isFinite(Number(rawN)) || Number(rawN) <= 0;
    const nAtEntry = !isEstimatedN
        ? Number(rawN)
        : oldEntry > oldStop
          ? Number(((oldEntry - oldStop) / 2).toFixed(2))
          : 0;
    const trailingStop10d = Number(props.trailing_stop_10d ?? oldStop ?? 0);

    const fillNum = Number(fillPrice);
    const hasValidFill =
        fillPrice.trim() !== '' && Number.isFinite(fillNum) && fillNum > 0;

    const newUnits = oldUnits + 1;
    const newEntryPrice = hasValidFill
        ? Number((((oldEntry * oldUnits) + fillNum) / newUnits).toFixed(2))
        : null;
    const newStop2n = hasValidFill
        ? Number((fillNum - 2.0 * nAtEntry).toFixed(2))
        : null;
    const newEffectiveStop =
        newStop2n != null
            ? Number(Math.max(newStop2n, trailingStop10d).toFixed(2))
            : null;
    const nextPyramidPrice =
        hasValidFill && newUnits < maxUnits && nAtEntry > 0
            ? Number((fillNum + 0.5 * nAtEntry).toFixed(2))
            : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (trade.id == null) {
            setErrorMsg('No se encontró el identificador del trade para actualizar.');
            return;
        }
        if (oldUnits >= maxUnits) {
            setErrorMsg(`La posición ya alcanzó el máximo de ${maxUnits} unidades.`);
            return;
        }
        if (!hasValidFill || newEntryPrice == null || newStop2n == null || newEffectiveStop == null) {
            setErrorMsg('El precio de ejecución (fill_price) debe ser un número mayor a 0.');
            return;
        }

        const existingFills = Array.isArray(props.unit_fills)
            ? props.unit_fills.map(Number).filter(Number.isFinite)
            : [oldEntry];

        const updatedProps = {
            ...props,
            n_at_entry: nAtEntry > 0 ? nAtEntry : props.n_at_entry ?? null,
            units: newUnits,
            max_units: maxUnits,
            unit_fills: [...existingFills, Number(fillNum.toFixed(2))],
            stop_2n: newStop2n,
            trailing_stop_10d: trailingStop10d,
            next_pyramid_price: nextPyramidPrice,
        };

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('trades')
                .update({
                    entry_price: newEntryPrice,
                    stop_loss: newEffectiveStop,
                    strategy_props: updatedProps,
                })
                .eq('id', trade.id)
                .eq('taken', true);

            if (error) {
                if (error.code === '42501') {
                    setErrorMsg(
                        'Permiso denegado por política RLS en Supabase. Verifica tu sesión de operador y las políticas de UPDATE.'
                    );
                } else {
                    setErrorMsg(`Error al piramidar la posición: ${error.message}`);
                }
                return;
            }

            onTradePyramided();
            onClose();
        } catch (err: any) {
            setErrorMsg(err?.message || 'Error inesperado al registrar la piramidación.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pyramid-trade-modal-title"
        >
            <div className="w-full max-w-md bg-panel border border-slate-700 rounded-lg shadow-2xl p-4 text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div>
                        <h3 id="pyramid-trade-modal-title" className="text-sm font-bold text-slate-100">
                            Piramidar Posición: <span className="text-accent">{trade.ticker}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">
                            Unidad actual: {oldUnits}/{maxUnits} → {newUnits}/{maxUnits} · N = {nAtEntry > 0 ? `$${nAtEntry.toFixed(2)}` : 'N/A'}
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

                {/* Estado actual */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/60 border border-slate-800 rounded p-2 mb-3">
                    <div>
                        <span className="block text-[10px] text-slate-500">ENTRY ACTUAL</span>
                        <span className="font-semibold text-slate-200">${oldEntry.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-slate-500">STOP ACTUAL</span>
                        <span className="font-semibold text-danger">${oldStop.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-slate-500">GATILLO (+0.5N)</span>
                        <span className="font-semibold text-accent">
                            {props.next_pyramid_price != null ? `$${Number(props.next_pyramid_price).toFixed(2)}` : '-'}
                        </span>
                    </div>
                </div>

                {isEstimatedN && nAtEntry > 0 && (
                    <div className="mb-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 p-2 text-[11px]">
                        Trade cargado manualmente sin N original: se estimó N = ${nAtEntry.toFixed(2)} a partir de (Entry - Stop) / 2.
                    </div>
                )}

                {errorMsg && (
                    <div className="mb-3 rounded bg-danger/10 border border-danger/30 text-danger p-2 text-[11px]">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="pyramid-fill-price" className="text-slate-400 font-medium">
                            Fill Price de la Nueva Unidad (Broker)
                        </label>
                        <input
                            id="pyramid-fill-price"
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            autoFocus
                            value={fillPrice}
                            onChange={(e) => setFillPrice(e.target.value)}
                            placeholder="Precio real ejecutado"
                            className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600"
                        />
                    </div>

                    {hasValidFill && newEntryPrice != null && newEffectiveStop != null && newStop2n != null && (
                        <div className="bg-slate-900/60 border border-slate-800 rounded p-2.5 space-y-1.5 text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Nuevo Entry Ponderado:</span>
                                <span className="font-semibold text-slate-100">${newEntryPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Nuevo Stop 2N / Trail 10d:</span>
                                <span className="text-slate-300">
                                    ${newStop2n.toFixed(2)} / ${trailingStop10d.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Stop Loss Efectivo (max):</span>
                                <span className="font-semibold text-danger">${newEffectiveStop.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Próximo Gatillo:</span>
                                <span className="font-semibold text-accent">
                                    {nextPyramidPrice != null ? `$${nextPyramidPrice.toFixed(2)}` : 'Máximo (4/4)'}
                                </span>
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
                            className="px-3 py-1.5 rounded bg-accent/20 hover:bg-accent/30 border border-accent/40 text-accent font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? 'Actualizando...' : `Confirmar Unidad ${newUnits}/${maxUnits}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
