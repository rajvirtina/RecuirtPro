import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from 'recharts';

export interface TimeSeriesPoint {
  date:      string; // ISO date string "2024-01-15"
  total:     number;
  qualified: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

const LINE_TOTAL     = '#6366f1'; // primary-500
const LINE_QUALIFIED = '#22c55e'; // success-500
const GRID_COLOR     = '#f1f1f7'; // neutral-100
const AXIS_COLOR     = '#9ca3af'; // neutral-400

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  let dateLabel = label;
  try { dateLabel = format(new Date(label), 'MMM d, yyyy'); } catch { /* fallback */ }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg shadow-md px-4 py-3 text-sm min-w-[160px]">
      <p className="font-semibold text-neutral-900 mb-2">{dateLabel}</p>
      <div className="space-y-1.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} aria-hidden="true" />
              <span className="text-neutral-600">{p.name}</span>
            </div>
            <span className="font-bold text-neutral-900">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomLegend() {
  return (
    <div className="flex justify-center gap-6 mt-2">
      {[
        { color: LINE_TOTAL,     label: 'Total Applications' },
        { color: LINE_QUALIFIED, label: 'AI Qualified (score ≥ 70%)' },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: item.color }} aria-hidden="true" />
          <span className="text-xs text-neutral-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const tickFormatter = (dateStr: string) => {
    try { return format(new Date(dateStr), 'MMM d'); }
    catch { return dateStr; }
  };

  // Thin down x-axis ticks when there are many data points
  const tickCount = data.length <= 14 ? undefined : Math.min(8, data.length);

  return (
    <div role="img" aria-label="Applications over time line chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis
            dataKey="date"
            tickFormatter={tickFormatter}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={tickCount ? Math.floor(data.length / tickCount) : 'preserveStartEnd'}
          />
          <YAxis
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="total"
            name="Total Applications"
            stroke={LINE_TOTAL}
            strokeWidth={2}
            dot={data.length <= 30 ? <Dot r={3} fill={LINE_TOTAL} stroke="#fff" strokeWidth={1} /> : false}
            activeDot={{ r: 5, fill: LINE_TOTAL, stroke: '#fff', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="qualified"
            name="AI Qualified"
            stroke={LINE_QUALIFIED}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={data.length <= 30 ? <Dot r={3} fill={LINE_QUALIFIED} stroke="#fff" strokeWidth={1} /> : false}
            activeDot={{ r: 5, fill: LINE_QUALIFIED, stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <CustomLegend />

      <table className="sr-only" aria-label="Application volume data">
        <thead><tr><th>Date</th><th>Total Applications</th><th>AI Qualified</th></tr></thead>
        <tbody>
          {data.map(d => (
            <tr key={d.date}>
              <td>{d.date}</td><td>{d.total}</td><td>{d.qualified}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
