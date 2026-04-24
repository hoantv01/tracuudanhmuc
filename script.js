let rawData = [];
// Biến lưu trữ riêng dữ liệu đã phân tích của ĐVSDNS để truy xuất siêu tốc
let parsedDVSDNS = []; 
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
    if (!str) return "";
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
   LOAD FILE TXT (TÍCH HỢP PAPAPARSE)
===================== */
async function loadFile(file) {
    input.value = "";
    tbody.innerHTML = "";
    rawData = [];

    buildHeader(file);

    if (file === "madbhcdonvi.txt") {
        // Nếu đã parse một lần rồi thì dùng lại bộ nhớ RAM, không tải lại qua mạng
        if (parsedDVSDNS.length > 0) {
            input.disabled = false;
            input.placeholder = "Nhập Mã hoặc Tên ĐVSDNS...";
            input.focus();
            return;
        }

        // Khóa input trong lúc Web Worker đang làm việc để tránh lỗi
        input.disabled = true;
        input.placeholder = "Đang nạp 400.000 danh mục ĐVSDNS, vui lòng đợi...";

        Papa.parse("data/" + file, {
            download: true,
            delimiter: "\t",
            worker: true, // Chạy ngầm không làm đơ giao diện
            skipEmptyLines: true,
            complete: function(results) {
                // TIỀN XỬ LÝ DỮ LIỆU: Chuẩn hóa sẵn để hàm search chạy nhanh như chớp
                parsedDVSDNS = results.data.map(cols => {
                    const ma = cols[0] ? cols[0].trim() : "";
                    const ten = cols[1] ? cols[1].trim() : "";
                    const maDBHC = cols[2] ? cols[2].trim() : "";
                    
                    return {
                        ma: ma,
                        ten: ten,
                        maDBHC: maDBHC,
                        nMa: normalize(ma),          // Chuẩn hóa sẵn Mã
                        nTen: normalize(ten),        // Chuẩn hóa sẵn Tên
                        nMaDBHC: normalize(maDBHC),  // Chuẩn hóa sẵn Mã ĐBHC
                        originalLine: `${ma}\t${ten}\t${maDBHC}` // Lưu lại dòng gốc để render
                    };
                });

                input.disabled = false;
                input.placeholder = "Nhập Mã hoặc Tên ĐVSDNS...";
                input.focus();
            },
            error: function(err) {
                input.placeholder = "Lỗi tải dữ liệu ĐVSDNS!";
                console.error("PapaParse Lỗi:", err);
            }
        });
    } else {
        // Dành cho các file nhỏ (dbhc.txt, kbnn.txt)
        input.disabled = false;
        input.placeholder = "Nhập từ khóa tìm kiếm...";
        const res = await fetch("data/" + file);
        const text = await res.text();
        rawData = text.split(/\r?\n/).filter(x => x.trim());
    }
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
    else if (file === "madbhcdonvi.txt") 
        thead.innerHTML = "<th>Mã ĐVSDNS</th><th>Tên đơn vị</th><th>Mã ĐBHC</th>";
    else
        thead.innerHTML = "<th>Mã</th><th>Ngân hàng</th>";
}

/* =====================
   SEARCH DBHC & NORMAL (GIỮ NGUYÊN CODE CỦA BẠN)
===================== */
// ... (Giữ nguyên toàn bộ nội dung hàm searchDBHC và searchNormal) ...

/* =====================
   SEARCH ĐVSDNS (TỐI ƯU HÓA MỚI)
===================== */
function searchDVSDNS(keyword) {
    const q = normalize(keyword);
    const keys = q.split(" ").filter(k => k.trim() !== "");

    let results = [];

    // Duyệt trực tiếp qua mảng Object đã được tiền xử lý
    for (let i = 0; i < parsedDVSDNS.length; i++) {
        const item = parsedDVSDNS[i];

        // 1. ĐIỀU KIỆN BẮT BUỘC: So sánh trực tiếp trên thuộc tính đã chuẩn hóa
        const isMatchAll = keys.every(k => 
            item.nMa.includes(k) || 
            item.nTen.includes(k) || 
            item.nMaDBHC.includes(k)
        );
        
        if (!isMatchAll) continue;

        // 2. TÍNH ĐIỂM XẾP HẠNG
        let score = 0;

        if (item.ma === keyword) score += 2000;
        else if (item.ma.includes(keyword)) score += 900;
        
        if (item.maDBHC === keyword) score += 1500;
        else if (item.maDBHC.includes(keyword)) score += 700;

        if (item.nTen === q) score += 1000;        
        if (item.nTen.includes(q)) score += 800;   

        keys.forEach(k => {
            const paddedN = " " + item.nTen + " ";
            const paddedK = " " + k + " ";
            if (paddedN.includes(paddedK)) score += 50; 
            else if (item.nTen.includes(k)) score += 20;      
        });

        if (score > 0) {
            // Trả về định dạng { line, score } để khớp với hàm render hiện tại
            results.push({ line: item.originalLine, score: score });
        }
    }

    results.sort((a, b) => b.score - a.score);
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

    if (currentFile === "dbhc.txt") {
        results = searchDBHC(keyword);
    } else if (currentFile === "madbhcdonvi.txt") {
        results = searchDVSDNS(keyword); 
    } else {
        results = searchNormal(keyword);
    }

    lastResult = results;

    const highlightKeys = keyword.split(" ").filter(k => k.trim() !== "");

    results.forEach(obj => {
        const cols = obj.line.split(/\t| {2,}/);
        const tr = document.createElement("tr");

        cols.forEach(col => {
            let html = col;

            highlightKeys.forEach(k => {
                if (k.length > 0) {
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
