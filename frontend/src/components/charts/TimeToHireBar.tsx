import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LabelList,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface DepartmentHire {
  department: string;
  avgDays:    number;
  count:      number;
}

interface TimeToHireBarProps {
  departments: DepartmentHire[];
  companyAvg:  number;
}

const BAR_FAST   = '#22c55e'; // success-500 — faster than avg
const BAR_SLOW   = '#3b82f6'; // info-500    — at/above avg
const BENCH_LINE = '#ef4444'; // error-500   — benchmark
const GRID_COLOR = '#f1f1f7'; // neutral-100
const AXIS_COLOR = '#9ca3af'; // neutral-400

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DepartmentHire;
  return (
    <div className="bg-white border border-neutral-200 rounded-lg shadow-md px-4 py-3 text-sm">
      <p className="font-semibold text-neutral-900 mb-1">{d.department}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">Avg. days to hire</span>
          <span className="font-bold text-neutral-900">{d.avgDays.toFixed(1)} days</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">Hires in period</span>
          <span className="font-bold text-neutral-900">{d.count}</span>
        </div>
      </div>
    </div>
  );
}

export function TimeToHireBar({ departments, companyAvg }: TimeToHireBarProps) {
  if (!departments || departments.length === 0) return null;

  // X-axis domain: 0 → max + 20% headroom
  const maxDays = Math.max(...departments.map(d => d.avgDays), companyAvg);
  const domainMax = Math.ceil(maxDays * 1.25);

  const chartHeight = Math.max(160, departments.length * 44 + 40);

  return (
    <div role="img" aria-label={`Time to hire by department. Company average: ${companyAvg} days.`}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={departments}
          margin={{ top: 4, right: 80, bottom: 4, left: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_COLOR} />
          <XAxis
            type="number"
            domain={[0, domainMax]}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}d`}
          />
          <YAxis
            type="category"
            dataKey="department"
            width={110}
            tick={{ fill: '#374151', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8f8fc' }} />

          {/* Company average benchmark line */}
          {companyAvg > 0 && (
            <ReferenceLine
              x={companyAvg}
              stroke={BENCH_LINE}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              label={{
                value:    `Avg ${companyAvg.toFixed(0)}d`,
                position: 'top',
                fill:     BENCH_LINE,
                fontSize: 10,
                fontWeight: 600,
              }}
            />
          )}

          <Bar dataKey="avgDays" radius={[0, 5, 5, 0]} barSize={26}>
            {departments.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.avgDays <= companyAvg ? BAR_FAST : BAR_SLOW}
              />
            ))}
            <LabelList
              dataKey="avgDays"
              position="right"
              formatter={(v: number) => `${v.toFixed(1)}d`}
              style={{ fill: AXIS_COLOR, fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 text-xs text-neutral-500 justify-center">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: BAR_FAST }} />
          Below average
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: BAR_SLOW }} />
          Above average
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="16" y2="5" stroke={BENCH_LINE} strokeWidth="1.5" strokeDasharray="5 3" />
          </svg>
          Company avg
        </div>
      </div>

      <table className="sr-only">
        <caption>Time to hire by department</caption>
        <thead><tr><th>Department</th><th>Average Days</th><th>Hires</th></tr></thead>
        <tbody>
          {departments.map(d => (
            <tr key={d.department}>
              <td>{d.department}</td><td>{d.avgDays}</td><td>{d.count}</td>
            </tr>
          ))}
          <tr><td>Company Average</td><td>{companyAvg}</td><td>—</td></tr>
        </tbody>
      </table>
    </div>
  );
}
