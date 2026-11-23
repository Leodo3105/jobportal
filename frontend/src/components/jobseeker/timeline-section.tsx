"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus } from "lucide-react";

import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteRequest, errorMessage, putJson } from "@/lib/api-client";
import { formatPeriod } from "@/lib/format";
import { dateToMonth, educationSchema, experienceSchema, monthToDate } from "@/lib/validation/profile";
import type { EducationItem, ExperienceItem } from "@/types/api";

type Kind = "education" | "experience";
type Item = EducationItem | ExperienceItem;

// Học vấn và kinh nghiệm chỉ khác nhau ở các ô chữ và cách hiện. Phần còn lại dùng chung.
const CONFIG = {
  education: {
    title: "Học vấn",
    addLabel: "Thêm học vấn",
    empty: "Chưa có thông tin học vấn.",
    currentLabel: "Tôi vẫn đang học ở đây",
    schema: educationSchema,
    fields: [
      { name: "school", label: "Trường", placeholder: "Đại học Bách khoa Hà Nội" },
      { name: "degree", label: "Bằng cấp", placeholder: "Kỹ sư" },
      { name: "fieldOfStudy", label: "Chuyên ngành", placeholder: "Công nghệ thông tin" },
    ],
    heading: (item: Item) => (item as EducationItem).school,
    subheading: (item: Item) => `${(item as EducationItem).degree}, ${(item as EducationItem).fieldOfStudy}`,
  },
  experience: {
    title: "Kinh nghiệm làm việc",
    addLabel: "Thêm kinh nghiệm",
    empty: "Chưa có kinh nghiệm làm việc. Thực tập và dự án freelance cũng tính.",
    currentLabel: "Tôi vẫn đang làm ở đây",
    schema: experienceSchema,
    fields: [
      { name: "position", label: "Vị trí", placeholder: "Backend Developer" },
      { name: "company", label: "Công ty", placeholder: "Công ty ABC" },
      { name: "location", label: "Địa điểm (không bắt buộc)", placeholder: "Hà Nội" },
    ],
    heading: (item: Item) => (item as ExperienceItem).position,
    subheading: (item: Item) =>
      [(item as ExperienceItem).company, (item as ExperienceItem).location].filter(Boolean).join(", "),
  },
};


interface TimelineSectionProps {
  kind: Kind;
  items: Item[];
  enabled: boolean; // false khi chưa tạo hồ sơ (backend yêu cầu có hồ sơ trước)
}

