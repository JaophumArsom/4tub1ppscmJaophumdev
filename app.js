// ============================================================
// ระบบเก็บเงินห้องเรียนออนไลน์ - Main Application Logic
// Firebase Realtime Database (shared data across all browsers)
// ============================================================

// ==================== FIREBASE CONFIG ====================
// ⚠️ ใส่ Firebase config ของคุณตรงนี้เพื่อให้ข้อมูลเป็นข้อมูลเดียวกันทุกเครื่อง
// ไปที่ https://console.firebase.google.com → สร้างโปรเจกต์ → Realtime Database → Copy config
const firebaseConfig = {
  apiKey: "AIzaSyB9AMGsaEhRqrZ-gZBlD8Ku3b84RvslufI",
  authDomain: "tub1money.firebaseapp.com",
  databaseURL: "https://tub1money-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tub1money",
  storageBucket: "tub1money.firebasestorage.app",
  messagingSenderId: "493848795659",
  appId: "1:493848795659:web:9871ae7dd5fcbef2fec50e",
  measurementId: "G-8WCXBLN8V0"
};


// เช็คว่า config เป็นจริงหรือยังเป็น placeholder
const FIREBASE_READY = !FIREBASE_CONFIG.apiKey.includes("YOUR_");

let db = null;
if (FIREBASE_READY) {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
} else {
    console.warn("⚠️ Firebase config ยังไม่ได้ตั้งค่า — ใช้ localStorage แทน (ข้อมูลจะไม่ sync ข้ามเครื่อง)");
}

// ==================== LOCALSTORAGE FALLBACK ====================
const LS = {
    KEYS: { STUDENTS: 'classroom_students', SETTINGS: 'classroom_settings', ROUNDS: 'classroom_rounds', QR_IMAGE: 'classroom_qr_image' },
    get(k) { const d = localStorage.getItem(k); return d ? JSON.parse(d) : null; },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
    remove(k) { localStorage.removeItem(k); },
};

// ==================== DATABASE LAYER (Firebase + localStorage fallback) ====================
const DB = {
    // --- Students ---
    getStudents() {
        if (FIREBASE_READY) {
            return db.ref('students').once('value').then(snap => { const v = snap.val(); return v ? Object.values(v) : []; });
        }
        return Promise.resolve(LS.get(LS.KEYS.STUDENTS) || []);
    },
    saveStudents(students) {
        if (FIREBASE_READY) {
            const obj = {}; students.forEach(s => { obj[s.id] = s; });
            return db.ref('students').set(obj);
        }
        return Promise.resolve(LS.set(LS.KEYS.STUDENTS, students));
    },
    addStudent(student) {
        student.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        student.status = 'unpaid'; student.slipImage = null; student.bankInfo = null; student.paidAt = null; student.customAmount = null;
        if (FIREBASE_READY) return db.ref('students/' + student.id).set(student).then(() => student);
        return this.getStudents().then(list => { list.push(student); LS.set(LS.KEYS.STUDENTS, list); return student; });
    },
    updateStudent(id, updates) {
        if (FIREBASE_READY) return db.ref('students/' + id).update(updates);
        return this.getStudents().then(list => { const i = list.findIndex(s => s.id === id); if (i !== -1) list[i] = { ...list[i], ...updates }; LS.set(LS.KEYS.STUDENTS, list); });
    },
    deleteStudent(id) {
        if (FIREBASE_READY) return db.ref('students/' + id).remove();
        return this.getStudents().then(list => { LS.set(LS.KEYS.STUDENTS, list.filter(s => s.id !== id)); });
    },
    findStudentByLoginId(loginId) {
        return this.getStudents().then(list => list.find(s => s.loginId === loginId));
    },
    findStudentById(id) {
        if (FIREBASE_READY) return db.ref('students/' + id).once('value').then(snap => snap.val());
        return this.getStudents().then(list => list.find(s => s.id === id));
    },

    // --- Settings ---
    getSettings() {
        if (FIREBASE_READY) return db.ref('settings').once('value').then(snap => snap.val() || { amount: 0 });
        return Promise.resolve(LS.get(LS.KEYS.SETTINGS) || { amount: 0 });
    },
    saveSettings(settings) {
        if (FIREBASE_READY) return db.ref('settings').set(settings);
        return Promise.resolve(LS.set(LS.KEYS.SETTINGS, settings));
    },

    // --- QR Image ---
    getQrImage() {
        if (FIREBASE_READY) return db.ref('qrImage').once('value').then(snap => snap.val() || null);
        return Promise.resolve(LS.get(LS.KEYS.QR_IMAGE) || null);
    },
    saveQrImage(base64) {
        if (FIREBASE_READY) return db.ref('qrImage').set(base64);
        return Promise.resolve(LS.set(LS.KEYS.QR_IMAGE, base64));
    },
    removeQrImage() {
        if (FIREBASE_READY) return db.ref('qrImage').remove();
        return Promise.resolve(LS.remove(LS.KEYS.QR_IMAGE));
    },

    // --- Rounds ---
    getRounds() {
        if (FIREBASE_READY) return db.ref('rounds').once('value').then(snap => { const v = snap.val(); return v ? Object.values(v) : []; });
        return Promise.resolve(LS.get(LS.KEYS.ROUNDS) || []);
    },
    saveRounds(rounds) {
        if (FIREBASE_READY) { const obj = {}; rounds.forEach((r, i) => { obj[i] = r; }); return db.ref('rounds').set(obj); }
        return Promise.resolve(LS.set(LS.KEYS.ROUNDS, rounds));
    },
    addRound(round) {
        if (FIREBASE_READY) return this.getRounds().then(list => { list.unshift(round); return this.saveRounds(list); });
        return this.getRounds().then(list => { list.unshift(round); LS.set(LS.KEYS.ROUNDS, list); });
    },
    deleteRound(idx) {
        if (FIREBASE_READY) return this.getRounds().then(list => { list.splice(idx, 1); return this.saveRounds(list); });
        return this.getRounds().then(list => { list.splice(idx, 1); LS.set(LS.KEYS.ROUNDS, list); });
    },

    // --- Stats ---
    getStats() {
        return this.getStudents().then(list => ({
            total: list.length,
            paid: list.filter(s => s.status === 'paid' || s.status === 'cash').length,
            pending: list.filter(s => s.status === 'pending').length,
            unpaid: list.filter(s => s.status === 'unpaid').length,
        }));
    },

    getStudentAmount(student) {
        if (student.customAmount && student.customAmount > 0) return Promise.resolve(student.customAmount);
        return this.getSettings().then(s => s.amount || 0);
    },
};

