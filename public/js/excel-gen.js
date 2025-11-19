// File: public/js/excel-gen.js
// Phiên bản: Final Debug - Bắt lỗi chi tiết

document.addEventListener('DOMContentLoaded', () => {
    // In log để xác nhận trình duyệt đã tải file mới
    console.log("--- JS FILE LOADED: VERSION " + new Date().toISOString() + " ---");
    
    const btnGenerate = document.getElementById('btnGenerate');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', handleGenerate);
    } else {
        console.error("Lỗi: Không tìm thấy nút có ID 'btnGenerate' trong HTML.");
    }
});

async function handleGenerate() {
    const btn = document.getElementById('btnGenerate');
    const loading = document.getElementById('loadingMsg'); // Đảm bảo ID này khớp với HTML (status-msg hoặc loadingMsg)
    const success = document.getElementById('successMsg');
    const error = document.getElementById('errorMsg');

    // Hàm hiển thị trạng thái UI an toàn (kiểm tra element tồn tại trước khi gọi)
    const setDisplay = (el, style) => { if (el) el.style.display = style; };
    const setText = (el, text) => { if (el) el.textContent = text; };

    // 1. Reset giao diện
    setDisplay(loading, 'block');
    setDisplay(success, 'none');
    setDisplay(error, 'none');
    setText(error, '');
    if (btn) btn.disabled = true;

    // 2. Thu thập dữ liệu từ Form
    try {
        var payload = {
            mon_hoc: getValue('mon_hoc'),
            lop: getValue('lop'),
            bo_sach: getValue('bo_sach'),
            bai_hoc: getValue('bai_hoc'),
            c1: getNum('c1'),
            c2: getNum('c2'),
            c3: getNum('c3'),
            c4: getNum('c4'),
            c5: getNum('c5'),
            c6: getNum('c6'),
        };

        // Validate cơ bản
        if (!payload.mon_hoc || !payload.bai_hoc) {
            throw new Error("Vui lòng nhập đầy đủ 'Môn học' và 'Chủ đề bài học'!");
        }

    } catch (e) {
        showError("Lỗi nhập liệu: " + e.message);
        setDisplay(loading, 'none');
        if (btn) btn.disabled = false;
        return;
    }

    // 3. Gọi Backend (BẮT LỖI CHI TIẾT)
  try {
        console.log("--- ĐANG GỌI API ---");
        
        // TẠO URL CHỐNG CACHE (Thêm ?t= thời gian hiện tại)
        const timestamp = new Date().getTime();
        
        // QUAN TRỌNG: KHÔNG CÓ CHỮ 'functions' Ở ĐÂY
        const apiUrl = `/api_v2?t=${timestamp}`; 

        console.log("URL GỌI LÀ:", apiUrl); // Xem dòng này trong Console F12

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        // Đọc phản hồi thô (Raw Text) để debug
        const rawText = await response.text();
        console.log("DEBUG SERVER RESPONSE:", rawText);

        // Kiểm tra HTTP Status Code
        if (!response.ok) {
            let statusInfo = "";
            if (response.status === 404) statusInfo = " (Sai đường dẫn API)";
            if (response.status === 405) statusInfo = " (Sai phương thức - Method Not Allowed)";
            if (response.status === 500) statusInfo = " (Lỗi nội bộ Server - API Key?)";
            
            throw new Error(`Server báo lỗi ${response.status}${statusInfo}: ${rawText.substring(0, 200)}...`);
        }

        // Thử Parse JSON
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            throw new Error("Server trả về dữ liệu không phải JSON (Có thể là HTML lỗi). Nội dung: " + rawText.substring(0, 100));
        }

        // Kiểm tra nội dung dữ liệu
        const content = data.result || data.answer || data.rawData;
        if (!content) {
            throw new Error("Kết quả JSON thiếu trường dữ liệu (result/answer). Full JSON: " + JSON.stringify(data));
        }

        // 4. Xử lý tạo Excel
        createAndDownloadExcel(content, payload);
        
        // Thành công
        setDisplay(success, 'block');

    } catch (err) {
        console.error("Lỗi trong quá trình xử lý:", err);
        showError(err.message);
    } finally {
        setDisplay(loading, 'none');
        if (btn) btn.disabled = false;
    }
}

