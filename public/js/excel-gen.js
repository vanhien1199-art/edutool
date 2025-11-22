// File: public/js/excel-gen.js
// Phiên bản: CLEAN & STABLE (Đã fix lỗi biến không xác định)

// --- BIẾN TOÀN CỤC ---
var GLOBAL_EXCEL_DATA = [];
var GLOBAL_FILENAME = "";

// --- KHỞI TẠO ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("--- SYSTEM READY: CLEAN VERSION ---");
    
    var btnGenerate = document.getElementById('btnGenerate');
    var btnDownload = document.getElementById('btnDownload');

    if (btnGenerate) btnGenerate.addEventListener('click', handleGenerate);
    if (btnDownload) btnDownload.addEventListener('click', handleDownload);
});

// --- 1. XỬ LÝ CHÍNH (GỌI API) ---
async function handleGenerate() {
    var btn = document.getElementById('btnGenerate');
    var loading = document.getElementById('loadingMsg');
    var error = document.getElementById('errorMsg');
    var previewSection = document.getElementById('previewSection');

    // Reset giao diện
    if(loading) loading.style.display = 'block';
    if(error) error.style.display = 'none';
    if(previewSection) previewSection.style.display = 'none';
    if(btn) btn.disabled = true;

    try {
        // 1. Lấy License Key
        var licenseKeyInput = document.getElementById('license_key');
        var licenseKey = licenseKeyInput ? licenseKeyInput.value.trim() : "";
        
        if (!licenseKey) throw new Error("Vui lòng nhập MÃ KÍCH HOẠT!");

        // 2. Lấy dữ liệu Form
        var payload = {
            license_key: licenseKey,
            mon_hoc: document.getElementById('mon_hoc').value.trim(),
            lop: document.getElementById('lop').value.trim(),
            bo_sach: document.getElementById('bo_sach').value,
            bai_hoc: document.getElementById('bai_hoc').value.trim(),
            c1: parseInt(document.getElementById('c1').value) || 0,
            c2: parseInt(document.getElementById('c2').value) || 0,
            c3: parseInt(document.getElementById('c3').value) || 0,
            c4: parseInt(document.getElementById('c4').value) || 0,
            c5: parseInt(document.getElementById('c5').value) || 0,
            c6: parseInt(document.getElementById('c6').value) || 0
        };

        // 3. Kiểm tra giới hạn (Validation)
        var LIMITS = { c1: 30, c2: 10, c3: 10, c4: 10, c5: 5, c6: 10 };
        if (payload.c1 > LIMITS.c1) throw new Error("Quá nhiều câu Trắc nghiệm! Tối đa: " + LIMITS.c1);
        if (payload.c2 > LIMITS.c2) throw new Error("Quá nhiều câu Đúng/Sai! Tối đa: " + LIMITS.c2);
        if (payload.c3 > LIMITS.c3) throw new Error("Quá nhiều câu Điền khuyết! Tối đa: " + LIMITS.c3);
        if (payload.c4 > LIMITS.c4) throw new Error("Quá nhiều câu Kéo thả! Tối đa: " + LIMITS.c4);
        if (payload.c5 > LIMITS.c5) throw new Error("Quá nhiều câu Chùm! Tối đa: " + LIMITS.c5);
        if (payload.c6 > LIMITS.c6) throw new Error("Quá nhiều câu Tự luận! Tối đa: " + LIMITS.c6);

        var total = payload.c1 + payload.c2 + payload.c3 + payload.c4 + payload.c5 + payload.c6;
        if (total === 0) throw new Error("Vui lòng nhập số lượng câu hỏi!");
        if (total > 70) throw new Error("Tổng số câu hỏi quá lớn (>70). Vui lòng chia nhỏ.");
        
        if (!payload.mon_hoc || !payload.bai_hoc) throw new Error("Thiếu thông tin Môn học hoặc Chủ đề!");

        // 4. Gọi API Backend
        var timestamp = new Date().getTime();
        var apiUrl = "/api_v2?t=" + timestamp; 

        console.log("Calling API:", apiUrl);
        var response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        var rawText = await response.text();
        
        // Xử lý các mã lỗi từ Server
        if (response.status === 403) throw new Error("⛔ MÃ KÍCH HOẠT KHÔNG ĐÚNG HOẶC HẾT HẠN!");
        if (response.status === 402) throw new Error("⛔ MÃ ĐÃ HẾT LƯỢT. VUI LÒNG MUA THÊM!");
        if (!response.ok) throw new Error("Lỗi Server " + response.status + ": " + rawText);

        // Parse JSON
        var data;
        try { 
            data = JSON.parse(rawText); 
        } catch (e) { 
            throw new Error("Lỗi dữ liệu JSON từ Server (Backend trả về sai định dạng)."); 
        }
        
        var content = data.result || data.answer;
        if (!content) throw new Error("AI không trả về nội dung câu hỏi.");

        // 5. Xử lý dữ liệu & Hiển thị
        processDataForPreview(content, payload);
        renderPreviewTable();
        
        if(previewSection) {
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });
        }

    } catch (err) {
        console.error(err);
        if(error) { 
            error.innerHTML = "<strong>⚠️ " + err.message + "</strong>"; 
            error.style.display = 'block'; 
        }
    } finally {
        if(loading) loading.style.display = 'none';
        if(btn) btn.disabled = false;
    }
}

