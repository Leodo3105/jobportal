import { cn } from "@/lib/utils";

// Tên file avatar mặc định, khớp DEFAULT_AVATAR trong backend/src/config/paths.js
const DEFAULT_AVATAR = "default-avatar.jpg";

const SIZES = {
  md: { box: "size-10", px: 40 },
  lg: { box: "size-16", px: 64 },
};

// alt="" vì tên người dùng luôn được viết ngay cạnh ảnh
export function UserAvatar({ avatar, size = "md" }: { avatar?: string | null; size?: keyof typeof SIZES }) {
  const { box, px } = SIZES[size];
  return (
    <img
      src={`/uploads/avatars/${avatar || DEFAULT_AVATAR}`}
      alt=""
      width={px}
      height={px}
      className={cn(box, "shrink-0 rounded-full border bg-muted object-cover")}
    />
  );
}
