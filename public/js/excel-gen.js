// File: public/js/excel-gen.js
// Phiên bản: MATH FIXED & LOGIC ORDER (Đã sửa lỗi hiển thị công thức x|1/3)

let GLOBAL_EXCEL_DATA = [];
let GLOBAL_FILENAME = "";

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- SYSTEM READY: MATH FIXED VERSION ---");
    
    const btnGenerate = document.getElementById('btnGenerate');
    const btnDownload = document.getElementById('btnDownload');

    if (btnGenerate) btnGenerate.addEventListener('click', handleGenerate);
    if (btnDownload) btnDownload.addEventListener('click', handleDownload);
});

// --- 1. XỬ LÝ CHÍNH ---
async function handleGenerate() {
    const btn = document.getElementById('btnGenerate');
    const loading = document.getElementById('loadingMsg');
    const error = document.getElementById('errorMsg');
    const previewSection = document.getElementById('previewSection');

    // Reset UI
    if(loading) loading.style.display = 'block';
    if(error) error.style.display = 'none';
    if(previewSection) previewSection.style.display = 'none';
    if(btn) btn.disabled = true;

    try {
        // 1a. Validate License
        const licenseKeyInput = document.getElementById('license_key');
        const licenseKey = licenseKeyInput ? licenseKeyInput.value.trim() : "";
        if (!licenseKey) throw new Error("Vui lòng nhập MÃ KÍCH HOẠT!");

        // 1b. Validate Form
        const payload = {
            license_key: licenseKey,
            mon_hoc: getValue('mon_hoc'),
            lop: getValue('lop'),
            bo_sach: getValue('bo_sach'),
            bai_hoc: getValue('bai_hoc'),
            c1: getNum('c1'), c2: getNum('c2'), c3: getNum('c3'),
            c4: getNum('c4'), c5: getNum('c5'), c6: getNum('c6')
        };

        // Kiểm tra giới hạn (Validation)
        const LIMITS = { c1: 30, c2: 10, c3: 10, c4: 10, c5: 5, c6: 10 };
        if (payload.c1 > LIMITS.c1) throw new Error(`Quá nhiều câu Trắc nghiệm! Max: ${LIMITS.c1}`);
        if (payload.c2 > LIMITS.c2) throw new Error(`Quá nhiều câu Đúng/Sai! Max: ${LIMITS.c2}`);
        
        const total = payload.c1 + payload.c2 + payload.c3 + payload.c4 + payload.c5 + payload.c6;
        if (total === 0) throw new Error("Vui lòng nhập số lượng câu hỏi!");
        if (total > 70) throw new Error("Tổng số câu hỏi quá lớn (>70). Vui lòng chia nhỏ.");
        if (!payload.mon_hoc || !payload.bai_hoc) throw new Error("Thiếu thông tin Môn học hoặc Chủ đề!");

        // 1c. Gọi API
        const timestamp = new Date().getTime();
        const apiUrl = `/api_v2?t=${timestamp}`; 

        console.log("Calling API:", apiUrl);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        
        if (response.status === 403) throw new Error("⛔ MÃ KÍCH HOẠT KHÔNG ĐÚNG HOẶC HẾT HẠN!");
        if (response.status === 402) throw new Error("⛔ MÃ ĐÃ HẾT LƯỢT. VUI LÒNG MUA THÊM!");
        if (!response.ok) throw new Error(`Lỗi Server ${response.status}: ${rawText}`);

        let data;
        try { data = JSON.parse(rawText); } catch (e) { throw new Error("Lỗi dữ liệu từ Server."); }
        
        const content = data.result || data.answer;
        if (!content) throw new Error("AI không trả về nội dung câu hỏi.");

        // 1d. Xử lý dữ liệu
        processDataForPreview(content, payload);
        renderPreviewTable();
        
        if(previewSection) {
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });
        }

    } catch (err) {
        console.error(err);
        if(error) { error.innerHTML = `<strong>⚠️ ${err.message}</strong>`; error.style.display = 'block'; }
    } finally {
        if(loading) loading.style.display = 'none';
        if(btn) btn.disabled = false;
    }
}

