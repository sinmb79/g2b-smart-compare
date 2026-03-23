// Spec section 10.2 — footer disclaimer required on every page

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 mt-8" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Disclaimer (required per spec section 10.2) */}
        <div
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-900"
          role="note"
          aria-label="서비스 면책 고지"
        >
          <p className="font-semibold mb-1">⚠️ 면책 고지</p>
          <p className="leading-relaxed">
            본 서비스는 나라장터 공공데이터를 가공·재제공하는 <strong>비영리 공익 보조도구</strong>입니다.
            제공되는 정보는 의사결정 <strong>참고 자료</strong>이며, 공식 평가가 아닙니다.
            외부 쇼핑몰 가격은 <strong>참고 가격</strong>이며 구성·조건이 다를 수 있습니다.
            납품활동 지표는 <strong>참고 지표</strong>이며, 업체의 신뢰도나 품질을 보증하지 않습니다.
            최종 구매 결정은 관련 법령 및 기관 규정에 따라 담당자가 직접 판단하시기 바랍니다.
          </p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs text-gray-500">
          <div>
            <p className="font-medium text-gray-700 mb-1">G2B 스마트 비교</p>
            <p>나라장터 종합쇼핑몰 공공데이터 기반 비영리 공익 서비스</p>
            <p>데이터 출처: 공공데이터포털(data.go.kr), 조달데이터허브</p>
          </div>
          <div className="text-right">
            <p>© {currentYear} G2B 스마트 비교</p>
            <p>로그인 불필요 · 개인정보 수집 없음</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
