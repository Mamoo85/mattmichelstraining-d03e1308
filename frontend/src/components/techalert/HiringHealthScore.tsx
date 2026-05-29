interface HiringHealthScoreProps {
  score?: number;
}

const HiringHealthScore = ({ score = 0 }: HiringHealthScoreProps) => (
  <div className="flex items-center gap-2">
    <div className="text-2xl font-black">{score}</div>
    <div className="text-xs text-muted-foreground">Hiring Health Score</div>
  </div>
);
export default HiringHealthScore;
