// File: /functions/generateQuiz.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequest(context) {
    const apiKey = context.env.GOOGLE_API_KEY;

    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'LỖI CẤU HÌNH: GOOGLE_API_KEY chưa được thiết lập!' }), { status: 500 });
    }

    if (context.request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const body = await context.request.json();
        // Lấy các tham số từ Client gửi lên
        const { mon_hoc, lop, bo_sach, bai_hoc, c1, c2, c3, c4, c5, c6 } = body;

        const genAI = new GoogleGenerativeAI(apiKey);
        // Sử dụng model flash để phản hồi nhanh, giảm nguy cơ timeout
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // --- ĐỊNH NGHĨA HEADER CHÍNH XÁC 22 CỘT (Dùng để đưa vào Prompt) ---
        const header_str = "STT|Loại câu hỏi|Độ khó|Mức độ nhận thức|Đơn vị kiến thức|Mức độ đánh giá|Là câu hỏi con của câu hỏi chùm?|Nội dung câu hỏi|Đáp án đúng|Đáp án 1|Đáp án 2|Đáp án 3|Đáp án 4|Đáp án 5|Đáp án 6|Đáp án 7|Đáp án 8|Tags (phân cách nhau bằng dấu ;)|Giải thích|Đảo đáp án|Tính điểm mỗi đáp án đúng|Nhóm đáp án theo từng chỗ trống";

        // --- PROMPT (CHUYỂN TỪ PYTHON SANG JS TEMPLATE LITERAL - GIỮ NGUYÊN VĂN) ---
        const prompt_cua_ban = `
    Bạn là chuyên gia khảo thí quản lí dữ liệu cho hệ thống LMS (VNEDU) số 1 Việt Nam. Bạn am hiểu sâu sắc chương trình giáo dục phổ thông 2018. Nhiệm vụ chính của bạn là xây dựng ngân hàng câu hỏi bám sát bộ sách giáo khoa ${bo_sach} theo các chủ đề sau:
    Chủ đề: "${bai_hoc}" - Môn ${mon_hoc} - Lớp ${lop}.
    **Nội dung:** Đảm bảo tính chính xác, ngôn ngữ phù hợp với lứa tuổi học sinh và bám sát yêu cầu về phẩm chất năng lực trong chương trình.
    - Câu hỏi phải rõ ràng, chính xác, không đánh đố, ngôn ngữ chuẩn mực SGK.

    **PHÂN BỔ MỨC ĐỘ NHẬN THỨC ĐÚNG TỶ LỆ:**
    - Nhận biết: 20–30%
    - Thông hiểu: 30–40%
    - Vận dụng: 20–30%
    - Vận dụng cao: 10–20%

**ĐIỀU KIỆN TIÊN QUYẾT - KIỂM TRA NGHIÊM NGẶT:**

TRƯỚC KHI TẠO CÂU HỎI, PHẢI THỰC HIỆN:

1. **KIỂM TRA PHẠM VI LỚP HỌC CỤ THỂ:**
   - Môn ${mon_hoc} lớp ${lop} chỉ được phép chứa kiến thức ĐÚNG LỚP ĐÓ
   - TUYỆT ĐỐI KHÔNG lấy kiến thức của lớp cao hơn hoặc thấp hơn
   - Ví dụ: "Khoa học tự nhiên lớp 8" → chỉ kiến thức LỚP 8

2. **SO SÁNH VỚI CHƯƠNG TRÌNH GDPT 2018:**
   - Chỉ sử dụng nội dung Ban hành kèm theo Thông tư số 32/2018/TT-BGDĐT
   - Đối chiếu chính xác phạm vi kiến thức cho từng lớp

3. **QUY TẮC ĐÁNH GIÁ PHÙ HỢP:**
   ✅ CHẤP NHẬN: Chủ đề có trong chương trình CHÍNH KHÓA đúng lớp
   ✅ CHẤP NHẬN: Chủ đề tương đương về nội dung nhưng dùng từ ngữ khác (cùng lớp)
   ❌ TỪ CHỐI: Chủ đề thuộc lớp khác (cao hơn hoặc thấp hơn)
   ❌ TỪ CHỐI: Chủ đề quá nâng cao, chuyên sâu so với chuẩn
   ❌ TỪ CHỐI: Chủ đề không có trong khung chương trình

**QUY ĐỊNH QUAN TRỌNG VỀ PHẠM VI KIẾN THỨC:**

VÍ DỤ CỤ THỂ ĐỂ TRÁNH LỖI:
- "Khoa học tự nhiên lớp 8 - Điện học" → CHỈ lấy kiến thức ĐIỆN HỌC LỚP 8
- KHÔNG ĐƯỢC lấy kiến thức Điện học lớp 9, lớp 7, hoặc lớp 6
- "Toán lớp 6 - Phân số" → CHỈ lấy kiến thức Phân số LỚP 6
- KHÔNG ĐƯỢC lấy kiến thức Phân số lớp 7, 8, 9

**QUYẾT ĐỊNH CUỐI CÙNG:**
- Nếu "${bai_hoc}" KHÔNG thuộc phạm vi ${mon_hoc} lớp ${lop} theo GDPT 2018 → Chỉ trả về: "Bạn nhập chủ đề không có trong chương trình hiện hành"
- Nếu thuộc chương trình ĐÚNG LỚP → Tiếp tục thực hiện các yêu cầu bên dưới

YÊU CẦU SỐ LƯỢNG:
- Một lựa chọn: ${c1} | Đúng/Sai: ${c2} | Điền khuyết: ${c3} | Kéo thả: ${c4} | Chùm: ${c5} | Tự luận: ${c6}

QUY ĐỊNH ĐỊNH DẠNG CỰC KỲ QUAN TRỌNG (TRÁNH LỖI):
1. Sử dụng dấu GẠCH ĐỨNG \`|\` làm ký tự ngăn cách giữa các cột (Delimiter). MỖI DÒNG PHẢI CÓ ĐÚNG 21 DẤU | (TỔNG 22 TRƯỜNG, KỂ CẢ TRỐNG Ở CUỐI).
2. TUYỆT ĐỐI KHÔNG dùng dấu phẩy \`,\` để ngăn cách các cột. Nếu cần phân cách trong nội dung, dùng ; hoặc /.
3. Không được sử dụng dấu \`|\` bên trong nội dung câu hỏi hay đáp án (hãy thay bằng dấu phẩy hoặc gạch chéo /).
4. Chỉ xuất ra HEADER + DỮ LIỆU text thô (bắt đầu từ STT=1), không code block markdown, không giải thích thêm. Mọi trường trống phải có | ở cuối dòng.

HEADER (Copy chính xác dòng này làm dòng đầu tiên):
${header_str}

QUY TẮC ĐIỀN DỮ LIỆU:
1. **MỘT LỰA CHỌN**: \`Đáp án đúng\` ghi số (VD: \`2\`). Loại câu hỏi: "Một lựa chọn".
 - Cột 10 đến cột 19: ĐỂ TRỐNG HOÀN TOÀN (không ghi gì, kể cả dấu cách)
2. **ĐÚNG/SAI**: \`Đáp án 1\`: "Đúng" | \`Đáp án 2\`: "Sai" | \`Đáp án đúng\`: \`1\` hoặc \`2\`.
3. **ĐIỀN KHUYẾT**:
   - Nội dung: Dùng \`{{a}}\`, \`{{b}}\` (dấu ngoặc kép) để đánh dấu chỗ trống
   - Mỗi chỗ trống cung cấp 4 phương án để lựa chọn
   - Cột 10 (Đáp án 1): Các phương án cho \`{{a}}\`, phân cách bằng dấu / (VD: lực/Lực/trọng lượng/khối lượng)
   - Cột 11 (Đáp án 2): Các phương án cho \`{{b}}\`, phân cách bằng dấu / (VD: diện tích/Diện tích/thể tích/chiều dài)
   - Cột 12 (Đáp án 3): ĐỂ TRỐNG
   - Cột 13 (Đáp án 4): ĐỂ TRỐNG
   - Cột 10 đến cột 19: ĐỂ TRỐNG HOÀN TOÀN (không ghi gì, kể cả dấu cách)
   - Cột 9 (Đáp án đúng): Ghi \`1,2\` (dùng dấu phẩy bình thường)
   - Ví dụ mẫu:
     STT|Loại câu hỏi|...|Nội dung câu hỏi|Đáp án đúng|Đáp án 1|Đáp án 2|Đáp án 3|Đáp án 4|...|
     1|Điền khuyết|...|Áp suất là độ lớn của {{a}} trên một đơn vị {{b}}|1,2|áp lực/lực/trọng lực/khối lượng|diện tích/Diện tích/bề mặt/thể tích||||...|
4. **KÉO THẢ**:
   - Nội dung: Dùng \`{{a}}\`, \`{{b}}\` (dấu ngoặc kép) để đánh dấu chỗ trống
   - Cung cấp 4 phương án kéo thả cho mỗi chỗ trống
   - Cột 10 (Đáp án 1): 4 phương án cho \`{{a}}\`, phân cách bằng dấu / (VD: F/P/A/m)
   - Cột 11 (Đáp án 2): 4 phương án cho \`{{b}}\`, phân cách bằng dấu / (VD: S/V/h/t)
   - Cột 12 (Đáp án 3): ĐỂ TRỐNG
   - Cột 13 (Đáp án 4): ĐỂ TRỐNG
   - Cột 9 (Đáp án đúng): Ghi \`1,2\` (dùng dấu phẩy bình thường)
   - Cột 10 đến cột 19: ĐỂ TRỐNG HOÀN TOÀN (không ghi gì, kể cả dấu cách)
   - Cột 22 (Nhóm đáp án): Ghi "Có" (phân nhóm đáp án)
   - Ví dụ mẫu:
     STT|Loại câu hỏi|...|Nội dung câu hỏi|Đáp án đúng|Đáp án 1|Đáp án 2|Đáp án 3|Đáp án 4|...|Nhóm đáp án|
     2|Kéo thả|...|Công thức tính áp suất: p = {{a}} / {{b}}|1,2|F/P/A/m|S/V/h/t||||...|Có|
5. **Câu chùm**: phải tuân thủ đúng các quy tắc sau (không sai dù chỉ 1 ký tự):
   Cấu trúc bắt buộc chỉ có 2 loại dòng
   Dòng 1: Câu dẫn (câu chùm chính)
   Dòng 2, 3, 4…: Các câu hỏi con (a, b, c…)
   Tổng số cột: luôn luôn đúng 22 cột (không được thiếu, không được thừa). Mỗi dòng phải kết thúc bằng đủ | cho 22 trường.
   Cách điền từng cột đối với câu chùm	
   Cột 1 - STT
   - Câu dẫn: ghi số bất kỳ (ví dụ 20, 35, 50…)
   - Câu con: ghi số tiếp theo (21, 22, 23…)
   Cột 2 - Loại câu hỏi
   - Câu dẫn: phải ghi chính xác → Câu hỏi chùm (câu dẫn)
   - Câu con: ghi loại thật của câu đó → Một lựa chọn / Đúng/Sai / Điền khuyết / Tự luận / Kéo thả
   Cột 3 - Độ khó
   - Câu dẫn: Dễ / Trung bình / Khó / Rất khó
   - Câu con: có thể giống hoặc khác câu dẫn
   Cột 4 - Mức độ nhận thức
   - Cả câu dẫn và câu con đều bắt buộc điền → ➊ Nhận biết / ➋ Thông hiểu / ➌ Vận dụng / ➍ Vận dụng cao
   Cột 5 - Đơn vị kiến thức
   - Thường ghi giống nhau giữa câu dẫn và các câu con (ví dụ: Tốc độ chuyển động)
   Cột 6 - Mức độ đánh giá
   - Cả câu dẫn và câu con đều bắt buộc điền (ví dụ: Hiểu / Vận dụng thấp / Vận dụng cao / Phân tích)
   Cột 7 - Là câu hỏi con của câu hỏi chùm?
   - Câu dẫn: Không
   - Câu con: Có (phải viết chữ "Có" có dấu tiếng Việt)
   Cột 8 - Nội dung câu hỏi
   - Câu dẫn: ghi toàn bộ tình huống chung
   - Câu con: ghi luôn phần hỏi, bắt đầu bằng a) … / b) … / c) …
   Cột 9 - Đáp án đúng
   - Câu dẫn: để TRỐNG hoàn toàn
   - Câu con: điền bình thường (ví dụ 1 hoặc 2 hoặc 1,3 nếu nhiều lựa chọn)
   Cột 10 đến cột 17 - Đáp án 1 → Đáp án 8
   - Câu dẫn: để TRỐNG hoàn toàn
   - Câu con: điền đáp án như câu hỏi bình thường
   Cột 18 - Tags (phân cách nhau bằng dấu ;)
   - ĐỂ TRỐNG HOÀN TOÀN (không ghi gì, kể cả dấu cách)
   Cột 19 - Giải thích
   - Câu dẫn: ĐỂ TRỐNG HOÀN TOÀN (không ghi gì, kể cả dấu cách)
   - Câu con: ĐỂ TRỐNG HOÀN TOÀN (không ghi gì, kể cả dấu cách)
   Cột 20 - Đảo đáp án
   - Cả câu dẫn và câu con: ghi 1 hoặc để trống đều được
   Cột 21 - Tính điểm mỗi đáp án đúng
   - Thường để trống, chỉ điền "Có" hoặc "Không" khi cần tính điểm riêng
   Cột 22 - Nhóm đáp án theo từng chỗ trống
   - Thường để trống, chỉ điền "Có" khi câu kéo thả có nhiều nhóm
   Tuyệt đối không được làm những việc sau
   Không tạo dòng riêng chỉ ghi "a) …"
   Không để trống cột "Là câu hỏi con…" ở câu con
   Không ghi "Chùm" hoặc "Câu chùm" ở cột Loại câu hỏi của câu con
   Không để thiếu dấu gạch đứng cuối dòng (phải đủ 21 dấu gạch đứng → 22 trường)
6. **TỰ LUẬN** (kể cả tự luận đơn và tự luận có nhiều phần a, b, c…):
   Cột 1  - STT                        → Ghi số thứ tự bình thường (ví dụ 25, 26, 27…)
   Cột 2  - Loại câu hỏi               → Phải ghi chính xác: Tự luận
   Cột 3  - Độ khó                     → Dễ / Trung bình / Khó / Rất khó
   Cột 4  - Mức độ nhận thức           → ➊ Nhận biết / ➋ Thông hiểu / ➌ Vận dụng / ➍ Vận dụng cao (bắt buộc điền)
   Cột 5  - Đơn vị kiến thức           → Ví dụ: Tốc độ chuyển động, Nhiệt học, Điện học…
   Cột 6  - Mức độ đánh giá            → Hiểu / Vận dụng thấp / Vận dụng cao / Phân tích / Đánh giá (bắt buộc điền)
   Cột 7  - Là câu hỏi con của câu hỏi chùm? → Không (nếu là tự luận độc lập) hoặc Có (nếu thuộc chùm)
   Cột 8  - Nội dung câu hỏi           → Ghi đầy đủ đề bài. Nếu có nhiều phần a, b, c thì dùng thẻ <br> để xuống dòng trong cùng 1 ô, ví dụ:
          Một người đi từ A đến B…
          <br>a) Tính thời gian đi hết quãng đường nếu tốc độ 60 km/h.
          <br>b) Nếu tăng tốc độ lên 80 km/h thì thời gian giảm bao nhiêu?
   Cột 9  - Đáp án đúng                → ĐỂ TRỐNG HOÀN TOÀN (không ghi gì, kể cả dấu cách)
   Cột 10 → Cột 17 - Đáp án 1 đến Đáp án 8 → ĐỂ TRỐNG HOÀN TOÀN (8 cột này không dùng cho tự luận)
   Cột 18 - Tags                       → ĐỂ TRỐNG HOÀN TOÀN (không ghi gì, kể cả dấu cách)
   Cột 19 - Giải thích                 → ĐỂ TRỐNG HOÀN TOÀN (không ghi gì, kể cả dấu cách)
   Cột 20 - Đảo đáp án                 → Để trống (tự luận không đảo)
   Cột 21 - Tính điểm mỗi đáp án đúng  → Để trống
   Cột 22 - Nhóm đáp án theo từng chỗ trống → Để trống
   Tuyệt đối không được làm:
   - Không tạo dòng riêng chỉ ghi "a) …", "b) …" 
   - Không ghi đáp án mẫu vào cột 9 hoặc cột 10-17
   - Không để thiếu dấu gạch đứng cuối dòng → phải đủ 21 dấu gạch đứng → 22 trường
   - Không ghi "Tự luân", "Tu luan", "Freeresponse"… → phải ghi đúng "Tự luận"
7. Đảm bảo mọi dòng có đúng 22 trường, STT tăng dần từ 1, độ khó đa dạng, nội dung phù hợp chủ đề. KẾT THÚC MỖI DÒNG BẰNG | ĐỦ SỐ LƯỢNG.
        `;

        // Gọi AI
        const result = await model.generateContent(prompt_cua_ban);
        const response = await result.response;
        const rawText = response.text();

        // Trả về dữ liệu thô để Client xử lý Excel (nhằm giảm tải cho Worker)
        return new Response(JSON.stringify({ rawData: rawText }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}