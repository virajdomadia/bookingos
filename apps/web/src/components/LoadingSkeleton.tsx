"use client";

export function AuthLoadingSkeleton() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        .skeleton-element {
          background: linear-gradient(
            90deg,
            #f3f4f6 25%,
            #e5e7eb 50%,
            #f3f4f6 75%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      <div style={{ maxWidth: "400px", margin: "0 auto" }}>
        {/* Title skeleton */}
        <div
          className="skeleton-element"
          style={{
            height: "2rem",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
          }}
        />

        {/* Subtitle skeleton */}
        <div
          className="skeleton-element"
          style={{
            height: "1rem",
            borderRadius: "0.375rem",
            marginBottom: "2rem",
            width: "80%",
          }}
        />

        {/* Form fields skeleton */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ marginBottom: "1rem" }}>
            <div
              className="skeleton-element"
              style={{
                height: "0.875rem",
                borderRadius: "0.375rem",
                marginBottom: "0.5rem",
                width: "60%",
              }}
            />
            <div
              className="skeleton-element"
              style={{
                height: "2.5rem",
                borderRadius: "0.375rem",
              }}
            />
          </div>
        ))}

        {/* Button skeleton */}
        <div
          className="skeleton-element"
          style={{
            height: "2.5rem",
            borderRadius: "0.375rem",
            marginTop: "1.5rem",
          }}
        />

        {/* Toggle link skeleton */}
        <div
          className="skeleton-element"
          style={{
            height: "1rem",
            borderRadius: "0.375rem",
            marginTop: "1rem",
            width: "70%",
          }}
        />
      </div>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        .skeleton-element {
          background: linear-gradient(
            90deg,
            #f3f4f6 25%,
            #e5e7eb 50%,
            #f3f4f6 75%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Header skeleton */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          className="skeleton-element"
          style={{
            height: "2rem",
            borderRadius: "0.5rem",
            width: "30%",
            marginBottom: "1rem",
          }}
        />
      </div>

      {/* Cards skeleton */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="skeleton-element"
          style={{
            height: "6rem",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
          }}
        />
      ))}
    </div>
  );
}
