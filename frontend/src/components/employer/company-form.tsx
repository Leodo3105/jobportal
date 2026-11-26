"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { IndustryField } from "@/components/employer/industry-field";
import { Field, errorProps } from "@/components/form-field";
import { FormAlert } from "@/components/form-alert";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, putForm, putJson } from "@/lib/api-client";
import { companySizeLabel } from "@/lib/format";
import { EMPLOYER_LIMITS, companySchema, type CompanyValues } from "@/lib/validation/employer";
import { IMAGE_EXTENSIONS, validateImageFile } from "@/lib/validation/image";
import type { CompanySize, MyCompany } from "@/types/api";

const SIZES: CompanySize[] = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

type Status = { type: "success" | "error"; message: string } | null;

interface CompanyFormProps {
  company: MyCompany | null;
  industries: string[]; // tên các ngành đang hiện trong danh mục
}

export function CompanyForm({ company, industries }: CompanyFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name ?? "",
      industry: company?.industry ?? "",
      companySize: company?.companySize ?? "1-10",
      location: company?.location ?? "",
      foundedYear: company?.foundedYear ? String(company.foundedYear) : "",
      description: company?.description ?? "",
      website: company?.website ?? "",
      facebook: company?.socialMedia?.facebook ?? "",
      linkedin: company?.socialMedia?.linkedin ?? "",
    },
  });
  const descriptionLength = watch("description")?.length ?? 0;

  async function onSubmit(values: CompanyValues) {
    setStatus(null);
    try {
      // PUT /api/companies tạo mới nếu chưa có, và GHI ĐÈ toàn bộ nếu đã có.
      // Twitter chưa có ô nhập nên gửi lại giá trị cũ để không bị xoá.
      await putJson("/api/companies", {
        name: values.name,
        industry: values.industry,
        companySize: values.companySize,
        location: values.location,
        foundedYear: values.foundedYear === "" ? null : Number(values.foundedYear),
        description: values.description,
        website: values.website,
        socialMedia: { facebook: values.facebook, linkedin: values.linkedin, twitter: company?.socialMedia?.twitter ?? "" },
      });
      setStatus({
        type: "success",
        message: company ? "Đã lưu thông tin công ty." : "Đã tạo công ty. Giờ bạn có thể tải logo và đăng tin tuyển dụng.",
      });
      router.refresh();
    } catch (error) {
      setStatus({ type: "error", message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {status && <FormAlert variant={status.type}>{status.message}</FormAlert>}

      <Field id="name" label="Tên công ty" error={errors.name?.message}>
        <Input id="name" className="h-11" {...register("name")} {...errorProps(errors.name, "name")} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <IndustryField
          id="industry"
          industries={industries}
          current={company?.industry}
          error={errors.industry?.message}
          {...register("industry")}
          {...errorProps(errors.industry, "industry")}
        />
        <Field id="companySize" label="Quy mô">
          <NativeSelect id="companySize" {...register("companySize")}>
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {companySizeLabel(size)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="location" label="Địa chỉ" error={errors.location?.message} className="sm:col-span-2">
          <Input id="location" className="h-11" placeholder="123 Láng Hạ, Đống Đa, Hà Nội" {...register("location")} {...errorProps(errors.location, "location")} />
        </Field>
        <Field id="foundedYear" label="Năm thành lập (không bắt buộc)" error={errors.foundedYear?.message}>
          <Input id="foundedYear" inputMode="numeric" className="h-11" placeholder="2015" {...register("foundedYear")} {...errorProps(errors.foundedYear, "foundedYear")} />
        </Field>
        <Field id="website" label="Website" error={errors.website?.message}>
          <Input id="website" type="url" className="h-11" placeholder="https://" {...register("website")} {...errorProps(errors.website, "website")} />
        </Field>
      </div>

      <Field id="description" label="Giới thiệu công ty" error={errors.description?.message} hint="Ứng viên đọc phần này ở mỗi tin tuyển dụng của bạn">
        <Textarea id="description" rows={6} {...register("description")} {...errorProps(errors.description, "description")} />
        <p className={descriptionLength > EMPLOYER_LIMITS.companyDescription ? "text-right text-sm text-destructive" : "text-right text-sm text-muted-foreground"}>
          {descriptionLength}/{EMPLOYER_LIMITS.companyDescription}
        </p>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="facebook" label="Facebook" error={errors.facebook?.message}>
          <Input id="facebook" type="url" className="h-11" placeholder="https://facebook.com/…" {...register("facebook")} {...errorProps(errors.facebook, "facebook")} />
        </Field>
        <Field id="linkedin" label="LinkedIn" error={errors.linkedin?.message}>
          <Input id="linkedin" type="url" className="h-11" placeholder="https://linkedin.com/company/…" {...register("linkedin")} {...errorProps(errors.linkedin, "linkedin")} />
        </Field>
      </div>

      <Button type="submit" size="lg" className="h-11 self-start" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {isSubmitting ? "Đang lưu…" : company ? "Lưu thông tin" : "Tạo công ty"}
      </Button>
    </form>
  );
}

export function LogoUploader({ logo }: { logo: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const file = input.current?.files?.[0];
    const error = validateImageFile(file, "ảnh logo");
    setFileError(error);
    if (error || !file) return;

    const formData = new FormData();
    formData.append("logo", file); // khớp logoUpload.single('logo') ở backend
    setPending(true);
    try {
      await putForm("/api/companies/logo", formData);
      if (input.current) input.current.value = "";
      setStatus({ type: "success", message: "Đã cập nhật logo." });
      router.refresh();
    } catch (err) {
      setStatus({ type: "error", message: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={upload} noValidate className="flex flex-col gap-4">
      {status && <FormAlert variant={status.type}>{status.message}</FormAlert>}
      <div className="flex items-center gap-4">
        <CompanyLogo logo={logo} size="lg" />
        <p className="text-sm text-muted-foreground">Ảnh vuông hiển thị đẹp nhất. JPG, PNG, GIF hoặc WEBP, tối đa 2MB.</p>
      </div>
      <Field id="logo" label="Ảnh logo mới" error={fileError ?? undefined}>
        <Input
          ref={input}
          id="logo"
          type="file"
          accept={IMAGE_EXTENSIONS.join(",")}
          className="h-11 py-2"
          onChange={() => setFileError(null)}
          {...errorProps(fileError, "logo")}
        />
      </Field>
      <Button type="submit" variant="outline" className="self-start" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {pending ? "Đang tải lên…" : "Tải logo lên"}
      </Button>
    </form>
  );
}
