"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, putJson } from "@/lib/api-client";
import { APPLICATION_STATUS_LABELS, INTERVIEW_TYPE_LABELS, timeAgo } from "@/lib/format";
import type { ApplicationNote, ApplicationStatus, Interview } from "@/types/api";

// Khớp giới hạn ở backend applicationController.js (MAX_FEEDBACK, MAX_NOTE)
const MAX_TEXT = 1000;

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm";

type Status = { type: "success" | "error"; message: string } | null;

// Gửi PUT rồi render lại trang. Dùng chung cho 3 form bên dưới.
function useSubmit() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(path: string, body: object, successMessage: string): Promise<boolean> {
    setPending(true);
    setStatus(null);
    try {
      await putJson(path, body);
      setStatus({ type: "success", message: successMessage });
      router.refresh();
      return true;
    } catch (error) {
      setStatus({ type: "error", message: errorMessage(error) });
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, status, submit };
}

function SubmitButton({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {pending ? busy : idle}
    </Button>
  );
}

// ===== Đổi trạng thái =====

// NTD chọn được các trạng thái này. "pending" chỉ là trạng thái ban đầu, không chọn lại.
const STATUS_CHOICES: ApplicationStatus[] = ["viewed", "interview", "accepted", "rejected"];

export function StatusForm({
  applicationId,
  status,
  feedback,
}: {
  applicationId: string;
  status: ApplicationStatus;
  feedback?: string;
}) {
  const { pending, status: result, submit } = useSubmit();
  const [next, setNext] = useState<ApplicationStatus>(status === "pending" ? "viewed" : status);
  const [text, setText] = useState(feedback ?? "");

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit(`/api/applications/${applicationId}/status`, { status: next, feedback: text.trim() }, "Đã cập nhật trạng thái và gửi thông báo cho ứng viên.");
      }}
    >
      {result && <FormAlert variant={result.type}>{result.message}</FormAlert>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="next-status">Trạng thái mới</Label>
        <select id="next-status" className={SELECT_CLASS} value={next} onChange={(e) => setNext(e.target.value as ApplicationStatus)}>
          {STATUS_CHOICES.map((value) => (
            <option key={value} value={value}>
              {APPLICATION_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="feedback">Phản hồi cho ứng viên (không bắt buộc)</Label>
        <Textarea
          id="feedback"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ứng viên sẽ đọc được nội dung này."
          aria-invalid={text.length > MAX_TEXT ? true : undefined}
        />
        <p className={text.length > MAX_TEXT ? "text-right text-sm text-destructive" : "text-right text-sm text-muted-foreground"}>
          {text.length}/{MAX_TEXT}
        </p>
      </div>

      <SubmitButton pending={pending || text.length > MAX_TEXT} idle="Cập nhật trạng thái" busy="Đang cập nhật…" />
    </form>
  );
}

// ===== Hẹn phỏng vấn =====

// Giờ hiện tại theo máy người dùng, dạng "2030-01-10T16:00" cho thuộc tính min của ô datetime-local
function nowForInput(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // đổi sang giờ địa phương trước khi cắt chuỗi
  return now.toISOString().slice(0, 16);
}

export function InterviewForm({ applicationId }: { applicationId: string }) {
  const { pending, status: result, submit } = useSubmit();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [type, setType] = useState<Interview["type"]>("in-person");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        {result?.type === "success" && <FormAlert variant="success">{result.message}</FormAlert>}
        <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
          Hẹn phỏng vấn
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-md border bg-background p-4"
      aria-label="Hẹn phỏng vấn"
      onSubmit={async (event) => {
        event.preventDefault();
        // Kiểm tra nhanh ở FE; backend vẫn kiểm tra lại
        if (!date) return setFieldError("Vui lòng chọn ngày giờ phỏng vấn");
        if (new Date(date) < new Date()) return setFieldError("Thời gian phỏng vấn phải ở tương lai");
        if (!location.trim()) return setFieldError(type === "in-person" ? "Vui lòng nhập địa chỉ" : "Vui lòng nhập link hoặc số điện thoại");
        setFieldError(null);
        // Ô datetime-local cho giờ theo máy người dùng ("2030-01-10T16:00"). toISOString() đổi sang UTC
        // để backend lưu đúng thời điểm, ứng viên ở múi giờ nào cũng thấy đúng giờ.
        const ok = await submit(
          `/api/applications/${applicationId}/schedule-interview`,
          { date: new Date(date).toISOString(), type, location: location.trim(), notes: notes.trim() },
          "Đã hẹn phỏng vấn và gửi thông báo cho ứng viên."
        );
        if (ok) {
          setOpen(false);
          setDate("");
          setLocation("");
          setNotes("");
        }
      }}
    >
      {result?.type === "error" && <FormAlert>{result.message}</FormAlert>}
      {fieldError && <FormAlert>{fieldError}</FormAlert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="interview-date">Ngày giờ</Label>
          <Input id="interview-date" type="datetime-local" min={nowForInput()} className="h-11" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="interview-type">Hình thức</Label>
          <select id="interview-type" className={SELECT_CLASS} value={type} onChange={(e) => setType(e.target.value as Interview["type"])}>
            {(Object.keys(INTERVIEW_TYPE_LABELS) as Interview["type"][]).map((value) => (
              <option key={value} value={value}>
                {INTERVIEW_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="interview-location">{type === "in-person" ? "Địa chỉ" : type === "video" ? "Link cuộc gọi" : "Số điện thoại"}</Label>
        <Input
          id="interview-location"
          className="h-11"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={type === "in-person" ? "Tầng 5, 123 Láng Hạ, Hà Nội" : type === "video" ? "https://meet.google.com/…" : "0901 234 567"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="interview-notes">Lưu ý cho ứng viên (không bắt buộc)</Label>
        <Textarea id="interview-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mang CV bản giấy, hỏi lễ tân tầng 1." />
      </div>

      <div className="flex gap-2">
        <SubmitButton pending={pending} idle="Gửi lịch hẹn" busy="Đang gửi…" />
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

// ===== Ghi chú nội bộ =====

export function NotesPanel({ applicationId, notes }: { applicationId: string; notes: ApplicationNote[] }) {
  const { pending, status: result, submit } = useSubmit();
  const [text, setText] = useState("");
  // Ghi chú mới nhất lên đầu
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-4">
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!text.trim()) return;
          const ok = await submit(`/api/applications/${applicationId}/notes`, { content: text.trim() }, "Đã thêm ghi chú.");
          if (ok) setText("");
        }}
      >
        {result?.type === "error" && <FormAlert>{result.message}</FormAlert>}
        <Label htmlFor="new-note" className="sr-only">
          Ghi chú mới
        </Label>
        <Textarea
          id="new-note"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhận xét sau khi đọc CV, kết quả phỏng vấn…"
          aria-invalid={text.length > MAX_TEXT ? true : undefined}
        />
        <div className="flex items-center justify-between gap-3">
          <SubmitButton pending={pending || !text.trim() || text.length > MAX_TEXT} idle="Thêm ghi chú" busy="Đang lưu…" />
          <span className={text.length > MAX_TEXT ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {text.length}/{MAX_TEXT}
          </span>
        </div>
      </form>

      {sorted.length > 0 && (
        <ul className="flex flex-col divide-y">
          {sorted.map((note) => (
            <li key={note._id} className="py-3 first:pt-0">
              <p className="whitespace-pre-line text-sm">{note.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">{timeAgo(note.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
