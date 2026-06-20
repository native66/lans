# Báo cáo Chi tiết Source Code: DIEPS Intent Engine (Sui Hackathon)

## 1. Tổng quan Dự án (Project Overview)
Dự án là một ứng dụng Web3 **Intent-Centric Swap** (Giao dịch dựa trên ý định) được xây dựng trên hệ sinh thái **Sui Blockchain**. Dự án được thiết kế với kiến trúc full-stack hiện đại, kết hợp giữa giao diện người dùng cao cấp, backend xử lý logic on-chain và tích hợp sâu với các tác vụ AI tự động (Agent).

**Tech Stack chính:**
- **Frontend**: React 19, Vite, Tailwind CSS v4, TypeScript.
- **Backend**: Express.js, TypeScript (chạy qua `tsx` trong môi trường dev).
- **Web3/Sui**: `@mysten/sui` (SDK), `@mysten/dapp-kit` (Quản lý ví và Provider).
- **State & Data**: `@tanstack/react-query` (quản lý server state), `zustand` (client state).
- **UI/UX**: Radix UI (thông qua custom components), `lucide-react` (icons), `recharts` (biểu đồ), `motion` (animation).
- **Database**: `drizzle-orm` (có thể kết nối với PostgreSQL/SQLite).

---

## 2. Phân tích Kiến trúc Frontend (`src/`)

Frontend được tổ chức theo mô hình component-based rất rõ ràng:
- **Routing (`App.tsx`, `main.tsx`)**: Sử dụng `react-router-dom`. Bọc toàn bộ app trong `QueryClientProvider`, `SuiClientProvider`, và `WalletProvider` để cung cấp global context cho việc kết nối ví Sui và gọi RPC.
- **Giao diện (UI/UX)**:
  - Thiết kế theo hướng *Glassmorphism* kết hợp *Dark Mode*, tạo cảm giác không gian công nghệ cao cấp (Premium UI).
  - Sử dụng các component tái sử dụng trong thư mục `components/ui/` (như Card, Button,...).
- **Các trang chính (Pages)**:
  - `landing.tsx`: Trang chủ giới thiệu dự án.
  - `dashboard.tsx`: Bảng điều khiển tổng quan về tài sản và hoạt động.
  - `agents.tsx`: Giao diện quản lý các AI Trading Agents. Cho phép xem trạng thái (Active/Paused), ngân sách, và lợi nhuận (PnL). Có tích hợp nút tạo mới "Intent" bằng ngôn ngữ tự nhiên.
  - `deepbook.tsx`: Tích hợp sổ lệnh (Orderbook) từ DeepBook của Sui. Hiện thị giá ask/bid và giả lập giao diện trading live.
  - `nfts.tsx`, `policies.tsx`, `activity.tsx`: Quản lý tài sản NFT, các chính sách bảo mật (Guardian layer), và lịch sử hoạt động.

---

## 3. Phân tích Kiến trúc Backend (`backend/`)

Backend đóng vai trò là một API Gateway và xử lý các logic phức tạp mà frontend không nên thực hiện trực tiếp:
- **Core (`server.ts`)**: Server Express chạy trên cổng 3000. Trong môi trường Dev, nó sử dụng Vite middleware để phục vụ Frontend (giúp chạy cả BE và FE trên cùng 1 port một cách mượt mà).
- **Routes (`routes/`)**: Cung cấp các endpoint RESTful (phiên bản `v1`):
  - `/api/v1/auth`, `/api/v1/wallet`, `/api/v1/agents`, `/api/v1/nfts`, `/api/v1/deepbook`.
- **Services (`services/`)**: Xử lý logic nghiệp vụ giao tiếp với Sui Blockchain.
  - **`deepbook.ts`**: Cấu hình `SuiJsonRpcClient` kết nối tới `mainnet`. Chứa logic giả lập việc tạo **Programmable Transaction Block (PTB)** cho các lệnh Limit Order (`createLimitOrderPTB`). Hiện tại đoạn code này đang là cấu trúc khung (stub) để chuẩn bị tích hợp logic gọi hàm Move (`deepbook::clob_v2::place_limit_order`) thực tế.

