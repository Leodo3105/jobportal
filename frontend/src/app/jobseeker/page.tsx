import { redirect } from "next/navigation";

// /jobseeker chưa có trang tổng quan, chuyển thẳng tới danh sách đơn
export default function JobseekerHome() {
  redirect("/jobseeker/applications");
}