// ==================== UI HELPERS ====================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const content = document.getElementById('toastContent');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500',
    };
    content.className = `px-6 py-3 rounded-xl shadow-lg text-white font-medium fade-in ${colors[type] || colors.success}`;
    content.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function switchLoginType(type) {
    const tabAdmin = document.getElementById('tabAdmin');
    const tabUser = document.getElementById('tabUser');
    const adminForm = document.getElementById('adminLoginForm');
    const userForm = document.getElementById('userLoginForm');
    const errorDiv = document.getElementById('loginError');
    errorDiv.classList.add('hidden');
    if (type === 'admin') {
        tabAdmin.className = 'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all bg-white shadow text-primary';
        tabUser.className = 'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all text-gray-500 hover:text-gray-700';
        adminForm.classList.remove('hidden');
        userForm.classList.add('hidden');
    } else {
        tabUser.className = 'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all bg-white shadow text-secondary';
        tabAdmin.className = 'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all text-gray-500 hover:text-gray-700';
        userForm.classList.remove('hidden');
        adminForm.classList.add('hidden');
    }
}

function showPage(pageId) {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('adminPage').classList.add('hidden');
    document.getElementById('userPage').classList.add('hidden');
    document.getElementById(pageId).classList.remove('hidden');
}

// ==================== AUTHENTICATION ====================
const ADMIN_CREDENTIALS = {
    username: 'Admin001',
    password: '1234',
};

// Current user stored in memory (not localStorage)
let currentUser = null;

function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        currentUser = { type: 'admin', username: 'Admin001' };
        showToast('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ Admin', 'success');
        showPage('adminPage');
        renderAdminDashboard();
    } else {
        errorDiv.textContent = '❌ ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        errorDiv.classList.remove('hidden');
    }
}

