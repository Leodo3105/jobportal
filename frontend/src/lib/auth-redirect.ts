import type { UserRole } from "@/types/api";

const HOME_BY_ROLE: Record<UserRole, string> = {
  jobseeker: "/",
  employer: "/",
  admin: "/",
};

export function homeForRole(role: UserRole): string {
  return HOME_BY_ROLE[role] ?? "/";
}

export function safeNext(next: string | undefined | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  return next;
}

export function redirectAfterLogin(role: UserRole, next?: string | null): string {
  return safeNext(next) ?? homeForRole(role);
}
