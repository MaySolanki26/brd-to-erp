import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { PageError } from '@brd/ui';

/** Shown when a route throws while rendering or loading. The error text is not displayed. */
export function RouteErrorPage() {
  const error = useRouteError();
  const description =
    isRouteErrorResponse(error) && error.status === 404
      ? 'The page you are looking for does not exist.'
      : 'An unexpected error occurred. Reload the page to try again.';

  return (
    <PageError
      variant="full"
      message="Something went wrong"
      description={description}
      onRetry={() => window.location.reload()}
    />
  );
}
