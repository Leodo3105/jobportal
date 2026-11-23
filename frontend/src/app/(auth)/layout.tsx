// Layout dùng chung cho các trang trong thư mục (auth): /login, /register...
//
// "(auth)" là route group: thư mục có tên trong ngoặc tròn chỉ để gom file,
// Next.js KHÔNG đưa nó vào URL. Vì vậy app/(auth)/login/page.tsx có địa chỉ /login,
// không phải /auth/login.
//
// Layout này nằm BÊN TRONG layout gốc (app/layout.tsx), nên header và footer vẫn hiện.
//
// Hiện tại layout chỉ căn giữa form. Muốn thêm panel bên trái sau này thì chỉ sửa file này:
// đổi khối ngoài thành lưới 2 cột ở màn hình lớn, thêm panel vào cột trái,
// còn {children} (phần form) giữ nguyên.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center px-5 py-12 sm:py-16">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 sm:p-8">{children}</div>
    </div>
  );
}
