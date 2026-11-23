import type { Metadata } from "next";

import { CvManager } from "@/components/jobseeker/cv-manager";
import { getMyProfileCv } from "@/lib/api";

export const metadata: Metadata = { title: "CV của tôi" };

export default async function CvPage() {
  const cvFile = await getMyProfileCv();

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">CV của tôi</h1>
      <p className="mt-1 text-sm text-muted-foreground">CV này được chọn sẵn khi bạn ứng tuyển.</p>

      <div className="mt-6">
        <CvManager cvFile={cvFile} />
      </div>
    </div>
  );
}