---

## 4. Phân tích Hệ thống AI Skills (`.agents/skills/`)

Bạn vừa cài đặt gói `mystenlabs/skills`, đây là một nước đi rất chuẩn xác để hỗ trợ AI trong việc viết code Move và tương tác với Sui. Bộ skills này chứa 20 module, cung cấp context và định dạng chuẩn cho AI Agent:
- **Ngôn ngữ Move**: `modern-move-syntax`, `sui-move`, `sui-object-model`, `composable-move-functions`, `naming-conventions` (Hướng dẫn AI viết smart contract chuẩn bảo mật và tối ưu).
- **Tương tác On-chain (Client/SDK)**: `ptbs` (Cách xây dựng Programmable Transaction Blocks), `sui-client`, `sui-sdks` (Cách sử dụng TS SDK v2 mới nhất của Sui).
- **Truy xuất dữ liệu**: `accessing-data` (Chứa các file như `graphql.md`, `grpc.md`, `indexers.md` giúp AI hiểu cách dùng Sui GraphQL RPC thay cho RPC truyền thống).
- **Testing & Tooling**: `move-unit-testing`, `sui-build`, `sui-cli`, `sui-publish`.

**Tác dụng:** Khi bạn yêu cầu AI code một tính năng (ví dụ: "Viết logic tạo PTB cho Deepbook"), AI sẽ tự động đọc các file trong thư mục này để đảm bảo code sinh ra tương thích 100% với phiên bản Sui mới nhất, không bị lỗi thời.

---

## 5. Đánh giá & Đề xuất Nâng cấp

### Điểm mạnh:
1. **Cấu trúc Source Code chặt chẽ**: Việc gộp chung Express và Vite bằng middleware là một setup rất hiện đại, giúp giải quyết triệt để lỗi CORS khi dev.
2. **UI/UX xuất sắc**: Component UI được chia nhỏ, sử dụng Tailwind v4 mới nhất. Việc dùng `@tanstack/react-query` giúp việc fetch data orderbook mượt mà, không bị chớp giật.
3. **Ý tưởng Agent/Intent Đột phá**: Việc có trang quản lý Agent và tự động build PTB từ intent là rất phù hợp với xu hướng (Narrative) hiện tại của các cuộc thi Hackathon.

### Đề xuất công việc tiếp theo (To-do List):
1. **Kết nối thật với DeepBook (Backend)**: Thay thế dữ liệu mock trong `backend/services/deepbook.ts` bằng việc fetch orderbook thật từ contract DeepBook qua Sui RPC.
2. **Hoàn thiện luồng tạo PTB**: Trong hàm `createLimitOrderPTB`, cần code logic tạo `Transaction` (tx), gọi `tx.moveCall(...)`, sau đó serialize trả về cho Frontend. Tại Frontend, dùng hook `useSignAndExecuteTransaction` của `@mysten/dapp-kit` để người dùng ký ví.
3. **Bảo mật (Guardian Layer)**: Đảm bảo các intent của AI sinh ra được kiểm duyệt rủi ro (Risk Assessment) trước khi đẩy lên blockchain để ngăn chặn việc Agent tiêu xài vượt budget (`budgetMs`).
4. **.gitignore**: Thư mục `.agents` đã được thêm vào `.gitignore`, điều này là đúng đắn để không đẩy các file skills (vốn có thể được sinh tự động) lên GitHub gây nặng repo.

Dự án hiện tại có foundation cực kỳ vững chắc. Bro muốn chúng ta bắt tay vào việc tích hợp logic **DeepBook thật** hay hoàn thiện **Agent Intent Parsing** trước?
