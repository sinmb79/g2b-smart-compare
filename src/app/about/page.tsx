import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "서비스 소개",
  description: "G2B 스마트 비교 서비스 소개 — 나라장터 공공데이터 기반 비영리 공익 보조도구",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">서비스 소개</h1>

      <div className="space-y-6">
        {/* Service positioning */}
        <section className="bg-white border border-gray-200 rounded-xl p-6" aria-labelledby="about-positioning">
          <h2 id="about-positioning" className="font-semibold text-gray-900 mb-3">이 서비스는 무엇인가요?</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            <strong>G2B 스마트 비교</strong>는 나라장터 종합쇼핑몰(shop.g2b.go.kr)의 공공데이터를
            활용하여 관급자재를 쉽게 검색하고 비교할 수 있는 <strong>비영리 공익 보조도구</strong>입니다.
          </p>
          <ul className="text-gray-700 space-y-1.5 text-sm list-none">
            {[
              "로그인/회원가입 없이 누구나 무료로 이용",
              "개인정보를 수집하지 않습니다",
              "공공데이터를 보기 쉽게 재가공하여 제공",
              "의사결정 참고 자료이며 공식 평가가 아닙니다",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5" aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Features */}
        <section className="bg-white border border-gray-200 rounded-xl p-6" aria-labelledby="about-features">
          <h2 id="about-features" className="font-semibold text-gray-900 mb-4">주요 기능</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: "🔍", title: "통합 검색", desc: "품목명, 분류, 키워드로 빠른 검색. 한국어 형태소 분석 기반." },
              { icon: "📍", title: "지역 필터링", desc: "업체 소재지 및 공급 가능 지역 기반 필터링" },
              { icon: "📊", title: "납품활동 지표", desc: "납품횟수, 금액, 인증 기반 100점 참고 지표 (공식 평가 아님)" },
              { icon: "💰", title: "참고 가격 (Beta)", desc: "네이버 쇼핑 연동 참고 가격. 구성·조건이 다를 수 있습니다." },
              { icon: "⚖️", title: "비교함", desc: "최대 5개 상품을 비교함에 담아 비교 (브라우저 저장)" },
              { icon: "♿", title: "웹 접근성", desc: "WCAG 2.1 AA 준수. 키보드 탐색, 스크린리더 지원" },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <span className="text-2xl shrink-0" aria-hidden="true">{item.icon}</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Data sources */}
        <section className="bg-white border border-gray-200 rounded-xl p-6" aria-labelledby="about-data">
          <h2 id="about-data" className="font-semibold text-gray-900 mb-3">데이터 출처</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="font-medium text-gray-700 w-40 shrink-0">나라장터 공공데이터</dt>
              <dd className="text-gray-600">공공데이터포털(data.go.kr), 조달데이터허브 — 매일 업데이트</dd>
            </div>
            <div className="flex gap-3">
              <dt className="font-medium text-gray-700 w-40 shrink-0">외부 참고 가격</dt>
              <dd className="text-gray-600">네이버 쇼핑 API — 매주 업데이트 (매칭 신뢰도 0.7 이상만 표시)</dd>
            </div>
          </dl>
        </section>

        {/* Disclaimer */}
        <section
          className="bg-amber-50 border border-amber-200 rounded-xl p-6"
          aria-labelledby="about-disclaimer"
          role="note"
        >
          <h2 id="about-disclaimer" className="font-semibold text-amber-900 mb-3">⚠️ 이용 시 주의사항</h2>
          <ul className="text-amber-800 text-sm space-y-1.5">
            <li>본 서비스는 공식 조달 평가 시스템이 아닙니다.</li>
            <li>납품활동 지표는 참고용이며, 업체의 신뢰도나 품질을 보증하지 않습니다.</li>
            <li>외부 쇼핑몰 참고 가격은 관급자재 계약 가격과 구성·조건이 다를 수 있습니다.</li>
            <li>최종 구매 결정은 관련 법령 및 기관 규정에 따라 담당자가 직접 판단하시기 바랍니다.</li>
          </ul>
        </section>

        <div className="text-center">
          <Link
            href="/search"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            지금 검색하기
          </Link>
        </div>
      </div>
    </div>
  );
}