function handleUserLogin(e) {
    e.preventDefault();
    const loginId = document.getElementById('studentId').value.trim();
    const errorDiv = document.getElementById('loginError');
    if (loginId.length !== 5) {
        errorDiv.textContent = '❌ กรุณากรอกเลขประจำตัว 5 หลัก';
        errorDiv.classList.remove('hidden');
        return;
    }
    DB.findStudentByLoginId(loginId).then(student => {
        if (student) {
            currentUser = { type: 'user', studentId: student.id, loginId: loginId };
            showToast(`เข้าสู่ระบบสำเร็จ! สวัสดี ${student.name}`, 'success');
            showPage('userPage');
            renderUserDashboard();
        } else {
            errorDiv.textContent = '❌ ไม่พบเลขประจำตัวนี้ในระบบ กรุณาติดต่อแอดมิน';
            errorDiv.classList.remove('hidden');
        }
    });
}

function logout() {
    currentUser = null;
    showPage('loginPage');
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
    document.getElementById('studentId').value = '';
    document.getElementById('loginError').classList.add('hidden');
    showToast('ออกจากระบบแล้ว', 'info');
}

// ==================== ADMIN DASHBOARD ====================
function renderAdminDashboard() {
    updateStats();
    renderStudentList();
    loadSettingsToForm();
    updateAdminQrPreview();
    renderRoundsTab();
}

function updateStats() {
    DB.getStats().then(stats => {
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statPaid').textContent = stats.paid;
        document.getElementById('statPending').textContent = stats.pending;
        document.getElementById('statUnpaid').textContent = stats.unpaid;
    });
}