// --- Các hàm hỗ trợ ---

function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function getNum(id) {
    const el = document.getElementById(id);
    return el ? (parseInt(el.value) || 0) : 0;
}

function showError(msg) {
    const error = document.getElementById('errorMsg');
    if (error) {
        error.textContent = "⚠️ Lỗi: " + msg;
        error.style.display = 'block';
    } else {
        alert("⚠️ Lỗi: " + msg);
    }
}

// File: public/js/excel-gen.js

// ... (Các phần trên giữ nguyên) ...

function createAndDownloadExcel(rawText, payload) {
    if (typeof XLSX === 'undefined') {
        throw new Error("Thư viện SheetJS chưa được tải. Hãy kiểm tra kết nối mạng.");
    }

    // 1. Làm sạch dữ liệu markdown
    // Xóa ```csv, ```, và các dòng trống đầu đuôi
    const cleanText = rawText.replace(/```csv/g, "").replace(/```/g, "").trim();
    const lines = cleanText.split('\n');
    
    const finalData = [];
    const TOTAL_COLS = 22;

    // 2. Tạo Header chuẩn (Giữ nguyên cấu trúc App.py)
    let row1 = new Array(TOTAL_COLS).fill(""); row1[7] = "IMPORT CÂU HỎI";
    let row2 = new Array(TOTAL_COLS).fill(""); row2[7] = "(Chú ý: các cột bôi đỏ là bắt buộc)";
    const headers = [
        'STT', 'Loại câu hỏi', 'Độ khó', 'Mức độ nhận thức', 'Đơn vị kiến thức', 'Mức độ đánh giá',
        'Là câu hỏi con của câu hỏi chùm?', 'Nội dung câu hỏi', 'Đáp án đúng',
        'Đáp án 1', 'Đáp án 2', 'Đáp án 3', 'Đáp án 4', 'Đáp án 5', 'Đáp án 6', 'Đáp án 7', 'Đáp án 8',
        'Tags (phân cách nhau bằng dấu ;)', 'Giải thích', 'Đảo đáp án',
        'Tính điểm mỗi đáp án đúng', 'Nhóm đáp án theo từng chỗ trống'
    ];
    
    finalData.push(row1, row2, headers);

    // 3. Xử lý dữ liệu (BỘ LỌC MỚI MẠNH MẼ HƠN)
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // Bỏ qua dòng rỗng
        if (!line) continue;

        // --- FIX LỖI CỦA BẠN TẠI ĐÂY ---
        // Nếu dòng này KHÔNG chứa dấu gạch đứng |, nghĩa là nó là văn bản rác (giải thích của AI)
        // -> Bỏ qua ngay lập tức!
        if (!line.includes('|')) continue;

        // Bỏ qua dòng Header do AI tự sinh ra (nếu có)
        if (line.includes("Loại câu hỏi") && line.includes("Độ khó")) continue; 

        let parts = line.split('|');

        // Đảm bảo đủ 22 cột (Cắt thừa, bù thiếu)
        if (parts.length > TOTAL_COLS) {
            parts = parts.slice(0, TOTAL_COLS);
        } else {
            while (parts.length < TOTAL_COLS) parts.push("");
        }

        // Kiểm tra cột STT (index 0) phải là số
        // Ví dụ: "1" -> OK. "Phạm vi" -> Loại.
        const stt = parseInt(parts[0]);
        if (!isNaN(stt)) {
            // Ép kiểu cột 1 về số nguyên để Excel hiển thị đẹp hơn
            parts[0] = stt; 
            finalData.push(parts);
        }
    }

    // 4. Xuất File Excel
    const ws = XLSX.utils.aoa_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const safeMon = payload.mon_hoc.replace(/[^a-z0-9]/gi, '_');
    const fileName = `NHCH_${safeMon}_${new Date().getTime()}.xlsx`;

    XLSX.writeFile(wb, fileName);
}


