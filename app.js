// ============================================================
// ระบบเก็บเงินห้องเรียนออนไลน์ - Main Application Logic
// Firebase Realtime Database (shared data across all browsers)
// ============================================================

// ==================== FIREBASE CONFIG ====================
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const FIREBASE_READY = true;

// ==================== LOCALSTORAGE FALLBACK ====================
const LS = {
    KEYS: { STUDENTS: 'classroom_students', SETTINGS: 'classroom_settings', QR_IMAGE: 'classroom_qr_image' },
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
        student.status = 'unpaid'; student.bankInfo = null; student.paidAt = null; student.customAmount = null;
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
        if (FIREBASE_READY) return db.ref('settings').once('value').then(snap => snap.val() || { amount: 0, collectionActive: false });
        return Promise.resolve(LS.get(LS.KEYS.SETTINGS) || { amount: 0, collectionActive: false });
    },
    saveSettings(settings) {
        if (FIREBASE_READY) return db.ref('settings').set(settings);
        return Promise.resolve(LS.set(LS.KEYS.SETTINGS, settings));
    },
    isCollectionActive() {
        return this.getSettings().then(s => !!s.collectionActive);
    },
    setCollectionActive(active) {
        return this.getSettings().then(s => {
            s.collectionActive = active;
            return this.saveSettings(s);
        });
    },

    // --- Slip Image (stored separately from student data) ---
    getSlipImage(studentId) {
        if (FIREBASE_READY) return db.ref('slipImages/' + studentId).once('value').then(snap => snap.val() || null);
        return Promise.resolve(LS.get('slip_' + studentId) || null);
    },
    saveSlipImage(studentId, base64) {
        if (FIREBASE_READY) return db.ref('slipImages/' + studentId).set(base64);
        return Promise.resolve(LS.set('slip_' + studentId, base64));
    },
    removeSlipImage(studentId) {
        if (FIREBASE_READY) return db.ref('slipImages/' + studentId).remove();
        return Promise.resolve(LS.remove('slip_' + studentId));
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

    // --- Stats ---
    getStats() {
        return this.getStudents().then(list => {
            const paid = list.filter(s => s.status === 'paid' || s.status === 'cash');
            const pending = list.filter(s => s.status === 'pending');
            const unpaid = list.filter(s => s.status === 'unpaid');
            return { list, total: list.length, paid: paid.length, pending: pending.length, unpaid: unpaid.length };
        });
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
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-amber-500',
    };
    content.className = `px-5 py-3 rounded-xl card-shadow-lg text-white font-medium fade-in ${colors[type] || colors.success}`;
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
        tabAdmin.className = 'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all bg-white card-shadow text-primary';
        tabUser.className = 'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-gray-600';
        adminForm.classList.remove('hidden');
        userForm.classList.add('hidden');
    } else {
        tabUser.className = 'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all bg-white card-shadow text-secondary';
        tabAdmin.className = 'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-gray-600';
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

let currentUser = null;

function saveSession() {
    if (currentUser) sessionStorage.setItem('classroom_session', JSON.stringify(currentUser));
    else sessionStorage.removeItem('classroom_session');
}

function loadSession() {
    const raw = sessionStorage.getItem('classroom_session');
    if (raw) { try { currentUser = JSON.parse(raw); return true; } catch(e) { sessionStorage.removeItem('classroom_session'); } }
    return false;
}

function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        currentUser = { type: 'admin', username: 'Admin001' };
        saveSession();
        showToast('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ Admin', 'success');
        showPage('adminPage');
        renderAdminDashboard();
        startAdminRealTimeSync();
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
            saveSession();
            showToast(`เข้าสู่ระบบสำเร็จ! สวัสดี ${student.name}`, 'success');
            showPage('userPage');
            renderUserDashboard();
            startUserRealTimeSync();
        } else {
            errorDiv.textContent = '❌ ไม่พบเลขประจำตัวนี้ในระบบ กรุณาติดต่อหัวหน้าห้อง';
            errorDiv.classList.remove('hidden');
        }
    });
}

function logout() {
    stopAllSync();
    currentUser = null;
    saveSession();
    showPage('loginPage');
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
    document.getElementById('studentId').value = '';
    document.getElementById('loginError').classList.add('hidden');
    showToast('ออกจากระบบแล้ว', 'info');
}