function renderStudentList() {
    DB.getStudents().then(students => {
        const tbody = document.getElementById('studentTableBody');
        const emptyDiv = document.getElementById('emptyStudentList');
        const countSpan = document.getElementById('studentCount');
        countSpan.textContent = `${students.length} คน`;
        if (students.length === 0) {
            tbody.innerHTML = '';
            emptyDiv.classList.remove('hidden');
            return;
        }
        emptyDiv.classList.add('hidden');
        tbody.innerHTML = students.map(s => {
            const statusConfig = getStatusConfig(s.status);
            const amount = s.customAmount && s.customAmount > 0 ? s.customAmount : '';
            const amountDisplay = s.customAmount
                ? `<span class="text-primary font-medium">${s.customAmount} ฿</span> <span class="text-xs text-gray-400">(กำหนดเอง)</span>`
                : `<span class="text-gray-500">มาตรฐาน</span>`;
            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4 text-sm font-medium text-gray-800">${s.number}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">${s.name}</td>
                    <td class="px-6 py-4 text-sm text-gray-500 font-mono">${s.loginId}</td>
                    <td class="px-6 py-4 text-sm">${amountDisplay}</td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}">
                            <span class="w-1.5 h-1.5 rounded-full ${statusConfig.dot}"></span>
                            ${statusConfig.label}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        ${s.slipImage ? `
                            <button onclick="openSlipModal('${s.id}')" class="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                ดูสลิป
                            </button>
                        ` : '-'}
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            ${s.status === 'unpaid' ? `<button onclick="openCashModal('${s.id}')" class="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-all">💵 เงินสด</button>` : ''}
                            ${s.status === 'pending' ? `<button onclick="openSlipModal('${s.id}')" class="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-all">🔍 ตรวจสอบ</button>` : ''}
                            <button onclick="openEditAmountModal('${s.id}')" class="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-all" title="กำหนดจำนวนเงิน">💰</button>
                            <button onclick="deleteStudent('${s.id}')" class="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-all" title="ลบ">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    });
}

function getStatusConfig(status) {
    const configs = {
        unpaid: { label: 'ยังไม่จ่าย', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
        pending: { label: 'รอตรวจสอบ', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500 pulse-dot' },
        paid: { label: 'จ่ายแล้ว ✓', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
        cash: { label: 'เงินสด 💵', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    };
    return configs[status] || configs.unpaid;
}

function addStudent(e) {
    e.preventDefault();
    const name = document.getElementById('studentName').value.trim();
    const number = parseInt(document.getElementById('studentNumber').value);
    const loginId = document.getElementById('studentLoginId').value.trim();
    if (loginId.length !== 5) { showToast('❌ เลขประจำตัวต้องเป็น 5 หลัก', 'error'); return; }
    DB.getStudents().then(existing => {
        if (existing.find(s => s.loginId === loginId)) { showToast('❌ เลขประจำตัวนี้มีอยู่ในระบบแล้ว', 'error'); return; }
        if (existing.find(s => s.number === number)) { showToast('❌ เลขที่นี้มีอยู่ในระบบแล้ว', 'error'); return; }
        DB.addStudent({ name, number, loginId }).then(() => {
            showToast(`✅ เพิ่มนักเรียน "${name}" สำเร็จ`, 'success');
            document.getElementById('studentName').value = '';
            document.getElementById('studentNumber').value = '';
            document.getElementById('studentLoginId').value = '';
            renderAdminDashboard();
        });
    });
}

function deleteStudent(id) {
    DB.findStudentById(id).then(student => {
        if (!student) return;
        if (confirm(`ต้องการลบ "${student.name}" ออกจากระบบหรือไม่?`)) {
            DB.deleteStudent(id).then(() => {
                showToast(`ลบ "${student.name}" แล้ว`, 'info');
                renderAdminDashboard();
            });
        }
    });
}

// ==================== ROOM SETTINGS ====================
function saveRoomSettings(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('roomAmount').value);
    if (!amount || amount <= 0) { showToast('❌ กรุณากรอกจำนวนเงิน', 'error'); return; }
    DB.saveSettings({ amount }).then(() => {
        showToast('✅ บันทึกการตั้งค่าสำเร็จ', 'success');
    });
}

function loadSettingsToForm() {
    DB.getSettings().then(settings => {
        document.getElementById('roomAmount').value = settings.amount || '';
    });
}

// ==================== QR IMAGE (Admin Upload) ====================
function handleQrImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('❌ กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error'); return; }
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX = 400;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.8);
            DB.saveQrImage(compressed).then(() => {
                showToast('✅ อัปโหลด QR Code สำเร็จ', 'success');
                updateAdminQrPreview();
            });
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function removeQrImage() {
    DB.removeQrImage().then(() => {
        document.getElementById('qrImageInput').value = '';
        updateAdminQrPreview();
        showToast('ลบ QR Code แล้ว', 'info');
    });
}

function updateAdminQrPreview() {
    DB.getQrImage().then(qrImage => {
        const container = document.getElementById('adminQrImage');
        if (qrImage) {
            container.innerHTML = `<img src="${qrImage}" alt="QR Code" class="w-48 h-48 rounded-lg">`;
        } else {
            container.innerHTML = '<p class="text-gray-400 text-sm p-4">ยังไม่ได้อัปโหลด QR Code</p>';
        }
    });
}

// ==================== EDIT AMOUNT (Per-student) ====================
let editAmountStudentId = null;

function openEditAmountModal(studentId) {
    DB.findStudentById(studentId).then(student => {
        if (!student) return;
        editAmountStudentId = studentId;
        DB.getSettings().then(settings => {
            document.getElementById('editAmountStudentName').textContent = `${student.name} (เลขที่ ${student.number})`;
            document.getElementById('editAmountDefault').textContent = settings.amount || 0;
            document.getElementById('editAmountInput').value = student.customAmount || '';
            document.getElementById('editAmountModal').classList.remove('hidden');
        });
    });
}

function closeEditAmountModal() {
    document.getElementById('editAmountModal').classList.add('hidden');
    editAmountStudentId = null;
}

function saveStudentAmount() {
    if (!editAmountStudentId) return;
    const val = document.getElementById('editAmountInput').value.trim();
    const amount = val ? parseFloat(val) : null;
    if (amount !== null && amount <= 0) { showToast('❌ จำนวนเงินต้องมากกว่า 0', 'error'); return; }
    DB.findStudentById(editAmountStudentId).then(student => {
        DB.updateStudent(editAmountStudentId, { customAmount: amount }).then(() => {
            DB.getSettings().then(s => {
                showToast(`✅ กำหนดจำนวนเงินของ "${student.name}" เป็น ${amount || s.amount} บาท`, 'success');
                closeEditAmountModal();
                renderAdminDashboard();
            });
        });
    });
}

function clearStudentAmount() {
    if (!editAmountStudentId) return;
    DB.findStudentById(editAmountStudentId).then(student => {
        DB.updateStudent(editAmountStudentId, { customAmount: null }).then(() => {
            showToast(`✅ ใช้จำนวนเงินมาตรฐานสำหรับ "${student.name}"`, 'success');
            closeEditAmountModal();
            renderAdminDashboard();
        });
    });
}

// ==================== CASH PAYMENT ====================
let cashModalStudentId = null;

function openCashModal(studentId) {
    DB.findStudentById(studentId).then(student => {
        if (!student) return;
        cashModalStudentId = studentId;
        DB.getSettings().then(settings => {
            const amount = student.customAmount && student.customAmount > 0 ? student.customAmount : (settings.amount || 0);
            document.getElementById('cashModalText').textContent = `ยืนยันว่า "${student.name}" (เลขที่ ${student.number}) จ่ายเงินสด ${amount} บาทภายในห้องเรียนแล้ว`;
            document.getElementById('cashModal').classList.remove('hidden');
        });
    });
}

function closeCashModal() {
    document.getElementById('cashModal').classList.add('hidden');
    cashModalStudentId = null;
}

document.getElementById('confirmCashBtn').addEventListener('click', function() {
    if (!cashModalStudentId) return;
    DB.findStudentById(cashModalStudentId).then(student => {
        if (student) {
            DB.updateStudent(cashModalStudentId, { status: 'cash', paidAt: new Date().toISOString() }).then(() => {
                showToast(`✅ บันทึกการจ่ายเงินสดของ "${student.name}" สำเร็จ`, 'success');
                renderAdminDashboard();
            });
        }
        closeCashModal();
    });
});

// ==================== SLIP MODAL (Admin Review) ====================
let modalStudentId = null;

function openSlipModal(studentId) {
    DB.findStudentById(studentId).then(student => {
        if (!student) return;
        modalStudentId = studentId;
        document.getElementById('modalSlipImg').src = student.slipImage;
        DB.getSettings().then(settings => {
            const amount = student.customAmount && student.customAmount > 0 ? student.customAmount : (settings.amount || 0);
            let infoHtml = `<div class="bg-gray-50 rounded-xl p-4 space-y-2"><p><span class="text-gray-500">จำนวนเงิน:</span> <span class="font-bold text-primary">${amount} บาท</span></p>`;
            if (student.bankInfo) {
                infoHtml += `<p><span class="text-gray-500">ธนาคาร:</span> <span class="font-medium">${student.bankInfo.bankName}</span></p>`;
                infoHtml += `<p><span class="text-gray-500">ชื่อบัญชี:</span> <span class="font-medium">${student.bankInfo.accountName}</span></p>`;
                infoHtml += `<p><span class="text-gray-500">เลขที่บัญชี:</span> <span class="font-medium">${student.bankInfo.accountNumber}</span></p>`;
            }
            infoHtml += `<p><span class="text-gray-500">เวลาโอน:</span> <span class="font-medium">${student.paidAt ? new Date(student.paidAt).toLocaleString('th-TH') : '-'}</span></p></div>`;
            document.getElementById('modalSlipInfo').innerHTML = infoHtml;
            const verifyBtn = document.getElementById('verifyBtn');
            if (student.status === 'paid' || student.status === 'cash') verifyBtn.classList.add('hidden');
            else verifyBtn.classList.remove('hidden');
            document.getElementById('slipModal').classList.remove('hidden');
        });
    });
}

function closeSlipModal() {
    document.getElementById('slipModal').classList.add('hidden');
    modalStudentId = null;
}

function verifyPayment() {
    if (!modalStudentId) return;
    DB.findStudentById(modalStudentId).then(student => {
        if (student) {
            DB.updateStudent(modalStudentId, { status: 'paid' }).then(() => {
                showToast(`✅ ตรวจสอบหลักฐานของ "${student.name}" ผ่าน`, 'success');
                renderAdminDashboard();
            });
        }
        closeSlipModal();
    });
}

// ==================== USER DASHBOARD ====================
function renderUserDashboard() {
    if (!currentUser || currentUser.type !== 'user') return;
    DB.findStudentById(currentUser.studentId).then(student => {
        if (!student) { logout(); return; }
        DB.getQrImage().then(qrImage => {
            DB.getSettings().then(settings => {
                const amount = student.customAmount && student.customAmount > 0 ? student.customAmount : (settings.amount || 0);
                document.getElementById('userDisplayName').textContent = student.name;
                document.getElementById('userDisplayId').textContent = `เลขที่ ${student.number} | รหัส ${student.loginId}`;
                const statusIcon = document.getElementById('statusIcon');
                const statusText = document.getElementById('statusText');
                const statusSubtext = document.getElementById('statusSubtext');
                const paymentSection = document.getElementById('paymentSection');
                const paidInfo = document.getElementById('paidInfo');
                const paidInfoContent = document.getElementById('paidInfoContent');

                if (student.status === 'unpaid') {
                    statusIcon.className = 'w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-red-100';
                    statusIcon.innerHTML = '<svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    statusText.className = 'text-xl font-bold mb-1 text-red-600';
                    statusText.textContent = 'ยังไม่ได้จ่ายเงิน';
                    statusSubtext.textContent = 'กรุณาสแกน QR Code เพื่อโอนเงินหรือจ่ายเงินสดที่ครูประจำชั้น';
                    paymentSection.classList.remove('hidden');
                    paidInfo.classList.add('hidden');
                    if (qrImage) document.getElementById('qrCodeContainer').innerHTML = `<img src="${qrImage}" alt="QR Code" class="w-64 h-64 rounded-xl">`;
                    else document.getElementById('qrCodeContainer').innerHTML = '<p class="text-gray-400 text-sm p-8">แอดมินยังไม่ได้อัปโหลด QR Code</p>';
                    document.getElementById('qrAmount').textContent = amount.toLocaleString();
                } else if (student.status === 'pending') {
                    statusIcon.className = 'w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-yellow-100';
                    statusIcon.innerHTML = '<svg class="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    statusText.className = 'text-xl font-bold mb-1 text-yellow-600';
                    statusText.textContent = 'จ่ายแล้ว (รอตรวจสอบ)';
                    statusSubtext.textContent = 'แอดมินกำลังตรวจสอบหลักฐานการโอนเงินของคุณ กรุณารอสักครู่...';
                    paymentSection.classList.add('hidden');
                    paidInfo.classList.remove('hidden');
                    paidInfoContent.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center"><div class="pulse-dot inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></div><span class="text-yellow-700 font-medium">อยู่ระหว่างการตรวจสอบ</span></div><p class="text-sm text-gray-500 text-center">จำนวน <span class="font-bold text-primary">${amount} บาท</span></p>${student.slipImage ? `<img src="${student.slipImage}" class="w-full rounded-xl mt-3">` : ''}${student.bankInfo ? `<div class="bg-gray-50 rounded-xl p-4 space-y-1 mt-3"><p class="text-sm"><span class="text-gray-500">ธนาคาร:</span> ${student.bankInfo.bankName}</p><p class="text-sm"><span class="text-gray-500">ชื่อบัญชี:</span> ${student.bankInfo.accountName}</p><p class="text-sm"><span class="text-gray-500">เลขที่บัญชี:</span> ${student.bankInfo.accountNumber}</p></div>` : ''}`;
                } else if (student.status === 'paid') {
                    statusIcon.className = 'w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-green-100';
                    statusIcon.innerHTML = '<svg class="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    statusText.className = 'text-xl font-bold mb-1 text-green-600';
                    statusText.textContent = 'จ่ายแล้ว ✓ ผ่านการตรวจสอบ';
                    statusSubtext.textContent = 'ขอบคุณที่ชำระเงิน! แอดมินยืนยันการชำระเงินของคุณแล้ว';
                    paymentSection.classList.add('hidden');
                    paidInfo.classList.remove('hidden');
                    paidInfoContent.innerHTML = `<div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center"><span class="text-green-700 font-medium">✅ ชำระเงินสำเร็จ</span></div><p class="text-sm text-gray-500 text-center">จำนวน <span class="font-bold text-primary">${amount} บาท</span></p>${student.slipImage ? `<img src="${student.slipImage}" class="w-full rounded-xl mt-3">` : ''}${student.bankInfo ? `<div class="bg-gray-50 rounded-xl p-4 space-y-1 mt-3"><p class="text-sm"><span class="text-gray-500">ธนาคาร:</span> ${student.bankInfo.bankName}</p><p class="text-sm"><span class="text-gray-500">ชื่อบัญชี:</span> ${student.bankInfo.accountName}</p><p class="text-sm"><span class="text-gray-500">เลขที่บัญชี:</span> ${student.bankInfo.accountNumber}</p></div>` : ''}`;
                } else if (student.status === 'cash') {
                    statusIcon.className = 'w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-emerald-100';
                    statusIcon.innerHTML = '<svg class="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>';
                    statusText.className = 'text-xl font-bold mb-1 text-emerald-600';
                    statusText.textContent = 'จ่ายเป็นเงินสด 💵';
                    statusSubtext.textContent = 'แอดมินบันทึกว่าคุณจ่ายเงินสดภายในห้องเรียนแล้ว';
                    paymentSection.classList.add('hidden');
                    paidInfo.classList.remove('hidden');
                    paidInfoContent.innerHTML = `<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center"><span class="text-emerald-700 font-medium">💵 จ่ายเป็นเงินสด (แอดมินยืนยันแล้ว)</span></div><p class="text-sm text-gray-500 text-center">จำนวน <span class="font-bold text-primary">${amount} บาท</span></p>`;
                }
            });
        });
    });
}

// ==================== SLIP UPLOAD (User) ====================
let selectedSlipBase64 = null;

function handleSlipSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('❌ กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error'); return; }
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX = 800;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            selectedSlipBase64 = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById('slipPlaceholder').classList.add('hidden');
            document.getElementById('slipPreview').classList.remove('hidden');
            document.getElementById('slipPreviewImg').src = selectedSlipBase64;
            document.getElementById('slipFileName').textContent = file.name;
            document.getElementById('bankInfoForm').classList.remove('hidden');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function uploadSlip(e) {
    e.preventDefault();
    if (!selectedSlipBase64) { showToast('❌ กรุณาเลือกรูปภาพสลิปก่อน', 'error'); return; }
    const bankName = document.getElementById('bankName').value;
    const accountName = document.getElementById('accountName').value.trim();
    const accountNumber = document.getElementById('accountNumber').value.trim();
    if (!bankName || !accountName || !accountNumber) { showToast('❌ กรุณากรอกข้อมูลให้ครบทุกช่อง', 'error'); return; }
    if (!currentUser || currentUser.type !== 'user') return;
    DB.updateStudent(currentUser.studentId, {
        status: 'pending',
        slipImage: selectedSlipBase64,
        bankInfo: { bankName, accountName, accountNumber },
        paidAt: new Date().toISOString(),
    }).then(() => {
        showToast('✅ ส่งหลักฐานการโอนเงินสำเร็จ! รอแอดมินตรวจสอบ', 'success');
        selectedSlipBase64 = null;
        document.getElementById('slipInput').value = '';
        document.getElementById('slipPlaceholder').classList.remove('hidden');
        document.getElementById('slipPreview').classList.add('hidden');
        document.getElementById('bankInfoForm').classList.add('hidden');
        document.getElementById('bankName').value = '';
        document.getElementById('accountName').value = '';
        document.getElementById('accountNumber').value = '';
        renderUserDashboard();
    });
}

// ==================== COLLECTION ROUNDS ====================
function renderRoundsTab() {
    DB.getRounds().then(rounds => {
        const container = document.getElementById('roundsList');
        const emptyDiv = document.getElementById('emptyRounds');
        if (rounds.length === 0) { container.innerHTML = ''; emptyDiv.classList.remove('hidden'); return; }
        emptyDiv.classList.add('hidden');
        container.innerHTML = rounds.map((r, idx) => {
            const date = new Date(r.createdAt).toLocaleString('th-TH');
            const totalAmount = r.students.reduce((sum, s) => sum + (s.amount || 0), 0);
            const paidCount = r.students.filter(s => s.status === 'paid' || s.status === 'cash').length;
            return `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="p-4 flex items-center justify-between">
                        <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors flex-1" onclick="toggleRoundDetail('roundDetail${idx}')">
                            <div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"><span class="text-primary font-bold">${rounds.length - idx}</span></div>
                            <div><h3 class="font-bold text-gray-800">${r.name}</h3><p class="text-xs text-gray-500">${date}</p></div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="text-right mr-2"><p class="text-sm font-bold text-primary">${paidCount}/${r.students.length} คน</p><p class="text-xs text-gray-500">${totalAmount.toLocaleString()} บาท</p></div>
                            <button onclick="deleteRound(${idx})" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="ลบรายการนี้"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                        </div>
                    </div>
                    <div id="roundDetail${idx}" class="hidden border-t border-gray-100 p-4">
                        <div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="px-3 py-2 text-left text-xs text-gray-500">เลขที่</th><th class="px-3 py-2 text-left text-xs text-gray-500">ชื่อ</th><th class="px-3 py-2 text-left text-xs text-gray-500">จำนวนเงิน</th><th class="px-3 py-2 text-left text-xs text-gray-500">สถานะ</th></tr></thead><tbody class="divide-y divide-gray-100">${r.students.map(s => { const sc = getStatusConfig(s.status); return `<tr><td class="px-3 py-2">${s.number}</td><td class="px-3 py-2">${s.name}</td><td class="px-3 py-2">${s.amount} บาท</td><td class="px-3 py-2"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}">${sc.label}</span></td></tr>`; }).join('')}</tbody></table></div>
                    </div>
                </div>
            `;
        }).join('');
    });
}

function toggleRoundDetail(id) {
    document.getElementById(id).classList.toggle('hidden');
}

function deleteRound(idx) {
    DB.getRounds().then(rounds => {
        const r = rounds[idx];
        if (!r) return;
        if (!confirm(`ต้องการลบ "${r.name}" หรือไม่?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
        DB.deleteRound(idx).then(() => {
            showToast(`🗑️ ลบ "${r.name}" แล้ว`, 'info');
            renderRoundsTab();
        });
    });
}

function startNewRound() {
    DB.getStudents().then(students => {
        if (students.length === 0) { showToast('❌ ยังไม่มีรายชื่อนักเรียน', 'error'); return; }
        DB.getRounds().then(rounds => {
            const roundName = `รายการเก็บเงิน ครั้งที่ ${rounds.length + 1}`;
            if (!confirm(`ต้องการสร้าง "${roundName}" หรือไม่?\n\nระบบจะบันทึกสถานะปัจจุบันของนักเรียนทั้งหมดและรีเซ็ตสถานะเป็น "ยังไม่จ่าย" ทั้งหมด`)) return;
            DB.getSettings().then(settings => {
                const roundSnapshot = {
                    name: roundName,
                    createdAt: new Date().toISOString(),
                    students: students.map(s => ({
                        id: s.id, number: s.number, name: s.name, loginId: s.loginId,
                        status: s.status, amount: s.customAmount && s.customAmount > 0 ? s.customAmount : (settings.amount || 0),
                        slipImage: s.slipImage, bankInfo: s.bankInfo, paidAt: s.paidAt,
                    })),
                };
                DB.addRound(roundSnapshot).then(() => {
                    const resetStudents = students.map(s => ({ ...s, status: 'unpaid', slipImage: null, bankInfo: null, paidAt: null }));
                    DB.saveStudents(resetStudents).then(() => {
                        showToast(`✅ สร้าง "${roundName}" สำเร็จ และรีเซ็ตสถานะนักเรียนทั้งหมด`, 'success');
                        renderAdminDashboard();
                    });
                });
            });
        });
    });
}

// ==================== CLEAR ALL DATA ====================
function clearAllData() {
    if (!confirm('⚠️ ต้องการล้างข้อมูลทั้งหมด?\n\nข้อมูลที่จะถูกลบ:\n- รายชื่อนักเรียนทั้งหมด\n- การตั้งค่าบัญชีห้อง\n- หลักฐานการโอนเงินทั้งหมด\n- รายการเก็บเงินทั้งหมด\n- QR Code\n\nการกระทำนี้ไม่สามารถย้อนกลับได้!')) return;
    if (!confirm('ยืนยันอีกครั้ง: ลบข้อมูลทั้งหมดจริงๆ หรือไม่?')) return;
    if (FIREBASE_READY) {
        db.ref().remove().then(() => { currentUser = null; showToast('🗑️ ล้างข้อมูลทั้งหมดเรียบร้อย', 'info'); showPage('loginPage'); });
    } else {
        Object.values(LS.KEYS).forEach(k => localStorage.removeItem(k));
        currentUser = null;
        showToast('🗑️ ล้างข้อมูลทั้งหมดเรียบร้อย', 'info');
        showPage('loginPage');
    }
}

// ==================== INITIALIZATION ====================
function init() {
    const statusEl = document.getElementById('connectionStatus');
    if (FIREBASE_READY) {
        db.ref('.info/connected').on('value', snap => {
            if (statusEl) {
                if (snap.val() === true) {
                    statusEl.className = 'fixed bottom-4 left-4 z-[100] px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1.5';
                    statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500 pulse-dot"></span> ออนไลน์';
                } else {
                    statusEl.className = 'fixed bottom-4 left-4 z-[100] px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1.5';
                    statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> ออฟไลน์';
                }
            }
        });
    } else {
        if (statusEl) {
            statusEl.className = 'fixed bottom-4 left-4 z-[100] px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 flex items-center gap-1.5';
            statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-yellow-500 pulse-dot"></span> ใช้ข้อมูลในเครื่อง';
        }
    }
}

document.addEventListener('DOMContentLoaded', init);
