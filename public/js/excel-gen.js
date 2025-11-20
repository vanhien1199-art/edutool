// File: public/js/excel-gen.js
// Phiên bản: STABLE (Khôi phục trạng thái ổn định - Đã fix lỗi AI nói nhiều & xuống dòng <br>)

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- JS LOADED: STABLE VERSION RESTORED " + new Date().toISOString() + " ---");
    
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

    // Helper: Ẩn hiện UI
    const setDisplay = (el, style) => { if (el) el.style.display = style; };
    const setText = (el, text) => { if (el) el.textContent = text; };

    // 1. Reset giao diện
    setDisplay(loading, 'block');
    setDisplay(success, 'none');
    setDisplay(error, 'none');
    setText(error, '');
    if (btn) btn.disabled = true;

    // 2. Thu thập dữ liệu
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

        if (!payload.mon_hoc || !payload.bai_hoc) {
            throw new Error("Vui lòng nhập đầy đủ 'Môn học' và 'Chủ đề bài học'!");
        }

    } catch (e) {
        showError("Lỗi nhập liệu: " + e.message);
        setDisplay(loading, 'none');
        if (btn) btn.disabled = false;
        return;
    }

    // 3. Gọi Server (Bắt lỗi chi tiết)
    try {
        console.log("--- ĐANG GỌI API ---");
        
        // Chống Cache bằng timestamp
        const timestamp = new Date().getTime();
        const apiUrl = `/api_v2?t=${timestamp}`; 

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Đọc text thô trước để debug
        const rawText = await response.text();
        console.log("DEBUG SERVER RESPONSE:", rawText);

        if (!response.ok) {
            let statusInfo = "";
            if (response.status === 404) statusInfo = " (Sai đường dẫn API)";
            if (response.status === 405) statusInfo = " (Sai phương thức - Method Not Allowed)";
            if (response.status === 500) statusInfo = " (Lỗi nội bộ Server)";
            throw new Error(`Server báo lỗi ${response.status}${statusInfo}: ${rawText.substring(0, 200)}...`);
        }

        // Parse JSON
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            throw new Error("Dữ liệu trả về không phải JSON hợp lệ. Có thể AI bị lỗi hoặc trả về HTML.");
        }

        // Lấy nội dung
        const content = data.result || data.answer || data.rawData;
        if (!content) {
            throw new Error("Thiếu trường dữ liệu kết quả (result/answer).");
        }

        // 4. Tạo Excel
        createAndDownloadExcel(content, payload);
        
        setDisplay(success, 'block');

    } catch (err) {
        console.error("Lỗi xử lý:", err);
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

function createAndDownloadExcel(rawText, payload) {
    if (typeof XLSX === 'undefined') {
        throw new Error("Thư viện SheetJS chưa tải được. Kiểm tra mạng.");
    }

    // Làm sạch markdown
    const cleanText = rawText.replace(/```csv/g, "").replace(/```/g, "").trim();
    const lines = cleanText.split('\n');
    
    const finalData = [];
    const TOTAL_COLS = 22;

    // Header chuẩn
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

    // Xử lý từng dòng
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        // 1. Lọc rác AI (Quan trọng): Dòng nào không có dấu | thì bỏ qua
        if (!line.includes('|')) continue;

        // 2. Bỏ qua Header lặp lại
        if (line.includes("Loại câu hỏi") && line.includes("Độ khó")) continue; 

        let parts = line.split('|');

        // 3. Đảm bảo đủ 22 cột
        if (parts.length > TOTAL_COLS) {
            parts = parts.slice(0, TOTAL_COLS);
        } else {
            while (parts.length < TOTAL_COLS) parts.push("");
        }

        // 4. Xử lý ký tự đặc biệt
        parts = parts.map(cell => {
            if (typeof cell === 'string') {
                // Thay thế <br> thành xuống dòng (\n)
                return cell.replace(/<br\s*\/?>/gi, '\n');
            }
            return cell;
        });

        // 5. Kiểm tra STT phải là số mới lấy
        if (!isNaN(parseInt(parts[0]))) {
            finalData.push(parts);
        }
    }

    // Xuất file
    const ws = XLSX.utils.aoa_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const safeMon = payload.mon_hoc.replace(/[^a-z0-9]/gi, '_');
    const fileName = `NHCH_${safeMon}_${new Date().getTime()}.xlsx`;

    XLSX.writeFile(wb, fileName);
}