// --- 2. HÀM LÀM SẠCH CÔNG THỨC TOÁN (PHIÊN BẢN CHUẨN) ---
function cleanMathFormulas(text) {
    if (!text) return "";
    var s = text;

    // Dọn dẹp thẻ bao
    s = s.replace(/\\\[(.*?)\\\]/g, '$1'); 
    s = s.replace(/\\\((.*?)\\\)/g, '$1'); 
    s = s.replace(/\$(.*?)\$/g, '$1');     

    // Xóa rác LaTeX
    s = s.split('\\displaystyle').join('');
    s = s.split('\\limits').join('');
    s = s.split('\\left').join('');
    s = s.split('\\right').join('');
    s = s.split('\\mathrm').join('');

    // Xử lý cấu trúc phức tạp trước
    // Căn bậc n
    s = s.replace(/\\sqrt\s*\[\s*(.+?)\s*\]\s*\{\s*(.+?)\s*\}/g, '($1)√($2)'); 
    // Căn bậc 2
    s = s.replace(/\\sqrt\s*\{\s*(.+?)\s*\}/g, '√($1)');
    s = s.replace(/\\sqrt\s+(.)/g, '√$1');

    // Phân số
    s = s.replace(/\\frac\s*\{\s*(.+?)\s*\}\s*\{\s*(.+?)\s*\}/g, '($1/$2)');
    s = s.replace(/\\frac\s+(\w)\s+(\w)/g, '($1/$2)');

    // Số mũ
    s = s.replace(/\^2/g, '²');
    s = s.replace(/\^3/g, '³');
    s = s.replace(/\^0/g, '⁰');
    s = s.replace(/\^\{(.+?)\}/g, '^($1)'); 

    // Chỉ số dưới
    s = s.replace(/_\{(.+?)\}/g, '$1'); 
    s = s.replace(/_(\w)/g, '$1');

    // Vector & Góc
    s = s.replace(/\\vec\s*\{\s*(.+?)\s*\}/g, '$1→');
    s = s.replace(/\\vec\s+(\w)/g, '$1→');
    s = s.replace(/\\hat\s*\{\s*(.+?)\s*\}/g, '∠$1');

    // Giá trị tuyệt đối & Hàm số
    s = s.replace(/\\mid/g, '|');
    s = s.replace(/\\log_?\{\s*(.+?)\s*\}\s*\{\s*(.+?)\s*\}/g, 'log$1($2)');
    s = s.replace(/\\ln\s*\{\s*(.+?)\s*\}/g, 'ln($1)');
    s = s.replace(/\\int_?\{\s*(.+?)\s*\}^?\{\s*(.+?)\s*\}/g, '∫($1->$2)');

    // BẢNG MAP KÝ TỰ UNICODE
    var replacements = {
        '\\\\approx': '≈', '\\\\le': '≤', '\\\\leq': '≤', '\\\\ge': '≥', '\\\\geq': '≥',
        '\\\\ne': '≠', '\\\\neq': '≠', '\\\\pm': '±', '\\\\times': '×', '\\\\div': '÷',
        '\\\\cdot': '·', '\\\\ast': '*', '\\\\circ': '°', '\\\\angle': '∠', '\\\\triangle': '∆',
        '\\\\in': '∈', '\\\\notin': '∉', '\\\\infty': '∞', '\\\\rightarrow': '→',
        '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ', '\\\\Delta': 'Δ', 
        '\\\\pi': 'π', '\\\\theta': 'θ', '\\\\lambda': 'λ', '\\\\omega': 'ω', '\\\\Omega': 'Ω',
        '\\\\sqrt': '√', '\\\\{': '{', '\\\\}': '}', '\\\\%': '%',
    };

    for (var key in replacements) {
        if (replacements.hasOwnProperty(key)) {
            s = s.split(key).join(replacements[key]);
        }
    }

    // Dọn dẹp cuối
    s = s.replace(/\\text\s*\{\s*(.+?)\s*\}/g, '$1');
    s = s.replace(/\\/g, ''); 
    s = s.replace(/\s+/g, ' ').trim();

    return s;
}

