import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

export interface RadarScores {
  communication:  number;   // 0-100
  technical:      number;
  confidence:     number;
  problemSolving: number;
  culturalFit:    number;
}

interface ScoreRadarProps {
  scores:      RadarScores;
  /** Per-axis benchmark values (0-100). Defaults to 65 for every axis. */
  benchmarks?: Partial<RadarScores>;
  className?:  string;
}

const AXES: { key: keyof RadarScores; label: string }[] = [
  { key: 'communication',  label: 'Communication'  },
  { key: 'technical',      label: 'Technical'       },
  { key: 'confidence',     label: 'Confidence'      },
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'culturalFit',    label: 'Cultural Fit'    },
];

const DEFAULT_BENCHMARK = 65;

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-neutral-200 rounded-lg shadow-sm px-3 py-2 text-sm">
      <p className="font-semibold text-neutral-900 mb-1">{d.subject}</p>
      <p className="text-primary-600">
        <span className="font-bold">{d.value}</span>
        <span className="text-neutral-400 font-normal">/100</span>
        <span className="text-neutral-400 font-normal ml-1">(candidate)</span>
      </p>
      <p className="text-neutral-500">
        <span className="font-semibold">{d.benchmark}</span>
        <span className="text-neutral-400 font-normal">/100</span>
        <span className="text-neutral-400 font-normal ml-1">(benchmark)</span>
      </p>
    </div>
  );
}

// ─── Legend renderer ──────────────────────────────────────────────────────────

function LegendContent() {
  return (
    <div className="flex items-center justify-center gap-6 mt-1">
      {/* Candidate series */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-8 h-0 border-t-2 rounded"
          style={{ borderColor: '#6366f1' }}
          aria-hidden="true"
        />
        <span className="text-xs text-neutral-600 font-medium">Candidate Score</span>
      </div>
      {/* Benchmark series */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-8 h-0 border-t-2 border-dashed rounded"
          style={{ borderColor: '#d1d5db' }}
          aria-hidden="true"
        />
        <span className="text-xs text-neutral-500">Role Benchmark</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScoreRadar({ scores, benchmarks, className }: ScoreRadarProps) {
  const data = AXES.map(({ key, label }) => ({
    subject:   label,
    value:     scores[key] ?? 0,
    benchmark: benchmarks?.[key] ?? DEFAULT_BENCHMARK,
    fullMark:  100,
  }));

  return (
    <div
      className={className}
      role="img"
      aria-label="Competency radar chart showing candidate vs. role benchmark scores"
    >
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

          {/* Benchmark — dashed outline, no fill */}
          <Radar
            name="Role Benchmark"
            dataKey="benchmark"
            stroke="#d1d5db"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            fill="none"
          />

          {/* Candidate — filled area */}
          <Radar
            name="Candidate Score"
            dataKey="value"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.25}
            strokeWidth={2}
            dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend content={<LegendContent />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Accessible score table */}
      <table className="sr-only">
        <caption>Competency scores — candidate vs. benchmark</caption>
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Candidate (0-100)</th>
            <th>Benchmark (0-100)</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.subject}>
              <td>{d.subject}</td>
              <td>{d.value}</td>
              <td>{d.benchmark}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
