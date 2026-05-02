"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Circle,
  Sparkles,
  FolderOpen,
  Mic,
  FileText,
  Users,
  Rocket,
} from "lucide-react";

type Step = "welcome" | "project" | "brand-voice" | "brief" | "invite" | "complete";

interface OnboardingTourProps {
  currentStep?: Step;
  workspaceId: string;
}

const STEPS: {
  key: Step;
  title: string;
  description: string;
  icon: React.ElementType;
  optional?: boolean;
}[] = [
  {
    key: "welcome",
    title: "欢迎来到 ContentOS",
    description: "让我们用几分钟时间了解如何高效使用 ContentOS",
    icon: Sparkles,
  },
  {
    key: "project",
    title: "创建第一个项目",
    description: "项目帮助你组织内容，每个客户或品牌可以有独立的项目空间",
    icon: FolderOpen,
  },
  {
    key: "brand-voice",
    title: "设置品牌调性",
    description: "定义你的品牌风格，AI 将根据你的调性生成一致的内容",
    icon: Mic,
    optional: true,
  },
  {
    key: "brief",
    title: "创建第一个内容",
    description: "使用 AI 快速生成第一篇内容，支持多平台一键发布",
    icon: FileText,
  },
  {
    key: "invite",
    title: "邀请团队成员",
    description: "与团队协作，提高内容创作效率",
    icon: Users,
    optional: true,
  },
  {
    key: "complete",
    title: "设置完成！",
    description: "你已经准备好了，开始创作精彩内容吧",
    icon: Rocket,
  },
];

export function OnboardingTour({ currentStep = "welcome", workspaceId }: OnboardingTourProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(
    STEPS.findIndex((s) => s.key === currentStep)
  );
  const [loading, setLoading] = useState(false);
  const [skipped, setSkipped] = useState<Step[]>([]);

  const currentStepData = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  const saveProgress = async (step: Step, completed?: boolean) => {
    try {
      await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, completed }),
      });
    } catch (e) {
      console.error("Failed to save onboarding progress:", e);
    }
  };

  const handleNext = async () => {
    if (isLastStep) {
      setLoading(true);
      await saveProgress("complete", true);
      router.push("/");
      return;
    }

    const nextStep = STEPS[stepIndex + 1];
    setStepIndex(stepIndex + 1);
    await saveProgress(nextStep.key);

    // Navigate based on step
    if (nextStep.key === "project") {
      router.push("/projects/new?onboarding=true");
    } else if (nextStep.key === "brand-voice") {
      router.push("/settings/brand-voice?onboarding=true");
    } else if (nextStep.key === "brief") {
      router.push("/brief/new?onboarding=true");
    } else if (nextStep.key === "invite") {
      router.push("/settings?onboarding=true");
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setStepIndex(stepIndex - 1);
    }
  };

  const handleSkip = async () => {
    setSkipped([...skipped, currentStepData.key]);
    if (isLastStep) {
      setLoading(true);
      await saveProgress("complete", true);
      router.push("/");
    } else {
      await handleNext();
    }
  };

  const handleClose = async () => {
    await saveProgress(currentStepData.key);
    router.push("/");
  };

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="关闭"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="p-8 pt-12">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <currentStepData.icon className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-center text-foreground mb-2">
            {currentStepData.title}
          </h2>

          {/* Description */}
          <p className="text-center text-muted-foreground mb-8">
            {currentStepData.description}
          </p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-8">
            {STEPS.map((step, index) => {
              const isCompleted = index < stepIndex;
              const isCurrent = index === stepIndex;
              const isOptional = step.optional;
              const isSkipped = skipped.includes(step.key);

              return (
                <div
                  key={step.key}
                  className={`flex items-center ${
                    index < STEPS.length - 1 ? "flex-1" : ""
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        isCompleted
                          ? "bg-green-600 text-white"
                          : isCurrent
                          ? "bg-primary text-primary-foreground"
                          : isSkipped
                          ? "bg-muted text-muted-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : isSkipped ? (
                        "—"
                      ) : (
                        index + 1
                      )}
                    </div>
                    {isOptional && (
                      <span className="text-[10px] text-muted-foreground mt-1">
                        可选
                      </span>
                    )}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 ${
                        index < stepIndex ? "bg-green-600" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {!isFirstStep && (
              <button
                onClick={handleBack}
                className="px-4 py-2.5 border border-input rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                上一步
              </button>
            )}

            <div className="flex-1" />

            {currentStepData.optional && !isLastStep && (
              <button
                onClick={handleSkip}
                disabled={loading}
                className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                跳过
              </button>
            )}

            <button
              onClick={handleNext}
              disabled={loading}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "保存中..."
                : isLastStep
                ? "开始使用"
                : currentStepData.key === "welcome"
                ? "开始"
                : "下一步"}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