// ==================== COLLECTION TOGGLE ====================
function toggleCollection() {
    DB.getSettings().then(settings => {
        const newState = !settings.collectionActive;
        DB.setCollectionActive(newState).then(() => {
            updateCollectionBtn();
            if (newState) {
                showToast('✅ เปิดระบบเรียกเก็บเงินแล้ว — สมาชิกสามารถจ่ายเงินได้', 'success');
            } else {
                showToast('⏸️ ปิดระบบเรียกเก็บเงินแล้ว — สมาชิกจะเห็นข้อความ "ยังไม่มีการเรียกเก็บเงิน"', 'info');
            }
        });
    });
}

function updateCollectionBtn() {
    DB.getSettings().then(settings => {
        const btn = document.getElementById('collectionToggleBtn');
        if (!btn) return;
        if (settings.collectionActive) {
            btn.className = 'px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-1.5 btn-press';
            btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="hidden sm:inline">หยุดเรียกเก็บ</span>`;
        } else {
            btn.className = 'px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all flex items-center gap-1.5 btn-press';
            btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="hidden sm:inline">เริ่มเรียกเก็บเงิน</span>`;
        }
    });
}

// ==================== ADD STUDENT MODE ====================
function switchAddMode(mode) {
    const tabSingle = document.getElementById('tabSingle');
    const tabBatch = document.getElementById('tabBatch');
    const singleForm = document.getElementById('singleAddForm');
    const batchForm = document.getElementById('batchAddForm');
    if (mode === 'single') {
        tabSingle.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition-all bg-white card-shadow text-secondary';
        tabBatch.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition-all text-gray-400 hover:text-gray-600';
        singleForm.classList.remove('hidden');
        batchForm.classList.add('hidden');
    } else {
        tabBatch.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition-all bg-white card-shadow text-blue-500';
        tabSingle.className = 'flex-1 py-2 rounded-lg text-sm font-medium transition-all text-gray-400 hover:text-gray-600';
        batchForm.classList.remove('hidden');
        singleForm.classList.add('hidden');
    }
}

// ==================== ADMIN DASHBOARD ====================
function renderAdminDashboard() {
    updateStats();
    renderStudentList();
    loadSettingsToForm();
    updateAdminQrPreview();
    updateCollectionBtn();
}

