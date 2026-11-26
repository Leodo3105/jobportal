import { Field } from "@/components/form-field";
import { NativeSelect } from "@/components/ui/native-select";

interface IndustryFieldProps extends React.ComponentProps<"select"> {
  id: string;
  industries: string[]; // tên các ngành đang hiện trong danh mục
  current?: string; // ngành đang lưu của tin/công ty (khi sửa)
  error?: string;
}

// Ô chọn "Ngành nghề" dùng chung cho form công ty và form tin.
// Backend chỉ nhận ngành có trong danh mục đang hiện, nhưng cho giữ nguyên ngành cũ dù admin đã ẩn
// (backend/src/utils/checkIndustry.js). Phần props còn lại (register, aria-*) truyền thẳng vào <select>.
export function IndustryField({ id, industries, current, error, ...selectProps }: IndustryFieldProps) {
  // Ngành đang lưu đã bị ẩn: vẫn hiện trong danh sách để giữ nguyên được
  const retired = current && !industries.includes(current) ? current : null;
  const empty = industries.length === 0 && !retired;

  let hint: string | undefined;
  if (empty) hint = "Chưa có ngành nghề nào. Liên hệ quản trị viên để thêm ngành, rồi tải lại trang.";
  else if (retired) hint = `Ngành "${retired}" đã ngừng sử dụng. Bạn vẫn giữ được, nhưng đổi sang ngành khác thì không chọn lại được.`;

  return (
    // Chưa có ngành mà bấm lưu: hiện câu hướng dẫn ở chỗ lỗi (thay "Vui lòng chọn ngành nghề", vì không có gì để chọn)
    <Field id={id} label="Ngành nghề" error={error && empty ? hint : error} hint={hint}>
      <NativeSelect id={id} {...selectProps}>
        <option value="">{empty ? "Chưa có ngành nghề" : "Chọn ngành nghề"}</option>
        {retired && <option value={retired}>{retired} (ngừng sử dụng)</option>}
        {industries.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}
