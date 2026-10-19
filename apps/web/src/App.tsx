import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConfirmHost, ErrorBoundary, ThemeProvider, ToastProvider } from '@brd/ui';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/providers/auth-provider';
import { router } from '@/router';

export function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <RouterProvider router={router} />
              <ConfirmHost />
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
