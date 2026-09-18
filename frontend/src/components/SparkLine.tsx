import React from 'react';
import { ResponsiveContainer, LineChart, Line, YAxis, ReferenceLine, Tooltip } from 'recharts';

interface SparkLineProps {
    data: { value: number }[];
    baseline: number;
}

export default function SparkLine({ data, baseline }: SparkLineProps) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
                <YAxis
                    hide
                    domain={[
                        (dataMin: number) => Math.min(dataMin, baseline),
                        (dataMax: number) => Math.max(dataMax, baseline)
                    ]}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1e293b',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        padding: '4px 8px'
                    }}
                    itemStyle={{ color: '#10b981' }}
                    formatter={(value: any) => [`$${value}`, '']}
                    labelStyle={{ display: 'none' }}
                    cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <ReferenceLine opacity={1.0} stroke="#c0c0c0ff" strokeDasharray="3 3" y={baseline} />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}