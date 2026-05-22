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
  if (!data || data.length === 0) return null;

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
