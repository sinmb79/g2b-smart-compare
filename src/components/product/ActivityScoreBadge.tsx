/**
 * Displays the vendor activity score (납품활동 지표).
 * Always shows "(참고 지표)" — never "신뢰도" or "품질".
 */

interface ActivityScoreBadgeProps {
  score: number;
  size?: "sm" | "md";
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-700 bg-green-50 border-green-200";
  if (score >= 60) return "text-blue-700 bg-blue-50 border-blue-200";
  if (score >= 40) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-gray-600 bg-gray-50 border-gray-200";
}

export function ActivityScoreBadge({ score, size = "md" }: ActivityScoreBadgeProps) {
  const colorClass = getScoreColor(score);
  const rounded = Math.round(score);

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs border rounded px-1.5 py-0.5 ${colorClass}`}
        title="납품활동 지표 (참고 지표)"
        aria-label={`납품활동 지표 ${rounded}점 (참고 지표)`}
      >
        📊 {rounded}점
        <span className="text-gray-400 text-[10px]">(참고)</span>
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 text-sm border rounded-lg px-3 py-1.5 ${colorClass}`}
      aria-label={`납품활동 지표 ${rounded}점 (참고 지표)`}
    >
      <span className="font-semibold">{rounded}점</span>
      <span className="text-xs opacity-70">/ 100점 (참고 지표)</span>
    </div>
  );
}
