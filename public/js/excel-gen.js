// File: public/js/excel-gen.js
// Phiên bản: COMMERCIAL + PREVIEW + LIMITS (Đã thêm kiểm tra giới hạn)

// Biến toàn cục để lưu dữ liệu sau khi AI trả về
let GLOBAL_EXCEL_DATA = [];
let GLOBAL_FILENAME = "";

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- CLIENT LOADED: PREVIEW VERSION WITH LIMITS ---");
    
    const btnGenerate = document.getElementById('btnGenerate');
    if (btnGenerate) btnGenerate.addEventListener('click', handleGenerate);

    const btnDownload = document.getElementById('btnDownload');
    if (btnDownload) btnDownload.addEventListener('click', handleDownload);
});

// 1. HÀM XỬ LÝ CHÍNH: KIỂM TRA GIỚI HẠN -> GỌI AI -> HIỆN PREVIEW
async function handleGenerate() {
    const btn = document.getElementById('btnGenerate');
    const loading = document.getElementById('loadingMsg');
    const error = document.getElementById('errorMsg');
    const previewSection = document.getElementById('previewSection');

    // Reset UI
    if(loading) loading.style.display = 'block';
    if(error) error.style.display = 'none';
    if(previewSection) previewSection.style.display = 'none'; // Ẩn preview cũ
    if(btn) btn.disabled = true;

    try {
        // 1a. Lấy License
        const licenseKey = document.getElementById('license_key').value.trim();
        if (!licenseKey) throw new Error("Vui lòng nhập MÃ KÍCH HOẠT để sử dụng!");

        // 1b. Thu thập dữ liệu form
        const payload = {
            license_key: licenseKey,
            mon_hoc: document.getElementById('mon_hoc').value.trim(),
            lop: document.getElementById('lop').value.trim(),
            bo_sach: document.getElementById('bo_sach').value,
            bai_hoc: document.getElementById('bai_hoc').value.trim(),
            c1: parseInt(document.getElementById('c1').value)||0,
            c2: parseInt(document.getElementById('c2').value)||0,
            c3: parseInt(document.getElementById('c3').value)||0,
            c4: parseInt(document.getElementById('c4').value)||0,
            c5: parseInt(document.getElementById('c5').value)||0,
            c6: parseInt(document.getElementById('c6').value)||0
        };

        // ------------------------------------------------------------------
        // 🛑 BẮT ĐẦU PHẦN KIỂM TRA GIỚI HẠN (VALIDATION) - MỚI THÊM
        // ------------------------------------------------------------------
        
        // Cấu hình giới hạn tối đa cho từng loại (Khớp với file HTML của bạn)
        const LIMITS = {
            c1: 20, // Trắc nghiệm 4 chọn 1
            c2: 10, // Đúng/Sai
            c3: 10, // Điền khuyết
            c4: 10, // Kéo thả
            c5: 5,  // Câu chùm
            c6: 10  // Tự luận
        };

        // Kiểm tra từng loại câu hỏi
        if (payload.c1 > LIMITS.c1) throw new Error(`Quá nhiều câu Trắc nghiệm! Tối đa cho phép là ${LIMITS.c1} câu.`);
        if (payload.c2 > LIMITS.c2) throw new Error(`Quá nhiều câu Đúng/Sai! Tối đa cho phép là ${LIMITS.c2} câu.`);
        if (payload.c3 > LIMITS.c3) throw new Error(`Quá nhiều câu Điền khuyết! Tối đa cho phép là ${LIMITS.c3} câu.`);
        if (payload.c4 > LIMITS.c4) throw new Error(`Quá nhiều câu Kéo thả! Tối đa cho phép là ${LIMITS.c4} câu.`);
        if (payload.c5 > LIMITS.c5) throw new Error(`Quá nhiều câu Chùm! Tối đa cho phép là ${LIMITS.c5} câu.`);
        if (payload.c6 > LIMITS.c6) throw new Error(`Quá nhiều câu Tự luận! Tối đa cho phép là ${LIMITS.c6} câu.`);

        // Kiểm tra tổng số lượng (Tránh gửi 0 câu hoặc quá nhiều gây timeout)
        const totalQuestions = payload.c1 + payload.c2 + payload.c3 + payload.c4 + payload.c5 + payload.c6;
        
        if (totalQuestions === 0) {
            throw new Error("Vui lòng nhập số lượng cho ít nhất 1 loại câu hỏi!");
        }
        
        // Giới hạn tổng an toàn (Ví dụ: 60 câu) để tránh Cloudflare Timeout
        if (totalQuestions > 65) {
            throw new Error(`Tổng số câu hỏi (${totalQuestions}) quá lớn. Vui lòng tạo ít hơn 65 câu mỗi lần để hệ thống xử lý tốt nhất.`);
        }

        if (!payload.mon_hoc || !payload.bai_hoc) throw new Error("Thiếu thông tin Môn học hoặc Chủ đề!");

        // ------------------------------------------------------------------
        // ✅ KẾT THÚC KIỂM TRA - NẾU OK MỚI CHẠY TIẾP
        // ------------------------------------------------------------------

        // 1c. Gọi API
        const timestamp = new Date().getTime();
        const apiUrl = `/api_v2?t=${timestamp}`; 

        console.log("Calling:", apiUrl);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        
        // Xử lý các lỗi từ Server trả về
        if (response.status === 403) throw new Error("⛔ MÃ KÍCH HOẠT SAI HOẶC KHÔNG TỒN TẠI!");
        if (response.status === 402) throw new Error("⛔ MÃ ĐÃ HẾT LƯỢT SỬ DỤNG. VUI LÒNG MUA THÊM!");
        if (!response.ok) throw new Error(`Lỗi Server ${response.status}: ${rawText}`);

        let data;
        try { data = JSON.parse(rawText); } catch (e) { throw new Error("Lỗi JSON: " + rawText); }
        
        const content = data.result || data.answer;
        if (!content) throw new Error("AI không trả về dữ liệu.");

        // 1d. Xử lý dữ liệu thành mảng Excel
        processDataForPreview(content, payload);

        // 1e. Hiển thị bảng xem trước
        renderPreviewTable();
        
        // Hiện khung preview
        if(previewSection) previewSection.style.display = 'block';
        
        // Cuộn xuống bảng
        previewSection.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        console.error(err);
        if(error) { 
            // Hiển thị lỗi rõ ràng cho người dùng
            error.innerHTML = `<strong>⚠️ ${err.message}</strong>`; 
            error.style.display = 'block'; 
        }
    } finally {
        if(loading) loading.style.display = 'none';
        if(btn) btn.disabled = false;
    }
}

