import { cn } from '../lib/cn';

interface ProgressRingProps {
  progress: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  strokeWidth?: number;
  diameter?: number;
}

export function ProgressRing({
  progress,
  size = 'md',
  showLabel = true,
  strokeWidth: strokeWidthOverride,
  diameter,
}: ProgressRingProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);

  const dimensions = {
    xs: { size: 18, strokeWidth: 2.75, fontSize: 'text-xxs' },
    sm: { size: 32, strokeWidth: 3, fontSize: 'text-xs' },
    md: { size: 48, strokeWidth: 4, fontSize: 'text-lg' },
    lg: { size: 64, strokeWidth: 5, fontSize: 'text-xl' },
  };

  const {
    size: defaultSize,
    strokeWidth: defaultStroke,
    fontSize,
  } = dimensions[size ?? 'md'];
  const svgSize = diameter ?? defaultSize;
  const strokeWidth = strokeWidthOverride ?? defaultStroke;
  const radius = (svgSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  const getColor = () => {
    if (normalizedProgress >= 80) return 'text-success';
    if (normalizedProgress >= 50) return 'text-info';
    if (normalizedProgress >= 25) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={svgSize} height={svgSize} className="-rotate-90 transform">
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn('transition-all duration-500', getColor())}
        />
      </svg>
      {showLabel && (
        <span className={cn('absolute font-medium', fontSize, getColor())}>
          {Math.round(normalizedProgress)}%
        </span>
      )}
    </div>
  );
}
