import { BriefForm } from "@/components/brief-form";

export default function NewBriefPage() {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">新建 Brief</h1>
      <p className="text-sm text-gray-500 mb-6">
        输入主题和要点，AI 将为每个目标平台生成专属内容
      </p>
      <BriefForm />
    </div>
  );
}
