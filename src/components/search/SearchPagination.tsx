"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SearchPaginationProps {
  total: number;
  page: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
}

export function SearchPagination({ total, page, pageSize, searchParams }: SearchPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  const goToPage = (p: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, val]) => {
      if (val && key !== "page") params.set(key, val);
    });
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  // Show at most 5 page buttons centered around current page
  const delta = 2;
  const rangeStart = Math.max(1, page - delta);
  const rangeEnd = Math.min(totalPages, page + delta);
  const pages = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => rangeStart + i);

  return (
    <nav aria-label="검색 결과 페이지 탐색" className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => goToPage(page - 1)}
        disabled={page <= 1}
        aria-label="이전 페이지"
        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>

      {rangeStart > 1 && (
        <>
          <button
            type="button"
            onClick={() => goToPage(1)}
            aria-label="1 페이지"
            className="min-w-[36px] h-9 px-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            1
          </button>
          {rangeStart > 2 && <span className="text-gray-400 px-1">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => goToPage(p)}
          aria-label={`${p} 페이지`}
          aria-current={p === page ? "page" : undefined}
          className={`min-w-[36px] h-9 px-2 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            p === page
              ? "bg-blue-600 text-white border-blue-600"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          {p}
        </button>
      ))}

      {rangeEnd < totalPages && (
        <>
          {rangeEnd < totalPages - 1 && <span className="text-gray-400 px-1">…</span>}
          <button
            type="button"
            onClick={() => goToPage(totalPages)}
            aria-label={`${totalPages} 페이지`}
            className="min-w-[36px] h-9 px-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={() => goToPage(page + 1)}
        disabled={page >= totalPages}
        aria-label="다음 페이지"
        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
