"use client";

import React, { ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-red-50 px-4">
            <div className="max-w-md text-center space-y-4">
              <div className="text-5xl">⚠️</div>
              <h1 className="text-2xl font-bold text-red-800">Something went wrong</h1>
              <p className="text-red-700 leading-relaxed text-sm">
                An unexpected error has occurred. Please try refreshing the page or contact support
                if the problem persists.
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="text-left bg-red-100 rounded-md p-3 text-xs">
                  <summary className="cursor-pointer font-medium mb-2">
                    Error Details (Development Only)
                  </summary>
                  <pre className="overflow-auto whitespace-pre-wrap break-words">
                    {this.state.error.toString()}
                    {"\n\n"}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={this.handleReset}
                  className="px-5 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => { window.location.href = "/"; }}
                  className="px-5 py-2 bg-white text-red-600 border-2 border-red-600 rounded-md font-medium hover:bg-red-50 transition-colors"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
