import { Skeleton } from '../uab/primitives/feedback';

/** Loading state for a whole page: skeleton rows. */
export function PageLoader() {
  return (
    <div className="uab-page">
      <Skeleton rows={8} />
    </div>
  );
}
