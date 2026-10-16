import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@brd/ui';
import { FileQuestion } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={FileQuestion}
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
      actionLabel="Go to Dashboard"
      onAction={() => navigate('/')}
      fill
    />
  );
}
