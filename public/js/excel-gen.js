// File: public/js/excel-gen.js
// Phiên bản: FINAL INTEGRATED (Validation + Advanced Math + Preview)

// --- BIẾN TOÀN CỤC ---
let GLOBAL_EXCEL_DATA = [];
let GLOBAL_FILENAME = "";

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- SYSTEM LOADED: FINAL INTEGRATED VERSION ---");
    
    const btnGenerate = document.getElementById('btnGenerate');
    const btnDownload = document.getElementById('btnDownload');

    if (btnGenerate) {
        btnGenerate.addEventListener('click', handleGenerate);
    } else {
        console.error("Lỗi: Không tìm thấy nút btnGenerate");
    }

    if (btnDownload) {
        btnDownload.addEventListener('click', handleDownload);
    }
});

// --- 1. XỬ LÝ NÚT TẠO DỮ LIỆU ---
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
        const licenseKey = document.getElementById('license_key').value.trim();
        if (!licenseKey) throw new Error("Vui lòng nhập MÃ KÍCH HOẠT!");

        // 1b. Lấy dữ liệu
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

        // ---------------------------------------------------------
        // 🛑 KIỂM TRA GIỚI HẠN SỐ LƯỢNG (VALIDATION)
        // ---------------------------------------------------------
        const LIMITS = { c1: 30, c2: 10, c3: 10, c4: 10, c5: 5, c6: 10 };
        
        if (payload.c1 > LIMITS.c1) throw new Error(`Quá nhiều câu Trắc nghiệm! Tối đa: ${LIMITS.c1}`);
        if (payload.c2 > LIMITS.c2) throw new Error(`Quá nhiều câu Đúng/Sai! Tối đa: ${LIMITS.c2}`);
        if (payload.c3 > LIMITS.c3) throw new Error(`Quá nhiều câu Điền khuyết! Tối đa: ${LIMITS.c3}`);
        if (payload.c4 > LIMITS.c4) throw new Error(`Quá nhiều câu Kéo thả! Tối đa: ${LIMITS.c4}`);
        if (payload.c5 > LIMITS.c5) throw new Error(`Quá nhiều câu Chùm! Tối đa: ${LIMITS.c5}`);
        if (payload.c6 > LIMITS.c6) throw new Error(`Quá nhiều câu Tự luận! Tối đa: ${LIMITS.c6}`);

        const total = payload.c1 + payload.c2 + payload.c3 + payload.c4 + payload.c5 + payload.c6;
        if (total === 0) throw new Error("Vui lòng nhập số lượng câu hỏi!");
        if (total > 65) throw new Error(`Tổng số câu hỏi (${total}) quá lớn. Vui lòng giảm xuống dưới 65 câu.`);
        
        if (!payload.mon_hoc || !payload.bai_hoc) throw new Error("Thiếu thông tin Môn học hoặc Chủ đề!");
        // ---------------------------------------------------------

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
        
        // Xử lý lỗi HTTP
        if (response.status === 403) throw new Error("⛔ MÃ KÍCH HOẠT SAI HOẶC KHÔNG TỒN TẠI!");
        if (response.status === 402) throw new Error("⛔ MÃ ĐÃ HẾT LƯỢT. VUI LÒNG MUA THÊM!");
        if (!response.ok) throw new Error(`Lỗi Server ${response.status}: ${rawText}`);

        // Parse JSON
        let data;
        try { data = JSON.parse(rawText); } catch (e) { throw new Error("Lỗi dữ liệu từ Server (JSON Parse Error)."); }
        
        const content = data.result || data.answer;
        if (!content) throw new Error("AI không trả về nội dung câu hỏi.");

        // 1d. Xử lý dữ liệu & Hiển thị
        processDataForPreview(content, payload);
        renderPreviewTable();
        
        if(previewSection) {
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });
        }

    } catch (err) {
        console.error(err);
        if(error) { 
            error.innerHTML = `<strong>⚠️ ${err.message}</strong>`; 
            error.style.display = 'block'; 
        }
    } finally {
        if(loading) loading.style.display = 'none';
        if(btn) btn.disabled = false;
    }
}

