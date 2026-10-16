import { cn } from '../lib/cn';
import { Avatar, AvatarFallback, AvatarImage } from '../avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';

export interface AvatarGroupItem {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface AvatarGroupProps {
  participants: AvatarGroupItem[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}

export function AvatarGroup({ participants, max = 4, size = 'sm' }: AvatarGroupProps) {
  const visibleParticipants = participants.slice(0, max);
  const remainingCount = participants.length - max;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sizeConfig = {
    xs: { avatar: 'h-6 w-6', font: 'text-xs', overlap: '-ml-1.5', border: 'border' },
    sm: { avatar: 'h-8 w-8', font: 'text-lg', overlap: '-ml-2', border: 'border-2' },
    md: { avatar: 'h-10 w-10', font: 'text-xl', overlap: '-ml-2.5', border: 'border-2' },
  };

  const { avatar: avatarSize, font: fontSize, overlap, border } = sizeConfig[size];

  return (
    <TooltipProvider>
      <div className="flex items-center">
        {visibleParticipants.map((participant, index) => (
          <Tooltip key={participant.id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Avatar
                className={cn(
                  avatarSize,
                  border,
                  'border-white',
                  index > 0 && overlap,
                )}
              >
                <AvatarImage src={participant.avatarUrl} alt={participant.name} />
                <AvatarFallback className={cn(fontSize, 'bg-gray-100 text-gray-600')}>
                  {getInitials(participant.name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              <span className="text-lg">{participant.name}</span>
            </TooltipContent>
          </Tooltip>
        ))}

        {remainingCount > 0 && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  avatarSize,
                  overlap,
                  'rounded-full border-white bg-zinc-100',
                  border,
                  'flex items-center justify-center',
                  fontSize,
                  'text-muted-foreground font-medium',
                )}
              >
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4} variant="light">
              <div>
                {participants.slice(max).map((p) => (
                  <div key={p.id}>{p.name}</div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
