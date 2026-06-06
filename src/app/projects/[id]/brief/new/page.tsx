import { BriefForm } from "@/components/brief-form";

export default async function NewProjectBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BriefForm projectId={id} />;
}
