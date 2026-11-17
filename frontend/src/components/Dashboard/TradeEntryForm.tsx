import React, { useEffect, useRef, useState } from 'react';
import { Lock, LogOut, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StrategyType, Top5Candidate } from './DashboardTables';

interface TradeEntryFormProps {
    activeStrategy: StrategyType;
    availableTickers: string[];
    selectedCandidate?: Top5Candidate | null;
    isAuthenticated?: boolean;
    userEmail?: string | null;
    onTradeCreated?: () => void;
    onClearSelectedCandidate?: () => void;
}

const getTodayISO = () => new Date().toISOString().slice(0, 10);

export const TradeEntryForm: React.FC<TradeEntryFormProps> = ({
    activeStrategy,
    availableTickers,
    selectedCandidate = null,
    isAuthenticated = false,
    userEmail = null,
    onTradeCreated,
    onClearSelectedCandidate,
}) => {
    // Estados de autenticación (Operador Único)
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    // Estados del formulario de apertura (trades reales: taken = true)
    const [ticker, setTicker] = useState('');
    const [strategy, setStrategy] = useState<StrategyType>(activeStrategy);
    const [entryDate, setEntryDate] = useState(getTodayISO);
    const [entryPrice, setEntryPrice] = useState('');
    const [target, setTarget] = useState('');
    const [stopLoss, setStopLoss] = useState('');
    const [notes, setNotes] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

    const entryPriceInputRef = useRef<HTMLInputElement>(null);

    // Sincronizar estrategia activa cuando cambia el selector global
    useEffect(() => {
        setStrategy(activeStrategy);
        setTarget('');
        setSubmitError(null);
        setSubmitSuccess(null);
    }, [activeStrategy]);

    // Quick-Add: copia literal desde el candidato del screener sin recalcular SL/TP (Invariante #4)
    useEffect(() => {
        if (!selectedCandidate) return;

        setTicker(selectedCandidate.ticker || '');
        setStrategy((selectedCandidate.strategy as StrategyType) || activeStrategy);
        setEntryPrice(
            selectedCandidate.close_price != null ? String(selectedCandidate.close_price) : ''
        );
        setTarget(selectedCandidate.target != null ? String(selectedCandidate.target) : '');
        setStopLoss(
            selectedCandidate.stop_loss != null ? String(selectedCandidate.stop_loss) : ''
        );
        setSubmitError(null);
        setSubmitSuccess(null);

        requestAnimationFrame(() => {
            entryPriceInputRef.current?.focus();
        });
    }, [selectedCandidate, activeStrategy]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        setAuthLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });
            if (error) {
                setAuthError(error.message);
            } else {
                setPassword('');
            }
        } catch (err: any) {
            setAuthError(err?.message || 'Error inesperado al iniciar sesión.');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        setAuthError(null);
        await supabase.auth.signOut();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);
        setSubmitSuccess(null);

        const cleanTicker = ticker.trim().toUpperCase();
        const entryNum = Number(entryPrice);
        const targetTrimmed = target.trim();
        const targetNum = targetTrimmed !== '' ? Number(targetTrimmed) : null;
        const stopLossNum = Number(stopLoss);
        const isTurtle = strategy === 'turtle';

        if (!cleanTicker) {
            setSubmitError('El ticker es obligatorio.');
            return;
        }
        if (!entryDate) {
            setSubmitError('La fecha de entrada es obligatoria.');
            return;
        }
        if (!Number.isFinite(entryNum) || entryNum <= 0 || !Number.isFinite(stopLossNum) || stopLossNum <= 0) {
            setSubmitError('Entry Price y Stop Loss deben ser valores numéricos mayores a 0.');
            return;
        }
        if (!isTurtle && (targetNum == null || !Number.isFinite(targetNum) || targetNum <= 0)) {
            setSubmitError('Target debe ser un valor numérico mayor a 0.');
            return;
        }
        if (isTurtle && targetNum != null && (!Number.isFinite(targetNum) || targetNum <= 0)) {
            setSubmitError('Si ingresas un Target opcional, debe ser mayor a 0.');
            return;
        }

        const buildStrategyProps = (): Record<string, any> => {
            const baseNotes = notes.trim() ? { notes: notes.trim() } : {};
            if (!isTurtle) {
                return baseNotes;
            }

            const entryRounded = Number(entryNum.toFixed(2));
            const stopRounded = Number(stopLossNum.toFixed(2));
            const candProps = selectedCandidate?.strategy_props;
            const nFromCandidate = candProps?.n_value != null ? Number(candProps.n_value) : null;
            const nInferred =
                nFromCandidate != null && Number.isFinite(nFromCandidate) && nFromCandidate > 0
                    ? nFromCandidate
                    : entryNum > stopLossNum
                      ? Number(((entryNum - stopLossNum) / 2).toFixed(2))
                      : null;

            const stop2n =
                nInferred != null
                    ? Number((entryRounded - 2.0 * nInferred).toFixed(2))
                    : stopRounded;
            const trailingStop10d =
                candProps?.donchian_low_10 != null
                    ? Number(candProps.donchian_low_10)
                    : stopRounded;
            const nextPyramidPrice =
                nInferred != null
                    ? Number((entryRounded + 0.5 * nInferred).toFixed(2))
                    : null;

            return {
                ...baseNotes,
                n_at_entry: nInferred,
                initial_entry_price: entryRounded,
                units: 1,
                max_units: 4,
                unit_fills: [entryRounded],
                stop_2n: stop2n,
                trailing_stop_10d: trailingStop10d,
                next_pyramid_price: nextPyramidPrice,
                ...(candProps?.donchian_high_20 != null
                    ? { donchian_high_20_entry: Number(candProps.donchian_high_20) }
                    : {}),
            };
        };

        setIsSubmitting(true);
        try {
            const payload = {
                ticker: cleanTicker,
                strategy: strategy || activeStrategy,
                taken: true,
                entry_date: entryDate,
                entry_price: Number(entryNum.toFixed(2)),
                target: targetNum != null ? Number(targetNum.toFixed(2)) : null,
                stop_loss: Number(stopLossNum.toFixed(2)),
                status: 'OPEN',
                exit_date: null,
                exit_price: null,
                exit_reason: null,
                pnl_percent: null,
                days_held: null,
                strategy_props: buildStrategyProps(),
            };

            const { error } = await supabase.from('trades').insert(payload);

            if (error) {
                if (error.code === '42501') {
                    setSubmitError(
                        'Permiso denegado por política RLS en Supabase. Verifica que las políticas para authenticated estén aplicadas y tu sesión siga activa.'
                    );
                } else {
                    setSubmitError(`Error al guardar en Supabase: ${error.message}`);
                }
                return;
            }

            setTicker('');
            setStrategy(activeStrategy);
            setEntryDate(getTodayISO());
            setEntryPrice('');
            setTarget('');
            setStopLoss('');
            setNotes('');
            setSubmitSuccess(`Trade real ${cleanTicker} registrado como OPEN.`);
            onClearSelectedCandidate?.();
            onTradeCreated?.();
        } catch (err: any) {
            setSubmitError(err?.message || 'Error inesperado al registrar el trade.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <form onSubmit={handleLogin} className="flex flex-col gap-2.5 text-slate-300 text-xs pt-2 md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1">
                <div className="flex items-start gap-2 rounded bg-slate-900/60 border border-slate-800 p-2 text-slate-400">
                    <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                    <span>
                        Modo lectura público activo. Inicia sesión como operador para registrar o cerrar trades reales.
                    </span>
                </div>

                {authError && (
                    <div className="rounded bg-danger/10 border border-danger/30 text-danger p-2 text-[11px]">
                        {authError}
                    </div>
                )}

                <div className="flex flex-col gap-1">
                    <label htmlFor="operator-email" className="text-slate-400 font-medium">
                        Email operador
                    </label>
                    <input
                        id="operator-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="operador@kotegawa.dev"
                        className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-200 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label htmlFor="operator-password" className="text-slate-400 font-medium">
                        Contraseña
                    </label>
                    <input
                        id="operator-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-200 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600"
                    />
                </div>

                <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full mt-1 py-2 rounded bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                    {authLoading ? 'Autenticando...' : 'Iniciar sesión de operador'}
                </button>
            </form>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 text-slate-300 text-xs pt-2 md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1">
            {/* Cabecera discreta de sesión activa */}
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded px-2 py-1 text-[11px]">
                <span className="text-slate-400 truncate" title={userEmail || 'Operador activo'}>
                    Operador: <strong className="text-slate-200">{userEmail || 'Activo'}</strong>
                </span>
                <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-slate-400 hover:text-danger transition-colors cursor-pointer shrink-0 ml-2"
                    title="Cerrar sesión de operador"
                >
                    <LogOut className="w-3 h-3" />
                    <span>Salir</span>
                </button>
            </div>

            {selectedCandidate && (
                <div className="flex items-center justify-between rounded bg-accent/10 border border-accent/30 px-2 py-1 text-[11px] text-accent">
                    <span>
                        Quick-Add: <strong>{selectedCandidate.ticker}</strong> (edita precio real si hubo slippage)
                    </span>
                    <button
                        type="button"
                        onClick={() => onClearSelectedCandidate?.()}
                        className="text-accent hover:text-white cursor-pointer ml-2"
                        title="Desvincular candidato"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {submitError && (
                <div className="rounded bg-danger/10 border border-danger/30 text-danger p-2 text-[11px]">
                    {submitError}
                </div>
            )}

            {submitSuccess && (
                <div className="rounded bg-accent/10 border border-accent/30 text-accent p-2 text-[11px]">
                    {submitSuccess}
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                    <label htmlFor="trade-ticker" className="text-slate-400 font-medium">
                        Ticker
                    </label>
                    <input
                        id="trade-ticker"
                        type="text"
                        list="screener-tickers-datalist"
                        required
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        placeholder="Ej. AAPL"
                        className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 uppercase focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600"
                    />
                    <datalist id="screener-tickers-datalist">
                        {availableTickers.map((t) => (
                            <option key={t} value={t} />
                        ))}
                    </datalist>
                </div>

                <div className="flex flex-col gap-1">
                    <label htmlFor="trade-entry-date" className="text-slate-400 font-medium">
                        Fecha de Entrada
                    </label>
                    <input
                        id="trade-entry-date"
                        type="date"
                        required
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="trade-entry-price" className="text-slate-400 font-medium">
                    Actual Entry Price (Broker)
                </label>
                <input
                    ref={entryPriceInputRef}
                    id="trade-entry-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="Precio real ejecutado"
                    className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600"
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                    <label htmlFor="trade-target" className="text-slate-400 font-medium">
                        {strategy === 'turtle' ? 'Target (Opcional)' : 'Target'}
                    </label>
                    <input
                        id="trade-target"
                        type="number"
                        step="0.01"
                        min="0.01"
                        required={strategy !== 'turtle'}
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder={strategy === 'turtle' ? 'N/A (Trailing Stop)' : '0.00'}
                        className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label htmlFor="trade-stop-loss" className="text-slate-400 font-medium">
                        Stop Loss
                    </label>
                    <input
                        id="trade-stop-loss"
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        placeholder="0.00"
                        className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="trade-notes" className="text-slate-400 font-medium">
                    Thesis / Notes
                </label>
                <textarea
                    id="trade-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tesis de entrada, slippage, notas..."
                    className="bg-slate-900/50 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-1 focus:ring-accent focus:outline-none placeholder:text-slate-600 resize-none"
                />
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-1 py-2 rounded bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors font-semibold cursor-pointer disabled:opacity-50"
            >
                {isSubmitting ? 'Registrando...' : 'Add to Portfolio'}
            </button>
        </form>
    );
};
