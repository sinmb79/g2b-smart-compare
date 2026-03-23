"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface EtlStatus {
  isStale: boolean;
  lastSuccessfulRun: string | null;
  hoursAgo: number | null;
}

export function DataStaleBanner() {
  const [status, setStatus] = useState<EtlStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/etl/status")
      .then((r) => r.json())
      .then((body) => setStatus(body.data))
      .catch(() => {
        // Fail silently — banner is non-critical
      });
  }, []);

  if (!status || !status.isStale || dismissed) return null;

  const hoursText =
    status.hoursAgo !== null
      ? `${status.hoursAgo}시간 전`
      : "알 수 없음";

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 text-sm text-amber-800"
    >
      <AlertTriangle size={16} aria-hidden="true" className="shrink-0 text-amber-600" />
      <p className="flex-1">
        데이터가 최신 상태가 아닐 수 있습니다. 마지막 업데이트: {hoursText} 이전
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
        aria-label="알림 닫기"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