// --- 2. BỘ XỬ LÝ TOÁN HỌC MẠNH MẼ (QUAN TRỌNG) ---
function cleanMathFormulas(text) {
    if (!text) return "";
    let s = text;

    // 1. Dọn dẹp thẻ bao quanh
    s = s.replace(/\\\[(.*?)\\\]/g, '$1'); 
    s = s.replace(/\\\((.*?)\\\)/g, '$1'); 
    s = s.replace(/\$(.*?)\$/g, '$1');     

    // 2. Xóa rác LaTeX
    const garbage = ['\\displaystyle', '\\limits', '\\left', '\\right', '\\mathrm', '\\mathbf'];
    garbage.forEach(g => { s = s.split(g).join(''); });

    [cite_start]// 3. XỬ LÝ CĂN BẬC N (Fix lỗi sqrt[6]) [cite: 4]
    // \sqrt[n]{x} -> (x)^(1/n) hoặc n√x. Chọn n√x cho gọn.
    s = s.replace(/\\sqrt\s*\[\s*(.+?)\s*\]\s*\{\s*(.+?)\s*\}/g, '($1)√($2)'); 
    s = s.replace(/\\sqrt\s*\[\s*(.+?)\s*\]\s*(.+?)/g, '($1)√($2)'); // Trường hợp không có ngoặc nhọn

    // Xử lý căn bậc 2 thường
    s = s.replace(/\\sqrt\s*\{\s*(.+?)\s*\}/g, '√($1)');
    s = s.replace(/\\sqrt\s+(.)/g, '√$1');

    // 4. XỬ LÝ PHÂN SỐ
    s = s.replace(/\\frac\s*\{\s*(.+?)\s*\}\s*\{\s*(.+?)\s*\}/g, '($1/$2)');
    s = s.replace(/\\frac\s+(\w)\s+(\w)/g, '($1/$2)');

    [cite_start]// 5. XỬ LÝ SỐ MŨ (Fix lỗi x|1/3) [cite: 36, 37]
    // Chiến thuật: Chuyển hết dấu ^ trong toán thành ký tự khác hoặc Unicode để không bị nhầm là dấu phân cách.
    
    // Mũ đơn giản: ^2, ^3 -> Unicode
    s = s.replace(/\^2/g, '²'); 
    s = s.replace(/\^3/g, '³'); 
    s = s.replace(/\^0/g, '⁰');
    
    // Mũ phức tạp: ^{1/3} -> ⁽¹/³⁾ hoặc **(1/3)
    // Ở đây ta chuyển thành ** (dấu mũ trong Excel/Code) để tránh bị thay thế thành |
    s = s.replace(/\^\{\s*(.+?)\s*\}/g, '**($1)'); 
    s = s.replace(/\^([0-9a-zA-Z]+)/g, '**$1'); // x^y -> x**y

    // 6. CÁC KÝ TỰ KHÁC
    s = s.replace(/_\{(.+?)\}/g, '$1'); // Chỉ số dưới
    s = s.replace(/\\vec\s*\{(.+?)\}/g, '$1→'); 
    s = s.replace(/\\hat\s*\{(.+?)\}/g, '∠$1');
    s = s.replace(/\\mid/g, '|'); // Giá trị tuyệt đối giữ nguyên |

    // Map ký tự đặc biệt
    const replacements = {
        '\\\\approx': '≈', '\\\\le': '≤', '\\\\leq': '≤', '\\\\ge': '≥', '\\\\geq': '≥',
        '\\\\ne': '≠', '\\\\neq': '≠', '\\\\pm': '±', '\\\\times': '×', '\\\\div': '÷',
        '\\\\cdot': '.', '\\\\ast': '*', '\\\\circ': '°', '\\\\angle': '∠', 
        '\\\\in': '∈', '\\\\notin': '∉', '\\\\infty': '∞', '\\\\rightarrow': '→',
        '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ', '\\\\Delta': 'Δ', 
        '\\\\pi': 'π', '\\\\theta': 'θ', '\\\\lambda': 'λ', '\\\\omega': 'ω', '\\\\Omega': 'Ω',
        '\\\\sqrt': '√', '\\\\{': '{', '\\\\}': '}', '\\\\%': '%',
    };

    for (const [key, value] of Object.entries(replacements)) {
        s = s.split(key).join(value);
    }

    // Dọn dẹp
    s = s.replace(/\\text\{(.+?)\}/g, '$1');
    s = s.replace(/\\/g, ''); 
    s = s.replace(/\s+/g, ' ').trim();

    return s;
}

// --- 3. XỬ LÝ DỮ LIỆU EXCEL ---
function processDataForPreview(rawText, payload) {
    const cleanText = rawText.replace(/```csv/g, "").replace(/```/g, "").trim();
    const lines = cleanText.split('\n');
    
    const finalData = [];
    const TOTAL_COLS = 22;

    // Header
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
                p = p.replace(/<br\s*\/?>/gi, '\n'); // Xuống dòng
                
                // --- QUAN TRỌNG: THỨ TỰ XỬ LÝ ---
                
                // 1. Xử lý Toán học TRƯỚC (Để bảo vệ các dấu mũ trong công thức)
                p = cleanMathFormulas(p); 
                
                // 2. Sau khi xử lý toán, các dấu ^ của toán đã thành ** hoặc ²,
                // nên dấu ^ còn lại chính là dấu phân cách đáp án -> Thay thành |
                p = p.replace(/\^/g, '|');          
                
                return p;
            }
            return cell;
        });

        if (!isNaN(parseInt(parts[0]))) finalData.push(parts);
    }

    GLOBAL_EXCEL_DATA = finalData;
    const safeMon = payload.mon_hoc.replace(/[^a-z0-9]/gi, '_');
    GLOBAL_FILENAME = `NHCH_${safeMon}_${new Date().getTime()}.xlsx`;
}

// --- 4. HIỂN THỊ BẢNG ---
function renderPreviewTable() {
    const table = document.getElementById('dataTable');
    if(!table) return;
    table.innerHTML = ""; 
    const displayLimit = 20; 
    const dataToShow = GLOBAL_EXCEL_DATA.slice(3);

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

    const tbody = document.createElement('tbody');
    for (let i = 1; i < dataToShow.length; i++) {
        if (i > displayLimit) break;
        const tr = document.createElement('tr');
        dataToShow[i].forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
}

// --- 5. TẢI XUỐNG & HELPER ---
function handleDownload() {
    if (!GLOBAL_EXCEL_DATA || GLOBAL_EXCEL_DATA.length === 0) {
        alert("Chưa có dữ liệu!"); return;
    }
    if (typeof XLSX === 'undefined') { alert("Lỗi thư viện SheetJS"); return; }

    const ws = XLSX.utils.aoa_to_sheet(GLOBAL_EXCEL_DATA);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, GLOBAL_FILENAME);
}

function getValue(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function getNum(id) { const el = document.getElementById(id); return el ? (parseInt(el.value) || 0) : 0; }