function updateStats() {
    DB.getStats().then(stats => {
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statPaid').textContent = stats.paid;
        document.getElementById('statPending').textContent = stats.pending;
        document.getElementById('statUnpaid').textContent = stats.unpaid;
        // Calculate money totals
        DB.getSettings().then(settings => {
            const stdAmount = settings.amount || 0;
            let totalOwed = 0;
            let totalCollected = 0;
            stats.list.forEach(s => {
                const amt = s.customAmount && s.customAmount > 0 ? s.customAmount : stdAmount;
                totalOwed += amt;
                if (s.status === 'paid' || s.status === 'cash') totalCollected += amt;
            });
            document.getElementById('statTotalOwed').textContent = totalOwed.toLocaleString();
            document.getElementById('statTotalCollected').textContent = totalCollected.toLocaleString();
        });
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
        // Sort by number
        students.sort((a, b) => a.number - b.number);
        // Check slip images for all students
        const slipChecks = students.map(s => DB.getSlipImage(s.id).then(img => ({ id: s.id, hasSlip: !!img })));
        Promise.all(slipChecks).then(slipResults => {
            const slipMap = {};
            slipResults.forEach(r => { slipMap[r.id] = r.hasSlip; });
            tbody.innerHTML = students.map(s => {
                const sc = getStatusConfig(s.status);
                const hasSlip = slipMap[s.id];
                const amountDisplay = s.customAmount
                    ? `<span class="text-primary font-semibold">${s.customAmount} ฿</span> <span class="text-[10px] text-gray-400">(กำหนดเอง)</span>`
                    : `<span class="text-gray-400 text-sm">มาตรฐาน</span>`;
                return `
                    <tr class="hover:bg-gray-50/80 transition-colors">
                        <td class="px-6 py-3.5 text-sm font-semibold text-gray-700">${s.number}</td>
                        <td class="px-6 py-3.5 text-sm ${s.name ? 'text-gray-700' : 'text-gray-300 italic'}">${s.name || 'ยังไม่ได้ตั้งชื่อ'}</td>
                        <td class="px-6 py-3.5 text-sm text-gray-400 font-mono">${s.loginId || '—'}</td>
                        <td class="px-6 py-3.5 text-sm">${amountDisplay}</td>
                        <td class="px-6 py-3.5">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}">
                                <span class="w-1.5 h-1.5 rounded-full ${sc.dot}"></span>
                                ${sc.label}
                            </span>
                        </td>
                        <td class="px-6 py-3.5">
                            ${hasSlip ? `
                                <button onclick="openSlipModal('${s.id}')" class="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1 btn-press">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                    ดูสลิป
                                </button>
                            ` : '<span class="text-gray-300 text-sm">—</span>'}
                        </td>
                        <td class="px-6 py-3.5">
                            <div class="flex items-center gap-1.5">
                                ${s.status === 'unpaid' ? `<button onclick="openCashModal('${s.id}')" class="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-all btn-press">💵 เงินสด</button>` : ''}
                                ${s.status === 'pending' ? `<button onclick="openSlipModal('${s.id}')" class="px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-all btn-press">🔍 ตรวจสอบ</button>` : ''}
                                <button onclick="openEditAmountModal('${s.id}')" class="px-2.5 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-100 transition-all btn-press" title="กำหนดจำนวนเงิน">💰</button>
                                <button onclick="openEditStudentModal('${s.id}')" class="px-2.5 py-1.5 bg-sky-50 text-sky-600 rounded-lg text-xs font-medium hover:bg-sky-100 transition-all btn-press" title="แก้ไขชื่อ/เลขประจำตัว">✏️</button>
                                <button onclick="deleteStudent('${s.id}')" class="px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-all btn-press" title="ลบ">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        });
    });
}

function getStatusConfig(status) {
    const configs = {
        unpaid: { label: 'ยังไม่จ่าย', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
        pending: { label: 'รอตรวจสอบ', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400 pulse-dot' },
        paid: { label: 'จ่ายแล้ว ✓', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
        cash: { label: 'เงินสด 💵', bg: 'bg-teal-50', text: 'text-teal-600', dot: 'bg-teal-400' },
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
            showToast(`✅ เพิ่มสมาชิก "${name}" สำเร็จ`, 'success');
            document.getElementById('studentName').value = '';
            document.getElementById('studentNumber').value = '';
            document.getElementById('studentLoginId').value = '';
            renderAdminDashboard();
        });
    });
}

function addBatchStudents(e) {
    e.preventDefault();
    const start = parseInt(document.getElementById('batchStart').value) || 1;
    const end = parseInt(document.getElementById('batchEnd').value) || 40;
    if (start < 1 || end < 1 || start > 99 || end > 99) { showToast('❌ กรุณากรอกเลขที่ 1-99', 'error'); return; }
    if (start > end) { showToast('❌ เลขที่เริ่มต้นต้องน้อยกว่าหรือเท่ากับเลขที่สุดท้าย', 'error'); return; }
    const count = end - start + 1;
    if (count > 99) { showToast('❌ ไม่สามารถสร้างมากกว่า 99 คนพร้อมกัน', 'error'); return; }

    DB.getStudents().then(existing => {
        const usedNumbers = new Set(existing.map(s => s.number));
        const newStudents = [];
        for (let i = start; i <= end; i++) {
            if (usedNumbers.has(i)) { showToast(`❌ เลขที่ ${i} มีอยู่ในระบบแล้ว`, 'error'); return; }
            newStudents.push({ name: '', number: i, loginId: '', status: 'unpaid', bankInfo: null, paidAt: null, customAmount: null });
        }

        // Save all new students
        const savePromises = newStudents.map(s => DB.addStudent(s));
        Promise.all(savePromises).then(() => {
            showToast(`✅ สร้างสมาชิก ${count} คนสำเร็จ (เลขที่ ${start}–${end})`, 'success');
            renderAdminDashboard();
        });
    });
}

function deleteStudent(id) {
    DB.findStudentById(id).then(student => {
        if (!student) return;
        if (confirm(`ต้องการลบ "${student.name}" ออกจากระบบหรือไม่?`)) {
            DB.deleteStudent(id).then(() => {
                return DB.removeSlipImage(id);
            }).then(() => {
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
            container.innerHTML = `<img src="${qrImage}" alt="QR Code" class="w-48 h-48 rounded-xl card-shadow">`;
        } else {
            container.innerHTML = `
                <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                </svg>
                <p class="text-gray-400 text-sm">ยังไม่ได้อัปโหลด QR Code</p>`;
        }
    });
}

// ==================== EDIT STUDENT ====================
let editStudentModalId = null;

function openEditStudentModal(studentId) {
    DB.findStudentById(studentId).then(student => {
        if (!student) return;
        editStudentModalId = studentId;
        document.getElementById('editStuNumber').value = student.number || '';
        document.getElementById('editStuName').value = student.name || '';
        document.getElementById('editStuLoginId').value = student.loginId || '';
        document.getElementById('editStudentModal').classList.remove('hidden');
    });
}

function closeEditStudentModal() {
    document.getElementById('editStudentModal').classList.add('hidden');
    editStudentModalId = null;
}

function saveEditStudent() {
    if (!editStudentModalId) return;
    const number = parseInt(document.getElementById('editStuNumber').value);
    const name = document.getElementById('editStuName').value.trim();
    const loginId = document.getElementById('editStuLoginId').value.trim();
    if (!number || number < 1) { showToast('❌ กรุณากรอกเลขที่ให้ถูกต้อง', 'error'); return; }
    if (loginId && loginId.length !== 5) { showToast('❌ เลขประจำตัวต้องเป็น 5 หลัก', 'error'); return; }

    DB.findStudentById(editStudentModalId).then(current => {
        DB.getStudents().then(existing => {
            // Check duplicate number (excluding self)
            if (existing.find(s => s.number === number && s.id !== editStudentModalId)) {
                showToast(`❌ เลขที่ ${number} มีอยู่ในระบบแล้ว`, 'error'); return;
            }
            // Check duplicate loginId (excluding self)
            if (loginId && existing.find(s => s.loginId === loginId && s.id !== editStudentModalId)) {
                showToast(`❌ เลขประจำตัว ${loginId} มีอยู่ในระบบแล้ว`, 'error'); return;
            }
            DB.updateStudent(editStudentModalId, { number, name, loginId }).then(() => {
                showToast(`✅ แก้ไขข้อมูล "${name || 'ว่าว'}" สำเร็จ`, 'success');
                closeEditStudentModal();
                renderAdminDashboard();
            });
        });
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
        DB.getSlipImage(studentId).then(slipImg => {
            document.getElementById('modalSlipImg').src = slipImg || '';
            DB.getSettings().then(settings => {
                const amount = student.customAmount && student.customAmount > 0 ? student.customAmount : (settings.amount || 0);
                let infoHtml = `<div class="bg-gray-50 rounded-xl p-4 space-y-2"><p><span class="text-gray-400">จำนวนเงิน:</span> <span class="font-bold text-primary">${amount} บาท</span></p>`;
                if (student.bankInfo) {
                    infoHtml += `<p><span class="text-gray-400">ธนาคาร:</span> <span class="font-medium text-gray-700">${student.bankInfo.bankName}</span></p>`;
                    infoHtml += `<p><span class="text-gray-400">ชื่อบัญชี:</span> <span class="font-medium text-gray-700">${student.bankInfo.accountName}</span></p>`;
                }
                infoHtml += `<p><span class="text-gray-400">เวลาโอน:</span> <span class="font-medium text-gray-700">${student.paidAt ? new Date(student.paidAt).toLocaleString('th-TH') : '-'}</span></p></div>`;
                document.getElementById('modalSlipInfo').innerHTML = infoHtml;
                const verifyBtn = document.getElementById('verifyBtn');
                if (student.status === 'paid' || student.status === 'cash') verifyBtn.classList.add('hidden');
                else verifyBtn.classList.remove('hidden');
                document.getElementById('slipModal').classList.remove('hidden');
            });
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

function rejectPayment() {
    if (!modalStudentId) return;
    DB.findStudentById(modalStudentId).then(student => {
        if (!student) { closeSlipModal(); return; }
        if (!confirm(`ยืนยัน: สลิปของ "${student.name}" ไม่ถูกต้อง?\n\nระบบจะ:\n- เปลี่ยนสถานะกลับเป็น "ยังไม่จ่าย"\n- ลบหลักฐานการโอนเงิน\n- แจ้งเตือนให้สมาชิกส่งสลิปใหม่`)) return;
        DB.removeSlipImage(modalStudentId).then(() => {
            return DB.updateStudent(modalStudentId, { status: 'unpaid', bankInfo: null, paidAt: null, slipRejected: true });
        }).then(() => {
            showToast(`❌ แจ้ง "${student.name}" ว่าสลิปไม่ถูกต้อง — กรุณาส่งสลิปใหม่`, 'warning');
            renderAdminDashboard();
            closeSlipModal();
        });
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
                const collectionActive = !!settings.collectionActive;
                document.getElementById('userDisplayName').textContent = student.name || 'สมาชิก';
                document.getElementById('userDisplayId').textContent = `เลขที่ ${student.number} | รหัส ${student.loginId}`;
                const statusIcon = document.getElementById('statusIcon');
                const statusText = document.getElementById('statusText');
                const statusSubtext = document.getElementById('statusSubtext');
                const paymentSection = document.getElementById('paymentSection');
                const paidInfo = document.getElementById('paidInfo');
                const paidInfoContent = document.getElementById('paidInfoContent');

                // If collection not active, show message and hide payment
                if (!collectionActive && student.status === 'unpaid') {
                    statusIcon.className = 'w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-100';
                    statusIcon.innerHTML = '<svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-4-4h-4a4 4 0 00-4 4v10z"/></svg>';
                    statusText.className = 'text-xl font-bold mb-1 text-gray-500';
                    statusText.textContent = 'ยังไม่มีการเรียกเก็บเงิน';
                    statusSubtext.textContent = 'หัวหน้าห้องยังไม่ได้เปิดระบบเรียกเก็บเงิน กรุณารอหัวหน้าห้องแจ้งอีกครั้ง';
                    paymentSection.classList.add('hidden');
                    paidInfo.classList.add('hidden');
                    return;
                }

                if (student.status === 'unpaid') {
                    statusIcon.className = 'w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-red-50';
                    statusIcon.innerHTML = '<svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    statusText.className = 'text-xl font-bold mb-1 text-red-500';
                    statusText.textContent = student.slipRejected ? 'สลิปไม่ถูกต้อง ❌' : 'ยังไม่ได้จ่ายเงิน';
                    statusSubtext.textContent = student.slipRejected ? 'หัวหน้าห้องแจ้งว่าสลิปไม่ถูกต้อง กรุณาส่งสลิปใหม่อีกครั้ง' : 'กรุณาสแกน QR Code เพื่อโอนเงินหรือจ่ายเงินสดที่ครูประจำชั้น';
                    paymentSection.classList.remove('hidden');
                    paidInfo.classList.add('hidden');
                    // Remove old warning if any
                    const oldWarn = paymentSection.querySelector('.slip-reject-warn');
                    if (oldWarn) oldWarn.remove();
                    // Show slip rejected warning
                    if (student.slipRejected) {
                        const warnDiv = document.createElement('div');
                        warnDiv.className = 'slip-reject-warn bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-center fade-in';
                        warnDiv.innerHTML = '<p class="text-red-500 font-medium text-sm">❌ สลิปก่อนหน้าไม่ถูกต้อง กรุณาส่งสลิปใหม่อีกครั้ง</p>';
                        paymentSection.insertBefore(warnDiv, paymentSection.firstChild);
                    }
                    if (qrImage) document.getElementById('qrCodeContainer').innerHTML = `<img src="${qrImage}" alt="QR Code" class="w-56 h-56 rounded-xl card-shadow">`;
                    else document.getElementById('qrCodeContainer').innerHTML = '<p class="text-gray-400 text-sm p-8">แอดมินยังไม่ได้อัปโหลด QR Code</p>';
                    document.getElementById('qrAmount').textContent = amount.toLocaleString();
                } else if (student.status === 'pending') {
                    statusIcon.className = 'w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-amber-50';
                    statusIcon.innerHTML = '<svg class="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    statusText.className = 'text-xl font-bold mb-1 text-amber-500';
                    statusText.textContent = 'จ่ายแล้ว (รอตรวจสอบ)';
                    statusSubtext.textContent = 'แอดมินกำลังตรวจสอบหลักฐานการโอนเงินของคุณ กรุณารอสักครู่...';
                    paymentSection.classList.add('hidden');
                    paidInfo.classList.remove('hidden');
                    DB.getSlipImage(student.id).then(slipImg => {
                        paidInfoContent.innerHTML = `<div class="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center"><div class="pulse-dot inline-block w-2.5 h-2.5 bg-amber-400 rounded-full mr-2"></div><span class="text-amber-600 font-medium text-sm">อยู่ระหว่างการตรวจสอบ</span></div><p class="text-sm text-gray-400 text-center mt-2">จำนวน <span class="font-bold text-primary">${amount} บาท</span></p>${slipImg ? `<img src="${slipImg}" class="w-full rounded-xl mt-3">` : ''}${student.bankInfo ? `<div class="bg-gray-50 rounded-xl p-4 space-y-1 mt-3"><p class="text-sm"><span class="text-gray-400">ธนาคาร:</span> <span class="text-gray-600">${student.bankInfo.bankName}</span></p><p class="text-sm"><span class="text-gray-400">ชื่อบัญชี:</span> <span class="text-gray-600">${student.bankInfo.accountName}</span></p></div>` : ''}`;
                    });
                } else if (student.status === 'paid') {
                    statusIcon.className = 'w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-emerald-50';
                    statusIcon.innerHTML = '<svg class="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    statusText.className = 'text-xl font-bold mb-1 text-emerald-500';
                    statusText.textContent = 'จ่ายแล้ว ✓ ผ่านการตรวจสอบ';
                    statusSubtext.textContent = 'ขอบคุณที่ชำระเงิน! แอดมินยืนยันการชำระเงินของคุณแล้ว';
                    paymentSection.classList.add('hidden');
                    paidInfo.classList.remove('hidden');
                    DB.getSlipImage(student.id).then(slipImg => {
                        paidInfoContent.innerHTML = `<div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center"><span class="text-emerald-600 font-medium text-sm">✅ ชำระเงินสำเร็จ</span></div><p class="text-sm text-gray-400 text-center mt-2">จำนวน <span class="font-bold text-primary">${amount} บาท</span></p>${slipImg ? `<img src="${slipImg}" class="w-full rounded-xl mt-3">` : ''}${student.bankInfo ? `<div class="bg-gray-50 rounded-xl p-4 space-y-1 mt-3"><p class="text-sm"><span class="text-gray-400">ธนาคาร:</span> <span class="text-gray-600">${student.bankInfo.bankName}</span></p><p class="text-sm"><span class="text-gray-400">ชื่อบัญชี:</span> <span class="text-gray-600">${student.bankInfo.accountName}</span></p></div>` : ''}`;
                    });
                } else if (student.status === 'cash') {
                    statusIcon.className = 'w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-teal-50';
                    statusIcon.innerHTML = '<svg class="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>';
                    statusText.className = 'text-xl font-bold mb-1 text-teal-500';
                    statusText.textContent = 'จ่ายเป็นเงินสด 💵';
                    statusSubtext.textContent = 'แอดมินบันทึกว่าคุณจ่ายเงินสดภายในห้องเรียนแล้ว';
                    paymentSection.classList.add('hidden');
                    paidInfo.classList.remove('hidden');
                    paidInfoContent.innerHTML = `<div class="bg-teal-50 border border-teal-100 rounded-xl p-4 text-center"><span class="text-teal-600 font-medium text-sm">💵 จ่ายเป็นเงินสด (แอดมินยืนยันแล้ว)</span></div><p class="text-sm text-gray-400 text-center mt-2">จำนวน <span class="font-bold text-primary">${amount} บาท</span></p>`;
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
    if (!bankName || !accountName) { showToast('❌ กรุณากรอกข้อมูลให้ครบทุกช่อง', 'error'); return; }
    if (!currentUser || currentUser.type !== 'user') return;
    DB.updateStudent(currentUser.studentId, {
        status: 'pending',
        slipRejected: false,
        bankInfo: { bankName, accountName, },
        paidAt: new Date().toISOString(),
    }).then(() => {
        return DB.saveSlipImage(currentUser.studentId, selectedSlipBase64);
    }).then(() => {
        showToast('✅ ส่งหลักฐานการโอนเงินสำเร็จ! รอแอดมินตรวจสอบ', 'success');
        selectedSlipBase64 = null;
        document.getElementById('slipInput').value = '';
        document.getElementById('slipPlaceholder').classList.remove('hidden');
        document.getElementById('slipPreview').classList.add('hidden');
        document.getElementById('bankInfoForm').classList.add('hidden');
        document.getElementById('bankName').value = '';
        document.getElementById('accountName').value = '';
        renderUserDashboard();
    });
}

// ==================== JSON EDITOR ====================
function openJsonEditor() {
    DB.getStudents().then(students => {
        const textarea = document.getElementById('jsonEditorArea');
        textarea.value = JSON.stringify(students, null, 2);
        document.getElementById('jsonError').classList.add('hidden');
        document.getElementById('jsonModal').classList.remove('hidden');
    });
}

function closeJsonEditor() {
    document.getElementById('jsonModal').classList.add('hidden');
}

function saveJsonData() {
    const textarea = document.getElementById('jsonEditorArea');
    const errorDiv = document.getElementById('jsonError');
    let data;
    try {
        data = JSON.parse(textarea.value);
    } catch (e) {
        errorDiv.textContent = '❌ JSON ไม่ถูกต้อง: ' + e.message;
        errorDiv.classList.remove('hidden');
        return;
    }
    if (!Array.isArray(data)) {
        errorDiv.textContent = '❌ ข้อมูลต้องเป็น Array [...]';
        errorDiv.classList.remove('hidden');
        return;
    }
    // Validate each item has required fields
    for (let i = 0; i < data.length; i++) {
        const s = data[i];
        if (!s.id || !s.name || !s.loginId) {
            errorDiv.textContent = `❌ ข้อมูลลำดับ ${i + 1} ขาดฟิลด์จำเป็น (id, name, loginId)`;
            errorDiv.classList.remove('hidden');
            return;
        }
        // Ensure all fields exist with defaults
        s.status = s.status || 'unpaid';
        s.number = s.number || 0;
        s.bankInfo = s.bankInfo || null;
        s.paidAt = s.paidAt || null;
        s.customAmount = s.customAmount || null;
    }
    DB.saveStudents(data).then(() => {
        showToast(`✅ บันทึกข้อมูลสำเร็จ (${data.length} คน)`, 'success');
        closeJsonEditor();
        renderAdminDashboard();
    }).catch(err => {
        errorDiv.textContent = '❌ บันทึกไม่สำเร็จ: ' + err.message;
        errorDiv.classList.remove('hidden');
    });
}

function downloadJson() {
    const textarea = document.getElementById('jsonEditorArea');
    const blob = new Blob([textarea.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'classroom_students_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== RESET PAYMENTS ====================
function resetAllPayments() {
    document.getElementById('resetModal').classList.remove('hidden');
}

function closeResetModal() {
    document.getElementById('resetModal').classList.add('hidden');
}

function confirmResetPayments() {
    DB.getStudents().then(students => {
        if (students.length === 0) {
            showToast('❌ ยังไม่มีรายชื่อสมาชิก', 'error');
            closeResetModal();
            return;
        }
        const resetStudents = students.map(s => ({
            ...s,
            status: 'unpaid',
            bankInfo: null,
            paidAt: null,
        }));
        DB.saveStudents(resetStudents).then(() => {
            // Remove all slip images
            const slipRemovals = students.map(s => DB.removeSlipImage(s.id));
            return Promise.all(slipRemovals);
        }).then(() => {
            showToast('🔄 รีเซตการเก็บเงินสำเร็จ! สมาชิกทุ้งคนถูกรีเซ็ตเป็น "ยังไม่จ่าย"', 'success');
            closeResetModal();
            renderAdminDashboard();
        });
    });
}

// ==================== CLEAR ALL DATA ====================
function clearAllData() {
    if (!confirm('⚠️ ต้องการล้างข้อมูลทั้งหมด?\n\nข้อมูลที่จะถูกลบ:\n- รายชื่อสมาชิกทั้งหมด\n- การตั้งค่าบัญชีห้อง\n- หลักฐานการโอนเงินทั้งหมด\n- QR Code\n\nการกระทำนี้ไม่สามารถย้อนกลับได้!')) return;
    if (!confirm('ยืนยันอีกครั้ง: ลบข้อมูลทั้งหมดจริงๆ หรือไม่?')) return;
    if (FIREBASE_READY) {
        db.ref().remove().then(() => { currentUser = null; saveSession(); showToast('🗑️ ล้างข้อมูลทั้งหมดเรียบร้อย', 'info'); showPage('loginPage'); });
        // Also clear localStorage slip images
        Object.keys(localStorage).forEach(k => { if (k.startsWith('slip_')) localStorage.removeItem(k); });
    } else {
        Object.values(LS.KEYS).forEach(k => localStorage.removeItem(k));
        currentUser = null;
        saveSession();
        showToast('🗑️ ล้างข้อมูลทั้งหมดเรียบร้อย', 'info');
        showPage('loginPage');
    }
}


// ==================== AUTO-REFRESH & MANUAL REFRESH SYSTEM ====================
let adminListener = null;
let adminSettingsListener = null;
let userStudentListener = null;
let userSettingsListener = null;
let pollingInterval = null;

function updateLastRefreshTime() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');
    const text = hh + ':' + mm + ':' + ss;
    const el1 = document.getElementById('lastRefreshTime');
    const el2 = document.getElementById('lastRefreshTimeUser');
    if (el1) el1.textContent = text;
    if (el2) el2.textContent = text;
}

function animateRefreshIcon() {
    ['refreshIcon', 'refreshIconUser'].forEach(function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('spin');
        void el.offsetWidth;
        el.classList.add('spin');
        setTimeout(function() { el.classList.remove('spin'); }, 650);
    });
}

function manualRefresh() {
    const btn1 = document.getElementById('manualRefreshBtn');
    const btn2 = document.getElementById('manualRefreshBtnUser');
    [btn1, btn2].forEach(function(b) { if (b) b.disabled = true; });
    animateRefreshIcon();
    let task;
    if (currentUser && currentUser.type === 'admin') task = renderAdminDashboard();
    else if (currentUser && currentUser.type === 'user') task = renderUserDashboard();
    else task = Promise.resolve();
    Promise.resolve(task).then(function() {
        updateLastRefreshTime();
        showToast('🔄 รีเฟรชข้อมูลแล้ว', 'info');
    }).catch(function() {}).finally(function() {
        setTimeout(function() {
            [btn1, btn2].forEach(function(b) { if (b) b.disabled = false; });
        }, 800);
    });
}

function startAdminRealTimeSync() {
    stopAllSync();
    if (!FIREBASE_READY) { startPolling(); return; }
    adminListener = db.ref('students').on('value', function() {
        if (currentUser && currentUser.type === 'admin') { renderAdminDashboard(); updateLastRefreshTime(); }
    });
    adminSettingsListener = db.ref('settings').on('value', function() {
        if (currentUser && currentUser.type === 'admin') { updateCollectionBtn(); updateStats(); updateLastRefreshTime(); }
    });
}

function startUserRealTimeSync() {
    stopAllSync();
    if (!FIREBASE_READY || !currentUser) { startPolling(); return; }
    userStudentListener = db.ref('students/' + currentUser.studentId).on('value', function() {
        if (currentUser && currentUser.type === 'user') { renderUserDashboard(); updateLastRefreshTime(); }
    });
    userSettingsListener = db.ref('settings').on('value', function() {
        if (currentUser && currentUser.type === 'user') { renderUserDashboard(); updateLastRefreshTime(); }
    });
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(function() {
        if (!currentUser) return;
        if (currentUser.type === 'admin') renderAdminDashboard();
        else if (currentUser.type === 'user') renderUserDashboard();
        updateLastRefreshTime();
    }, 30000);
}

function stopAllSync() {
    if (adminListener) { db.ref('students').off('value', adminListener); adminListener = null; }
    if (adminSettingsListener) { db.ref('settings').off('value', adminSettingsListener); adminSettingsListener = null; }
    if (userStudentListener && currentUser) { db.ref('students/' + currentUser.studentId).off('value', userStudentListener); userStudentListener = null; }
    if (userSettingsListener) { db.ref('settings').off('value', userSettingsListener); userSettingsListener = null; }
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
}

// ==================== INITIALIZATION ====================
function init() {
    if (loadSession()) {
        if (currentUser.type === 'admin') {
            showPage('adminPage');
            renderAdminDashboard();
            startAdminRealTimeSync();
            updateLastRefreshTime();
        } else if (currentUser.type === 'user') {
            showPage('userPage');
            renderUserDashboard();
            startUserRealTimeSync();
            updateLastRefreshTime();
        }
    }

    const statusEl = document.getElementById('connectionStatus');
    if (FIREBASE_READY) {
        db.ref('.info/connected').on('value', function(snap) {
            if (statusEl) {
                if (snap.val() === true) {
                    statusEl.className = 'fixed bottom-4 left-4 z-[100] px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 flex items-center gap-1.5 card-shadow';
                    statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span> ออนไลน์';
                } else {
                    statusEl.className = 'fixed bottom-4 left-4 z-[100] px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-500 flex items-center gap-1.5 card-shadow';
                    statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400"></span> ออฟไลน์';
                }
            }
        });
    } else {
        if (statusEl) {
            statusEl.className = 'fixed bottom-4 left-4 z-[100] px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 flex items-center gap-1.5 card-shadow';
            statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 pulse-dot"></span> ใช้ข้อมูลในเครื่อง';
        }
    }
}

document.addEventListener('DOMContentLoaded', init);