// File: public/js/excel-gen.js
// Phiên bản: DEBUG_CARET (Kiểm tra thay thế dấu mũ ^)

document.addEventListener('DOMContentLoaded', () => {
    // HÃY KIỂM TRA DÒNG NÀY TRONG CONSOLE
    console.log("--- JS LOADED: VERSION DEBUG_CARET " + new Date().toISOString() + " ---");
    
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

    const setDisplay = (el, style) => { if (el) el.style.display = style; };
    const setText = (el, text) => { if (el) el.textContent = text; };

    setDisplay(loading, 'block');
    setDisplay(success, 'none');
    setDisplay(error, 'none');
    setText(error, '');
    if (btn) btn.disabled = true;

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
            throw new Error("Vui lòng nhập đầy đủ thông tin!");
        }

        // GỌI API
        const timestamp = new Date().getTime();
        const apiUrl = `/api_v2?t=${timestamp}`; 

        console.log("Đang gọi API:", apiUrl);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        console.log("Server trả về (ký tự đầu):", rawText.substring(0, 100));

        if (!response.ok) throw new Error(`Lỗi Server ${response.status}: ${rawText}`);

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            throw new Error("Server không trả về JSON.");
        }

        const content = data.result || data.answer || data.rawData;
        if (!content) throw new Error("Thiếu dữ liệu kết quả.");

        // TẠO EXCEL
        createAndDownloadExcel(content, payload);
        setDisplay(success, 'block');

    } catch (err) {
        console.error(err);
        showError(err.message);
    } finally {
        setDisplay(loading, 'none');
        if (btn) btn.disabled = false;
    }
}

// --- HÀM XỬ LÝ EXCEL QUAN TRỌNG ---
function createAndDownloadExcel(rawText, payload) {
    if (typeof XLSX === 'undefined') throw new Error("Lỗi thư viện SheetJS.");

    const cleanText = rawText.replace(/```csv/g, "").replace(/```/g, "").trim();
    const lines = cleanText.split('\n');
    const finalData = [];
    const TOTAL_COLS = 22;

    // Header
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

    let caretCount = 0; // Đếm số lần thay thế

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || !line.includes('|')) continue;
        if (line.includes("Loại câu hỏi") && line.includes("Độ khó")) continue; 

        let parts = line.split('|');

        if (parts.length > TOTAL_COLS) {
            parts = parts.slice(0, TOTAL_COLS);
        } else {
            while (parts.length < TOTAL_COLS) parts.push("");
        }

        // --- XỬ LÝ THAY THẾ ---
        parts = parts.map(cell => {
            if (typeof cell === 'string') {
                let processed = cell;

                // 1. Thay <br>
                processed = processed.replace(/<br\s*\/?>/gi, '\n');
                
                // 2. Thay </>
                processed = processed.replace(/<\/>/g, '|');

                // 3. Thay ^ thành |
                if (processed.includes('^')) {
                    console.log("⚠️ TÌM THẤY DẤU ^ TẠI Ô:", processed);
                    // Thay thế tất cả dấu ^
                    processed = processed.replace(/\^/g, '|');
                    console.log("👉 ĐÃ ĐỔI THÀNH:", processed);
                    caretCount++;
                }

                return processed;
            }
            return cell;
        });

        if (!isNaN(parseInt(parts[0]))) {
            finalData.push(parts);
        }
    }

    console.log(`--- TỔNG KẾT: Đã thay thế ${caretCount} dấu mũ (^) ---`);

    const ws = XLSX.utils.aoa_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const safeMon = payload.mon_hoc.replace(/[^a-z0-9]/gi, '_');
    XLSX.writeFile(wb, `NHCH_${safeMon}_${new Date().getTime()}.xlsx`);
}

function getValue(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function getNum(id) { const el = document.getElementById(id); return el ? (parseInt(el.value) || 0) : 0; }
function showError(msg) { 
    const el = document.getElementById('errorMsg'); 
    if(el) { el.textContent = "⚠️ " + msg; el.style.display = 'block'; } else alert(msg); 
}

