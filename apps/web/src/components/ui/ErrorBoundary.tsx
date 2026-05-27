'use client';
import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional label shown in the error card (e.g. "Orders", "Reports") */
  section?: string;
  /** Render a compact inline error instead of a full-page one */
  inline?: boolean;
}

interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // In production you'd send this to Sentry / LogRocket / etc.
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, section, inline } = this.props;

    if (!error) return children;

    if (inline) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle size={14} className="flex-shrink-0" />
          <span>{section ? `${section} failed to load` : 'Something went wrong'}</span>
          <button onClick={this.reset} className="ml-auto flex items-center gap-1 hover:text-red-300 transition-colors">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 flex items-center justify-center mb-4">
          <AlertTriangle size={28} className="text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">
          {section ? `${section} failed to load` : 'Something went wrong'}
        </h3>
        <p className="text-slate-900 dark:text-slate-400 text-sm max-w-sm mb-6">
          {process.env.NODE_ENV === 'development'
            ? error.message
            : 'An unexpected error occurred. Refresh the page or try again.'}
        </p>
        <button onClick={this.reset} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} /> Try Again
        </button>
      </div>
    );
  }
}

/** Convenience wrapper for simple use-cases */
export function withErrorBoundary<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  section?: string,
) {
  return function BoundedComponent(props: T) {
    return (
      <ErrorBoundary section={section}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
