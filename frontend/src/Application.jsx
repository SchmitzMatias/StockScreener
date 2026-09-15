import React, { useState } from 'react';

export default function App() {
  // Estado local para simular la interacción del Trade Activo
  const [activeTrade, setActiveTrade] = useState({
    ticker: "TPR",
    name: "Tapestry",
    entry: 128.67,
    current: 131.05,
    target: 140.20,
    stopLoss: 118.00,
    day: 3,
    maxDays: 15,
    pnlUsd: 9.52,
    pnlPct: 1.8
  });

  const top5 = [
    { ticker: "FSLR", price: 182.34, bounce: 2.45, target: 188.70 },
    { ticker: "TPR", price: 51.28, bounce: 2.31, target: 53.20 },
    { ticker: "ALAB", price: 89.67, bounce: 2.28, target: 92.60 },
    { ticker: "PDD", price: 126.15, bounce: 2.21, target: 130.10 },
    { ticker: "MDB", price: 267.89, bounce: 2.14, target: 275.40 },
  ];

  const theoreticalTrades = [
    { date: "20 May", ticker: "WDC", dir: "LONG", entry: 62.15, exit: "64.20 (TARGET)", pnl: "+$2.05", r: "+1.15R", win: true },
    { date: "20 May", ticker: "INTC", dir: "LONG", entry: 31.42, exit: "30.10 (STOP)", pnl: "-$1.32", r: "-1.00R", win: false },
    { date: "20 May", ticker: "BILI", dir: "LONG", entry: 14.85, exit: "16.50 (TARGET)", pnl: "+$1.65", r: "+1.11R", win: true },
    { date: "20 May", ticker: "DDOG", dir: "LONG", entry: 121.30, exit: "118.40 (STOP)", pnl: "-$2.90", r: "-1.02R", win: false },
    { date: "19 May", ticker: "COIN", dir: "LONG", entry: 187.60, exit: "191.80 (TARGET)", pnl: "+$4.20", r: "+1.12R", win: true },
    { date: "19 May", ticker: "SNOW", dir: "LONG", entry: 164.35, exit: "167.60 (TARGET)", pnl: "+$3.25", r: "+1.08R", win: true },
    { date: "19 May", ticker: "U", dir: "LONG", entry: 32.10, exit: "31.10 (STOP)", pnl: "-$1.00", r: "-1.00R", win: false },
    { date: "16 May", ticker: "RBLX", dir: "LONG", entry: 42.20, exit: "45.30 (TARGET)", pnl: "+$3.10", r: "+1.07R", win: true },
    { date: "16 May", ticker: "FSLR", dir: "LONG", entry: 176.40, exit: "179.90 (TARGET)", pnl: "+$3.50", r: "+1.02R", win: true },
    { date: "15 May", ticker: "PLTR", dir: "LONG", entry: 22.80, exit: "24.30 (TARGET)", pnl: "+$1.50", r: "+1.07R", win: true },
    { date: "15 May", ticker: "AI", dir: "LONG", entry: 28.70, exit: "26.90 (STOP)", pnl: "-$1.80", r: "-1.04R", win: false },
    { date: "14 May", ticker: "ATS", dir: "LONG", entry: 27.35, exit: "29.85 (TARGET)", pnl: "+$2.50", r: "+1.07R", win: true },
    { date: "14 May", ticker: "ZS", dir: "LONG", entry: 181.50, exit: "178.80 (STOP)", pnl: "-$2.70", r: "-1.01R", win: false },
    { date: "13 May", ticker: "SHOP", dir: "LONG", entry: 63.20, exit: "67.10 (TARGET)", pnl: "+$3.90", r: "+1.04R", win: true },
    { date: "13 May", ticker: "NET", dir: "LONG", entry: 91.80, exit: "92.85 (TARGET)", pnl: "+$1.05", r: "+1.01R", win: true },
    { date: "12 May", ticker: "APP", dir: "LONG", entry: 15.60, exit: "14.55 (STOP)", pnl: "-$1.05", r: "-1.00R", win: false },
    { date: "12 May", ticker: "CRWD", dir: "LONG", entry: 298.70, exit: "305.60 (TARGET)", pnl: "+$6.90", r: "+1.02R", win: true }
  ];

  const realTrades = [
    { ticker: "COIN", date: "16 May", days: 9, pnl: "+$8.20", pct: "+4.35%", win: true },
    { ticker: "DDOG", date: "13 May", days: 6, pnl: "-$3.10", pct: "-2.55%", win: false },
    { ticker: "U", date: "09 May", days: 8, pnl: "+$4.75", pct: "+3.21%", win: true },
    { ticker: "SNOW", date: "06 May", days: 7, pnl: "+$6.40", pct: "+5.12%", win: true },
    { ticker: "RBLX", date: "02 May", days: 10, pnl: "+$5.30", pct: "+4.67%", win: true },
    { ticker: "NET", date: "29 Apr", days: 11, pnl: "+$6.80", pct: "+5.45%", win: true },
    { ticker: "APP", date: "26 Apr", days: 5, pnl: "-$2.15", pct: "-1.65%", win: false },
    { ticker: "PLTR", date: "22 Apr", days: 12, pnl: "+$6.10", pct: "+4.21%", win: true },
  ];

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-200 font-sans p-4 flex flex-col justify-between text-xs selection:bg-cyan-500 selection:text-black">

      {/* 2. BODY PRINCIPAL: 3 COLUMNAS */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">

        {/* COLUMNA 1: OPERATIVA & KPIs TEÓRICOS (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* TOP 5 DEL DÍA */}
          <section className="bg-[#0e1626] border border-slate-800 rounded-lg p-3 flex flex-col">
            <div className="flex items-center gap-1.5 mb-1 text-amber-400 font-bold tracking-wide">
              <span>🏆</span> <span>TOP 5 DEL DÍA</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">Candidatas frescas identificadas al cierre</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] text-slate-400 border-b border-slate-800 pb-1">
                    <th className="py-1">TICKER</th>
                    <th>PRECIO</th>
                    <th>BOUNCE</th>
                    <th>TARGET</th>
                    <th className="text-right">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {top5.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="py-1.5 font-bold text-slate-100">{item.ticker}</td>
                      <td>${item.price.toFixed(2)}</td>
                      <td className="text-cyan-400 font-medium">{item.bounce}</td>
                      <td className="text-slate-300">${item.target.toFixed(2)}</td>
                      <td className="text-right">
                        <button
                          onClick={() => setActiveTrade({ ...activeTrade, ticker: item.ticker, entry: item.price, target: item.target })}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2 py-0.5 rounded text-[9px] transition"
                        >
                          Tomar {item.ticker}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/80 text-[9px] text-slate-400 flex items-center gap-1">
              <span>🔄</span> Actualizado automáticamente desde CSV - 17:15 hs
            </div>
          </section>

          {/* RENDIMIENTO TEÓRICO (BOT) */}
          <section className="bg-[#0e1626] border border-slate-800 rounded-lg p-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-slate-200 font-bold tracking-wide">
                <span>🤖</span> <span>RENDIMIENTO TEÓRICO (BOT)</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-slate-800/60 my-2">
                <div>
                  <span className="text-[9px] text-slate-400 block">WIN RATE 30D</span>
                  <span className="text-lg font-black text-emerald-400">68%</span>
                  <span className="text-[8px] text-slate-400 block">(Últimos 30 días)</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block">RRR PROMEDIO</span>
                  <span className="text-lg font-black text-slate-100">1 : 1.2</span>
                  <span className="text-[8px] text-slate-400 block">(Ganancia : Riesgo)</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block">PnL MENSUAL</span>
                  <span className="text-lg font-black text-emerald-400">+$340</span>
                  <span className="text-[8px] text-slate-400 block">USD</span>
                </div>
              </div>

              {/* Chart SVG Teórico */}
              <div className="mt-2">
                <span className="text-[9px] text-slate-400 block mb-1">PnL Teórico Acumulado (USD)</span>
                <div className="relative h-24 w-full bg-[#080d16] rounded border border-slate-800 p-1 flex items-end">
                  <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                    <path d="M0 60 L30 50 L60 55 L90 40 L120 48 L150 25 L180 30 L210 15 L240 10 L270 20 L300 5"
                      fill="none" stroke="#10b981" strokeWidth="2" />
                    <path d="M0 60 L30 50 L60 55 L90 40 L120 48 L150 25 L180 30 L210 15 L240 10 L270 20 L300 5 L300 80 L0 80 Z"
                      fill="url(#gradTheoretical)" opacity="0.1" />
                    <defs>
                      <linearGradient id="gradTheoretical" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="flex justify-between text-[8px] text-slate-400 mt-1">
                  <span>20 Abr</span><span>27 Abr</span><span>4 May</span><span>11 May</span><span>18 May</span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800 text-[9px] text-slate-400 flex justify-between">
              <span>TRADES SIMULADOS (30D): <strong className="text-slate-200">42</strong></span>
              <span>OPERACIONES ABIERTAS: <strong className="text-slate-200">5</strong></span>
            </div>
          </section>

        </div>

        {/* COLUMNA 2: TRADES TEÓRICOS CERRADOS (5 Cols - Scroll Central) */}
        <div className="lg:col-span-5 flex flex-col">
          <section className="bg-[#0e1626] border border-slate-800 rounded-lg p-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-200 font-bold tracking-wide">
                <span>📊</span> <span>TRADES TEÓRICOS CERRADOS (BOT)</span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2">Resultados de todas las señales teóricas auditadas por el script</p>

              <div className="overflow-y-auto max-h-[520px] pr-1">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[#0e1626] border-b border-slate-800 text-[9px] text-slate-400">
                    <tr>
                      <th className="py-1">FECHA</th>
                      <th>TICKER</th>
                      <th>DIRECCIÓN</th>
                      <th>ENTRY</th>
                      <th>EXIT (TARGET/STOP)</th>
                      <th>PnL (USD)</th>
                      <th className="text-right">R</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {theoreticalTrades.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/20">
                        <td className="py-1.5 text-slate-400">{t.date}</td>
                        <td className="font-bold text-slate-100">{t.ticker}</td>
                        <td className="text-cyan-400 font-semibold">{t.dir}</td>
                        <td>${t.entry.toFixed(2)}</td>
                        <td className={t.win ? "text-emerald-400" : "text-rose-400"}>{t.exit}</td>
                        <td className={`font-semibold ${t.win ? "text-emerald-400" : "text-rose-400"}`}>{t.pnl}</td>
                        <td className={`text-right font-medium ${t.win ? "text-emerald-400" : "text-rose-400"}`}>{t.r}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] bg-slate-900/50 p-2 rounded">
              <span className="text-slate-400">Win Rate: <strong className="text-emerald-400">68%</strong></span>
              <span className="text-slate-400">RRR Promedio: <strong className="text-slate-200">1 : 1.2</strong></span>
              <span className="text-slate-400">PnL Acumulado: <strong className="text-emerald-400">+$1,125 USD</strong></span>
            </div>
          </section>
        </div>

        {/* COLUMNA 3: PORTAFOLIO REAL & TRADES HUMANOS (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* TRADE ACTIVO */}
          <section className="bg-[#0e1626] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-200 font-bold tracking-wide">
                <span>🛡️</span> <span>TRADE ACTIVO (TU CAPITAL)</span>
              </div>
              <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px] text-slate-300">
                Día {activeTrade.day} de {activeTrade.maxDays} ⏳
              </span>
            </div>

            <div className="bg-[#090e17] border border-slate-800/80 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black text-sm">
                    {activeTrade.ticker}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100">{activeTrade.ticker} <span className="text-slate-400 text-xs font-normal">({activeTrade.name})</span></div>
                    <div className="text-[10px] text-slate-400">Entrada: <strong className="text-slate-200">${activeTrade.entry}</strong> → Actual: <strong className="text-emerald-400">${activeTrade.current}</strong></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center py-2 border-y border-slate-800 mb-3 text-[10px]">
                <div>
                  <span className="text-slate-400 block text-[9px]">TARGET LÍMITE</span>
                  <span className="text-emerald-400 font-bold text-xs">${activeTrade.target.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">STOP LOSS</span>
                  <span className="text-rose-400 font-bold text-xs">${activeTrade.stopLoss.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 block">PnL Flotante</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-black text-emerald-400">+${activeTrade.pnlUsd}</span>
                    <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 rounded text-[9px] font-bold">+{activeTrade.pnlPct}%</span>
                  </div>
                </div>
                <button
                  onClick={() => alert("Trade enviado a Historial Real")}
                  className="bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 hover:border-rose-600 text-rose-300 hover:text-white px-3 py-1.5 rounded text-[10px] font-bold transition"
                >
                  Cerrar Trade
                </button>
              </div>
            </div>
          </section>

          {/* HISTORIAL DE OPERACIONES REALES */}
          <section className="bg-[#0e1626] border border-slate-800 rounded-lg p-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-slate-200 font-bold tracking-wide">
                <span>📁</span> <span>HISTORIAL DE OPERACIONES REALES</span>
              </div>

              {/* KPIs Reales */}
              <div className="grid grid-cols-4 gap-1 text-center py-1.5 border-y border-slate-800/60 mb-2">
                <div>
                  <span className="text-[8px] text-slate-400 block">WIN RATE</span>
                  <span className="text-sm font-black text-emerald-400">75%</span>
                </div>
                <div>
                  <span className="text-[8px] text-slate-400 block">TRADES</span>
                  <span className="text-sm font-black text-slate-100">8</span>
                </div>
                <div>
                  <span className="text-[8px] text-slate-400 block">GANANCIA NETA</span>
                  <span className="text-sm font-black text-emerald-400">+$44</span>
                </div>
                <div>
                  <span className="text-[8px] text-slate-400 block">FRICCIÓN</span>
                  <span className="text-sm font-black text-rose-400">$4</span>
                </div>
              </div>

              {/* Tabla Real */}
              <div className="overflow-y-auto max-h-[140px]">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="text-[8px] text-slate-400 border-b border-slate-800">
                      <th className="py-1">TICKER</th>
                      <th>CIERRE</th>
                      <th>DÍAS</th>
                      <th>RESULTADO ($)</th>
                      <th className="text-right">(%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {realTrades.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/20">
                        <td className="py-1 font-bold text-slate-100">{r.ticker}</td>
                        <td className="text-slate-400">{r.date}</td>
                        <td className="text-slate-300">{r.days}</td>
                        <td className={`font-semibold ${r.win ? "text-emerald-400" : "text-rose-400"}`}>{r.pnl}</td>
                        <td className={`text-right font-medium ${r.win ? "text-emerald-400" : "text-rose-400"}`}>{r.pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mini Chart PnL Real */}
            <div className="mt-2 pt-2 border-t border-slate-800">
              <span className="text-[9px] text-slate-400 block mb-1">PnL Neto Acumulado Real (USD)</span>
              <div className="h-14 w-full bg-[#080d16] rounded border border-slate-800 p-1 flex items-end">
                <svg className="w-full h-full" viewBox="0 0 300 50" preserveAspectRatio="none">
                  <path d="M0 45 L40 40 L80 42 L120 30 L160 32 L200 20 L240 22 L300 10"
                    fill="none" stroke="#06b6d4" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </section>

        </div>

      </main>

      {/* 3. FOOTER */}
      <footer className="mt-3 pt-2 border-t border-slate-800/80 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-400">
        <div>Kotegawa Trading System • Disciplina, Datos y Paciencia</div>
        <div>Los datos se actualizan al cierre del mercado (NYSE)</div>
      </footer>

    </div>
  );
}