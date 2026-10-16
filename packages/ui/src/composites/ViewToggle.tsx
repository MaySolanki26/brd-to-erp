import { List, LayoutList } from 'lucide-react';
import { Button } from '../button';

export type ViewMode = 'tabs' | 'expanded';

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-gray-200 p-0.5">
      <Button
        variant={view === 'expanded' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-6 w-6"
        onClick={() => onViewChange('expanded')}
        title="Grouped view"
      >
        <List className="h-3.5 w-3.5" strokeWidth={1.5} />
      </Button>
      <Button
        variant={view === 'tabs' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-6 w-6"
        onClick={() => onViewChange('tabs')}
        title="Tab view"
      >
        <LayoutList className="h-3.5 w-3.5" strokeWidth={1.5} />
      </Button>
    </div>
  );
}
