import type { Metadata } from "next";

import { DeleteUserButton, UserStatusButton } from "@/components/admin/admin-actions";
import { FilterForm } from "@/components/admin/filter-form";
import { ErrorNotice } from "@/components/error-notice";
import { Pagination } from "@/components/jobs/pagination";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { getAdminUsers, getCurrentUser } from "@/lib/api";
import { ROLE_LABELS, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Quản lý người dùng" };

interface PageProps {
  searchParams: Promise<{ search?: string; role?: string; status?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { search, role, status, page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);
  const filters = { search, role, status };

  const [result, me] = await Promise.all([getAdminUsers({ ...filters, page }), getCurrentUser()]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Người dùng</h1>
      {result && <p className="mt-1 text-sm text-muted-foreground">{result.total} tài khoản.</p>}

      <div className="mt-6">
        <FilterForm
          action="/admin/users"
          searchPlaceholder="Tên hoặc email"
          search={search}
          selects={[
            {
              name: "role",
              label: "Vai trò",
              value: role,
              options: [
                { value: "", label: "Mọi vai trò" },
                { value: "jobseeker", label: "Ứng viên" },
                { value: "employer", label: "Nhà tuyển dụng" },
                { value: "admin", label: "Quản trị viên" },
              ],
            },
            {
              name: "status",
              label: "Trạng thái",
              value: status,
              options: [
                { value: "", label: "Mọi trạng thái" },
                { value: "active", label: "Đang hoạt động" },
                { value: "locked", label: "Bị khoá" },
              ],
            },
          ]}
        />
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {result === null ? (
          <ErrorNotice error={new Error("GET /api/admin/users thất bại")} title="Không tải được danh sách người dùng" />
        ) : result.data.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-12 text-center">
            <p className="font-semibold">Không có tài khoản nào khớp bộ lọc</p>
            <p className="mt-1 text-sm text-muted-foreground">Thử bỏ bớt điều kiện lọc.</p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {result.data.map((user) => {
                const active = user.isActive !== false;
                // Không khoá/xoá được chính mình và admin khác (backend cũng chặn)
                const canToggle = user.role !== "admin" && user._id !== me?.id;
                return (
                  <li key={user._id} className="flex flex-wrap items-center gap-4 p-4">
                    <UserAvatar avatar={user.avatar} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {user.name}
                        {user._id === me?.id && <span className="font-normal text-muted-foreground"> (bạn)</span>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex flex-col items-start gap-1 text-sm sm:w-40">
                      <span>{ROLE_LABELS[user.role]}</span>
                      <span className="text-xs text-muted-foreground">Tạo ngày {formatDate(user.createdAt)}</span>
                    </div>
                    <div className="sm:w-28">
                      <Badge variant={active ? "secondary" : "destructive"}>{active ? "Hoạt động" : "Bị khoá"}</Badge>
                    </div>
                    {canToggle && (
                      <div className="ml-auto flex flex-wrap items-start justify-end gap-2">
                        <UserStatusButton userId={user._id} name={user.name} isActive={active} />
                        <DeleteUserButton userId={user._id} name={user.name} role={user.role} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} totalPages={result.totalPages} searchParams={filters} basePath="/admin/users" />
          </>
        )}
      </div>
    </div>
  );
}
