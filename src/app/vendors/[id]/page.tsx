import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ActivityScoreBadge } from "@/components/product/ActivityScoreBadge";
import { ChevronLeft, ExternalLink, Building2 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getVendor(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/vendors/${id}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendor(id);
  if (!vendor) return { title: "업체 없음" };
  return {
    title: vendor.companyName,
    description: `${vendor.companyName} — 나라장터 등록 업체 정보 및 납품활동 지표`,
  };
}

export default async function VendorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const vendor = await getVendor(id);

  if (!vendor) notFound();

  const {
    companyName, companyType, isSme, address, regionName,
    phone, email, website, certifications, registrationDate,
    activityScore, products, productTotal, recentDeliveries,
  } = vendor;

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
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Vendor header */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="bg-gray-100 rounded-xl p-3 shrink-0">
                <Building2 size={24} className="text-gray-500" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {companyType && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {companyType}
                    </span>
                  )}
                  {isSme && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      중소기업
                    </span>
                  )}
                  {regionName && (
                    <span className="text-xs text-gray-500">📍 {regionName}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Activity score */}
            {activityScore && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">납품활동 지표 (참고 지표)</p>
                <ActivityScoreBadge score={activityScore.total} />
                <p className="text-xs text-gray-400 mt-1">{activityScore.disclaimer}</p>
              </div>
            )}
          </div>

          {/* Products */}
          {products && products.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-3">
                등록 상품 ({productTotal?.toLocaleString("ko-KR")}개)
              </h2>
              <ul className="divide-y divide-gray-100" role="list">
                {(products as Array<{
                  id: string;
                  productName: string;
                  unitPrice?: number;
                  unit?: string;
                  categoryName?: string;
                }>).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/products/${p.id}`}
                      className="flex justify-between items-center py-2.5 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      <span className="text-sm text-gray-800 line-clamp-1 mr-3">{p.productName}</span>
                      <span className="text-sm font-medium text-gray-900 shrink-0">
                        {p.unitPrice ? `${p.unitPrice.toLocaleString("ko-KR")}원` : "–"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent deliveries */}
          {recentDeliveries && recentDeliveries.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-3">최근 납품 이력</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="최근 납품 이력 목록">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-4 font-medium">수요기관</th>
                      <th className="pb-2 pr-4 font-medium">지역</th>
                      <th className="pb-2 pr-4 font-medium">납품일</th>
                      <th className="pb-2 font-medium text-right">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recentDeliveries as Array<{
                      buyer_org: string;
                      buyer_region: string;
                      delivery_date: string;
                      total_amount: number;
                    }>).map((d, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-4 text-gray-800">{d.buyer_org}</td>
                        <td className="py-2 pr-4 text-gray-500">{d.buyer_region}</td>
                        <td className="py-2 pr-4 text-gray-500">
                          {new Date(d.delivery_date).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="py-2 text-right text-gray-800">
                          {d.total_amount?.toLocaleString("ko-KR")}원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm space-y-2.5">
            <h2 className="font-semibold text-gray-900">업체 정보</h2>
            {address && <p className="text-gray-600">📍 {address}</p>}
            {phone && <p className="text-gray-600">📞 {phone}</p>}
            {email && (
              <a href={`mailto:${email}`} className="text-blue-600 hover:underline block">
                ✉️ {email}
              </a>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                🌐 홈페이지 <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
            {registrationDate && (
              <p className="text-gray-500 text-xs">
                등록일: {new Date(registrationDate).toLocaleDateString("ko-KR")}
              </p>
            )}
          </div>

          {certifications && certifications.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-2 text-sm">보유 인증</h2>
              <div className="flex flex-wrap gap-1.5">
                {(certifications as Array<{ type: string; name: string }>).map((cert, i) => (
                  <span
                    key={i}
                    className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded"
                  >
                    {cert.name ?? cert.type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Score breakdown */}
          {activityScore && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-3 text-sm">납품활동 지표 상세 (참고)</h2>
              <div className="space-y-2 text-xs">
                {[
                  { label: "납품횟수 (3년)", score: activityScore.deliveryCount, max: 35, detail: `${activityScore.deliveryCount3yr}건` },
                  { label: "납품금액 (3년)", score: activityScore.amount, max: 25, detail: `${(activityScore.totalAmount3yr / 100_000_000).toFixed(1)}억` },
                  { label: "인증 보유", score: activityScore.certification, max: 20, detail: `${activityScore.certificationCount}개` },
                  { label: "계약기간", score: activityScore.contractDuration, max: 15, detail: `${activityScore.activeContractMonths}개월` },
                  { label: "중소기업 가산", score: activityScore.smeBonus, max: 5 },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="text-gray-800 font-medium">
                        {item.score}/{item.max}점
                        {item.detail && <span className="text-gray-400 ml-1">({item.detail})</span>}
                      </span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${(item.score / item.max) * 100}%` }}
                        role="meter"
                        aria-valuenow={item.score}
                        aria-valuemin={0}
                        aria-valuemax={item.max}
                        aria-label={`${item.label}: ${item.score}/${item.max}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