export function TimelineSection({ kind, items, enabled }: TimelineSectionProps) {
  const config = CONFIG[kind];
  // null: không mở form; "new": đang thêm; id: đang sửa mục đó. Mỗi lúc chỉ mở một form.
  const [editing, setEditing] = useState<string | null>(null);
  const headingId = `${kind}-heading`;

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-lg font-semibold">
          {config.title}
        </h2>
        {enabled && editing === null && (
          <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            {config.addLabel}
          </Button>
        )}
      </div>

      {!enabled ? (
        <p className="mt-2 text-sm text-muted-foreground">Lưu thông tin chung ở trên trước, rồi thêm mục này.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {editing === "new" && <ItemForm kind={kind} onDone={() => setEditing(null)} />}

          {items.length === 0 && editing !== "new" && <p className="text-sm text-muted-foreground">{config.empty}</p>}

          {items.length > 0 && (
            <ul className="flex flex-col divide-y">
              {items.map((item) => (
                <li key={item._id} className="py-4 first:pt-0 last:pb-0">
                  {editing === item._id ? (
                    <ItemForm kind={kind} item={item} onDone={() => setEditing(null)} />
                  ) : (
                    <ItemView kind={kind} item={item} canEdit={editing === null} onEdit={() => setEditing(item._id)} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ItemView({ kind, item, canEdit, onEdit }: { kind: Kind; item: Item; canEdit: boolean; onEdit: () => void }) {
  const config = CONFIG[kind];
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await deleteRequest(`/api/profiles/${kind}/${item._id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="font-semibold">{config.heading(item)}</p>
          <p className="text-sm text-muted-foreground">{config.subheading(item)}</p>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">{formatPeriod(item)}</p>
      </div>

      {item.description && <p className="whitespace-pre-line text-sm">{item.description}</p>}

      {canEdit && !confirming && (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Sửa
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Xoá
          </Button>
        </div>
      )}

      {confirming && (
        <div role="group" aria-label={`Xoá ${config.heading(item)}`} className="flex flex-col items-start gap-2">
          <p className="text-sm">Xoá mục này khỏi hồ sơ?</p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={remove} disabled={pending}>
              {pending && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {pending ? "Đang xoá…" : "Xoá"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
              Giữ lại
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Form thêm (không có item) hoặc sửa (có item)
function ItemForm({ kind, item, onDone }: { kind: Kind; item?: Item; onDone: () => void }) {
  const config = CONFIG[kind];
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const prefix = `${kind}-${item?._id ?? "new"}`; // id ô nhập không trùng giữa các form

  // Hai schema khác nhau nên form dùng kiểu chung FieldValues (object bất kỳ)
  const defaultValues: FieldValues = {
    ...Object.fromEntries(config.fields.map((field) => [field.name, (item as unknown as Record<string, string>)?.[field.name] ?? ""])),
    from: dateToMonth(item?.from),
    to: dateToMonth(item?.to),
    current: item?.current ?? false,
    description: item?.description ?? "",
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    // Ép kiểu qua unknown: TypeScript không tự hiểu resolver của 2 schema khác nhau là cùng một kiểu.
    // An toàn vì dữ liệu vẫn được schema thật kiểm tra lúc chạy.
    resolver: zodResolver(config.schema) as unknown as Resolver<FieldValues>,
    defaultValues,
  });
  const current = watch("current");
  const errorOf = (name: string) => errors[name]?.message as string | undefined;

  async function onSubmit(values: FieldValues) {
    setServerError(null);
    const body = {
      ...values,
      from: monthToDate(values.from),
      to: values.current ? null : monthToDate(values.to),
    };
    try {
      // Thêm: PUT /api/profiles/education. Sửa: PUT /api/profiles/education/<id>
      await putJson(`/api/profiles/${kind}${item ? `/${item._id}` : ""}`, body);
      onDone();
      router.refresh();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  }

  const input = (name: string, label: string, props: React.ComponentProps<typeof Input> = {}) => {
    const id = `${prefix}-${name}`;
    const error = errorOf(name);
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          className="h-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
          {...register(name)}
        />
        {error && (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4 rounded-md border bg-background p-4"
      aria-label={item ? `Sửa ${config.heading(item)}` : config.addLabel}
    >
      {serverError && <FormAlert>{serverError}</FormAlert>}

      <div className="grid gap-4 sm:grid-cols-2">
        {config.fields.map((field) => (
          <div key={field.name} className={field.name === config.fields[0].name ? "sm:col-span-2" : undefined}>
            {input(field.name, field.label, { placeholder: field.placeholder })}
          </div>
        ))}
        {/* type="month": trình duyệt không hỗ trợ thì hiện ô chữ, nên có placeholder gợi ý định dạng */}
        {input("from", "Từ tháng", { type: "month", placeholder: "2020-09" })}
        {!current && input("to", "Đến tháng", { type: "month", placeholder: "2024-06" })}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" {...register("current")} />
        {config.currentLabel}
      </label>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}-description`}>Mô tả (không bắt buộc)</Label>
        <Textarea
          id={`${prefix}-description`}
          rows={4}
          placeholder={kind === "experience" ? "Công việc chính, công nghệ đã dùng, kết quả đạt được." : "Thành tích, đồ án, điểm trung bình."}
          aria-invalid={errorOf("description") ? true : undefined}
          {...register("description")}
        />
        {errorOf("description") && <p className="text-sm text-destructive">{errorOf("description")}</p>}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {isSubmitting ? "Đang lưu…" : item ? "Lưu thay đổi" : config.addLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={isSubmitting}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
