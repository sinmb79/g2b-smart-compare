import type { Metadata } from "next";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchFilters } from "@/components/search/SearchFilters";

export const metadata: Metadata = {
  title: "상품 검색",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    region?: string;
    supply?: string;
    sme?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";

  return (
    <div className="flex flex-col gap-6">
      {/* Search bar */}
      <div className="max-w-2xl">
        <SearchBar initialQuery={query} />
      </div>

      {query ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter sidebar */}
          <aside
            className="lg:w-64 shrink-0"
            aria-label="검색 필터"
          >
            <SearchFilters currentParams={params} />
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <SearchResults searchParams={params} />
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-16">검색어를 입력해 주세요.</p>
      )}
    </div>
  );
}
