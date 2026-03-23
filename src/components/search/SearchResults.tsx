import Link from "next/link";
import { searchProducts } from "@/lib/search/product-search";
import { ActivityScoreBadge } from "@/components/product/ActivityScoreBadge";
import { ReferencePriceBadge } from "@/components/product/ReferencePriceBadge";
import { SearchPagination } from "./SearchPagination";
import type { SearchParams } from "@/types";

interface SearchResultsProps {
  searchParams: {
    q?: string;
    category?: string;
    region?: string;
    supply?: string;
    sme?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  };
}

function formatPrice(price?: number, unit?: string): string {
  if (price === null || price === undefined) return "가격 미공개";
  return `${price.toLocaleString("ko-KR")}원${unit ? ` / ${unit}` : ""}`;
}

export async function SearchResults({ searchParams }: SearchResultsProps) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1") || 1);

  const params: SearchParams = {
    query: searchParams.q ?? "",
    categoryCode: searchParams.category,
    regionCode: searchParams.region,
    supplyRegion: searchParams.supply,
    isSme: searchParams.sme === "true" ? true : searchParams.sme === "false" ? false : undefined,
    minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
    sortBy: (searchParams.sort as SearchParams["sortBy"]) ?? "relevance",
    page,
    pageSize: 20,
  };

  let result;
  try {
    result = await searchProducts(params);
  } catch {
    return (
      <div role="alert" className="text-center py-16 text-gray-500">
        검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }

  if (result.total === 0) {
    return (
      <div className="text-center py-16 text-gray-500" aria-live="polite">
        <p className="text-lg font-medium mb-2">검색 결과가 없습니다</p>
        <p className="text-sm">다른 검색어나 필터를 시도해 보세요.</p>
      </div>
    );
  }

  return (
    <div aria-live="polite">
      {/* Result count + sort info */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          <strong className="text-gray-900">{result.total.toLocaleString("ko-KR")}</strong>개 결과
          {result.took < 2000 && (
            <span className="ml-2 text-xs text-gray-400">({result.took}ms)</span>
          )}
        </p>
      </div>

      {/* Product list */}
      <ul className="flex flex-col gap-3" role="list" aria-label="검색 결과 목록">
        {result.products.map((product) => (
          <li key={product.id}>
            <Link
              href={`/products/${product.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                    {product.productName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {product.categoryName && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {product.categoryName}
                      </span>
                    )}
                    {product.regionName && (
                      <span className="text-xs text-gray-500">📍 {product.regionName}</span>
                    )}
                  </div>
                  {product.vendorName && (
                    <p className="text-xs text-gray-500 mt-1">
                      업체:{" "}
                      <span
                        className="text-blue-600 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/vendors/${product.vendorId}`;
                        }}
                      >
                        {product.vendorName}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Price */}
                  <p className="font-bold text-gray-900 text-base">
                    {formatPrice(product.unitPrice)}
                  </p>

                  {/* Activity score badge (참고 지표) */}
                  {product.activityScore !== undefined && (
                    <ActivityScoreBadge score={product.activityScore} size="sm" />
                  )}

                  {/* Reference price indicator */}
                  {product.hasReferencePrice && (
                    <ReferencePriceBadge />
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Pagination */}
      <div className="mt-6">
        <SearchPagination
          total={result.total}
          page={page}
          pageSize={result.pageSize}
          searchParams={searchParams}
        />
      </div>
    </div>
  );
}
