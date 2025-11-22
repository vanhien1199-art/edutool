// File: public/js/excel-gen.js
// Phiên bản: ULTRA SAFE PRO (Đã sửa toàn bộ lỗi)

// Biến toàn cục
var GLOBAL_EXCEL_DATA = [];
var GLOBAL_FILENAME = "";

// Đợi trang tải xong
document.addEventListener('DOMContentLoaded', function() {
    console.log("--- SYSTEM READY: ULTRA SAFE PRO VERSION ---");
    
    initializeEventListeners();
});

// Khởi tạo event listeners
function initializeEventListeners() {
    var btnGenerate = document.getElementById('btnGenerate');
    var btnDownload = document.getElementById('btnDownload');

    if (btnGenerate) {
        btnGenerate.addEventListener('click', handleGenerate);
        console.log("✓ Đã đăng ký sự kiện cho btnGenerate");
    } else {
        console.error("❌ LỖI: Không tìm thấy nút btnGenerate");
    }

    if (btnDownload) {
        btnDownload.addEventListener('click', handleDownload);
        console.log("✓ Đã đăng ký sự kiện cho btnDownload");
    } else {
        console.warn("⚠️ Cảnh báo: Không tìm thấy nút btnDownload");
    }
}

// --- 1. HÀM XỬ LÝ CHÍNH ---
async function handleGenerate() {
    var btn = document.getElementById('btnGenerate');
    var loading = document.getElementById('loadingMsg');
    var error = document.getElementById('errorMsg');
    var previewSection = document.getElementById('previewSection');

    // Reset giao diện
    safeDisplay(loading, 'block');
    safeDisplay(error, 'none');
    safeDisplay(previewSection, 'none');
    safeDisableButton(btn, true);

    try {
        console.log("🚀 Bắt đầu xử lý...");

        // 1a. Lấy và validate License
        var licenseKey = getLicenseKey();
        if (!licenseKey) throw new Error("Vui lòng nhập MÃ KÍCH HOẠT!");

        // 1b. Lấy và validate dữ liệu Form
        var payload = getFormData();
        validateFormData(payload);

        // 1c. Gọi API
        var responseData = await callGenerationAPI(payload);
        
        // 1d. Xử lý dữ liệu
        processDataForPreview(responseData, payload);
        renderPreviewTable();
        
        // Hiển thị preview
        if(previewSection) {
            safeDisplay(previewSection, 'block');
            previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        console.log("✅ Xử lý thành công!");

    } catch (err) {
        console.error("❌ Lỗi:", err);
        showError(error, err.message);
    } finally {
        safeDisplay(loading, 'none');
        safeDisableButton(btn, false);
    }
}

// --- 2. HÀM TIỆN ÍCH ---
function safeDisplay(element, displayValue) {
    if (element && element.style) {
        element.style.display = displayValue;
    }
}

function safeDisableButton(button, disabled) {
    if (button) {
        button.disabled = disabled;
    }
}

function showError(errorElement, message) {
    if (errorElement) { 
        errorElement.innerHTML = "<strong>⚠️ " + message + "</strong>"; 
        errorElement.style.display = 'block'; 
    } else {
        alert("Lỗi: " + message);
    }
}

// --- 3. LẤY VÀ VALIDATE DỮ LIỆU ---
function getLicenseKey() {
    var licenseKeyInput = document.getElementById('license_key');
    return licenseKeyInput ? licenseKeyInput.value.trim() : "";
}

function getFormData() {
    return {
        license_key: getLicenseKey(),
        mon_hoc: getInputValue('mon_hoc'),
        lop: getInputValue('lop'),
        bo_sach: getInputValue('bo_sach'),
        bai_hoc: getInputValue('bai_hoc'),
        c1: parseInt(getInputValue('c1')) || 0,
        c2: parseInt(getInputValue('c2')) || 0,
        c3: parseInt(getInputValue('c3')) || 0,
        c4: parseInt(getInputValue('c4')) || 0,
        c5: parseInt(getInputValue('c5')) || 0,
        c6: parseInt(getInputValue('c6')) || 0
    };
}

function getInputValue(id) {
    var element = document.getElementById(id);
    return element ? element.value.trim() : "";
}

function validateFormData(payload) {
    // Validate giới hạn số lượng câu hỏi
    var limits = {
        c1: { max: 30, name: "Trắc nghiệm" },
        c2: { max: 10, name: "Đúng/Sai" },
        c3: { max: 10, name: "Điền khuyết" },
        c4: { max: 10, name: "Kéo thả" },
        c5: { max: 5, name: "Câu chùm" },
        c6: { max: 10, name: "Tự luận" }
    };

    for (var key in limits) {
        if (payload[key] > limits[key].max) {
            throw new Error(limits[key].name + " tối đa " + limits[key].max + " câu.");
        }
    }

    var total = payload.c1 + payload.c2 + payload.c3 + payload.c4 + payload.c5 + payload.c6;
    if (total === 0) throw new Error("Vui lòng nhập số lượng câu hỏi!");
    if (total > 65) throw new Error("Tổng số câu hỏi quá lớn (>65).");
    
    if (!payload.mon_hoc) throw new Error("Vui lòng nhập Môn học!");
    if (!payload.bai_hoc) throw new Error("Vui lòng nhập Chủ đề/Bài học!");
}

// --- 4. GỌI API ---
async function callGenerationAPI(payload) {
    var timestamp = new Date().getTime();
    var apiUrl = "/api_v2?t=" + timestamp; 

    console.log("📡 Đang gọi API:", apiUrl);
    
    var response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    var rawText = await response.text();
    console.log("📨 Server phản hồi:", rawText.substring(0, 100) + "...");

    // Xử lý lỗi HTTP
    if (response.status === 403) throw new Error("⛔ MÃ KÍCH HOẠT KHÔNG ĐÚNG HOẶC HẾT HẠN!");
    if (response.status === 402) throw new Error("⛔ MÃ ĐÃ HẾT LƯỢT. VUI LÒNG MUA THÊM!");
    if (!response.ok) throw new Error("Lỗi Server " + response.status + ": " + (rawText || "Không có thông tin"));

    // Parse JSON
    var data;
    try { 
        data = JSON.parse(rawText); 
    } catch (e) { 
        console.error("Lỗi parse JSON:", e, "Raw text:", rawText);
        throw new Error("Lỗi dữ liệu JSON từ Server."); 
    }
    
    var content = data.result || data.answer || data.data;
    if (!content) {
        console.error("Dữ liệu API không hợp lệ:", data);
        throw new Error("AI không trả về nội dung hoặc định dạng không đúng.");
    }

    return content;
}

// --- 5. HÀM XỬ LÝ TOÁN HỌC (AN TOÀN) ---
function cleanMathFormulas(text) {
    if (!text || typeof text !== 'string') return "";
    
    var s = text.toString();

    try {
        // Xóa các thẻ bao
        s = s.replace(/\\\[(.*?)\\\]/g, '$1'); 
        s = s.replace(/\\\((.*?)\\\)/g, '$1'); 
        s = s.replace(/\$(.*?)\$/g, '$1');     

        // Xóa rác LaTeX
        s = s.split('\\displaystyle').join('');
        s = s.split('\\limits').join('');
        s = s.split('\\left').join('');
        s = s.split('\\right').join('');

        // Map ký tự đặc biệt
        var replacements = {
            '\\\\approx': '≈', '\\\\le': '≤', '\\\\leq': '≤', '\\\\ge': '≥', '\\\\geq': '≥',
            '\\\\ne': '≠', '\\\\neq': '≠', '\\\\pm': '±', '\\\\times': '×', '\\\\div': '÷',
            '\\\\cdot': '·', '\\\\circ': '°', '\\\\angle': '∠', '\\\\triangle': '∆',
            '\\\\in': '∈', '\\\\notin': '∉', '\\\\infty': '∞', '\\\\rightarrow': '→',
            '\\\\alpha': 'α', '\\\\beta': 'β', '\\\\gamma': 'γ', '\\\\Delta': 'Δ', 
            '\\\\pi': 'π', '\\\\theta': 'θ', '\\\\lambda': 'λ', '\\\\omega': 'ω', '\\\\Omega': 'Ω',
            '\\\\sqrt': '√', '\\\\{': '{', '\\\\}': '}', '\\\\%': '%'
        };

        for (var key in replacements) {
            if (replacements.hasOwnProperty(key)) {
                s = s.split(key).join(replacements[key]);
            }
        }

        // Cấu trúc phức tạp
        s = s.replace(/\\sqrt\{(.+?)\}/g, '√($1)');
        s = s.replace(/\\frac\{(.+?)\}\{(.+?)\}/g, '($1/$2)');
        s = s.replace(/\^2/g, '²'); 
        s = s.replace(/\^3/g, '³'); 
        s = s.replace(/\^0/g, '⁰');
        s = s.replace(/\^\{(.+?)\}/g, '^($1)');
        s = s.replace(/_\{(.+?)\}/g, '$1');
        s = s.replace(/\\vec\{(.+?)\}/g, '$1→');
        s = s.replace(/\\hat\{(.+?)\}/g, '∠$1');

        // Dọn dẹp
        s = s.replace(/\\text\{(.+?)\}/g, '$1');
        s = s.replace(/\\/g, ''); 
        s = s.replace(/\s+/g, ' ').trim();

        return s;
    } catch (error) {
        console.warn("Lỗi xử lý công thức toán:", error);
        return text; // Trả về text gốc nếu có lỗi
    }
}

// --- 6. XỬ LÝ DỮ LIỆU EXCEL ---
function processDataForPreview(rawText, payload) {
    try {
        if (!rawText) {
            throw new Error("Không có dữ liệu để xử lý");
        }

        // Làm sạch text
        var cleanText = rawText.toString()
            .replace(/```csv/g, "")
            .replace(/```/g, "")
            .trim();
        
        var lines = cleanText.split('\n');
        var finalData = [];
        var TOTAL_COLS = 22;

        // Header Excel
        var row1 = new Array(TOTAL_COLS).fill(""); 
        row1[7] = "IMPORT CÂU HỎI";
        
        var row2 = new Array(TOTAL_COLS).fill(""); 
        row2[7] = "(Chú ý: các cột bôi đỏ là bắt buộc)";
        
        var row3 = new Array(TOTAL_COLS).fill(""); 
        
        var headers = [
            'STT', 'Loại câu hỏi', 'Độ khó', 'Mức độ nhận thức', 'Đơn vị kiến thức', 'Mức độ đánh giá',
            'Là câu hỏi con của câu hỏi chùm?', 'Nội dung câu hỏi', 'Đáp án đúng',
            'Đáp án 1', 'Đáp án 2', 'Đáp án 3', 'Đáp án 4', 'Đáp án 5', 'Đáp án 6', 'Đáp án 7', 'Đáp án 8',
            'Tags (phân cách nhau bằng dấu ;)', 'Giải thích', 'Đảo đáp án',
            'Tính điểm mỗi đáp án đúng', 'Nhóm đáp án theo từng chỗ trống'
        ];
        
        finalData.push(row1, row2, row3, headers);

        // Xử lý từng dòng dữ liệu
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || !line.includes('|')) continue;
            
            // Bỏ qua dòng header của bảng
            if (line.includes("Loại câu hỏi") && line.includes("Độ khó")) continue; 

            var parts = line.split('|').map(function(part) {
                return part ? part.trim() : "";
            });
            
            // Đảm bảo đủ 22 cột
            if (parts.length > TOTAL_COLS) {
                parts = parts.slice(0, TOTAL_COLS);
            } else {
                while (parts.length < TOTAL_COLS) {
                    parts.push("");
                }
            }

            // Xử lý từng ô
            for (var j = 0; j < parts.length; j++) {
                var cellValue = parts[j] || "";
                cellValue = cellValue.replace(/<br\s*\/?>/gi, '\n');
                cellValue = cellValue.replace(/\^/g, '|');
                cellValue = cleanMathFormulas(cellValue);
                parts[j] = cellValue;
            }

            // Chỉ thêm dòng có STT hợp lệ
            var firstCell = parts[0] ? parts[0].trim() : "";
            if (firstCell && !isNaN(parseInt(firstCell))) {
                finalData.push(parts);
            }
        }

        // Kiểm tra dữ liệu
        if (finalData.length <= 4) {
            throw new Error("Không có dữ liệu câu hỏi nào được tạo ra. Vui lòng kiểm tra lại đầu vào.");
        }

        GLOBAL_EXCEL_DATA = finalData;
        
        // Tạo tên file
        var safeMon = payload.mon_hoc ? payload.mon_hoc.replace(/[^a-z0-9\u0080-\uFFFF]/gi, '_') : 'unknown';
        GLOBAL_FILENAME = "NHCH_" + safeMon + "_" + new Date().getTime() + ".xlsx";
        
        console.log("📊 Đã xử lý xong dữ liệu:", finalData.length + " dòng");
        
    } catch (error) {
        console.error("❌ Lỗi xử lý dữ liệu:", error);
        throw new Error("Lỗi xử lý dữ liệu: " + error.message);
    }
}

