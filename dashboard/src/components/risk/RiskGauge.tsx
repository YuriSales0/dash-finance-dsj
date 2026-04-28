interface Props {
  score: number;
  level: "low" | "medium" | "high" | "critical";
}

export function RiskGauge({ score, level }: Props) {
  // 180deg arc (semicircle), score maps to 0-180deg
  const angle = Math.min(Math.max(score, 0), 100) * 1.8;
  const radius = 80;
  const cx = 100;
  const cy = 100;

  // Pointer position
  const rad = (angle - 90) * (Math.PI / 180);
  const px = cx + radius * Math.cos(rad);
  const py = cy + radius * Math.sin(rad);

  const colors = {
    low: "#22c55e",
    medium: "#f59e0b",
    high: "#f97316",
    critical: "#ef4444",
  };
  const labels = {
    low: "Baixo",
    medium: "Moderado",
    high: "Alto",
    critical: "Critico",
  };

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="120" viewBox="0 0 200 120">
        {/* Background arc */}
        <path
          d={`M 20 100 A 80 80 0 0 1 180 100`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Colored segments */}
        <path d="M 20 100 A 80 80 0 0 1 60 32" fill="none" stroke="#22c55e" strokeWidth="14" strokeLinecap="round" opacity={score < 25 ? 1 : 0.25} />
        <path d="M 60 32 A 80 80 0 0 1 100 20" fill="none" stroke="#f59e0b" strokeWidth="14" strokeLinecap="round" opacity={score >= 25 && score < 50 ? 1 : 0.25} />
        <path d="M 100 20 A 80 80 0 0 1 140 32" fill="none" stroke="#f97316" strokeWidth="14" strokeLinecap="round" opacity={score >= 50 && score < 75 ? 1 : 0.25} />
        <path d="M 140 32 A 80 80 0 0 1 180 100" fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" opacity={score >= 75 ? 1 : 0.25} />
        {/* Pointer */}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke={colors[level]} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill={colors[level]} />
      </svg>
      <div className="text-center -mt-2">
        <div className="text-3xl font-bold" style={{ color: colors[level] }}>
          {score.toFixed(0)}
        </div>
        <div className="text-sm font-medium" style={{ color: colors[level] }}>
          {labels[level]}
        </div>
      </div>
    </div>
  );
}