// --- 2. BỘ XỬ LÝ TOÁN HỌC (FINAL REFINED - BẠN CUNG CẤP) ---
function cleanMathFormulas(text) {
    if (!text) return "";
    let s = text;

    // 1. Dọn dẹp các thẻ bao quanh
    s = s.replace(/\\\[([\s\S]*?)\\\]/g, '$1'); 
    s = s.replace(/\\\(([\s\S]*?)\\\)/g, '$1'); 
    s = s.replace(/\$([\s\S]*?)\$/g, '$1');     

    // 2. Xóa rác LaTeX
    const garbage = [
        '\\displaystyle', '\\limits', '\\nolimits', 
        '\\left', '\\right', '\\big', '\\Big', '\\bigg', '\\Bigg',
        '\\mathrm', '\\mathbf', '\\it', '\\rm'
    ];
    garbage.forEach(cmd => {
        s = s.split(cmd).join('');
    });

    // 3. XỬ LÝ CẤU TRÚC PHỨC TẠP
    // Căn bậc n: \sqrt[3]{x} -> ³√(x)
    s = s.replace(/\\sqrt\s*\[\s*(.+?)\s*\]\s*\{\s*(.+?)\s*\}/g, '($1)√($2)'); 
    
    // Căn bậc 2
    s = s.replace(/\\sqrt\s*\{\s*(.+?)\s*\}/g, '√($1)');
    s = s.replace(/\\sqrt\s+(.)/g, '√$1');

    // Phân số
    s = s.replace(/\\frac\s*\{\s*(.+?)\s*\}\s*\{\s*(.+?)\s*\}/g, '($1/$2)');
    s = s.replace(/\\frac\s+(\w)\s+(\w)/g, '($1/$2)');

    // Số mũ
    const superscripts = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ'
    };
    s = s.replace(/\^([0-9n+\-=()])/g, (match, p1) => superscripts[p1] || match);
    s = s.replace(/\^\{\s*([0-9n+\-=()]+)\s*\}/g, (match, p1) => {
        return p1.split('').map(c => superscripts[c] || c).join('');
    });
    s = s.replace(/\^\{\s*(.+?)\s*\}/g, '^($1)');

    // Chỉ số dưới
    s = s.replace(/_\{\s*(.+?)\s*\}/g, '$1'); 
    s = s.replace(/_(\w)/g, '$1');

    // Vector
    s = s.replace(/\\vec\s*\{\s*(.+?)\s*\}/g, '$1→');
    s = s.replace(/\\vec\s+(\w)/g, '$1→');
    s = s.replace(/\\overrightarrow\s*\{\s*(.+?)\s*\}/g, '$1→');

    // Góc
    s = s.replace(/\\hat\s*\{\s*(.+?)\s*\}/g, '∠$1');
    s = s.replace(/\\widehat\s*\{\s*(.+?)\s*\}/g, '∠$1');

    // Giá trị tuyệt đối
    s = s.replace(/\\mid/g, '|');
    s = s.replace(/\\|/g, '|');

    // Hàm số
    s = s.replace(/\\log_?\{\s*(.+?)\s*\}\s*\{\s*(.+?)\s*\}/g, 'log$1($2)');
    s = s.replace(/\\ln\s*\{\s*(.+?)\s*\}/g, 'ln($1)');
    s = s.replace(/\\lim_?\{\s*(.+?)\s*\}/g, 'lim($1)');
    s = s.replace(/\\int_?\{\s*(.+?)\s*\}^?\{\s*(.+?)\s*\}/g, '∫($1->$2)');

    // 4. BẢNG MAP KÝ TỰ
    const replacements = {
        '\\\\approx': '≈', '\\\\le': '≤', '\\\\leq': '≤', '\\\\ge': '≥', '\\\\geq': '≥',
        '\\\\ne': '≠', '\\\\neq': '≠', '\\\\pm': '±', '\\\\mp': '∓', '\\\\equiv': '≡',
        '\\\\sim': '~', '\\\\cong': '≅',
        '\\\\times': '×', '\\\\div': '÷', '\\\\cdot': '·', '\\\\ast': '*', '\\\\star': '★',
        '\\\\oplus': '⊕', '\\\\otimes': '⊗',
        '\\\\circ': '°', '\\\\angle': '∠', '\\\\triangle': '∆',
        '\\\\perp': '⊥', '\\\\parallel': '∥', '\\\\deg': '°',
        '\\\\in': '∈', '\\\\notin': '∉', '\\\\subset': '⊂', '\\\\subseteq': '⊆',
        '\\\\cup': '∪', '\\\\cap': '∩', '\\\\emptyset': '∅', '\\\\O': '∅',
        '\\\\forall': '∀', '\\\\exists': '∃', '\\\\nexists': '∄',
        '\\\\rightarrow': '→', '\\\\Rightarrow': '⇒', '\\\\leftrightarrow': '↔', '\\\\Leftrightarrow': '⇔',
        '\\\\infty': '∞', '\\\\partial': '∂', '\\\\nabla': '∇',
        '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ', '\\\\delta': 'δ', '\\\\Delta': 'Δ',
        '\\\\epsilon': 'ε', '\\\\varepsilon': 'ε', '\\\\zeta': 'ζ', '\\\\eta': 'η',
        '\\\\theta': 'θ', '\\\\vartheta': 'θ', '\\\\iota': 'ι', '\\\\kappa': 'κ',
        '\\\\lambda': 'λ', '\\\\Lambda': 'Λ', '\\\\mu': 'µ', '\\\\nu': 'ν',
        '\\\\xi': 'ξ', '\\\\Xi': 'Ξ', '\\\\pi': 'π', '\\\\Pi': 'Π',
        '\\\\rho': 'ρ', '\\\\sigma': 'σ', '\\\\Sigma': 'Σ', '\\\\tau': 'τ',
        '\\\\upsilon': 'υ', '\\\\phi': 'φ', '\\\\varphi': 'φ', '\\\\Phi': 'Φ',
        '\\\\chi': 'χ', '\\\\psi': 'ψ', '\\\\Psi': 'Ψ', '\\\\omega': 'ω', '\\\\Omega': 'Ω',
        '\\\\sqrt': '√', '\\\\{': '{', '\\\\}': '}', '\\\\%': '%', '\\\\_': '_',
    };

    const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);
    sortedKeys.forEach(key => {
        s = s.split(key).join(replacements[key]);
    });

    // 5. Dọn dẹp cuối cùng
    s = s.replace(/\\text\s*\{\s*(.+?)\s*\}/g, '$1');
    s = s.replace(/\\/g, '');
    s = s.replace(/\s+/g, ' ').trim();

    return s;
}

// --- 3. XỬ LÝ DỮ LIỆU (PARSE & PREVIEW) ---
function processDataForPreview(rawText, payload) {
    const cleanText = rawText.replace(/```csv/g, "").replace(/```/g, "").trim();
    const lines = cleanText.split('\n');
    
    const finalData = [];
    const TOTAL_COLS = 22;

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
                p = p.replace(/\^/g, '|');          // Thay dấu mũ
                p = cleanMathFormulas(p);           // Làm đẹp toán học
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

// --- 4. HIỂN THỊ BẢNG PREVIEW ---
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

// --- 5. TẢI XUỐNG ---
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
