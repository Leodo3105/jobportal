"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, LoaderCircle } from "lucide-react";

import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteRequest, errorMessage, putForm } from "@/lib/api-client";
import { describeCvFile } from "@/lib/format";
import { CV_EXTENSIONS, validateCvFile } from "@/lib/validation/cv";

type Status = { type: "success" | "error"; message: string } | null;

export function CvManager({ cvFile }: { cvFile: string | null }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // không để trình duyệt tự gửi form và tải lại trang
    setStatus(null);

    const file = fileInput.current?.files?.[0];
    const error = validateCvFile(file);
    setFileError(error);
    if (error || !file) return;

    const formData = new FormData();
    formData.append("cv", file);

    setUploading(true);
    try {
      await putForm("/api/cv/upload", formData);
      if (fileInput.current) fileInput.current.value = ""; // xoá file đã chọn khỏi ô
      setStatus({ type: "success", message: cvFile ? "Đã thay CV." : "Đã tải CV lên." });
      router.refresh(); // render lại phần thông tin CV từ server
    } catch (err) {
      setStatus({ type: "error", message: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    setStatus(null);
    setDeleting(true);
    try {
      await deleteRequest("/api/cv");
      setConfirmDelete(false);
      setStatus({ type: "success", message: "Đã xoá CV khỏi hồ sơ." });
      router.refresh();
    } catch (err) {
      setStatus({ type: "error", message: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {status && <FormAlert variant={status.type}>{status.message}</FormAlert>}

      <section aria-labelledby="current-cv-heading" className="rounded-xl border bg-card p-6">
        <h2 id="current-cv-heading" className="text-lg font-semibold">
          CV hiện tại
        </h2>

        {cvFile ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <FileText className="size-8 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold">CV trong hồ sơ</p>
                <p className="text-sm text-muted-foreground">{describeCvFile(cvFile)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <a href={`/api/cv/${encodeURIComponent(cvFile)}`} target="_blank" rel="noopener noreferrer">
                  Xem CV
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
              {!confirmDelete && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                  Xoá CV
                </Button>
              )}
            </div>

            {confirmDelete && (
              <div role="group" aria-label="Xác nhận xoá CV" className="flex flex-col items-start gap-2 border-t pt-4">
                <p className="text-sm">
                  Xoá CV khỏi hồ sơ? Các đơn đã nộp vẫn giữ CV của đơn đó. Muốn ứng tuyển tiếp thì phải tải CV khác.
                </p>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={remove} disabled={deleting}>
                    {deleting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    {deleting ? "Đang xoá…" : "Xoá CV"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                    Giữ CV
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Bạn chưa có CV trong hồ sơ. Tải CV lên để ứng tuyển nhanh hơn, không cần chọn file mỗi lần nộp.
          </p>
        )}
      </section>

      <section aria-labelledby="upload-cv-heading" className="rounded-xl border bg-card p-6">
        <h2 id="upload-cv-heading" className="text-lg font-semibold">
          {cvFile ? "Thay CV" : "Tải CV lên"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, DOC hoặc DOCX, tối đa 5MB.{cvFile && " Thay CV không ảnh hưởng các đơn đã nộp."}
        </p>

        <form onSubmit={upload} noValidate className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cv">File CV</Label>
            <Input
              ref={fileInput}
              id="cv"
              type="file"
              accept={CV_EXTENSIONS.join(",")}
              className="h-11 py-2"
              onChange={() => setFileError(null)}
              aria-invalid={fileError ? true : undefined}
              aria-describedby={fileError ? "cv-error" : undefined}
            />
            {fileError && (
              <p id="cv-error" className="text-sm text-destructive">
                {fileError}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="h-11 self-start" disabled={uploading}>
            {uploading && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {uploading ? "Đang tải lên…" : cvFile ? "Thay CV" : "Tải CV lên"}
          </Button>
        </form>
      </section>
    </div>
  );
}
