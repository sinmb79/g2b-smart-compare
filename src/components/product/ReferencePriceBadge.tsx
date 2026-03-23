/**
 * Badge indicating a product has a reference price available.
 * Always labeled "참고 가격" — never "비교 가격" or "절약".
 */

export function ReferencePriceBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5"
      title="외부 쇼핑몰 참고 가격 조회 가능 (Beta)"
      aria-label="외부 쇼핑몰 참고 가격 조회 가능"
    >
      💰 참고 가격
      <span className="text-[10px] bg-purple-100 px-1 rounded">Beta</span>
    </span>
  );
}

interface ReferencePriceDisplayProps {
  price: number;
  priceMin?: number;
  priceMax?: number;
  sellerCount?: number;
  source?: string;
  fetchedAt?: string;
  externalUrl?: string;
  disclaimer?: string;
}

/**
 * Full reference price display for product detail pages.
 * Must always show disclaimer and Beta label.
 */
export function ReferencePriceDisplay({
  price,
  priceMin,
  priceMax,
  sellerCount,
  source,
  fetchedAt,
  externalUrl,
  disclaimer,
}: ReferencePriceDisplayProps) {
  const formattedDate = fetchedAt
    ? new Date(fetchedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div
      className="border border-purple-200 rounded-xl p-4 bg-purple-50"
      role="note"
      aria-label="외부 쇼핑몰 참고 가격"
    >
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold text-purple-900 text-sm">
          외부 쇼핑몰 참고 가격
        </h3>
        <span className="text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded font-medium">
          Beta
        </span>
      </div>

      <p className="text-2xl font-bold text-purple-900">
        {price.toLocaleString("ko-KR")}원
      </p>

      {(priceMin !== undefined || priceMax !== undefined) && (
        <p className="text-sm text-purple-700 mt-1">
          범위: {priceMin?.toLocaleString("ko-KR")}원 ~ {priceMax?.toLocaleString("ko-KR")}원
          {sellerCount !== undefined && (
            <span className="ml-2 text-purple-600">({sellerCount}개 판매처)</span>
          )}
        </p>
      )}

      <div className="flex items-center gap-3 mt-2 text-xs text-purple-600">
        {source && <span>출처: {source === "naver" ? "네이버 쇼핑" : source}</span>}
        {formattedDate && <span>수집일: {formattedDate}</span>}
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
          >
            외부 링크
          </a>
        )}
      </div>

      {/* Required disclaimer */}
      <p className="mt-3 text-xs text-purple-700 bg-purple-100 rounded p-2">
        ⚠️ {disclaimer ?? "외부 쇼핑몰 가격은 참고용이며, 구성·조건이 다를 수 있습니다."}
      </p>
    </div>
  );
}
