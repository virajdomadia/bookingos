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

    // Send to error tracking service in production
    if (process.env.NODE_ENV === "production") {
      // Example: Sentry.captureException(error, { contexts: errorInfo });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Optionally reload the page
    // window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fee2e2",
              fontFamily: "system-ui, -apple-system, sans-serif",
              padding: "1rem",
            }}
          >
            <div
              style={{
                maxWidth: "500px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "3rem",
                  marginBottom: "1rem",
                }}
              >
                ⚠️
              </div>

              <h1
                style={{
                  fontSize: "1.875rem",
                  fontWeight: "bold",
                  color: "#991b1b",
                  marginBottom: "0.5rem",
                }}
              >
                Something went wrong
              </h1>

              <p
                style={{
                  color: "#7f1d1d",
                  marginBottom: "1rem",
                  lineHeight: "1.6",
                }}
              >
                We're sorry for the inconvenience. An unexpected error has occurred. Please try
                refreshing the page or contact support if the problem persists.
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <details
                  style={{
                    marginBottom: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "#fecaca",
                    borderRadius: "0.375rem",
                    textAlign: "left",
                  }}
                >
                  <summary style={{ cursor: "pointer", fontWeight: "500", marginBottom: "0.5rem" }}>
                    Error Details (Development Only)
                  </summary>
                  <pre
                    style={{
                      overflow: "auto",
                      fontSize: "0.75rem",
                      whiteSpace: "pre-wrap",
                      wordWrap: "break-word",
                    }}
                  >
                    {this.state.error.toString()}
                    {"\n\n"}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={this.handleReset}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontWeight: "500",
                    fontSize: "1rem",
                  }}
                >
                  Try Again
                </button>

                <button
                  onClick={() => {
                    window.location.href = "/";
                  }}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "white",
                    color: "#dc2626",
                    border: "2px solid #dc2626",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontWeight: "500",
                    fontSize: "1rem",
                  }}
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