// --- 7. HIỂN THỊ BẢNG PREVIEW ---
function renderPreviewTable() {
    var table = document.getElementById('dataTable');
    if (!table) {
        console.error("❌ Không tìm thấy bảng preview");
        return;
    }
    
    table.innerHTML = ""; 
    
    var displayLimit = 20; 
    var dataToShow = GLOBAL_EXCEL_DATA.slice(3); // Bỏ 3 dòng header Excel

    // Kiểm tra dữ liệu
    if (!dataToShow || dataToShow.length === 0) {
        console.warn("⚠️ Không có dữ liệu để hiển thị");
        table.innerHTML = '<tr><td colspan="22" style="text-align: center; color: #666;">Không có dữ liệu để hiển thị</td></tr>';
        return;
    }

    // Tạo header
    if (dataToShow[0] && Array.isArray(dataToShow[0])) {
        var thead = document.createElement('thead');
        var trHead = document.createElement('tr');
        
        dataToShow[0].forEach(function(cell, index) {
            var th = document.createElement('th');
            th.textContent = cell || "Cột " + (index + 1);
            th.title = cell || "Cột " + (index + 1);
            trHead.appendChild(th);
        });
        
        thead.appendChild(trHead);
        table.appendChild(thead);
    }

    // Tạo body
    var tbody = document.createElement('tbody');
    var rowCount = 0;
    
    for (var i = 1; i < dataToShow.length && rowCount < displayLimit; i++) {
        if (!dataToShow[i] || !Array.isArray(dataToShow[i])) continue;
        
        var tr = document.createElement('tr');
        var hasData = false;
        
        dataToShow[i].forEach(function(cell) {
            var td = document.createElement('td');
            td.textContent = cell || "";
            if (cell && cell.trim() !== "") hasData = true;
            tr.appendChild(td);
        });
        
        if (hasData) {
            tbody.appendChild(tr);
            rowCount++;
        }
    }
    
    table.appendChild(tbody);

    // Thêm thông báo nếu có nhiều dòng hơn giới hạn hiển thị
    if (dataToShow.length - 1 > displayLimit) {
        var infoRow = document.createElement('tr');
        var infoCell = document.createElement('td');
        infoCell.colSpan = 22;
        infoCell.style.textAlign = 'center';
        infoCell.style.color = '#666';
        infoCell.style.fontStyle = 'italic';
        infoCell.textContent = '... và ' + (dataToShow.length - 1 - displayLimit) + ' dòng nữa (sẽ được xuất ra Excel)';
        tbody.appendChild(infoRow);
        infoRow.appendChild(infoCell);
    }

    console.log("👀 Đã hiển thị " + rowCount + "/" + (dataToShow.length - 1) + " dòng");
}

