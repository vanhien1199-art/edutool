// File: public/js/excel-gen.js
// Phiên bản: MATH FIX (Hỗ trợ hiển thị công thức Toán đẹp hơn)

let GLOBAL_EXCEL_DATA = [];
let GLOBAL_FILENAME = "";

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- CLIENT LOADED: MATH SUPPORT VERSION ---");
    
    const btnGenerate = document.getElementById('btnGenerate');
    if (btnGenerate) btnGenerate.addEventListener('click', handleGenerate);

    const btnDownload = document.getElementById('btnDownload');
    if (btnDownload) btnDownload.addEventListener('click', handleDownload);
});

// 1. XỬ LÝ CHÍNH
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
        // ... (Giữ nguyên các validation khác nếu cần) ...
        
        if (!payload.mon_hoc || !payload.bai_hoc) throw new Error("Thiếu Môn học hoặc Chủ đề!");

        // GỌI API
        const timestamp = new Date().getTime();
        const apiUrl = `/api_v2?t=${timestamp}`; 

        console.log("Calling:", apiUrl);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        if (response.status === 403) throw new Error("⛔ MÃ KÍCH HOẠT KHÔNG ĐÚNG/HẾT HẠN!");
        if (response.status === 402) throw new Error("⛔ MÃ ĐÃ HẾT LƯỢT. VUI LÒNG MUA THÊM!");
        if (!response.ok) throw new Error(`Lỗi Server ${response.status}: ${rawText}`);

        let data;
        try { data = JSON.parse(rawText); } catch (e) { throw new Error("Lỗi JSON."); }
        
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

// --- HÀM XỬ LÝ TOÁN HỌC (QUAN TRỌNG NHẤT) ---
function cleanMathFormulas(text) {
    if (!text) return "";
    let s = text;

    // 1. Xóa các ký hiệu LaTeX bao quanh ($...$ hoặc \(...\) hoặc \[...\])
    s = s.replace(/\\\[(.*?)\\\]/g, '$1'); 
    s = s.replace(/\\\((.*?)\\\)/g, '$1'); 
    s = s.replace(/\$(.*?)\$/g, '$1');     

    // 2. Xử lý CĂN BẬC 2 (\sqrt)
    // \sqrt{abc} -> √(abc) : Thêm ngoặc để rõ ràng phạm vi căn
    s = s.replace(/\\sqrt\{(.+?)\}/g, '√($1)');
    // \sqrt x -> √x : Căn đơn giản
    s = s.replace(/\\sqrt\s+(.)/g, '√$1');

    // 3. Xử lý PHÂN SỐ (\frac)
    // \frac{tu}{mau} -> (tu/mau)
    s = s.replace(/\\frac\{(.+?)\}\{(.+?)\}/g, '($1/$2)');

    // 4. Xử lý SỐ MŨ (Superscripts) thông dụng
    // Thay thế ^2, ^3, ^0 thành ký tự nhỏ phía trên
    s = s.replace(/\^2/g, '²');
    s = s.replace(/\^3/g, '³');
    s = s.replace(/\^0/g, '⁰');
    // Các số mũ khác: x^{n} -> x^n (Giữ nguyên dấu ^ để Excel hiểu là mũ)
    s = s.replace(/\^\{(.+?)\}/g, '^$1');

    // 5. Xử lý CHỈ SỐ DƯỚI (Subscripts) đơn giản
    // H_2 -> H2, x_i -> xi (Bỏ dấu gạch dưới cho gọn, hoặc giữ lại tùy ý)
    s = s.replace(/_\{(.+?)\}/g, '$1'); // x_{ab} -> xab
    s = s.replace(/_(.)/g, '$1');       // x_i -> xi

    // 6. BẢNG MÃ KÝ TỰ ĐẶC BIỆT (Unicode Mapping)
    const replacements = {
        // Quan hệ
        '\\\\approx': '≈', 
        '\\\\le': '≤', '\\\\leq': '≤',
        '\\\\ge': '≥', '\\\\geq': '≥',
        '\\\\ne': '≠', '\\\\neq': '≠',
        '\\\\pm': '±', '\\\\mp': '∓',
        
        // Phép toán
        '\\\\times': '×',
        '\\\\div': '÷',
        '\\\\cdot': '·',
        '\\\\ast': '*',
        
        // Hình học / Góc
        '\\\\circ': '°',
        '\\\\angle': '∠',
        '\\\\triangle': '∆',
        '\\\\perp': '⊥',
        '\\\\parallel': '∥',
        '\\\\degree': '°',

        // Tập hợp / Logic
        '\\\\in': '∈', '\\\\notin': '∉',
        '\\\\subset': '⊂', '\\\\subseteq': '⊆',
        '\\\\cup': '∪', '\\\\cap': '∩',
        '\\\\emptyset': '∅',
        '\\\\forall': '∀', '\\\\exists': '∃',
        '\\\\rightarrow': '→', '\\\\Rightarrow': '⇒',
        '\\\\leftrightarrow': '↔', '\\\\Leftrightarrow': '⇔',
        '\\\\infty': '∞',

        // Hy Lạp (Thường dùng trong Lý/Toán)
        '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ', 
        '\\\\delta': 'δ', '\\\\Delta': 'Δ',
        '\\\\pi': 'π', 
        '\\\\theta': 'θ', 
        '\\\\lambda': 'λ', 
        '\\\\omega': 'ω', '\\\\Omega': 'Ω',
        '\\\\sigma': 'σ', '\\\\Sigma': 'Σ',
        '\\\\mu': 'µ', // Micro
        '\\\\rho': 'ρ',

        // Ký tự khác
        '\\\\sqrt': '√', // Fallback nếu regex trên chưa bắt hết
        '\\\\{': '{', '\\\\}': '}', '\\\\%': '%',
    };

    // Thực hiện thay thế hàng loạt
    for (const [key, value] of Object.entries(replacements)) {
        // Dùng split/join để replace all nhanh nhất
        s = s.split(key).join(value);
    }
    
    // 7. Dọn dẹp các dấu gạch chéo thừa còn sót lại của LaTeX
    // Ví dụ \text{...} chỉ lấy nội dung bên trong
    s = s.replace(/\\text\{(.+?)\}/g, '$1');
    s = s.replace(/\\/g, ''); 

    // 8. Xóa khoảng trắng thừa
    s = s.replace(/\s+/g, ' ').trim();

    return s;
}
// 2. HÀM XỬ LÝ DỮ LIỆU
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
                p = p.replace(/\^/g, '|');          // Dấu mũ -> gạch đứng
                
                // GỌI HÀM LÀM ĐẸP TOÁN HỌC Ở ĐÂY
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

// 3. PREVIEW TABLE
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

// 4. DOWNLOAD
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
