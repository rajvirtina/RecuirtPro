import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from 'recharts';

export interface FunnelStage {
  stage: string;
  count: number;
  conversionRate: number; // 0-100, rate from previous stage
}

interface FunnelChartProps {
  data: FunnelStage[];
}

// Design-token hex values (Tailwind classes can't be used in Recharts props)
const STAGE_COLOR  = '#818cf8'; // primary-400
const HIRED_COLOR  = '#22c55e'; // success-500
const GRID_COLOR   = '#f1f1f7'; // neutral-100
const AXIS_COLOR   = '#9ca3af'; // neutral-400
const LABEL_COLOR  = '#374151'; // neutral-700

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload as FunnelStage;
  return (
    <div className="bg-white border border-neutral-200 rounded-lg shadow-md px-4 py-3 text-sm min-w-[160px]">
      <p className="font-semibold text-neutral-900 mb-2">{item.stage}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">Count</span>
          <span className="font-bold text-neutral-900">{item.count.toLocaleString()}</span>
        </div>
        {item.conversionRate < 100 && (
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">Conversion</span>
            <span className="font-bold text-neutral-900">{item.conversionRate}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Custom right-side label showing conversion rate for all stages except Applied
function ConversionLabel({ x, y, width, height, value, index }: any) {
  if (index === 0) return null; // no label for "Applied" stage
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      dy="0.35em"
      textAnchor="start"
      fill="#6b7280"
      fontSize={11}
      fontWeight={500}
      aria-label={`${value}% conversion from previous stage`}
    >
      {value}% conv.
    </text>
  );
}

export function FunnelChart({ data }: FunnelChartProps) {
  // Inject index so the custom label renderer knows which bar it's on
  const enriched = data.map((d, i) => ({ ...d, _index: i }));

  return (
    <div
      role="img"
      aria-label={`Conversion funnel: ${data.map(d => `${d.stage} ${d.count}`).join(', ')}`}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          layout="vertical"
          data={enriched}
          margin={{ top: 4, right: 90, bottom: 4, left: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke={GRID_COLOR}
          />
          <XAxis
            type="number"
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v.toLocaleString()}
          />
          <YAxis
            type="category"
            dataKey="stage"
            width={90}
            tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8f8fc' }} />
          <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={30}>
            {enriched.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.stage === 'Hired' ? HIRED_COLOR : STAGE_COLOR}
              />
            ))}
            {/* Count label inside / near bar */}
            <LabelList
              dataKey="count"
              position="insideRight"
              style={{ fill: '#ffffff', fontSize: 12, fontWeight: 700 }}
              formatter={(v: number) => v > 0 ? v.toLocaleString() : ''}
            />
            {/* Conversion rate label outside bar */}
            <LabelList
              dataKey="conversionRate"
              content={(props) => <ConversionLabel {...props} />}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Accessible fallback table */}
      <table className="sr-only" aria-label="Funnel data">
        <thead><tr><th>Stage</th><th>Count</th><th>Conversion from previous</th></tr></thead>
        <tbody>
          {data.map(d => (
            <tr key={d.stage}>
              <td>{d.stage}</td>
              <td>{d.count}</td>
              <td>{d.conversionRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
