// File: public/js/excel-gen.js
// Phiên bản: ULTIMATE MATH (Xử lý toán học tối ưu nhất cho Excel)

let GLOBAL_EXCEL_DATA = [];
let GLOBAL_FILENAME = "";

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- CLIENT LOADED: ULTIMATE MATH VERSION ---");
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

    if(loading) loading.style.display = 'block';
    if(error) error.style.display = 'none';
    if(previewSection) previewSection.style.display = 'none'; 
    if(btn) btn.disabled = true;

    try {
        const licenseKey = document.getElementById('license_key').value.trim();
        if (!licenseKey) throw new Error("Vui lòng nhập MÃ KÍCH HOẠT!");

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

        // VALIDATION
        const LIMITS = { c1: 30, c2: 10, c3: 10, c4: 10, c5: 5, c6: 10 };
        if (payload.c1 > LIMITS.c1) throw new Error(`Quá nhiều câu Trắc nghiệm! Max: ${LIMITS.c1}`);
        if (payload.c2 > LIMITS.c2) throw new Error(`Quá nhiều câu Đúng/Sai! Max: ${LIMITS.c2}`);
        
        const total = payload.c1 + payload.c2 + payload.c3 + payload.c4 + payload.c5 + payload.c6;
        if (total === 0) throw new Error("Vui lòng nhập số lượng câu hỏi!");
        if (!payload.mon_hoc || !payload.bai_hoc) throw new Error("Thiếu thông tin Môn học hoặc Chủ đề!");

        // CALL API
        const timestamp = new Date().getTime();
        const apiUrl = `/api_v2?t=${timestamp}`; 

        console.log("Calling:", apiUrl);
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
        try { data = JSON.parse(rawText); } catch (e) { throw new Error("Lỗi JSON từ Server."); }
        
        const content = data.result || data.answer;
        if (!content) throw new Error("Không có dữ liệu.");

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

// --- 2. BỘ XỬ LÝ TOÁN HỌC THÔNG MINH (SMART MATH PARSER) ---
function cleanMathFormulas(text) {
    if (!text) return "";
    let s = text;

    // 1. Dọn dẹp các thẻ bao quanh (xử lý cả trường hợp AI xuống dòng lung tung)
    s = s.replace(/\\\[([\s\S]*?)\\\]/g, '$1'); 
    s = s.replace(/\\\(([\s\S]*?)\\\)/g, '$1'); 
    s = s.replace(/\$([\s\S]*?)\$/g, '$1');     

    // 2. Xóa rác LaTeX (Thêm các lệnh định dạng thường gặp)
    const garbage = [
        '\\displaystyle', '\\limits', '\\nolimits', 
        '\\left', '\\right', '\\big', '\\Big', '\\bigg', '\\Bigg',
        '\\mathrm', '\\mathbf', '\\it', '\\rm'
    ];
    garbage.forEach(cmd => {
        // Xóa lệnh nhưng giữ lại nội dung bên trong nếu có dấu cách
        s = s.split(cmd).join('');
    });

    // 3. XỬ LÝ CẤU TRÚC PHỨC TẠP (Regex linh hoạt hơn với dấu cách \s*)

    // Căn bậc n: \sqrt[3]{x} -> ³√(x)
    s = s.replace(/\\sqrt\s*\[\s*(.+?)\s*\]\s*\{\s*(.+?)\s*\}/g, '($1)√($2)'); 
    
    // Căn bậc 2: \sqrt{abc} -> √(abc)
    s = s.replace(/\\sqrt\s*\{\s*(.+?)\s*\}/g, '√($1)');
    s = s.replace(/\\sqrt\s+(.)/g, '√$1');

    // Phân số: \frac{a}{b} -> (a/b) (Chấp nhận cả dấu cách thừa)
    s = s.replace(/\\frac\s*\{\s*(.+?)\s*\}\s*\{\s*(.+?)\s*\}/g, '($1/$2)');
    // Trường hợp phân số đơn: \frac ab -> (a/b)
    s = s.replace(/\\frac\s+(\w)\s+(\w)/g, '($1/$2)');

    // Số mũ (Superscript): ^2 -> ²
    const superscripts = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ'
    };
    // Xử lý mũ đơn: ^2, ^n
    s = s.replace(/\^([0-9n+\-=()])/g, (match, p1) => superscripts[p1] || match);
    // Xử lý mũ có ngoặc nhọn nhưng nội dung đơn giản: ^{2} -> ²
    s = s.replace(/\^\{\s*([0-9n+\-=()]+)\s*\}/g, (match, p1) => {
        return p1.split('').map(c => superscripts[c] || c).join('');
    });
    // Mũ phức tạp giữ nguyên dấu ^: a^{x+1} -> a^(x+1)
    s = s.replace(/\^\{\s*(.+?)\s*\}/g, '^($1)');

    // Chỉ số dưới (Subscript): H_2 -> H2
    s = s.replace(/_\{\s*(.+?)\s*\}/g, '$1'); 
    s = s.replace(/_(\w)/g, '$1');

    // Vector: \vec{a} -> a→
    s = s.replace(/\\vec\s*\{\s*(.+?)\s*\}/g, '$1→');
    s = s.replace(/\\vec\s+(\w)/g, '$1→');
    s = s.replace(/\\overrightarrow\s*\{\s*(.+?)\s*\}/g, '$1→');

    // Góc: \hat{A} -> ∠A
    s = s.replace(/\\hat\s*\{\s*(.+?)\s*\}/g, '∠$1');
    s = s.replace(/\\widehat\s*\{\s*(.+?)\s*\}/g, '∠$1');

    // Giá trị tuyệt đối
    s = s.replace(/\\mid/g, '|');
    s = s.replace(/\\|/g, '|');

    // Hàm số học
    s = s.replace(/\\log_?\{\s*(.+?)\s*\}\s*\{\s*(.+?)\s*\}/g, 'log$1($2)'); // log cơ số
    s = s.replace(/\\ln\s*\{\s*(.+?)\s*\}/g, 'ln($1)');
    s = s.replace(/\\lim_?\{\s*(.+?)\s*\}/g, 'lim($1)');
    s = s.replace(/\\int_?\{\s*(.+?)\s*\}^?\{\s*(.+?)\s*\}/g, '∫($1->$2)'); // Tích phân

    // 4. BẢNG MAP KÝ TỰ (Unicode Mapping) - Đầy đủ nhất
    const replacements = {
        // Quan hệ
        '\\\\approx': '≈', '\\\\le': '≤', '\\\\leq': '≤', '\\\\ge': '≥', '\\\\geq': '≥',
        '\\\\ne': '≠', '\\\\neq': '≠', '\\\\pm': '±', '\\\\mp': '∓', '\\\\equiv': '≡',
        '\\\\sim': '~', '\\\\cong': '≅',
        
        // Phép toán
        '\\\\times': '×', '\\\\div': '÷', '\\\\cdot': '·', '\\\\ast': '*', '\\\\star': '★',
        '\\\\oplus': '⊕', '\\\\otimes': '⊗',
        
        // Hình học
        '\\\\circ': '°', '\\\\angle': '∠', '\\\\triangle': '∆',
        '\\\\perp': '⊥', '\\\\parallel': '∥', '\\\\deg': '°',
        
        // Tập hợp & Logic
        '\\\\in': '∈', '\\\\notin': '∉', '\\\\subset': '⊂', '\\\\subseteq': '⊆',
        '\\\\cup': '∪', '\\\\cap': '∩', '\\\\emptyset': '∅', '\\\\O': '∅',
        '\\\\forall': '∀', '\\\\exists': '∃', '\\\\nexists': '∄',
        '\\\\rightarrow': '→', '\\\\Rightarrow': '⇒', '\\\\leftrightarrow': '↔', '\\\\Leftrightarrow': '⇔',
        '\\\\infty': '∞', '\\\\partial': '∂', '\\\\nabla': '∇',

        // Hy Lạp (Thường dùng)
        '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ', '\\\\delta': 'δ', '\\\\Delta': 'Δ',
        '\\\\epsilon': 'ε', '\\\\varepsilon': 'ε', '\\\\zeta': 'ζ', '\\\\eta': 'η',
        '\\\\theta': 'θ', '\\\\vartheta': 'θ', '\\\\iota': 'ι', '\\\\kappa': 'κ',
        '\\\\lambda': 'λ', '\\\\Lambda': 'Λ', '\\\\mu': 'µ', '\\\\nu': 'ν',
        '\\\\xi': 'ξ', '\\\\Xi': 'Ξ', '\\\\pi': 'π', '\\\\Pi': 'Π',
        '\\\\rho': 'ρ', '\\\\sigma': 'σ', '\\\\Sigma': 'Σ', '\\\\tau': 'τ',
        '\\\\upsilon': 'υ', '\\\\phi': 'φ', '\\\\varphi': 'φ', '\\\\Phi': 'Φ',
        '\\\\chi': 'χ', '\\\\psi': 'ψ', '\\\\Psi': 'Ψ', '\\\\omega': 'ω', '\\\\Omega': 'Ω',

        // Ký tự đặc biệt khác
        '\\\\sqrt': '√', '\\\\{': '{', '\\\\}': '}', '\\\\%': '%', '\\\\_': '_',
    };

    // Thực hiện thay thế (Ưu tiên chuỗi dài trước để tránh thay nhầm)
    // Ví dụ: thay \leq trước khi thay \le
    const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);
    
    sortedKeys.forEach(key => {
        s = s.split(key).join(replacements[key]);
    });

    // 5. Dọn dẹp cuối cùng
    s = s.replace(/\\text\s*\{\s*(.+?)\s*\}/g, '$1'); // \text{abc} -> abc
    s = s.replace(/\\/g, ''); // Xóa dấu gạch chéo còn sót lại
    s = s.replace(/\s+/g, ' ').trim(); // Xóa khoảng trắng thừa

    return s;
}

// --- 3. XỬ LÝ DỮ LIỆU ---
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
                p = p.replace(/<br\s*\/?>/gi, '\n'); 
                p = p.replace(/\^/g, '|');          
                
                // ÁP DỤNG HÀM LÀM ĐẸP TOÁN HỌC
                p = cleanMathFormulas(p); 
                
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

