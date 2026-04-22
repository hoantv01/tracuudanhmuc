let rawData = [];
let currentFile = "dbhc.txt";
let lastResult = [];

const input = document.getElementById("searchInput");
const tbody = document.getElementById("results");
const thead = document.getElementById("table-head");
const tabs = document.querySelectorAll(".tab");

/* =====================
   CHUẨN HÓA TIẾNG VIỆT
===================== */
function normalize(str) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/* =====================
   LOAD FILE TXT
===================== */
async function loadFile(file) {
    input.value = "";
    tbody.innerHTML = "";
    rawData = [];

    const res = await fetch("data/" + file);
    const text = await res.text();

    rawData = text.split(/\r?\n/).filter(x => x.trim());

    buildHeader(file);
}

loadFile(currentFile);

/* =====================
   HEADER TABLE
===================== */
function buildHeader(file) {
    if (file === "dbhc.txt")
        thead.innerHTML = "<th>Mã</th><th>Phường / Xã</th><th>Tỉnh / Huyện</th>";
    else if (file === "kbnn.txt")
        thead.innerHTML = "<th>Tên Kho bạc</th><th>Mã</th><th>Tỉnh</th>";
    else
        thead.innerHTML = "<th>Mã</th><th>Ngân hàng</th>";
}

/* =====================
   SEARCH DBHC (ƯU TIÊN CAO)
===================== */
function searchDBHC(keyword) {

    const q = normalize(keyword);
    const keys = q.split(" ");

    let results = [];

    for (let line of rawData) {

        const cols = line.split(/\t| {2,}/);

        const ma = cols[0] || "";
        const ten = cols[1] || "";
        const tinh = cols[2] || "";

        const nTen = normalize(ten);
        const nTinh = normalize(tinh);
        const full = normalize(ten + " " + tinh);

        let score = 0;

        /* ==========================
           1. ĐÚNG Y TUYỆT ĐỐI
        ========================== */
        if (nTen === q) score += 1000;

        /* ==========================
           2. ĐÚNG CỤM
        ========================== */
        if (nTen.includes(q)) score += 800;

        /* ==========================
           3. KHỚP ĐỦ TỪ ĐÚNG THỨ TỰ
        ========================== */
        if (full.includes(q)) score += 600;

        /* ==========================
           4. ĐẢO TỪ (PHỤ)
        ========================== */
        const tenWords = nTen.split(" ");
        if (keys.length === tenWords.length) {
            const a = [...keys].sort().join(" ");
            const b = [...tenWords].sort().join(" ");
            if (a === b) score += 300;
        }

        /* ==========================
           5. TỪ RỜI
        ========================== */
        keys.forEach(k => {
            if (nTen.includes(k)) score += 80;
            if (nTinh.includes(k)) score += 40;
        });

        /* ==========================
           6. MÃ
        ========================== */
        if (ma.includes(keyword)) score += 900;

        if (score > 0)
            results.push({ line, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
}

/* =====================
   SEARCH KHÁC (TỐI ƯU HÓA KBNN & NGÂN HÀNG)
===================== */
function searchNormal(keyword) {
    const q = normalize(keyword);
    const keys = q.split(" ").filter(k => k.trim() !== "");

    let results = [];

    for (let line of rawData) {
        const n = normalize(line);

        // 1. ĐIỀU KIỆN BẮT BUỘC: Phải chứa TẤT CẢ từ khóa (Strict AND)
        // Nếu chỉ cần thiếu 1 từ khóa, bỏ qua dòng này luôn (không hiển thị)
        const isMatchAll = keys.every(k => n.includes(k));
        if (!isMatchAll) continue; 

        // 2. Tính điểm cho các kết quả đã lọt qua bộ lọc để xếp hạng
        let score = 0;

        if (n.includes(q)) score += 1000; // Khớp y xì đúc nguyên cụm gõ vào

        keys.forEach(k => {
            const paddedN = " " + n + " ";
            const paddedK = " " + k + " ";
            
            // Khớp trọn vẹn 1 chữ/số đứng độc lập
            if (paddedN.includes(paddedK)) {
                score += 50; 
            } else {
                score += 20; // Khớp một phần
            }
        });

        results.push({ line, score });
    }

    // Sắp xếp điểm từ cao xuống thấp
    results.sort((a, b) => b.score - a.score);
    
    // Trả về top 50 kết quả
    return results.slice(0, 50);
}

/* =====================
   INPUT SEARCH & HIGHLIGHT
===================== */
input.addEventListener("input", () => {

    tbody.innerHTML = "";
    lastResult = [];

    const keyword = input.value.trim();
    if (!keyword) return;

    let results = [];

    if (currentFile === "dbhc.txt")
        results = searchDBHC(keyword);
    else
        results = searchNormal(keyword);

    lastResult = results;

    // Lấy từ khóa gốc (còn nguyên dấu tiếng Việt) để highlight chính xác hơn
    const highlightKeys = keyword.split(" ").filter(k => k.trim() !== "");

    results.forEach(obj => {

        const cols = obj.line.split(/\t| {2,}/);
        const tr = document.createElement("tr");

        cols.forEach(col => {
            let html = col;

            highlightKeys.forEach(k => {
                if (k.length > 0) {
                    // Escape các ký tự đặc biệt để tránh lỗi Regex
                    const safeK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const reg = new RegExp(`(${safeK})`, "gi");
                    html = html.replace(reg, "<mark>$1</mark>");
                }
            });

            const td = document.createElement("td");
            td.innerHTML = html;
            tr.appendChild(td);
        });

        tr.onclick = () => {
            navigator.clipboard.writeText(cols[0]);
            alert("Đã copy: " + cols[0]);
        };

        tbody.appendChild(tr);
    });
});

/* =====================
   TAB SWITCH
===================== */
tabs.forEach(tab => {
    tab.onclick = () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentFile = tab.dataset.file;
        loadFile(currentFile);
    };
});
