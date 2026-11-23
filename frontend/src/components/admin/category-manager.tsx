"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";

import { Field } from "@/components/form-field";
import { FormAlert } from "@/components/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteRequest, errorMessage, postJson, putJson } from "@/lib/api-client";
import type { AdminCategory, Category } from "@/types/api";

// Khớp backend categoryController.js (MAX_NAME, MAX_DESCRIPTION)
const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

function Spinner() {
  return <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}

function checkName(name: string): string | null {
  if (!name.trim()) return "Vui lòng nhập tên danh mục";
  if (name.trim().length > MAX_NAME) return `Tên tối đa ${MAX_NAME} ký tự`;
  return null;
}

// ===== Tạo danh mục =====

export function CategoryCreateForm({ type, typeLabel }: { type: Category["type"]; typeLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Thêm {typeLabel.toLowerCase()}
      </Button>
    );
  }

  return (
    <form
      noValidate
      aria-label={`Thêm ${typeLabel.toLowerCase()}`}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const nameError = checkName(name) ?? (description.length > MAX_DESCRIPTION ? `Mô tả tối đa ${MAX_DESCRIPTION} ký tự` : null);
        setError(nameError);
        if (nameError) return;
        setPending(true);
        try {
          await postJson("/api/categories", { name: name.trim(), type, description: description.trim() });
          setName("");
          setDescription("");
          setOpen(false);
          router.refresh();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {error && <FormAlert>{error}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="new-name" label="Tên">
          <Input id="new-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="new-description" label="Mô tả (không bắt buộc)">
          <Input id="new-description" className="h-11" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Thêm
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

// ===== Một dòng danh mục =====

export function CategoryRow({ category }: { category: AdminCategory }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isIndustry = category.type === "industry";
  const usage = (category.jobCount ?? 0) + (category.companyCount ?? 0);

  // Gửi request; trả về body nếu thành công
  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      router.refresh();
      return result;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setPending(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameError = checkName(name) ?? (description.length > MAX_DESCRIPTION ? `Mô tả tối đa ${MAX_DESCRIPTION} ký tự` : null);
    if (nameError) return setError(nameError);
    const result = await run(() =>
      putJson<{ renamed: { jobs: number; companies: number } | null }>(`/api/categories/${category._id}`, {
        name: name.trim(),
        description: description.trim(),
      })
    );
    if (result) {
      setMode("view");
      // Đổi tên ngành: backend đổi luôn tên ngành của tin và công ty, báo lại cho admin biết
      if (result.renamed && (result.renamed.jobs || result.renamed.companies)) {
        setNotice(`Đã đổi tên ngành ở ${result.renamed.jobs} tin và ${result.renamed.companies} công ty.`);
      }
    }
  }

  if (mode === "edit") {
    return (
      <form onSubmit={save} noValidate aria-label={`Sửa ${category.name}`} className="flex flex-col gap-3 p-4">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`name-${category._id}`} label="Tên" hint={isIndustry && usage > 0 ? "Đổi tên thì các tin và công ty đang dùng ngành này cũng đổi theo." : undefined}>
            <Input id={`name-${category._id}`} className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id={`description-${category._id}`} label="Mô tả">
            <Input id={`description-${category._id}`} className="h-11" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Spinner />}
            Lưu
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setName(category.name);
              setDescription(category.description ?? "");
              setError(null);
              setMode("view");
            }}
          >
            Huỷ
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className={category.active ? "font-semibold" : "font-semibold text-muted-foreground"}>
          {category.name}
          {!category.active && (
            <Badge variant="outline" className="ml-2 align-middle">
              Đang ẩn
            </Badge>
          )}
        </p>
        {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
        {isIndustry && (
          <p className="mt-1 text-xs text-muted-foreground">
            {category.jobCount ?? 0} tin, {category.companyCount ?? 0} công ty đang dùng
          </p>
        )}
        {notice && <p className="mt-1 text-sm text-primary">{notice}</p>}
        {error && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {mode === "confirm-delete" ? (
        <div role="group" aria-label={`Xoá ${category.name}`} className="flex max-w-xs flex-col items-end gap-2 text-right">
          <p className="text-sm">Xoá &quot;{category.name}&quot;? Không khôi phục được.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode("view")} disabled={pending}>
              Giữ lại
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={async () => {
                // Thất bại (ví dụ ngành đang được dùng) thì quay về dòng thường và hiện lý do
                if ((await run(() => deleteRequest(`/api/categories/${category._id}`))) === null) setMode("view");
              }}
            >
              {pending && <Spinner />}
              Xoá
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("edit")}>
            Sửa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => putJson(`/api/categories/${category._id}`, { active: !category.active }))}
          >
            {category.active ? "Ẩn" : "Hiện lại"}
          </Button>
          {/* Ngành đang được dùng không xoá được (backend chặn): chỉ gợi ý ẩn */}
          {!(isIndustry && usage > 0) && (
            <Button variant="ghost" size="sm" onClick={() => setMode("confirm-delete")}>
              Xoá
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
