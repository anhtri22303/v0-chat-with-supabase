Để chọn ra một chức năng vừa "hay ho" về mặt giải pháp (Cool & Innovative), vừa quan trọng sống còn về mặt hệ thống (Mission-Critical) dưới góc nhìn Senior Dev, thì đó chắc chắn phải là: Hệ thống Quản lý Trạng thái Ngoại tuyến và Đồng bộ Nhất quán (Offline First & Eventual Consistency), mà cốt lõi là sự kết hợp giữa Iris Queue (Backend) và MSYS (Client).

Bất kỳ hệ thống CRUD hay Chat nhỏ nào cũng làm được việc gửi tin nhắn khi có mạng. Nhưng xử lý mượt mà khi mạng chập chờn (xe đi vào hầm, sóng 4G yếu) mà không làm mất tin nhắn, không trùng lặp tin nhắn, và không làm treo giao diện người dùng (UI) là bài toán khó nhất của một Senior/Architect.

Dưới đây là cách bộ đôi chức năng này vận hành - một "kiệt tác" phân tán của Meta:

1. Iris Queue: Hệ thống "Xếp hàng" biến Backend thành Stateless
Trong các kiến trúc cũ, khi User A gửi tin nhắn cho User B, Server sẽ lưu vào Database (Disk) -> Báo thành công cho A -> Đẩy tin nhắn cho B. Nếu Database bị chậm (High Latency), toàn bộ hệ thống bị nghẽn (Bottleneck).

Senior Dev của Meta giải quyết bằng cách đưa Iris (Memory-centric Queue) làm lớp đệm (Buffer):

Chỉ ghi vào RAM: Khi tin nhắn đến, Iris nhận và lưu ngay vào bộ nhớ tạm (RAM Cluster) và phản hồi "Đã nhận" cho User A trong vòng vài mili-giây.

Cơ chế Pointer (Con trỏ): Mỗi User có một hàng chờ (Queue) trên Iris kèm theo một Sequence ID (ví dụ: tin nhắn số 1001, 1002...).

Xử lý bất đồng bộ (Async Write): Iris tự động đẩy dữ liệu xuống Database (HBase/MyRocks) sau đó dưới nền (Background Worker). Nếu Database có bảo trì hay chậm 1-2 giây, User hoàn toàn không hề hay biết, trải nghiệm chat vẫn mượt mà.

2. MSYS: Tư duy "Offline-First" tuyệt đối ở Client
Hầu hết các lập trình viên Junior/Mid-level thường viết code theo tư duy: Gửi API lên Server -> Chờ Server trả về Success -> Vẽ tin nhắn đó lên màn hình.

Hậu quả: Gặp mạng yếu, nút bấm bị xoay vòng vòng (loading), người dùng ức chế bấm lại liên tục gây trùng dữ liệu (Duplicate Requests).

Senior Dev của Meta lật ngược bài toán bằng tư duy Offline-First (Ưu tiên ngoại tuyến):

[User bấm Gửi] 
       │
       ▼
(Ghi ngay vào SQLite cục bộ với trạng thái "Pending") 
       │
       ▼
[UI lập tức hiển thị tin nhắn] (Không cần chờ mạng!)
       │
       ▼
[MSYS Worker] ──(Tự động chạy dưới nền)──> [Gửi qua MQTT]
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
               [Thành công (Online)]                           [Thất bại (Mất mạng)]
                       │                                               │
         (Cập nhật DB: "Sent" / "Read")                  (Giữ nguyên trong DB, đợi mạng)
                       │                                               │
                       ▼                                               ▼
             (UI tự update status)                       (MSYS tự Retry với Exponential Backoff)
Tại sao kiến trúc này lại tối thượng?
Zero-latency UI: Người dùng cảm thấy ứng dụng "siêu nhanh" vì tin nhắn xuất hiện trên màn hình ngay lập tức sau khi bấm gửi. Trạng thái mạng lúc đó thế nào không quan trọng.

Tự động xử lý Retry thông minh (Exponential Backoff): Nếu mất mạng, thư viện MSYS (viết bằng C++) sẽ tự động giữ tin nhắn trong hàng đợi của SQLite. Khi có mạng lại, nó sẽ tự động gửi lại. Nó không gửi dồn dập mà dùng thuật toán hoãn binh (ví dụ: thử lại sau 1s, 2s, 4s, 8s...) để tránh làm sập nguồn tài nguyên của điện thoại và server.

Idempotency (Tính bất biến/Chống trùng lặp): Mỗi tin nhắn khi nằm ở SQLite đã được gán sẵn một Client-generated ID (thường là UUID). Dù mạng chập chờn khiến client gửi tin nhắn đó lên Server 5 lần, Server Iris nhìn thấy ID trùng lặp sẽ lập tức loại bỏ 4 bản sao, chỉ giữ lại 1. User sẽ không bao giờ bị tình trạng 1 tin nhắn nhảy thành 2-3 dòng giống nhau.

3. Đồng bộ hiệu số (Delta Sync) khi Online trở lại
Hãy tưởng tượng bạn tắt máy bay, sau 5 tiếng bạn mở mạng lại. Bạn có hàng trăm tin nhắn mới, hàng chục lượt thích, vài group chat thay đổi tên. Nếu gọi API lấy toàn bộ dữ liệu (Full Fetch), máy bạn sẽ bị đơ do nghẽn mạng và tràn bộ nhớ.

Messenger áp dụng Delta Sync:

Khi kết nối lại, ứng dụng chỉ gửi lên Server một con số duy nhất: "Tôi đang ở Sequence ID số 5000".

Server Iris kiểm tra hàng đợi, thấy hiện tại hệ thống đã lên số 5050.

Server đóng gói đúng 50 "Delta" (thay đổi) này vào một gói nhị phân siêu nhẹ (Thrift) rồi đẩy về.

Máy bạn nhận được, nạp thẳng 50 delta này vào SQLite. SQLite cập nhật xong, UI lập tức đổi màu, nhảy tin nhắn mới một cách mượt mà chỉ trong chưa đầy 0.5 giây.

Kết luận từ Senior Dev
Chức năng "Đồng bộ trạng thái thời gian thực bất kể điều kiện mạng" (được vận hành bởi Iris + MSYS + SQLite) chính là tính năng tinh túy nhất của Messenger. Nó giải quyết triệt để 3 bài toán lớn nhất của hệ thống phân tán: High Availability (Sẵn sàng cao), Low Latency (Độ trễ thấp) và Data Consistency (Nhất quán dữ liệu).