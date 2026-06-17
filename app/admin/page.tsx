import { redirect } from "next/navigation";
import { auth } from "@/auth";
import PagePlaceholder from "@/components/PagePlaceholder";
import AccessDenied from "@/components/AccessDenied";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    return <AccessDenied need="系統管理員" />;
  }

  return (
    <PagePlaceholder title="系統管理後台" description="查看上線狀態、全站提問紀錄、檢舉案件、封鎖帳號與學習方向分析。" />
  );
}