// --- 8. TẢI XUỐNG EXCEL ---
function handleDownload() {
    try {
        if (!GLOBAL_EXCEL_DATA || GLOBAL_EXCEL_DATA.length === 0) {
            alert("❌ Chưa có dữ liệu để tải xuống! Vui lòng tạo câu hỏi trước.");
            return;
        }
        
        if (typeof XLSX === 'undefined') {
            alert("❌ Lỗi: Thư viện SheetJS chưa được tải. Vui lòng tải lại trang.");
            console.error("SheetJS không tồn tại");
            return;
        }

        console.log("💾 Đang tạo file Excel...");
        
        var ws = XLSX.utils.aoa_to_sheet(GLOBAL_EXCEL_DATA);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Câu hỏi");
        
        XLSX.writeFile(wb, GLOBAL_FILENAME);
        
        console.log("✅ Đã tải xuống file: " + GLOBAL_FILENAME);
        
    } catch (error) {
        console.error("❌ Lỗi tạo file Excel:", error);
        alert("❌ Lỗi tạo file Excel: " + error.message);
    }
}

// --- 9. HÀM TIỆN ÍCH BỔ SUNG ---
function getExcelDataCount() {
    return GLOBAL_EXCEL_DATA ? GLOBAL_EXCEL_DATA.length : 0;
}

function getQuestionCount() {
    if (!GLOBAL_EXCEL_DATA || GLOBAL_EXCEL_DATA.length <= 4) return 0;
    return GLOBAL_EXCEL_DATA.length - 4; // Trừ đi 4 dòng header
}

function clearData() {
    GLOBAL_EXCEL_DATA = [];
    GLOBAL_FILENAME = "";
    var table = document.getElementById('dataTable');
    if (table) table.innerHTML = "";
    var previewSection = document.getElementById('previewSection');
    safeDisplay(previewSection, 'none');
    console.log("🧹 Đã xóa dữ liệu");
}

// Export functions for testing (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        cleanMathFormulas,
        processDataForPreview,
        validateFormData,
        getExcelDataCount,
        getQuestionCount
    };
}