// 2. HÀM XỬ LÝ DỮ LIỆU (LƯU VÀO BIẾN TOÀN CỤC)
function processDataForPreview(rawText, payload) {
    const cleanText = rawText.replace(/```csv/g, "").replace(/```/g, "").trim();
    const lines = cleanText.split('\n');
    
    const finalData = [];
    const TOTAL_COLS = 22;

    // Header chuẩn
    let row1 = new Array(TOTAL_COLS).fill(""); row1[7] = "IMPORT CÂU HỎI";
    let row2 = new Array(TOTAL_COLS).fill(""); row2[7] = "(Chú ý: các cột bôi đỏ là bắt buộc)";
    let row3 = new Array(TOTAL_COLS).fill(""); 
    const headers = [
        'STT', 'Loại câu hỏi', 'Độ khó', 'Mức độ nhận thức', 'Đơn vị kiến thức', 'Mức độ đánh giá',
        'Là câu hỏi con của câu hỏi chùm?', 'Nội dung câu hỏi', 'Đáp án đúng',
        'Đáp án 1', 'Đáp án 2', 'Đáp án 3', 'Đáp án 4', 'Đáp án 5', 'Đáp án 6', 'Đáp án 7', 'Đáp án 8',
        'Tags (phân cách nhau bằng dấu ;)', 'Giải thích', 'Đảo đáp án',
        'Tính điểm mỗi đáp án đúng', 'Nhóm đáp án theo từng chỗ trống'
    ];
    
    finalData.push(row1, row2, row3, headers);

    // Parse body
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || !line.includes('|')) continue;
        if (line.includes("Loại câu hỏi") && line.includes("Độ khó")) continue; 

        let parts = line.split('|');
        if (parts.length > TOTAL_COLS) parts = parts.slice(0, TOTAL_COLS);
        while (parts.length < TOTAL_COLS) parts.push("");

        parts = parts.map(cell => {
            if (typeof cell === 'string') {
                let p = cell;
                p = p.replace(/<br\s*\/?>/gi, '\n'); // Excel xuống dòng
                p = p.replace(/\^/g, '|');          // Thay dấu mũ thành gạch đứng
                return p;
            }
            return cell;
        });

        if (!isNaN(parseInt(parts[0]))) finalData.push(parts);
    }

    // LƯU VÀO BIẾN TOÀN CỤC
    GLOBAL_EXCEL_DATA = finalData;
    
    // TẠO TÊN FILE
    const safeMon = payload.mon_hoc.replace(/[^a-z0-9]/gi, '_');
    GLOBAL_FILENAME = `NHCH_${safeMon}_${new Date().getTime()}.xlsx`;
}

// 3. HÀM VẼ BẢNG HTML (PREVIEW)
function renderPreviewTable() {
    const table = document.getElementById('dataTable');
    table.innerHTML = ""; // Xóa cũ

    // Chỉ hiển thị tối đa 10 dòng dữ liệu đầu tiên để xem trước cho gọn
    const displayLimit = 20; 
    const dataToShow = GLOBAL_EXCEL_DATA.slice(3); // Bỏ 3 dòng header rỗng đầu tiên để hiển thị cho đẹp

    // Tạo Header bảng HTML
    if (dataToShow.length > 0) {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        dataToShow[0].forEach(cell => {
            const th = document.createElement('th');
            th.textContent = cell;
            tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
    }

    // Tạo Body bảng HTML
    const tbody = document.createElement('tbody');
    for (let i = 1; i < dataToShow.length; i++) {
        if (i > displayLimit) break; // Giới hạn hiển thị
        const tr = document.createElement('tr');
        dataToShow[i].forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell; // TextContent tự động chống XSS
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
}

// 4. HÀM TẢI XUỐNG (KHI BẤM NÚT DOWNLOAD)
function handleDownload() {
    if (!GLOBAL_EXCEL_DATA || GLOBAL_EXCEL_DATA.length === 0) {
        alert("Chưa có dữ liệu để tải!");
        return;
    }

    if (typeof XLSX === 'undefined') { alert("Lỗi thư viện SheetJS"); return; }

    const ws = XLSX.utils.aoa_to_sheet(GLOBAL_EXCEL_DATA);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    
    XLSX.writeFile(wb, GLOBAL_FILENAME);
}
