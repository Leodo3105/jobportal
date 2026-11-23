"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { Field, errorProps } from "@/components/form-field";
import { FormAlert } from "@/components/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, putJson } from "@/lib/api-client";
import { JOB_TYPE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PROFILE_LIMITS, parseSkills, profileSchema, type ProfileValues } from "@/lib/validation/profile";
import type { JobType, JobseekerProfile } from "@/types/api";

// Đổi dữ liệu backend sang giá trị ban đầu của form
function toFormValues(profile: JobseekerProfile | null, userName: string): ProfileValues {
  return {
    title: profile?.title ?? `Hồ sơ của ${userName}`,
    desiredPosition: profile?.desiredPosition ?? "",
    location: profile?.location ?? "",
    workType: profile?.workType ?? "full-time",
    desiredSalaryMillions: profile?.desiredSalary ? String(profile.desiredSalary / 1_000_000) : "",
    availableFrom: profile?.availableFrom ? profile.availableFrom.slice(0, 10) : "",
    bio: profile?.bio ?? "",
    skillsText: profile?.skills.join(", ") ?? "",
    website: profile?.website ?? "",
    linkedin: profile?.socialMedia?.linkedin ?? "",
    github: profile?.socialMedia?.github ?? "",
    visibility: profile?.visibility ?? true,
  };
}

export function ProfileForm({ profile, userName }: { profile: JobseekerProfile | null; userName: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toFormValues(profile, userName),
  });

  const bioLength = watch("bio")?.length ?? 0;
  const skillsPreview = parseSkills(watch("skillsText") ?? "");

  async function onSubmit(values: ProfileValues) {
    setStatus(null);
    try {
      // PUT /api/profiles GHI ĐÈ mọi thông tin chung. Các field form này không có
      // (số điện thoại, ngày sinh, Twitter) phải gửi lại giá trị cũ, nếu không sẽ bị xoá.
      await putJson("/api/profiles", {
        title: values.title,
        desiredPosition: values.desiredPosition,
        location: values.location,
        workType: values.workType,
        desiredSalary: values.desiredSalaryMillions === "" ? 0 : Math.round(Number(values.desiredSalaryMillions) * 1_000_000),
        availableFrom: values.availableFrom || null,
        bio: values.bio,
        skills: parseSkills(values.skillsText),
        website: values.website,
        socialMedia: {
          linkedin: values.linkedin,
          github: values.github,
          twitter: profile?.socialMedia?.twitter ?? "",
        },
        visibility: values.visibility,
        phone: profile?.phone ?? "",
        dob: profile?.dob ?? null,
      });
      setStatus({ type: "success", message: profile ? "Đã lưu hồ sơ." : "Đã tạo hồ sơ. Giờ bạn có thể thêm kinh nghiệm và học vấn." });
      router.refresh(); // render lại trang để phần kinh nghiệm/học vấn biết hồ sơ đã tồn tại
    } catch (error) {
      setStatus({ type: "error", message: errorMessage(error) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {status && <FormAlert variant={status.type}>{status.message}</FormAlert>}

      <Field id="title" label="Tiêu đề hồ sơ" error={errors.title?.message} hint="Ví dụ: Lập trình viên Backend Node.js, 2 năm kinh nghiệm">
        <Input id="title" className="h-11" {...register("title")} {...errorProps(errors.title, "title")} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="desiredPosition" label="Vị trí mong muốn" error={errors.desiredPosition?.message}>
          <Input id="desiredPosition" className="h-11" placeholder="Backend Developer" {...register("desiredPosition")} {...errorProps(errors.desiredPosition, "desiredPosition")} />
        </Field>
        <Field id="location" label="Nơi muốn làm việc" error={errors.location?.message}>
          <Input id="location" className="h-11" placeholder="Hà Nội" {...register("location")} {...errorProps(errors.location, "location")} />
        </Field>
        <Field id="workType" label="Hình thức làm việc">
          <NativeSelect id="workType" {...register("workType")}>
            {(Object.entries(JOB_TYPE_LABELS) as [JobType, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="desiredSalaryMillions" label="Lương mong muốn (triệu đồng/tháng)" error={errors.desiredSalaryMillions?.message} hint="Để trống nếu muốn thoả thuận">
          <Input id="desiredSalaryMillions" inputMode="decimal" className="h-11" placeholder="15" {...register("desiredSalaryMillions")} {...errorProps(errors.desiredSalaryMillions, "desiredSalaryMillions")} />
        </Field>
        <Field id="availableFrom" label="Có thể đi làm từ ngày">
          <Input id="availableFrom" type="date" className="h-11" {...register("availableFrom")} />
        </Field>
      </div>

      <Field id="bio" label="Giới thiệu bản thân" error={errors.bio?.message}>
        <Textarea
          id="bio"
          rows={6}
          placeholder="Điểm mạnh, dự án nổi bật và mục tiêu nghề nghiệp của bạn."
          {...register("bio")}
          {...errorProps(errors.bio, "bio")}
        />
        <p className={cn("text-right text-sm", bioLength > PROFILE_LIMITS.bio ? "text-destructive" : "text-muted-foreground")}>
          {bioLength}/{PROFILE_LIMITS.bio}
        </p>
      </Field>

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

      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="website" label="Website" error={errors.website?.message}>
          <Input id="website" type="url" className="h-11" placeholder="https://" {...register("website")} {...errorProps(errors.website, "website")} />
        </Field>
        <Field id="linkedin" label="LinkedIn" error={errors.linkedin?.message}>
          <Input id="linkedin" type="url" className="h-11" placeholder="https://linkedin.com/in/…" {...register("linkedin")} {...errorProps(errors.linkedin, "linkedin")} />
        </Field>
        <Field id="github" label="GitHub" error={errors.github?.message}>
          <Input id="github" type="url" className="h-11" placeholder="https://github.com/…" {...register("github")} {...errorProps(errors.github, "github")} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 size-4 accent-primary" {...register("visibility")} />
        <span>
          <span className="block font-medium">Cho nhà tuyển dụng tìm thấy hồ sơ</span>
          <span className="block text-sm text-muted-foreground">
            Tắt thì hồ sơ không hiện khi nhà tuyển dụng tìm ứng viên. Nhà tuyển dụng bạn đã nộp đơn vẫn xem được.
          </span>
        </span>
      </label>

      <Button type="submit" size="lg" className="h-11 self-start" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {isSubmitting ? "Đang lưu…" : profile ? "Lưu hồ sơ" : "Tạo hồ sơ"}
      </Button>
    </form>
  );
}
