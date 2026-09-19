import React, { ReactNode } from 'react';

// Definimos la interfaz de la columna usando un Genérico <T>
export interface ColumnDef<T> {
    header: string; // Ej: "TICKER", "PRECIO CIERRE"
    accessorKey: keyof T; // La llave del JSON (ej: "ticker", "precio")
    cell?: (item: T) => ReactNode; // Opcional: Si quieres renderizar algo especial (como un botón verde)
}

interface DataTableProps<T> {
    columns: ColumnDef<T>[];
    data: T[];
}

export function DataTable<T>({ columns, data }: DataTableProps<T>) {
    return (
        <div className="w-full overflow-x-auto flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr>
                        {columns.map((col, index) => (
                            <th
                                key={index}
                                className="pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800"
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr
                            key={rowIndex}
                            className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                        >
                            {columns.map((col, colIndex) => (
                                <td key={colIndex} className="py-2.5 text-xs text-slate-300">
                                    {/* Si pasamos una función de renderizado especial, la usamos. Si no, mostramos el texto plano */}
                                    {col.cell ? col.cell(row) : (row[col.accessorKey] as ReactNode)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}