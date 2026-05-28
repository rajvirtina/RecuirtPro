import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface OfferBreakdown {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: OfferBreakdown[];
  acceptanceRate: number;
}

export function OfferRateChart({ data, acceptanceRate }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] gap-3 text-center">
        <svg className="w-10 h-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-medium text-neutral-500">No offer data yet</p>
        <p className="text-xs text-neutral-400">Offer acceptance data will appear once offers are sent</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Big rate display */}
      <div className="text-center">
        <p className="text-4xl font-bold text-neutral-900">{acceptanceRate}%</p>
        <p className="text-sm text-neutral-500 mt-1">Acceptance Rate</p>
      </div>

      {/* Donut chart */}
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            formatter={(value: number, name: string) => [`${value} offers`, name]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
