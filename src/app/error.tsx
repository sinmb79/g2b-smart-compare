"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center px-4">
      <p className="text-5xl" aria-hidden="true">⚠️</p>
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">오류가 발생했습니다</h1>
        <p className="text-gray-500 text-sm">일시적인 오류입니다. 잠시 후 다시 시도해 주세요.</p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
