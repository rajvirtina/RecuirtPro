import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface HistogramBucket {
  range: string;
  count: number;
}

interface Props {
  data: HistogramBucket[];
  average?: number;
}

export function AIScoreHistogram({ data, average }: Props) {
  if (!data || data.length === 0) return null;

  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="range"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={{ stroke: '#e2e8f0' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
          formatter={(value: number) => [`${value} candidates`, 'Count']}
          labelFormatter={(label) => `Score: ${label}`}
        />
        <Bar
          dataKey="count"
          radius={[4, 4, 0, 0]}
          fill="#6366f1"
          maxBarSize={40}
        />
        {average != null && (
          <ReferenceLine
            x={data.findIndex(d => {
              const low = parseInt(d.range.split('-')[0]);
              return average >= low && average < low + 10;
            }) >= 0 ? data[data.findIndex(d => {
              const low = parseInt(d.range.split('-')[0]);
              return average >= low && average < low + 10;
            })].range : undefined}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{ value: `Avg: ${average}`, position: 'top', fontSize: 11, fill: '#f59e0b' }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
