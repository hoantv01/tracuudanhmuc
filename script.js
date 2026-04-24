/* =========================================
   CÁC BIẾN TOÀN CỤC & QUẢN LÝ PHIÊN BẢN
========================================= */
// QUAN TRỌNG: Khi bạn cập nhật file madbhcdonvi.txt trên GitHub, 
// hãy tăng số này lên (ví dụ: 2, 3, 4...) để máy người dùng tự động tải file mới.
const DATA_VERSION = 1; 

let rawData = [];
let parsedDVSDNS = []; 
let currentFile = "dbhc.txt";
let lastResult = [];

// Trạng thái hệ thống
let isDVSDNSReady = false;
let isDVSDNSLoading = false;

const input = document.getElementById("searchInput");
const tbody = document.getElementById("results");
const thead = document.getElementById("table-head");
const tabs = document.querySelectorAll(".tab");

/* =========================================
   1. CHUẨN HÓA TIẾNG VIỆT
========================================= */
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

/* =========================================
   2. HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU INDEXEDDB
========================================= */
const DB_NAME = "KBNN_Lookup_DB";
const STORE_NAME = "DVSDNS_Store";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DATA_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Nếu có phiên bản mới, xóa kho cũ đi tạo lại
            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }
            db.createObjectStore(STORE_NAME);
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function saveToDB(data) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            store.put(data, "parsedDataKey");
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        });
    });
}

function loadFromDB() {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get("parsedDataKey");
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    });
}

/* =========================================
   3. TẢI NGẦM DỮ LIỆU ĐVSDNS THÔNG MINH
========================================= */
async function preloadDVSDNS() {
    if (isDVSDNSLoading || isDVSDNSReady) return;
    isDVSDNSLoading = true;

    try {
        // BƯỚC 1: Tìm trong ổ đĩa ảo (IndexedDB) trước
        const cachedData = await loadFromDB();
        
        if (cachedData && cachedData.length > 0) {
            console.log("✅ Đã lấy dữ liệu từ IndexedDB (Không tốn mạng). Tốc độ 0.1s");
            parsedDVSDNS = cachedData;
            isDVSDNSReady = true;
            unlockInputIfNeeded();
            return;
        }

        // BƯỚC 2: Nếu chưa có (mới vào lần đầu hoặc mới update version), bắt đầu tải từ GitHub
        console.log("⬇️ Không có sẵn cache. Bắt đầu kéo file 20MB từ máy chủ...");
        Papa.parse("data/madbhcdonvi.txt", {
            download: true,
            delimiter: "\t",
            worker: true,
            skipEmptyLines: true,
            complete: async function(results) {
                // Tiền xử lý dữ liệu
                parsedDVSDNS = results.data.map(cols => {
                    const ma = cols[0] ? cols[0].trim().toLowerCase() : "";
                    const ten = cols[1] ? cols[1].trim() : "";
                    const maDBHC = cols[2] ? cols[2].trim().toLowerCase() : "";
                    return {
                        ma: ma,
                        maDBHC: maDBHC,
                        nTen: normalize(ten),
                        originalLine: `${cols[0] || ""}\t${cols[1] || ""}\t${cols[2] || ""}`
                    };
                });

                isDVSDNSReady = true;
                unlockInputIfNeeded();

                // Lưu vào IndexedDB để dùng cho các lần mở trình duyệt sau
                try {
                    await saveToDB(parsedDVSDNS);
                    console.log("💾 Đã lưu 400.000 dòng vào IndexedDB trình duyệt thành công!");
                } catch (dbErr) {
                    console.error("Lỗi khi lưu vào IndexedDB: ", dbErr);
                }
            },
            error: function(err) {
                console.error("Lỗi tải PapaParse:", err);
                if (currentFile === "madbhcdonvi.txt") {
                    input.placeholder = "Lỗi tải dữ liệu. Vui lòng F5 tải lại trang.";
                }
            }
        });
    } catch (error) {
        console.error("Lỗi hệ thống lưu trữ:", error);
    }
}

// Mở khóa input nếu người dùng đang đứng ở tab ĐVSDNS chờ đợi
function unlockInputIfNeeded() {
    if (currentFile === "madbhcdonvi.txt") {
        input.disabled = false;
        input.placeholder = "Nhập Mã hoặc Tên ĐVSDNS để tra cứu...";
        input.focus();
    }
}

