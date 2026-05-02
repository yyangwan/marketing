"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, ChevronRight } from "lucide-react";

export function OnboardingPrompt() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const checkOnboarding = async () => {
      try {
        const res = await fetch("/api/user/onboarding");
        if (res.ok) {
          const data = await res.json();
          if (!data.onboardingCompleted) {
            // Check if recently dismissed (session storage)
            const dismissedTime = sessionStorage.getItem("onboarding-dismissed");
            if (dismissedTime) {
              const elapsed = Date.now() - parseInt(dismissedTime);
              // Show again after 1 hour if not completed
              if (elapsed > 60 * 60 * 1000) {
                setShow(true);
              }
            } else {
              setShow(true);
            }
          }
        }
      } catch (e) {
        console.error("Failed to check onboarding status:", e);
      }
    };

    checkOnboarding();
  }, []);

  const handleStart = () => {
    setShow(false);
    router.push("/onboarding");
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("onboarding-dismissed", Date.now().toString());
    setTimeout(() => setShow(false), 300);
  };

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg p-5 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
          aria-label="关闭"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground mb-1">
              完成设置，解锁全部功能
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              花几分钟时间了解 ContentOS 的核心功能
            </p>

            <button
              onClick={handleStart}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              开始引导
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
