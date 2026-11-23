import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  logo?: string | null; // tên file trong /uploads/logos, không có thì hiện ô xám
  size?: "md" | "lg";
}

const SIZES = {
  md: { box: "size-11", px: 44 },
  lg: { box: "size-16", px: 64 },
};

export function CompanyLogo({ logo, size = "md" }: CompanyLogoProps) {
  const { box, px } = SIZES[size];

  if (!logo) {
    return <div className={cn(box, "shrink-0 rounded-md bg-muted")} aria-hidden="true" />;
  }

  return (
    // alt="" vì tên công ty luôn được viết ngay cạnh logo, đọc lại tên là thừa
    <img
      src={`/uploads/logos/${logo}`}
      alt=""
      width={px}
      height={px}
      className={cn(box, "shrink-0 rounded-md border bg-white object-contain")}
    />
  );
}
