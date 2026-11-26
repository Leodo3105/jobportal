"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { IndustryField } from "@/components/employer/industry-field";
import { Field, errorProps } from "@/components/form-field";
import { FormAlert } from "@/components/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, postJson, putJson } from "@/lib/api-client";
import { EDUCATION_LABELS, EXPERIENCE_LABELS, JOB_TYPE_LABELS } from "@/lib/format";
import { EMPLOYER_LIMITS, jobSchema, salaryFactor, type JobFormValues } from "@/lib/validation/employer";
import { parseSkills } from "@/lib/validation/profile";
import { cn } from "@/lib/utils";
import type { EmployerJob } from "@/types/api";

// Ngày theo giờ máy người dùng dạng "2030-01-31" (cho ô date và so sánh với hôm nay)
function localDate(date: Date): string {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function toFormValues(job?: EmployerJob): JobFormValues {
  const factor = salaryFactor(job?.salaryCurrency ?? "VND");
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  return {
    title: job?.title ?? "",
    category: job?.category ?? "",
    location: job?.location ?? "",
    jobType: job?.jobType ?? "full-time",
    experienceLevel: job?.experienceLevel ?? "junior",
    educationLevel: job?.educationLevel ?? "any",
    salaryCurrency: job?.salaryCurrency === "USD" ? "USD" : "VND",
    salaryMin: job?.salaryMin ? String(job.salaryMin / factor) : "",
    salaryMax: job?.salaryMax ? String(job.salaryMax / factor) : "",
    showSalary: job?.showSalary ?? true,
    skillsText: job?.skills.join(", ") ?? "",
    applicationDeadline: job ? localDate(new Date(job.applicationDeadline)) : localDate(in30Days),
    description: job?.description ?? "",
    requirements: job?.requirements ?? "",
    benefits: job?.benefits ?? "",
  };
}

interface JobFormProps {
  job?: EmployerJob; // có: sửa tin; không có: đăng tin mới
  categories: string[];
}

export function JobForm({ job, categories }: JobFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const initial = toFormValues(job);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JobFormValues>({ resolver: zodResolver(jobSchema), defaultValues: initial });

  const currency = watch("salaryCurrency");
  const skillsPreview = parseSkills(watch("skillsText") ?? "");
  const unit = currency === "VND" ? "triệu đồng" : "USD";

  async function onSubmit(values: JobFormValues) {
    setServerError(null);
    const deadlineChanged = values.applicationDeadline !== initial.applicationDeadline;
    // Hạn nộp mới phải từ hôm nay. Sửa tin mà giữ nguyên hạn cũ (kể cả đã qua) thì vẫn cho lưu.
    if ((deadlineChanged || !job) && values.applicationDeadline < localDate(new Date())) {
      setError("applicationDeadline", { message: "Hạn nộp phải từ hôm nay trở đi" });
      return;
    }

    const factor = salaryFactor(values.salaryCurrency);
    const body = {
      title: values.title,
      category: values.category,
      location: values.location,
      jobType: values.jobType,
      experienceLevel: values.experienceLevel,
      educationLevel: values.educationLevel,
      salaryCurrency: values.salaryCurrency,
      salaryMin: values.salaryMin === "" ? null : Math.round(Number(values.salaryMin) * factor),
      salaryMax: values.salaryMax === "" ? null : Math.round(Number(values.salaryMax) * factor),
      showSalary: values.showSalary,
      skills: parseSkills(values.skillsText),
      // Không đổi hạn thì gửi lại đúng giá trị cũ, để backend nhận ra "không đổi"
      applicationDeadline: job && !deadlineChanged ? job.applicationDeadline : values.applicationDeadline,
      description: values.description,
      requirements: values.requirements,
      benefits: values.benefits,
    };

    try {
      if (job) {
        await putJson(`/api/jobs/${job._id}`, body);
      } else {
        await postJson("/api/jobs", body);
      }
      router.push(`/employer/jobs?saved=${job ? "updated" : "created"}`);
      router.refresh();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  }

  const longText = (name: "description" | "requirements" | "benefits", label: string, placeholder: string) => {
    const length = watch(name)?.length ?? 0;
    return (
      <Field id={name} label={label} error={errors[name]?.message} hint="Mỗi ý một dòng">
        <Textarea id={name} rows={6} placeholder={placeholder} {...register(name)} {...errorProps(errors[name], name)} />
        <p className={cn("text-right text-sm", length > EMPLOYER_LIMITS.jobText ? "text-destructive" : "text-muted-foreground")}>
          {length}/{EMPLOYER_LIMITS.jobText}
        </p>
      </Field>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {serverError && <FormAlert>{serverError}</FormAlert>}

      <section aria-labelledby="basic-heading" className="flex flex-col gap-5 rounded-xl border bg-card p-6">
        <h2 id="basic-heading" className="text-lg font-semibold">
          Thông tin chung
        </h2>
        <Field id="title" label="Tiêu đề tin" error={errors.title?.message} hint="Tên vị trí cụ thể, ví dụ: Lập trình viên Backend Node.js">
          <Input id="title" className="h-11" {...register("title")} {...errorProps(errors.title, "title")} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <IndustryField
            id="category"
            industries={categories}
            current={job?.category}
            error={errors.category?.message}
            {...register("category")}
            {...errorProps(errors.category, "category")}
          />
          <Field id="location" label="Địa điểm làm việc" error={errors.location?.message}>
            <Input id="location" className="h-11" placeholder="Hà Nội" {...register("location")} {...errorProps(errors.location, "location")} />
          </Field>
          <Field id="jobType" label="Hình thức">
            <NativeSelect id="jobType" {...register("jobType")}>
              {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="experienceLevel" label="Kinh nghiệm">
            <NativeSelect id="experienceLevel" {...register("experienceLevel")}>
              {Object.entries(EXPERIENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="educationLevel" label="Học vấn">
            <NativeSelect id="educationLevel" {...register("educationLevel")}>
              {Object.entries(EDUCATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="applicationDeadline" label="Hạn nộp hồ sơ" error={errors.applicationDeadline?.message}>
            <Input id="applicationDeadline" type="date" className="h-11" {...register("applicationDeadline")} {...errorProps(errors.applicationDeadline, "applicationDeadline")} />
          </Field>
        </div>

        <Field id="skillsText" label="Kỹ năng" error={errors.skillsText?.message} hint="Ngăn cách bằng dấu phẩy">
          <Input id="skillsText" className="h-11" placeholder="Node.js, Express, MongoDB" {...register("skillsText")} {...errorProps(errors.skillsText, "skillsText")} />
          {skillsPreview.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Kỹ năng sẽ được lưu">
              {skillsPreview.map((skill) => (
                <li key={skill}>
                  <Badge variant="secondary">{skill}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Field>
      </section>

      <section aria-labelledby="salary-heading" className="flex flex-col gap-5 rounded-xl border bg-card p-6">
        <h2 id="salary-heading" className="text-lg font-semibold">
          Mức lương
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="salaryCurrency" label="Đơn vị">
            <NativeSelect id="salaryCurrency" {...register("salaryCurrency")}>
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </NativeSelect>
          </Field>
          <Field id="salaryMin" label={`Từ (${unit})`} error={errors.salaryMin?.message}>
            <Input id="salaryMin" inputMode="decimal" className="h-11" placeholder={currency === "VND" ? "15" : "1000"} {...register("salaryMin")} {...errorProps(errors.salaryMin, "salaryMin")} />
          </Field>
          <Field id="salaryMax" label={`Đến (${unit})`} error={errors.salaryMax?.message}>
            <Input id="salaryMax" inputMode="decimal" className="h-11" placeholder={currency === "VND" ? "25" : "2000"} {...register("salaryMax")} {...errorProps(errors.salaryMax, "salaryMax")} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 size-4 accent-primary" {...register("showSalary")} />
          <span>
            <span className="block font-medium">Hiện mức lương trên tin</span>
            <span className="block text-sm text-muted-foreground">Bỏ chọn thì tin hiện &quot;Thỏa thuận&quot;. Tin có lương rõ ràng thường nhận nhiều đơn hơn.</span>
          </span>
        </label>
      </section>

      <section aria-labelledby="content-heading" className="flex flex-col gap-5 rounded-xl border bg-card p-6">
        <h2 id="content-heading" className="text-lg font-semibold">
          Nội dung tin
        </h2>
        {longText("description", "Mô tả công việc", "Bạn sẽ làm gì hằng ngày, làm với ai, sản phẩm là gì.")}
        {longText("requirements", "Yêu cầu ứng viên", "Kỹ năng, số năm kinh nghiệm, bằng cấp bắt buộc.")}
        {longText("benefits", "Quyền lợi", "Lương thưởng, bảo hiểm, ngày nghỉ, đào tạo.")}
      </section>

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-11" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {isSubmitting ? "Đang lưu…" : job ? "Lưu thay đổi" : "Đăng tin"}
        </Button>
        <Button asChild variant="ghost" size="lg" className="h-11">
          <Link href="/employer/jobs">Huỷ</Link>
        </Button>
      </div>
    </form>
  );
}
