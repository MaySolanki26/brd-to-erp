import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive-light flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" strokeWidth={1.5} />
          </div>

          <h3 className="text-3xl font-medium text-foreground mb-1">Something went wrong</h3>
          <p className="text-xl text-muted-foreground max-w-sm mb-1">
            An unexpected error occurred. Please try again.
          </p>
          {this.state.error && (
            <p className="text-lg text-muted-foreground/70 max-w-md mb-4">
              {this.state.error.message}
            </p>
          )}

          <Button onClick={this.handleReset} size="xs" variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
