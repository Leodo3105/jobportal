"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, FileText, LoaderCircle, Upload } from "lucide-react";

import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, postForm } from "@/lib/api-client";
import { describeCvFile } from "@/lib/format";
import { cn } from "@/lib/utils";
import { COVER_LETTER_MAX, applySchema, type ApplyValues } from "@/lib/validation/apply";
import { CV_EXTENSIONS } from "@/lib/validation/cv";

interface ApplyFormProps {
  jobId: string;
  profileCv: string | null; // tên file CV trong hồ sơ, null nếu chưa có
}

export function ApplyForm({ jobId, profileCv }: ApplyFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    // Có CV trong hồ sơ thì chọn sẵn, chưa có thì bắt buộc tải file
    defaultValues: { cvSource: profileCv ? "profile" : "upload", coverLetter: "" },
  });

  // watch: đọc giá trị hiện tại để giao diện đổi theo khi người dùng chọn/gõ
  const cvSource = watch("cvSource");
  const coverLetterLength = watch("coverLetter")?.length ?? 0;

  async function onSubmit(values: ApplyValues) {
    setServerError(null);

    // multipart/form-data: cách duy nhất để gửi file kèm các field chữ trong một request
    const formData = new FormData();
    formData.append("jobId", jobId);
    formData.append("coverLetter", values.coverLetter.trim());
    const file = values.cvFile?.[0];
    if (values.cvSource === "upload" && file) {
      formData.append("cv", file); // tên field "cv" khớp upload.single('cv') ở backend
    }

    try {
      await postForm("/api/applications/apply", formData);
      router.push(`/jobs/${jobId}?applied=1`);
      router.refresh(); // render lại Server Component để trang chi tiết thấy đơn mới
    } catch (error) {
      setServerError(errorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {serverError && <FormAlert>{serverError}</FormAlert>}

      <fieldset>
        <legend className="text-sm font-medium">CV gửi kèm</legend>
        <div className="mt-2 flex flex-col gap-3">
          {profileCv && (
            <CvOption checked={cvSource === "profile"}>
              <input type="radio" value="profile" defaultChecked className="sr-only" {...register("cvSource")} />
              <OptionTitle icon={FileText} checked={cvSource === "profile"}>
                CV trong hồ sơ
              </OptionTitle>
              <span className="text-sm text-muted-foreground">{describeCvFile(profileCv)}</span>
            </CvOption>
          )}

          <CvOption checked={cvSource === "upload"}>
            <input
              type="radio"
              value="upload"
              defaultChecked={!profileCv}
              className="sr-only"
              {...register("cvSource")}
            />
            <OptionTitle icon={Upload} checked={cvSource === "upload"}>
              {profileCv ? "Tải CV khác cho đơn này" : "Tải CV lên"}
            </OptionTitle>
            <span className="text-sm text-muted-foreground">
              PDF, DOC hoặc DOCX, tối đa 5MB.{profileCv && " CV trong hồ sơ vẫn giữ nguyên."}
            </span>
          </CvOption>
        </div>

        {/* Link "Xem" nằm ngoài label, nếu không bấm vào link cũng sẽ chọn radio */}
        {profileCv && cvSource === "profile" && (
          <a
            href={`/api/cv/${encodeURIComponent(profileCv)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Xem CV trong hồ sơ
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}

        {cvSource === "upload" && (
          <div className="mt-3 flex flex-col gap-2">
            <Label htmlFor="cvFile">File CV</Label>
            <Input
              id="cvFile"
              type="file"
              accept={CV_EXTENSIONS.join(",")}
              className="h-11 py-2"
              aria-invalid={errors.cvFile ? true : undefined}
              aria-describedby={errors.cvFile ? "cvFile-error" : undefined}
              {...register("cvFile")}
            />
            {errors.cvFile && (
              <p id="cvFile-error" className="text-sm text-destructive">
                {errors.cvFile.message}
              </p>
            )}
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="coverLetter">Thư giới thiệu (không bắt buộc)</Label>
        <Textarea
          id="coverLetter"
          rows={8}
          placeholder="Vài dòng về kinh nghiệm của bạn và lý do bạn phù hợp với vị trí này."
          aria-invalid={errors.coverLetter ? true : undefined}
          aria-describedby="coverLetter-count"
          {...register("coverLetter")}
        />
        <div className="flex justify-between gap-3 text-sm">
          <p className="text-destructive">{errors.coverLetter?.message}</p>
          <p
            id="coverLetter-count"
            className={cn("shrink-0", coverLetterLength > COVER_LETTER_MAX ? "text-destructive" : "text-muted-foreground")}
          >
            {coverLetterLength}/{COVER_LETTER_MAX}
          </p>
        </div>
      </div>

      <Button type="submit" size="lg" className="h-11 text-base" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {isSubmitting ? "Đang nộp…" : "Nộp hồ sơ"}
      </Button>
    </form>
  );
}

// Thẻ radio, cùng kiểu với components/auth/role-picker.tsx
function CvOption({ checked, children }: { checked: boolean; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-md border bg-card p-3 transition-colors",
        "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
        checked ? "border-2 border-primary bg-secondary p-[11px]" : "hover:border-primary/50"
      )}
    >
      {children}
    </label>
  );
}

function OptionTitle({
  icon: Icon,
  checked,
  children,
}: {
  icon: typeof FileText;
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <Icon className={cn("size-4 shrink-0", checked ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
      {children}
    </span>
  );
}
