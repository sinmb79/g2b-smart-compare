"use client";

import { useState, useEffect } from "react";
import { GitCompare, Check } from "lucide-react";

const TRAY_KEY = "g2b_compare_tray";
const MAX_TRAY = 5;

interface TrayItem {
  productId: string;
  productName: string;
  unitPrice?: number;
  vendorName?: string;
  addedAt: string;
}

function getTray(): TrayItem[] {
  try {
    const stored = localStorage.getItem(TRAY_KEY);
    return stored ? (JSON.parse(stored) as TrayItem[]) : [];
  } catch {
    return [];
  }
}

function saveTray(items: TrayItem[]): void {
  try {
    localStorage.setItem(TRAY_KEY, JSON.stringify(items));
  } catch {
    // localStorage unavailable
  }
}

interface AddToCompareTrayProps {
  productId: string;
  productName: string;
  unitPrice?: number;
  vendorName?: string;
}

export function AddToCompareTray({ productId, productName, unitPrice, vendorName }: AddToCompareTrayProps) {
  const [inTray, setInTray] = useState(false);
  const [trayFull, setTrayFull] = useState(false);

  useEffect(() => {
    const tray = getTray();
    setInTray(tray.some((item) => item.productId === productId));
    setTrayFull(tray.length >= MAX_TRAY && !tray.some((item) => item.productId === productId));
  }, [productId]);

  const handleClick = () => {
    const tray = getTray();
    if (inTray) {
      // Remove from tray
      const updated = tray.filter((item) => item.productId !== productId);
      saveTray(updated);
      setInTray(false);
      setTrayFull(false);
    } else {
      if (tray.length >= MAX_TRAY) {
        alert(`비교함에는 최대 ${MAX_TRAY}개까지 추가할 수 있습니다.`);
        return;
      }
      const updated: TrayItem[] = [
        ...tray,
        { productId, productName, unitPrice, vendorName, addedAt: new Date().toISOString() },
      ];
      saveTray(updated);
      setInTray(true);
      setTrayFull(updated.length >= MAX_TRAY);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={trayFull}
      aria-pressed={inTray}
      aria-label={
        inTray
          ? "비교함에서 제거"
          : trayFull
          ? `비교함이 가득 찼습니다 (최대 ${MAX_TRAY}개)`
          : "비교함에 추가"
      }
      className={`inline-flex items-center gap-1.5 text-sm rounded-lg px-4 py-2 border font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
        inTray
          ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
          : trayFull
          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {inTray ? (
        <Check size={14} aria-hidden="true" />
      ) : (
        <GitCompare size={14} aria-hidden="true" />
      )}
      {inTray ? "비교함에 추가됨" : "비교함에 추가"}
    </button>
  );
}
