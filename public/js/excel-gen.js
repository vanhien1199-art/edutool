// File: public/js/excel-gen.js

document.addEventListener('DOMContentLoaded', () => {
    const btnGenerate = document.getElementById('btnGenerate');
    
    if (btnGenerate) {
        btnGenerate.addEventListener('click', handleGenerate);
    }
});

async function handleGenerate() {
    const btn = document.getElementById('btnGenerate');
    const loading = document.getElementById('loadingMsg');
    const success = document.getElementById('successMsg');
    const error = document.getElementById('errorMsg');

    // 1. Reset giao diện
    loading.style.display = 'block';
    success.style.display = 'none';
    error.style.display = 'none';
    error.textContent = '';
    btn.disabled = true;

    // 2. Thu thập dữ liệu từ Form
    const payload = {
        mon_hoc: document.getElementById('mon_hoc').value.trim(),
        lop: document.getElementById('lop').value.trim(),
        bo_sach: document.getElementById('bo_sach').value,
        bai_hoc: document.getElementById('bai_hoc').value.trim(),
        c1: parseInt(document.getElementById('c1').value) || 0,
        c2: parseInt(document.getElementById('c2').value) || 0,
        c3: parseInt(document.getElementById('c3').value) || 0,
        c4: parseInt(document.getElementById('c4').value) || 0,
        c5: parseInt(document.getElementById('c5').value) || 0,
        c6: parseInt(document.getElementById('c6').value) || 0,
    };

    // Validate cơ bản
    if (!payload.mon_hoc || !payload.bai_hoc) {
        showError("Vui lòng nhập đầy đủ Môn học và Chủ đề bài học!");
        loading.style.display = 'none';
        btn.disabled = false;
        return;
    }

    try {
        // 3. Gọi Backend Cloudflare Function
        // Lưu ý: Đường dẫn này phải khớp với file trong thư mục functions/
        const response = await fetch('/generateQuiz', { // Hoặc '/generateQuiz' tùy tên file bạn đặt
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
const rawResponse = await response.text();
        console.log("Server raw response:", rawResponse); // Xem log này trong F12

        if (!response.ok) {
            // Nếu lỗi server (500, 404...), in ra nội dung lỗi
            throw new Error(`Server Error (${response.status}): ${rawResponse}`);
        }

        if (!rawResponse) {
            throw new Error("Server trả về rỗng (Có thể do Timeout hoặc lỗi API Key).");
        }

        let data;
        try {
            data = JSON.parse(rawResponse);
        } catch (e) {
            throw new Error("Server không trả về JSON hợp lệ: " + rawResponse);
        }

        if (!data.result && !data.answer) {
             throw new Error('AI không trả về dữ liệu.');
        }

        // Lấy text kết quả (hỗ trợ cả 2 biến result hoặc answer đề phòng bạn đổi tên)
        const rawText = data.result || data.answer;

        // 4. Xử lý tạo Excel (Client-Side)
        createAndDownloadExcel(rawText, payload);

        success.style.display = 'block';

    } catch (err) {
        console.error("Lỗi:", err);
        showError(`Có lỗi xảy ra: ${err.message}`);
    } finally {
        loading.style.display = 'none';
        btn.disabled = false;
    }
}

function showError(msg) {
    const error = document.getElementById('errorMsg');
    error.textContent = msg;
    error.style.display = 'block';
}

function createAndDownloadExcel(rawText, payload) {
    // Làm sạch dữ liệu markdown
    const cleanText = rawText.replace(/```csv/g, "").replace(/```/g, "").trim();
    const lines = cleanText.split('\n');
    
    const finalData = [];
    const TOTAL_COLS = 22;

    // --- TẠO HEADER ĐẶC BIỆT (Mô phỏng chính xác app.py) ---
    
    // Dòng 1: Cột H (index 7) là "IMPORT CÂU HỎI"
    let row1 = new Array(TOTAL_COLS).fill("");
    row1[7] = "IMPORT CÂU HỎI";
    finalData.push(row1);

    // Dòng 2: Cột H là cảnh báo
    let row2 = new Array(TOTAL_COLS).fill("");
    row2[7] = "(Chú ý: các cột bôi đỏ là bắt buộc)";
    finalData.push(row2);

    // Dòng 3: Header Chuẩn
    const headers = [
        'STT', 'Loại câu hỏi', 'Độ khó', 'Mức độ nhận thức', 'Đơn vị kiến thức', 'Mức độ đánh giá',
        'Là câu hỏi con của câu hỏi chùm?', 'Nội dung câu hỏi', 'Đáp án đúng',
        'Đáp án 1', 'Đáp án 2', 'Đáp án 3', 'Đáp án 4', 'Đáp án 5', 'Đáp án 6', 'Đáp án 7', 'Đáp án 8',
        'Tags (phân cách nhau bằng dấu ;)', 'Giải thích', 'Đảo đáp án',
        'Tính điểm mỗi đáp án đúng', 'Nhóm đáp án theo từng chỗ trống'
    ];
    finalData.push(headers);

    // --- XỬ LÝ DỮ LIỆU ---
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        // Bỏ qua dòng header do AI tự sinh ra (nếu có)
        if (line.includes("Loại câu hỏi") && line.includes("Độ khó")) continue;

        let parts = line.split('|');

        // Đảm bảo tính toàn vẹn số lượng cột
        if (parts.length > TOTAL_COLS) {
            parts = parts.slice(0, TOTAL_COLS); // Cắt bớt
        } else {
            while (parts.length < TOTAL_COLS) {
                parts.push(""); // Bù thêm
            }
        }

        // Kiểm tra cột STT (index 0) phải là số mới lấy
        // Logic: Nếu parse ra NaN thì bỏ qua dòng rác
        if (!isNaN(parseInt(parts[0]))) {
            finalData.push(parts);
        }
    }

    // --- XUẤT FILE BẰNG SHEETJS ---
    // Kiểm tra thư viện
    if (typeof XLSX === 'undefined') {
        showError("Lỗi: Thư viện SheetJS chưa được tải. Vui lòng kiểm tra kết nối mạng.");
        return;
    }

    const ws = XLSX.utils.aoa_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    // Đặt tên file: Mon_Lop_ThoiGian.xlsx
    const timestamp = new Date().toISOString().slice(0,10);
    const safeMonHoc = payload.mon_hoc.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `NHCH_${safeMonHoc}_lop${payload.lop}_${timestamp}.xlsx`;

    XLSX.writeFile(wb, fileName);

}


