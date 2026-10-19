import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Button } from '../button';
import { Textarea } from '../textarea';
import { Tabs } from '../uab/primitives/feedback';
import { FormDrawer } from './FormDrawer';

export interface InspectorTab {
  key: string;
  label: string;
  content: ReactNode;
}

export interface InspectorComment {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending?: boolean;
}

export interface RecordInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Record title, 18px in the drawer header. */
  title: string;
  /** Explanation shown behind the ⓘ icon next to the title. */
  description?: string;
  /** Status chip shown in the header, e.g. a `StatusBadge`. */
  status?: ReactNode;
  tabs: InspectorTab[];
  /** Previous and next record in the list the drawer was opened from. */
  onPrevious?: () => void;
  onNext?: () => void;
  /** When set, the footer shows Cancel · Edit and the comment box is hidden while editing. */
  onEdit?: () => void;
  editing?: boolean;
  /** One comment composer at the bottom, shared by every tab. */
  comment?: InspectorComment;
}

/** Record view as a side drawer: header with status and prev/next, Details/Related/Activity/Comments tabs, one comment box. */
export function RecordInspector({
  open,
  onOpenChange,
  title,
  description,
  status,
  tabs,
  onPrevious,
  onNext,
  onEdit,
  editing = false,
  comment,
}: RecordInspectorProps) {
  const [tab, setTab] = useState<string | undefined>(undefined);
  const active = tab && tabs.some((item) => item.key === tab) ? tab : tabs[0]?.key;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      noPadding
      headerRight={
        <>
          {status}
          {(onPrevious || onNext) && (
            <div className="uab-inspector-nav">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous record"
                disabled={!onPrevious}
                onClick={onPrevious}
              >
                <ChevronUp size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next record"
                disabled={!onNext}
                onClick={onNext}
              >
                <ChevronDown size={16} aria-hidden="true" />
              </Button>
            </div>
          )}
        </>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {onEdit && !editing && (
            <Button variant="primary" onClick={onEdit}>
              Edit
            </Button>
          )}
        </>
      }
    >
      <div className="uab-inspector-body">
        <div className="uab-inspector-tabs">
          <Tabs
            label="Record sections"
            value={active ?? ''}
            onChange={setTab}
            tabs={tabs.map((item) => ({ id: item.key, label: item.label }))}
          />
        </div>
        <div className="uab-inspector-content">
          {tabs.map((item) =>
            item.key === active ? (
              <div key={item.key} role="tabpanel">
                {item.content}
              </div>
            ) : null,
          )}
        </div>
        {comment && !editing && (
          <form
            className="uab-inspector-comment"
            onSubmit={(event) => {
              event.preventDefault();
              if (comment.value.trim()) comment.onSubmit();
            }}
          >
            <Textarea
              rows={2}
              aria-label="Add a comment"
              placeholder="Add a comment"
              value={comment.value}
              onChange={(event) => comment.onChange(event.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              size="icon"
              aria-label="Send comment"
              disabled={comment.pending || !comment.value.trim()}
            >
              <Send size={16} aria-hidden="true" />
            </Button>
          </form>
        )}
      </div>
    </FormDrawer>
  );
}
