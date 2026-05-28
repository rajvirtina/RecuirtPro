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
  const hasData = data && data.some(d => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[260px] gap-3 text-center">
        <svg className="w-10 h-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm font-medium text-neutral-500">No AI score data yet</p>
        <p className="text-xs text-neutral-400">Scores will appear here once candidates complete AI interviews</p>
      </div>
    );
  }

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
