import { Component, ReactNode } from 'react';

interface Props {
  children:  ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-neutral-50">
          <div className="max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-error-50 flex items-center justify-center mx-auto mb-5">
              <svg
                className="w-7 h-7 text-error-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-neutral-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
              {this.state.error.message || 'An unexpected error occurred. Please try reloading.'}
            </p>
            <button
              className="btn btn-secondary btn-md"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
