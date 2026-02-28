"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 80; // px to pull before triggering refresh
const MAX_PULL = 120; // max visual pull distance

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAtTop = useCallback(() => {
    return window.scrollY <= 0;
  }, []);

  useEffect(() => {
    // Only activate in standalone PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (!isStandalone) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isAtTop() && !refreshing) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || refreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      if (diff > 0 && isAtTop()) {
        // Apply resistance curve so it feels natural
        const distance = Math.min(diff * 0.5, MAX_PULL);
        setPullDistance(distance);

        if (distance > 10) {
          e.preventDefault();
        }
      } else {
        isPulling.current = false;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling.current) return;

      if (pullDistance >= THRESHOLD) {
        setRefreshing(true);
        setPullDistance(THRESHOLD);
        window.location.reload();
      } else {
        setPullDistance(0);
      }

      isPulling.current = false;
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isAtTop, pullDistance, refreshing]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = pullDistance * 3;

  return (
    <div ref={containerRef}>
      {/* Pull indicator */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center overflow-hidden"
        style={{
          height: pullDistance > 0 ? `${pullDistance}px` : 0,
          transition: isPulling.current ? "none" : "height 0.3s ease-out",
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            opacity: progress,
            transform: `translateY(${pullDistance - 40}px)`,
            transition: isPulling.current ? "none" : "all 0.3s ease-out",
          }}
        >
          {refreshing ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FFD36E] border-t-transparent" />
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-[#FFD36E]"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <path
                d="M12 4V16M12 16L7 11M12 16L17 11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: progress >= 1 ? "rotate(180deg)" : "none",
                  transformOrigin: "center",
                }}
              />
            </svg>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
