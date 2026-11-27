'use client';

import { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { RevenuePoint } from '@/types';
import { formatCOP } from '@/lib/utils';

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Force re-render when theme changes by using a key that changes with the theme
  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    const handleThemeChange = () => {
      setThemeKey(prev => prev + 1);
    };
    
    // Listen for storage events (theme changes in other tabs)
    window.addEventListener('storage', handleThemeChange);
    
    // Also listen for local theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleThemeChange);
    
    return () => {
      window.removeEventListener('storage', handleThemeChange);
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  // Helper to format CSS variable values (RGB channels) into valid CSS color strings
  const formatVar = (varName: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    const computed = getComputedStyle(document.documentElement);
    const val = computed.getPropertyValue(varName).trim();
    if (!val) return fallback;
    // If it's pure RGB channels like "120 170 255", wrap in rgb()
    return val.includes(' ') || !val.startsWith('#') ? `rgb(${val})` : val;
  };

  // Read CSS variables for colors
  const getChartColors = () => {
    return {
      gridStroke: formatVar('--ink-300', '#e9ebef'),
      axisStroke: formatVar('--ink-500', '#8a90a0'),
      barFill: formatVar('--brand-500', '#2f66e6'),
      tooltipBg: formatVar('--surface', '#14181f'),
      tooltipBorder: formatVar('--ink-700', '#232834'),
      tooltipColor: formatVar('--ink-900', '#fff'),
    };
  };

  const colors = getChartColors();

  return (
    <div className="w-full h-72" ref={chartRef} key={themeKey}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} vertical={false} />
          <XAxis dataKey="label" stroke={colors.axisStroke} fontSize={12} tickLine={false} />
          <YAxis
            stroke={colors.axisStroke}
            fontSize={12}
            tickLine={false}
            tickFormatter={(v) => `$${v / 1000}k`}
          />
          <Tooltip
            formatter={(value) => [formatCOP(Number(value)), 'Ingresos']}
            labelFormatter={(label) => `Mes: ${label}`}
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              borderColor: colors.tooltipBorder,
              borderRadius: '12px',
              color: colors.tooltipColor,
              fontSize: '12px',
            }}
          />
          <Bar dataKey="revenue" fill={colors.barFill} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}