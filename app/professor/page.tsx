import { redirect } from "next/navigation";
import { auth } from "@/auth";
import PagePlaceholder from "@/components/PagePlaceholder";
import AccessDenied from "@/components/AccessDenied";

export default async function ProfessorPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "professor" && session.user.role !== "admin") {
    return <AccessDenied need="課程教授或助教" />;
  }

  return (
    <PagePlaceholder title="課程管理" description="教授與助教管理課程、檢視學生提問與學習狀況。" />
  );
}
