// --- BỘ XỬ LÝ TOÁN HỌC THÔNG MINH (PHIÊN BẢN FINAL REFINED) ---
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
