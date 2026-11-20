'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { RevenuePoint } from '@/types';
import { formatCOP } from '@/lib/utils';

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9ebef" vertical={false} />
          <XAxis dataKey="label" stroke="#8a90a0" fontSize={12} tickLine={false} />
          <YAxis
            stroke="#8a90a0"
            fontSize={12}
            tickLine={false}
            tickFormatter={(v) => `$${v / 1000}k`}
          />
          <Tooltip
            formatter={(value: any) => [formatCOP(Number(value)), 'Ingresos']}
            labelFormatter={(label) => `Mes: ${label}`}
            contentStyle={{
              backgroundColor: '#14181f',
              borderColor: '#232834',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="revenue" fill="#2f66e6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}