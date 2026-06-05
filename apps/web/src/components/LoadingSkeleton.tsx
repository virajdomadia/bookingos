"use client";

export function AuthLoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl p-8 shadow-sm space-y-5 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-md w-2/3 mx-auto" />
        <div className="h-4 bg-gray-200 rounded-md w-1/2 mx-auto" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 bg-gray-200 rounded-md w-1/4" />
            <div className="h-9 bg-gray-200 rounded-md" />
          </div>
        ))}
        <div className="h-9 bg-gray-200 rounded-md mt-2" />
        <div className="h-4 bg-gray-200 rounded-md w-1/2 mx-auto" />
      </div>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-40" />
        <div className="h-8 bg-gray-200 rounded w-20" />
      </div>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-lg border border-gray-200" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-lg border border-gray-200" />
          ))}
        </div>
      </div>
    </div>
  );
}
