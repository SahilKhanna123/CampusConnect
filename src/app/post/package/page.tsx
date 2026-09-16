import { redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { PackagePostForm } from "@/components/PackagePostForm";
import { FadeIn } from "@/components/FadeIn";

// Create-PackagePost form -- reached from "Offer Package Space" on /post.
export default async function CreatePackagePostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="form-page">
      <FadeIn mode="mount" delay={0}>
        <span className="eyebrow">Post</span>
        <h1 className="heading-tight">Package Carrying</h1>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <PackagePostForm isStudent={hasStudentRecord(user)} />
      </FadeIn>
    </div>
  );
}