// --- 3. XỬ LÝ DỮ LIỆU CHO EXCEL ---
function processDataForPreview(rawText, payload) {
    // Làm sạch markdown
    var cleanText = rawText.replace(/```csv/g, "").replace(/```/g, "").trim();
    var lines = cleanText.split('\n');
    
    var finalData = [];
    var TOTAL_COLS = 22;

    // Header chuẩn 4 dòng
    var row1 = new Array(TOTAL_COLS).fill(""); row1[7] = "IMPORT CÂU HỎI";
    var row2 = new Array(TOTAL_COLS).fill(""); row2[7] = "(Chú ý: các cột bôi đỏ là bắt buộc)";
    var row3 = new Array(TOTAL_COLS).fill(""); 
    var headers = [
        'STT', 'Loại câu hỏi', 'Độ khó', 'Mức độ nhận thức', 'Đơn vị kiến thức', 'Mức độ đánh giá',
        'Là câu hỏi con của câu hỏi chùm?', 'Nội dung câu hỏi', 'Đáp án đúng',
        'Đáp án 1', 'Đáp án 2', 'Đáp án 3', 'Đáp án 4', 'Đáp án 5', 'Đáp án 6', 'Đáp án 7', 'Đáp án 8',
        'Tags (phân cách nhau bằng dấu ;)', 'Giải thích', 'Đảo đáp án',
        'Tính điểm mỗi đáp án đúng', 'Nhóm đáp án theo từng chỗ trống'
    ];
    finalData.push(row1, row2, row3, headers);

    // Parse từng dòng
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || !line.includes('|')) continue; // Lọc rác không có dấu |
        if (line.includes("Loại câu hỏi") && line.includes("Độ khó")) continue; 

        var parts = line.split('|');
        if (parts.length > TOTAL_COLS) parts = parts.slice(0, TOTAL_COLS);
        while (parts.length < TOTAL_COLS) parts.push("");

        // Xử lý từng ô dữ liệu
        for (var j = 0; j < parts.length; j++) {
            var cell = parts[j];
            if (typeof cell === 'string') {
                // 1. Xử lý xuống dòng
                cell = cell.replace(/<br\s*\/?>/gi, '\n');
                
                // 2. Xử lý Toán học TRƯỚC
                cell = cleanMathFormulas(cell);

                // 3. Xử lý dấu mũ phân cách SAU (Sau khi toán đã được dọn dẹp)
                cell = cell.replace(/\^/g, '|');
            }
            parts[j] = cell;
        }

        if (!isNaN(parseInt(parts[0]))) finalData.push(parts);
    }

    GLOBAL_EXCEL_DATA = finalData;
    var safeMon = payload.mon_hoc.replace(/[^a-z0-9]/gi, '_');
    GLOBAL_FILENAME = "NHCH_" + safeMon + "_" + new Date().getTime() + ".xlsx";
}

// --- 4. HIỂN THỊ BẢNG PREVIEW ---
function renderPreviewTable() {
    var table = document.getElementById('dataTable');
    if(!table) return;
    
    table.innerHTML = ""; 
    var displayLimit = 20; 
    var dataToShow = GLOBAL_EXCEL_DATA.slice(3); // Bỏ 3 dòng header

    if (dataToShow.length > 0) {
        var thead = document.createElement('thead');
        var tr = document.createElement('tr');
        dataToShow[0].forEach(function(cell) {
            var th = document.createElement('th');
            th.textContent = cell;
            tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
    }

    var tbody = document.createElement('tbody');
    for (var i = 1; i < dataToShow.length; i++) {
        if (i > displayLimit) break;
        var tr = document.createElement('tr');
        dataToShow[i].forEach(function(cell) {
            var td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
}

// --- 5. TẢI XUỐNG ---
function handleDownload() {
    if (!GLOBAL_EXCEL_DATA || GLOBAL_EXCEL_DATA.length === 0) {
        alert("Chưa có dữ liệu để tải!");
        return;
    }
    if (typeof XLSX === 'undefined') { alert("Lỗi thư viện SheetJS"); return; }

    var ws = XLSX.utils.aoa_to_sheet(GLOBAL_EXCEL_DATA);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, GLOBAL_FILENAME);
}
