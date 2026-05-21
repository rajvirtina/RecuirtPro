import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface RadarScores {
  communication:  number;   // 0-100
  technical:      number;
  confidence:     number;
  problemSolving: number;
  culturalFit:    number;
}

interface ScoreRadarProps {
  scores: RadarScores;
  className?: string;
}

const AXES: { key: keyof RadarScores; label: string }[] = [
  { key: 'communication',  label: 'Communication'  },
  { key: 'technical',      label: 'Technical'       },
  { key: 'confidence',     label: 'Confidence'      },
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'culturalFit',    label: 'Cultural Fit'    },
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-neutral-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <p className="font-semibold text-neutral-900">{d.subject}</p>
      <p className="text-primary-600 font-bold">{d.value}<span className="text-neutral-400 font-normal">/100</span></p>
    </div>
  );
}

export function ScoreRadar({ scores, className }: ScoreRadarProps) {
  const data = AXES.map(({ key, label }) => ({
    subject:  label,
    value:    scores[key] ?? 0,
    fullMark: 100,
  }));

  return (
    <div className={className} role="img" aria-label="Competency radar chart showing scores for Communication, Technical, Confidence, Problem Solving, and Cultural Fit">
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#e5e7eb" gridType="polygon" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            tickCount={5}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.25}
            strokeWidth={2}
            dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Accessible score table beneath the chart */}
      <table className="sr-only">
        <caption>Competency scores</caption>
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Score (out of 100)</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.subject}>
              <td>{d.subject}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
