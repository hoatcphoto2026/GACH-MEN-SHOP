# Ghi chú vận hành website Gạch Men Việt

Tài liệu này tóm tắt cách website đang chạy và các bước cần nhớ khi cập nhật code, quản lý sản phẩm hoặc xử lý lỗi.

## Website đang kết nối với những dịch vụ nào?

- **GitHub repository** lưu mã nguồn: [GACH-MEN-SHOP](https://github.com/hoatcphoto2026/GACH-MEN-SHOP), nhánh `main`.
- **GitHub Pages** đăng website lên mạng: <https://hoatcphoto2026.github.io/GACH-MEN-SHOP/>.
- **Supabase** xử lý đăng nhập admin, lưu dữ liệu sản phẩm và ảnh:
  - Bảng sản phẩm: `public.product_gach_men`.
  - Storage bucket ảnh: `product-images`.
- Trang chủ `index.html` đọc sản phẩm từ Supabase.
- Trang `admin.html` đăng nhập Supabase Auth; khi thêm/sửa/xóa, admin ghi trực tiếp vào Supabase. Ảnh được tải vào Supabase Storage và URL ảnh được lưu ở cột `image`.
- `products.json` không được trang online dùng để đọc/ghi sản phẩm. File này và `server.py` chỉ còn liên quan đến cách chạy/luồng cũ trên máy cá nhân; không xóa nếu vẫn muốn giữ luồng đó.

## Quy trình sửa code và cập nhật website

Sửa các file trong thư mục project trên máy trước. Lưu file xong, mở Terminal/PowerShell tại thư mục project và chạy:

```powershell
git status
git add -A
git commit -m "Mô tả ngắn thay đổi"
git push
```

- `git status`: xem file nào đã thay đổi.
- `git add -A`: chọn các thay đổi để đưa vào commit.
- `git commit`: lưu một mốc thay đổi trong lịch sử Git.
- `git push`: đưa commit lên GitHub. Đây là bước cần có để bản online nhận code mới.
- Sau khi push, GitHub Pages tự deploy từ nhánh `main`; chờ workflow Pages hoàn tất rồi tải lại website. Nếu vẫn thấy bản cũ, nhấn `Ctrl + F5` hoặc mở cửa sổ riêng tư để loại trừ cache.

Nếu `git push` báo có thay đổi mới trên remote hoặc có conflict, không dùng force-push. Dừng lại và xử lý đồng bộ trước để tránh ghi đè code trên GitHub.

## GitHub Pages

Repository hiện đã nối với remote `origin` và dùng nhánh `main`. Để kiểm tra Pages:

1. Mở repository → **Settings → Pages**.
2. Nếu chọn **Deploy from a branch**, chọn `main` và thư mục `/(root)`, rồi **Save**.
3. Mở **Actions** và chờ workflow **pages build and deployment** hoàn tất với trạng thái thành công.
4. Địa chỉ website dạng project page là `https://hoatcphoto2026.github.io/GACH-MEN-SHOP/`.

Nếu GitHub báo cần nâng cấp hoặc làm repository public để bật Pages, cân nhắc kỹ trước khi đổi visibility: repository public sẽ cho mọi người xem code và các file đã đưa lên GitHub. Không chuyển public nếu không muốn công khai nội dung repository.

## Supabase và tài khoản admin

- Project URL và Publishable key đang được website đọc từ [supabase-config.js](./supabase-config.js).
- Publishable key được dùng ở trình duyệt; **không đưa `service_role` key lên website hoặc GitHub**.
- Đăng nhập admin bằng user đã tạo trong **Supabase Dashboard → Authentication → Users**. UID của user đó phải giống UID được đặt trong các policy RLS.
- Khi chạy [supabase_admin_storage_setup.sql](./supabase_admin_storage_setup.sql), thay mọi `REPLACE_WITH_ADMIN_USER_UUID` bằng UID thật, giữ UID trong dấu nháy đơn, ví dụ:

  ```sql
  auth.uid() = 'c08f2211-cfe9-4fc7-aeb4-ca9176aaee3a'::uuid
  ```

- Script cấu hình quyền đọc công khai sản phẩm/ảnh, nhưng chỉ UID admin được thêm, sửa, xóa sản phẩm và tải ảnh lên.
- Bucket `product-images` là public để ảnh sản phẩm hiển thị trên trang chủ. Chỉ admin được upload; người xem website có thể đọc ảnh.
- Nếu thay URL website, cập nhật **Supabase Dashboard → Authentication → URL Configuration → Site URL** cho đúng domain mới.

## Sử dụng trang quản trị

1. Mở <https://hoatcphoto2026.github.io/GACH-MEN-SHOP/admin.html>.
2. Đăng nhập bằng email và mật khẩu user admin Supabase.
3. Tải ảnh JPG, PNG hoặc WEBP (tối đa 8 MB), điền thông tin rồi lưu sản phẩm.
4. Có thể sửa/xóa sản phẩm trong danh sách; thao tác được ghi trực tiếp vào Supabase.

## Xử lý nhanh khi gặp lỗi

- **Trang online không giống code mới:** kiểm tra đã `git push` chưa, xem workflow Pages trong GitHub Actions; sau đó nhấn `Ctrl + F5`.
- **Không đăng nhập được:** xác nhận email/mật khẩu trong Supabase Auth, project URL/key trong `supabase-config.js`, và mở trang qua HTTPS GitHub Pages thay vì `file://`.
- **Không tải được danh sách hoặc không lưu được:** xem thông báo lỗi trên trang admin; kiểm tra bảng `product_gach_men`, quyền RLS, UID admin trong policy và workflow/URL project.
- **Upload ảnh lỗi:** kiểm tra bucket `product-images` đã tồn tại, giới hạn/loại file, policy Storage và quyền upload của UID admin.
- Khi cần gửi hỗ trợ, chụp hoặc sao chép nguyên văn thông báo lỗi; không gửi mật khẩu hay `service_role` key.

