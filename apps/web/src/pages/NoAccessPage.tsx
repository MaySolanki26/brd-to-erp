import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@brd/ui';
import { ShieldOff } from 'lucide-react';

export function NoAccessPage() {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={ShieldOff}
      title="Access denied"
      description="You don't have permission to view this page."
      actionLabel="Go to Dashboard"
      onAction={() => navigate('/')}
      fill
    />
  );
}
