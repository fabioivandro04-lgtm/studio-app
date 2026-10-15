'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Paleta categórica validada (dataviz/validate_palette.js, modo claro): ordem fixa, nunca reciclada.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

const fmt = new Intl.NumberFormat('pt-PT');
const day = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function FollowersChart({ data, series }: { data: Array<Record<string, number | string>>; series: { key: string; label: string }[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Ainda sem dados de seguidores. A recolha corre 1 vez por dia.</p>;
  return (
    <div className="h-64 w-full" role="img" aria-label="Evolução de seguidores por conta">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="day" tickFormatter={day} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => fmt.format(v)} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={56} />
          <Tooltip
            formatter={(v, name) => [fmt.format(Number(v)), series.find((s) => s.key === name)?.label ?? String(name)]}
            labelFormatter={(l) => day(String(l))}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Legend formatter={(key) => <span className="text-xs text-foreground">{series.find((s) => s.key === key)?.label ?? key}</span>} />
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
