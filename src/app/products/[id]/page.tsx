import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ActivityScoreBadge } from "@/components/product/ActivityScoreBadge";
import { ReferencePriceDisplay } from "@/components/product/ReferencePriceBadge";
import { AddToCompareTray } from "@/components/product/AddToCompareTray";
import { ChevronLeft, ExternalLink } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProduct(id: string) {
  // In production, call the internal API route
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/products/${id}`, {
    next: { revalidate: 60 }, // cache for 60s
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: "상품 없음" };
  return {
    title: product.productName,
    description: `${product.productName} — ${product.categoryName ?? "관급자재"} 상세 정보`,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const {
    productName, categoryName, unitPrice, unit, spec, parsedSpec,
    manufacturer, origin, deliveryDays, minOrderQty, g2bUrl,
    lastSyncedAt, vendor, activityScore, referencePrice,
  } = product;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="페이지 경로" className="mb-4">
        <Link
          href="/search"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          검색으로 돌아가기
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product header */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            {categoryName && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded mb-2 inline-block">
                {categoryName}
              </span>
            )}
            <h1 className="text-xl font-bold text-gray-900 leading-snug mb-3">
              {productName}
            </h1>

            <div className="flex flex-wrap items-center gap-3">
              {unitPrice !== null && (
                <p className="text-2xl font-bold text-gray-900">
                  {unitPrice.toLocaleString("ko-KR")}원
                  {unit && <span className="text-base text-gray-500 font-normal ml-1">/ {unit}</span>}
                </p>
              )}
              {activityScore && (
                <ActivityScoreBadge score={activityScore.total} />
              )}
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              <AddToCompareTray
                productId={product.id}
                productName={productName}
                unitPrice={unitPrice}
                vendorName={vendor?.companyName}
              />
              {g2bUrl && (
                <a
                  href={g2bUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  나라장터에서 보기
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>

          {/* Spec table */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-gray-900 mb-3">상품 정보</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {spec && (
                <>
                  <dt className="text-gray-500">규격</dt>
                  <dd className="text-gray-900">{spec}</dd>
                </>
              )}
              {manufacturer && (
                <>
                  <dt className="text-gray-500">제조사</dt>
                  <dd className="text-gray-900">{manufacturer}</dd>
                </>
              )}
              {origin && (
                <>
                  <dt className="text-gray-500">원산지</dt>
                  <dd className="text-gray-900">{origin}</dd>
                </>
              )}
              {deliveryDays !== null && (
                <>
                  <dt className="text-gray-500">납기일수</dt>
                  <dd className="text-gray-900">{deliveryDays}일</dd>
                </>
              )}
              {minOrderQty > 1 && (
                <>
                  <dt className="text-gray-500">최소 주문 수량</dt>
                  <dd className="text-gray-900">{minOrderQty}{unit ?? ""}</dd>
                </>
              )}
              {parsedSpec && Object.keys(parsedSpec).length > 0 &&
                Object.entries(parsedSpec as Record<string, string>).map(([key, val]) => (
                  val ? (
                    <>
                      <dt key={`k-${key}`} className="text-gray-500 capitalize">{key}</dt>
                      <dd key={`v-${key}`} className="text-gray-900">{val}</dd>
                    </>
                  ) : null
                ))
              }
            </dl>
            {lastSyncedAt && (
              <p className="text-xs text-gray-400 mt-4">
                데이터 업데이트: {new Date(lastSyncedAt).toLocaleDateString("ko-KR")}
              </p>
            )}
          </div>

          {/* Reference price (Beta) — only shown if matchScore >= 0.7 */}
          {referencePrice && (
            <ReferencePriceDisplay
              price={referencePrice.price}
              priceMin={referencePrice.priceMin}
              priceMax={referencePrice.priceMax}
              sellerCount={referencePrice.sellerCount}
              source={referencePrice.source}
              fetchedAt={referencePrice.fetchedAt}
              externalUrl={referencePrice.externalUrl}
              disclaimer={referencePrice.disclaimer}
            />
          )}
        </div>

        {/* Vendor sidebar */}
        {vendor && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-3 text-sm">공급 업체</h2>

              <Link
                href={`/vendors/${vendor.id}`}
                className="block hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                <p className="font-semibold text-blue-700">{vendor.companyName}</p>
              </Link>

              <div className="mt-3 space-y-1 text-xs text-gray-600">
                {vendor.companyType && <p>유형: {vendor.companyType}</p>}
                {vendor.isSme && (
                  <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                    중소기업
                  </span>
                )}
                {vendor.regionName && <p>📍 {vendor.regionName}</p>}
                {vendor.phone && <p>📞 {vendor.phone}</p>}
                {vendor.website && (
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded inline-flex items-center gap-0.5"
                  >
                    홈페이지 <ExternalLink size={11} aria-hidden="true" />
                  </a>
                )}
              </div>

              {/* Certifications */}
              {vendor.certifications && vendor.certifications.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">인증</p>
                  <div className="flex flex-wrap gap-1">
                    {(vendor.certifications as Array<{ type: string; name: string }>).map((cert, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded"
                      >
                        {cert.name ?? cert.type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity score breakdown */}
              {activityScore && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">납품활동 지표 (참고 지표)</p>
                  <div className="space-y-1 text-xs">
                    {[
                      { label: "납품횟수", score: activityScore.deliveryCount, max: 35 },
                      { label: "납품금액", score: activityScore.amount, max: 25 },
                      { label: "인증", score: activityScore.certification, max: 20 },
                      { label: "계약기간", score: activityScore.contractDuration, max: 15 },
                      { label: "중소기업 가산", score: activityScore.smeBonus, max: 5 },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className="w-20 text-gray-500 shrink-0">{item.label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: `${(item.score / item.max) * 100}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-gray-700">
                          {item.score}/{item.max}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {activityScore.disclaimer}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
