// File: public/js/excel-gen.js
// Phiên bản: API_V2 + FIX LAYOUT (Thêm dòng trống thứ 3)

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- EXCEL GEN LOADED: LAYOUT FIX ---");
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

    // Helper UI
    const setDisplay = (el, style) => { if (el) el.style.display = style; };
    const setText = (el, text) => { if (el) el.textContent = text; };

    // Reset UI
    setDisplay(loading, 'block');
    setDisplay(success, 'none');
    setDisplay(error, 'none');
    setText(error, '');
    if (btn) btn.disabled = true;

    try {
        // Thu thập dữ liệu
        const payload = {
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

        if (!payload.mon_hoc || !payload.bai_hoc) {
            throw new Error("Vui lòng nhập Môn học và Chủ đề bài học!");
        }

        // Gọi API V2
        const timestamp = new Date().getTime();
        const apiUrl = `/api_v2?t=${timestamp}`; 

        console.log("Calling:", apiUrl);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        
        if (!response.ok) throw new Error(`Lỗi Server ${response.status}: ${rawText}`);

        let data;
        try { data = JSON.parse(rawText); } catch (e) { throw new Error("Lỗi JSON: " + rawText); }
        
        const content = data.result || data.answer;
        if (!content) throw new Error("Không có dữ liệu trả về.");

        // Tạo Excel
        createAndDownloadExcel(content, payload);
        setDisplay(success, 'block');

    } catch (err) {
        console.error(err);
        if(error) { error.textContent = "⚠️ " + err.message; error.style.display = 'block'; }
    } finally {
        setDisplay(loading, 'none');
        if (btn) btn.disabled = false;
    }
}

function createAndDownloadExcel(rawText, payload) {
    if (typeof XLSX === 'undefined') { alert("Lỗi thư viện SheetJS"); return; }

    // Làm sạch dữ liệu
    const cleanText = rawText.replace(/```csv/g, "").replace(/```/g, "").trim();
    const lines = cleanText.split('\n');
    
    const finalData = [];
    const TOTAL_COLS = 22;

    // --- CẤU TRÚC HEADER MỚI (4 DÒNG) ---
    
    // Dòng 1: IMPORT CÂU HỎI
    let row1 = new Array(TOTAL_COLS).fill(""); 
    row1[7] = "IMPORT CÂU HỎI";
    
    // Dòng 2: Chú ý
    let row2 = new Array(TOTAL_COLS).fill(""); 
    row2[7] = "(Chú ý: các cột bôi đỏ là bắt buộc)";
    
    // Dòng 3: DÒNG TRỐNG (MỚI THÊM)
    let row3 = new Array(TOTAL_COLS).fill(""); 

    // Dòng 4: Header các cột
    const headers = [
        'STT', 'Loại câu hỏi', 'Độ khó', 'Mức độ nhận thức', 'Đơn vị kiến thức', 'Mức độ đánh giá',
        'Là câu hỏi con của câu hỏi chùm?', 'Nội dung câu hỏi', 'Đáp án đúng',
        'Đáp án 1', 'Đáp án 2', 'Đáp án 3', 'Đáp án 4', 'Đáp án 5', 'Đáp án 6', 'Đáp án 7', 'Đáp án 8',
        'Tags (phân cách nhau bằng dấu ;)', 'Giải thích', 'Đảo đáp án',
        'Tính điểm mỗi đáp án đúng', 'Nhóm đáp án theo từng chỗ trống'
    ];
    
    // Đẩy lần lượt 4 dòng vào mảng dữ liệu
    finalData.push(row1, row2, row3, headers);

    // --- XỬ LÝ DỮ LIỆU CÁC CÂU HỎI ---
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || !line.includes('|')) continue;
        if (line.includes("Loại câu hỏi") && line.includes("Độ khó")) continue; 

        let parts = line.split('|');
        
        // Đảm bảo đủ cột
        if (parts.length > TOTAL_COLS) parts = parts.slice(0, TOTAL_COLS);
        while (parts.length < TOTAL_COLS) parts.push("");

        // Xử lý ký tự đặc biệt
        parts = parts.map(cell => {
            if (typeof cell === 'string') {
                let p = cell;
                p = p.replace(/<br\s*\/?>/gi, '\n'); // Thay br
                p = p.replace(/\^/g, '|');          // Thay dấu mũ ^ thành |
                return p;
            }
            return cell;
        });

        // Kiểm tra STT
        if (!isNaN(parseInt(parts[0]))) {
            finalData.push(parts);
        }
    }

    // Xuất file
    const ws = XLSX.utils.aoa_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    
    const safeMon = payload.mon_hoc.replace(/[^a-z0-9]/gi, '_');
    XLSX.writeFile(wb, `NHCH_${safeMon}_${new Date().getTime()}.xlsx`);
}