// KÍCH HOẠT QUY TRÌNH KHI MỞ WEB
preloadDVSDNS();

/* =========================================
   4. CHUYỂN TAB VÀ TẢI FILE NHỎ
========================================= */
async function loadFile(file) {
    input.value = "";
    tbody.innerHTML = "";
    rawData = [];

    buildHeader(file);

    if (file === "madbhcdonvi.txt") {
        if (isDVSDNSReady) {
            input.disabled = false;
            input.placeholder = "Nhập Mã hoặc Tên ĐVSDNS để tra cứu...";
            input.focus();
        } else {
            input.disabled = true;
            input.placeholder = "Hệ thống đang nạp dữ liệu lần đầu (có thể mất vài giây)...";
        }
    } else {
        input.disabled = false;
        input.placeholder = "Nhập từ khóa tìm kiếm...";
        try {
            const res = await fetch("data/" + file);
            if (!res.ok) throw new Error("File not found");
            const text = await res.text();
            rawData = text.split(/\r?\n/).filter(x => x.trim());
        } catch (err) {
            input.placeholder = "Lỗi: Không tìm thấy file " + file;
        }
    }
}

loadFile(currentFile);

/* =========================================
   5. RENDER HEADER BẢNG
========================================= */
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

/* =========================================
   6. CÁC HÀM TRA CỨU
========================================= */
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
        if (nTen === q) score += 1000;
        if (nTen.includes(q)) score += 800;
        if (full.includes(q)) score += 600;

        const tenWords = nTen.split(" ");
        if (keys.length === tenWords.length) {
            const a = [...keys].sort().join(" ");
            const b = [...tenWords].sort().join(" ");
            if (a === b) score += 300;
        }

        keys.forEach(k => {
            if (nTen.includes(k)) score += 80;
            if (nTinh.includes(k)) score += 40;
        });

        if (ma.includes(keyword)) score += 900;
        if (score > 0) results.push({ line, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
}

function searchNormal(keyword) {
    const q = normalize(keyword);
    const keys = q.split(" ").filter(k => k.trim() !== "");
    let results = [];

    for (let line of rawData) {
        const n = normalize(line);
        const isMatchAll = keys.every(k => n.includes(k));
        if (!isMatchAll) continue; 

        let score = 0;
        if (n.includes(q)) score += 1000; 

        keys.forEach(k => {
            const paddedN = " " + n + " ";
            const paddedK = " " + k + " ";
            if (paddedN.includes(paddedK)) score += 50; 
            else score += 20; 
        });
        results.push({ line, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 50);
}

function searchDVSDNS(keyword) {
    const q = normalize(keyword);
    const keys = q.split(" ").filter(k => k.trim() !== "");
    const qLower = keyword.trim().toLowerCase();
    let results = [];

    for (let i = 0; i < parsedDVSDNS.length; i++) {
        const item = parsedDVSDNS[i];

        const isMatchAll = keys.every(k => 
            item.ma.includes(k) || 
            item.nTen.includes(k) || 
            item.maDBHC.includes(k)
        );
        
        if (!isMatchAll) continue;

        let score = 0;

        if (item.ma === qLower) score += 2000;
        else if (item.ma.includes(qLower)) score += 900;
        
        if (item.maDBHC === qLower) score += 1500;
        else if (item.maDBHC.includes(qLower)) score += 700;

        if (item.nTen === q) score += 1000;        
        if (item.nTen.includes(q)) score += 800;   

        keys.forEach(k => {
            const paddedN = " " + item.nTen + " ";
            const paddedK = " " + k + " ";
            if (paddedN.includes(paddedK)) score += 50; 
            else if (item.nTen.includes(k)) score += 20;      
        });

        if (score > 0) {
            results.push({ line: item.originalLine, score: score });
        }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 50);
}

/* =========================================
   7. SỰ KIỆN TÌM KIẾM
========================================= */
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
            navigator.clipboard.writeText(cols[0])
                .then(() => alert("Đã copy: " + cols[0]))
                .catch(err => console.error("Lỗi copy: ", err));
        };
        tr.style.cursor = "pointer";
        
        tbody.appendChild(tr);
    });
});

/* =========================================
   8. SỰ KIỆN CHUYỂN TAB
========================================= */
tabs.forEach(tab => {
    tab.onclick = () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentFile = tab.dataset.file.trim(); 
        loadFile(currentFile);
    };
});
