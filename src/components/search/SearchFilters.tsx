"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

interface SearchFiltersProps {
  currentParams: {
    q?: string;
    category?: string;
    region?: string;
    sme?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  };
}

const SORT_OPTIONS = [
  { value: "relevance", label: "관련도순" },
  { value: "price_asc", label: "가격 낮은순" },
  { value: "price_desc", label: "가격 높은순" },
  { value: "activity_score", label: "납품활동 지표순" },
  { value: "newest", label: "최신순" },
] as const;

const REGIONS = [
  { code: "", label: "전체 지역" },
  { code: "11", label: "서울" },
  { code: "26", label: "부산" },
  { code: "27", label: "대구" },
  { code: "28", label: "인천" },
  { code: "29", label: "광주" },
  { code: "30", label: "대전" },
  { code: "31", label: "울산" },
  { code: "36", label: "세종" },
  { code: "41", label: "경기" },
  { code: "42", label: "강원" },
  { code: "43", label: "충북" },
  { code: "44", label: "충남" },
  { code: "45", label: "전북" },
  { code: "46", label: "전남" },
  { code: "47", label: "경북" },
  { code: "48", label: "경남" },
  { code: "50", label: "제주" },
];

export function SearchFilters({ currentParams }: SearchFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams();
      if (currentParams.q) params.set("q", currentParams.q);
      if (currentParams.category) params.set("category", currentParams.category);
      if (currentParams.region) params.set("region", currentParams.region);
      if (currentParams.sme) params.set("sme", currentParams.sme);
      if (currentParams.minPrice) params.set("minPrice", currentParams.minPrice);
      if (currentParams.maxPrice) params.set("maxPrice", currentParams.maxPrice);
      if (currentParams.sort) params.set("sort", currentParams.sort);

      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // reset to page 1 on filter change

      router.push(`${pathname}?${params.toString()}`);
    },
    [currentParams, pathname, router]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-5">
      <h2 className="font-semibold text-gray-900 text-sm">필터</h2>

      {/* Sort */}
      <div>
        <label htmlFor="filter-sort" className="block text-xs font-medium text-gray-600 mb-1.5">
          정렬
        </label>
        <select
          id="filter-sort"
          value={currentParams.sort ?? "relevance"}
          onChange={(e) => updateFilter("sort", e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Region */}
      <div>
        <label htmlFor="filter-region" className="block text-xs font-medium text-gray-600 mb-1.5">
          업체 지역
        </label>
        <select
          id="filter-region"
          value={currentParams.region ?? ""}
          onChange={(e) => updateFilter("region", e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* SME filter */}
      <div>
        <fieldset>
          <legend className="text-xs font-medium text-gray-600 mb-1.5">기업 유형</legend>
          <div className="space-y-1.5">
            {[
              { value: "", label: "전체" },
              { value: "true", label: "중소기업만" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sme-filter"
                  value={opt.value}
                  checked={(currentParams.sme ?? "") === opt.value}
                  onChange={() => updateFilter("sme", opt.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Price range */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">가격 범위 (원)</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            aria-label="최소 가격"
            placeholder="최소"
            value={currentParams.minPrice ?? ""}
            onChange={(e) => updateFilter("minPrice", e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={0}
          />
          <span className="text-gray-400 shrink-0">~</span>
          <input
            type="number"
            aria-label="최대 가격"
            placeholder="최대"
            value={currentParams.maxPrice ?? ""}
            onChange={(e) => updateFilter("maxPrice", e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={0}
          />
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={() => router.push(`${pathname}?q=${currentParams.q ?? ""}`)}
        className="w-full text-sm text-gray-500 hover:text-gray-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        필터 초기화
      </button>
    </div>
  );
}
