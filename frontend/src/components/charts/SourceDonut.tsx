import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface SourceData {
  source:     string;
  count:      number;
  percentage: number;
}

interface SourceDonutProps {
  data:  SourceData[];
  total: number;
}

// Distinct, accessible palette (checked against WCAG AA on white)
const PALETTE = [
  '#6366f1', // primary-500  (indigo)
  '#22c55e', // success-500  (green)
  '#f59e0b', // warning-500  (amber)
  '#3b82f6', // info-500     (blue)
  '#a855f7', // purple-500
  '#6b7280', // neutral-500  (grey)
];

const SOURCE_LABELS: Record<string, string> = {
  direct:   'Direct',
  naukri:   'Naukri',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  github:   'GitHub',
  other:    'Other',
};

function label(source: string) {
  return SOURCE_LABELS[source.toLowerCase()] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as SourceData;
  return (
    <div className="bg-white border border-neutral-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-neutral-900">{label(d.source)}</p>
      <p className="text-neutral-600">{d.count} applications</p>
      <p className="font-bold text-neutral-800">{d.percentage}%</p>
    </div>
  );
}

export function SourceDonut({ data, total }: SourceDonutProps) {
  if (!data || data.length === 0) return null;

  return (
    <div role="img" aria-label={`Application source breakdown: ${data.map(d => `${d.source} ${d.percentage}%`).join(', ')}`}>
      <div className="flex flex-col items-center">
        {/* Donut with center total */}
        <div className="relative">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="82%"
                dataKey="count"
                paddingAngle={data.length > 1 ? 2 : 0}
                startAngle={90}
                endAngle={-270}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PALETTE[index % PALETTE.length]}
                    stroke="white"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-neutral-900" aria-hidden="true">
              {total.toLocaleString()}
            </span>
            <span className="text-xs text-neutral-400" aria-hidden="true">total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="w-full mt-3 space-y-2">
          {data.map((entry, index) => (
            <div key={entry.source} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: PALETTE[index % PALETTE.length] }}
                  aria-hidden="true"
                />
                <span className="text-sm text-neutral-600 truncate">{label(entry.source)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-neutral-800 tabular-nums">
                  {entry.count}
                </span>
                <span className="text-xs text-neutral-400 w-10 text-right tabular-nums">
                  {entry.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Application sources</caption>
        <thead><tr><th>Source</th><th>Count</th><th>Percentage</th></tr></thead>
        <tbody>
          {data.map(d => (
            <tr key={d.source}>
              <td>{label(d.source)}</td><td>{d.count}</td><td>{d.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
