// Configuração do Firebase
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(e => console.log('SW erro:', e)); }); }

const firebaseConfig = {
  apiKey: "AIzaSyAsqcLzCS-ni-H13LPq4u_UyahuEVzszw8",
  authDomain: "sesi-2e0fc.firebaseapp.com",
  projectId: "sesi-2e0fc",
  storageBucket: "sesi-2e0fc.firebasestorage.app",
  messagingSenderId: "594607525814",
  appId: "1:594607525814:web:cad6cfdcc32004ce8afb17",
  measurementId: "G-VHFT3KG29N",
  databaseURL: "https://sesi-2e0fc-default-rtdb.firebaseio.com"
};

// Inicializar Firebase de forma segura
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const auth = firebase.auth();

// Proteção de Autenticação — login.html é a única página pública
if (!window.location.pathname.endsWith('login.html')) {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.replace('login.html');
        } else {
            injectUserAvatar(user);
        }
    });
}

function injectUserAvatar(user) {
    if (document.getElementById('user-avatar-widget')) return;

    // Pegar iniciais do email
    const initials = (user.email || '?').substring(0, 2).toUpperCase();
    const emailShort = user.email.length > 22 ? user.email.substring(0, 22) + '…' : user.email;

    const style = document.createElement('style');
    style.textContent = `
        #user-avatar-widget {
            position: fixed;
            bottom: 1.5rem;
            right: 1.5rem;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 0.5rem;
        }
        #user-avatar-btn {
            width: 48px; height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1e40af, #10b981);
            color: white;
            font-weight: 700;
            font-size: 1rem;
            font-family: 'Outfit', sans-serif;
            border: 2px solid white;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(30, 64, 175, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s;
            user-select: none;
        }
        #user-avatar-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 25px rgba(30, 64, 175, 0.5);
        }
        #user-avatar-dropdown {
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            border: 1px solid rgba(0,0,0,0.06);
            padding: 1rem;
            min-width: 210px;
            display: none;
            animation: dropup 0.2s ease-out;
        }
        #user-avatar-dropdown.open { display: block; }
        @keyframes dropup {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        #user-avatar-dropdown .avatar-email {
            font-size: 0.75rem;
            color: #64748b;
            font-weight: 500;
            padding: 0 0.25rem 0.75rem;
            border-bottom: 1px solid #f1f5f9;
            margin-bottom: 0.5rem;
            word-break: break-all;
        }
        #user-avatar-dropdown .avatar-email strong {
            display: block;
            font-size: 0.85rem;
            color: #0f172a;
            margin-bottom: 0.1rem;
        }
        #btn-avatar-logout {
            width: 100%;
            background: transparent;
            border: 1px solid rgba(239,68,68,0.3);
            color: #ef4444;
            padding: 0.6rem 1rem;
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 600;
            font-family: 'Outfit', sans-serif;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        #btn-avatar-logout:hover { background: rgba(239,68,68,0.08); }
    `;
    document.head.appendChild(style);

    const widget = document.createElement('div');
    widget.id = 'user-avatar-widget';
    widget.innerHTML = `
        <div id="user-avatar-dropdown">
            <div class="avatar-email">
                <strong>Usuário conectado</strong>
                ${emailShort}
            </div>
            <button id="btn-avatar-logout">
                <span>⎋</span> Sair do Sistema
            </button>
        </div>
        <button id="user-avatar-btn" title="${user.email}">${initials}</button>
    `;
    document.body.appendChild(widget);

    const btn = document.getElementById('user-avatar-btn');
    const dropdown = document.getElementById('user-avatar-dropdown');

    btn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    document.addEventListener('click', () => dropdown.classList.remove('open'));
    document.getElementById('btn-avatar-logout').onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Deseja sair do sistema?\n${user.email}`)) {
            auth.signOut().then(() => window.location.replace('login.html'));
        }
    };
}



// Estado Global
// Estado Local (Não sincronizado globalmente para evitar conflitos entre salas)
let localCurrentRoom = localStorage.getItem('sesi_last_room') || 'Sala 01';

// Estado Global (Sincronizado)
let globalState = { rooms: {} };
let globalLogs = [];
let keysState = { active: {}, history: [] };
let pedState = { referrals: [] };
let psicoState = { queue: [], history: [] };
let atrasosState = { logs: [], alerts: [] };
let saidasState = { history: [] };
let tiState = { tickets: [] };
let agendamentoState = {};
let currentWeekOffset = 0;
let notifiedPsicoCalls = new Set();

const defaultTimeSlots = {
    matutino: ['7:00 às 7:50', '7:50 às 8:40', '8:40 às 9:30', '9:30 às 10:35', '10:35 às 11:25', '11:25 às 12:15'],
    vespertino: ['13:15 às 14:05', '14:05 às 14:55', '14:55 às 15:45', '15:45 às 16:50', '16:50 às 17:40', '17:40 às 18:30']
};

let sysConfig = { 
    adminPassword: 'MateusSesi', 
    rooms: ['Sala 01', 'Sala 02', 'Sala 03', 'Sala 04', 'Sala 05', 'Sala 06', 'Sala 07', 'Sala 08', 'Sala 09', 'Sala 10', 'Sala 11', 'Sala 12', 'Sala 13', 'Sala 14'],
    supervisors: { 'claudia': 'Claudia', 'suelma': 'Suelma', 'indhyanne': 'Indhyanne', 'katia': 'Katia' },
    psychologists: {},
    timeSlots: defaultTimeSlots
};

const safeGet = (id) => document.getElementById(id);

// --- Tratamento de Erros Silencioso ---
function safeRun(fn) { try { fn(); } catch (err) { console.error("Erro interno:", err); } }
function safeRender(id, fn) { const el = safeGet(id); if (el) { try { fn(el); } catch (e) { console.error(`Falha no ${id}:`, e); } } }
function safeBind(id, event, fn) { const el = safeGet(id); if (el) { el[event] = (...args) => { try { fn(...args); } catch(e) { console.error(`Erro ${id}:`, e); alert('Erro ao processar ação.'); } }; } }

// --- Autenticação ---
function showAuthModal(title, desc, onConfirm) {
    let m = safeGet('global-auth-modal');
    if (!m) {
        m = document.createElement('div'); m.id = 'global-auth-modal'; m.className = 'modal';
        m.innerHTML = `<div class="modal-content glass" style="max-width: 350px;"><h3 id="auth-modal-title" style="color:var(--primary); margin-bottom:0.5rem;"></h3><p id="auth-modal-desc" style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1.5rem;"></p><input type="password" id="auth-modal-pwd" placeholder="••••••••" style="width:100%; margin-bottom:1.5rem; text-align:center; letter-spacing: 0.2em; font-size:1.2rem;"><div class="modal-actions"><button id="auth-modal-cancel" class="btn-secondary">Cancelar</button><button id="auth-modal-confirm" class="btn-primary">Confirmar</button></div></div>`;
        document.body.appendChild(m);
    }
    safeGet('auth-modal-title').innerText = title; safeGet('auth-modal-desc').innerText = desc;
    const inp = safeGet('auth-modal-pwd'); inp.value = ''; m.classList.add('active');
    setTimeout(() => inp.focus(), 100);
    safeGet('auth-modal-cancel').onclick = () => m.classList.remove('active');
    safeGet('auth-modal-confirm').onclick = () => { m.classList.remove('active'); onConfirm(inp.value); };
    inp.onkeyup = (e) => { if(e.key === 'Enter') safeGet('auth-modal-confirm').click(); };
}

function requestAdminAuth(desc, callback) {
    if (sessionStorage.getItem('adminAuth') === 'true') return callback();
    showAuthModal('Acesso Restrito (Admin)', desc || 'Digite a Senha Mestra', (pwd) => {
        if (pwd === sysConfig.adminPassword) { sessionStorage.setItem('adminAuth', 'true'); setTimeout(() => sessionStorage.removeItem('adminAuth'), 7200000); callback(); } else alert('Senha Mestra incorreta!');
    });
}

function requestSuperAuth(desc, callback) {
    if (sessionStorage.getItem('superAuth')) return callback(sessionStorage.getItem('superAuth'));
    showAuthModal('Acesso Restrito (Supervisão)', desc || 'Digite a sua senha de supervisão', (pwd) => {
        const sup = sysConfig.supervisors[pwd?.toLowerCase()];
        if (sup) { sessionStorage.setItem('superAuth', sup); setTimeout(() => sessionStorage.removeItem('superAuth'), 7200000); callback(sup); } else alert('Senha de supervisão incorreta ou não encontrada.');
    });
}

function requestPsicoAuth(desc, callback) {
    if (sessionStorage.getItem('psicoAuth')) return callback(sessionStorage.getItem('psicoAuth'));
    showAuthModal('Acesso Restrito (Psicologia)', desc || 'Digite a sua senha de psicóloga', (pwd) => {
        const p = (sysConfig.psychologists || {})[pwd?.toLowerCase()];
        if (p) { sessionStorage.setItem('psicoAuth', p); setTimeout(() => sessionStorage.removeItem('psicoAuth'), 7200000); callback(p); } else alert('Senha de psicologia incorreta ou não encontrada.');
    });
}

// --- Sincronização em Tempo Real ---

    db.ref('banheiro_saidas_state').on('value', snap => { try { saidasState = snap.val() || { history: [] }; } catch(e) {} });
    db.ref('banheiro_ti_state').on('value', snap => { try { tiState = snap.val() || { tickets: [] }; if(safeGet('list-aberto')) renderTiDashboard(); updateHubStats(); } catch(e) {} });
    db.ref('banheiro_support_logs').on('value', snap => { /* apenas monitorar se necessário */ });
    db.ref('banheiro_agendamento').on('value', snap => { try { agendamentoState = snap.val() || {}; if (safeGet('space-select')) safeRun(renderAgendamento); } catch(e) {} });

db.ref('banheiro_atrasos_state').on('value', (snap) => {
    safeRun(() => {
        const d = snap.val() || { logs: [], alerts: [] };
        atrasosState = d;
        renderAtrasosTable(); renderSupervisaoAtrasosAlerts();
    });
});

const normalizeName = (name) => (name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, ' ');

db.ref('banheiro_config').on('value', (snapshot) => {
    safeRun(() => {
        const data = snapshot.val();
        if (data) {
            sysConfig = {
                ...sysConfig,
                ...data,
                timeSlots: data.timeSlots || sysConfig.timeSlots || defaultTimeSlots
            };
            renderRoomSelector(); renderAdminRooms(); renderAdminSups(); renderAdminPsico();
            if (safeGet('psico-room-select')) {
                safeGet('psico-room-select').innerHTML = '<option value="" disabled selected>Selecione a Sala</option>' + (sysConfig.rooms || []).map(r => `<option value="${r}">${r}</option>`).join('');
            }
            if (safeGet('space-select')) {
                safeRun(renderAgendamento);
            }
        }
    });
});

db.ref('banheiro_multi_state').on('value', (snapshot) => {
    safeRun(() => {
        const data = snapshot.val();
        if (data) {
            // Preservar apenas as salas do estado global, a sala atual é local
            globalState.rooms = data.rooms || {};
            const roomInput = safeGet('room-name');
            if (roomInput) roomInput.value = localCurrentRoom;
            renderStudents(); renderQueue(); renderCurrent();
        }
    });
});

db.ref('banheiro_global_log').on('value', (snapshot) => {
    safeRun(() => {
        const data = snapshot.val();
        globalLogs = data ? Object.values(data) : [];
        renderSupervision(); renderMonitor(); updateHubStats();
    });
});

db.ref('banheiro_keys_state').on('value', (snapshot) => {
    safeRun(() => {
        const data = snapshot.val() || {};
        keysState = { active: data.active || {}, history: data.history || [] };
        renderKeys(); renderMonitor(); updateHubStats();
    });
});

db.ref('banheiro_ped_state').on('value', (snapshot) => {
    safeRun(() => {
        pedState = snapshot.val() || { referrals: [] };
        renderPed(); renderMonitor(); updateHubStats();
    });
});

db.ref('banheiro_psico_state').on('value', (snapshot) => {
    safeRun(() => {
        const val = snapshot.val();
        // Garantir que psicoState sempre tenha a estrutura correta
        psicoState = {
            queue: val && val.queue ? val.queue : [],
            history: val && val.history ? val.history : []
        };
        renderPsicoAlerts();
        if (safeGet('psico-pending-list')) renderPsicoDashboard();
    });
});

// --- Funções Globais (Ações do Usuário) ---

window.addToQueue = function(id) {
    const rs = getRoomState();
    if (!rs.queue) rs.queue = [];
    if (rs.queue.includes(id)) return;
    rs.queue.push(id);
    db.ref('banheiro_multi_state').set(globalState);
};

window.removeFromQueue = function(id) {
    const rs = getRoomState();
    rs.queue = (rs.queue || []).filter(sid => sid !== id);
    db.ref('banheiro_multi_state').set(globalState);
};

window.nextInQueue = function() {
    const rs = getRoomState();
    if (!rs.queue || rs.queue.length === 0) return;
    const nextId = rs.queue.shift();
    rs.currentOccupant = { id: nextId, startTime: Date.now() };
    db.ref('banheiro_multi_state').set(globalState);
};

window.finishTrip = function() {
    const rs = getRoomState();
    if (!rs.currentOccupant) return;
    const s = (rs.students || []).find(x => x.id === rs.currentOccupant.id);
    if (s) {
        s.visits = (s.visits || 0) + 1;
        const ts = Date.now();
        const date = new Date(rs.currentOccupant.startTime);
        const timeInMin = date.getHours() * 60 + date.getMinutes();
        const shift = (timeInMin >= 795 && timeInMin < 1110) ? 'Vespertino' : 'Matutino';
        db.ref('banheiro_global_log').push({
            studentName: s.name, roomName: localCurrentRoom,
            startTime: rs.currentOccupant.startTime, endTime: ts,
            shift: shift, date: new Date().toLocaleDateString('pt-BR'),
            timestamp: ts
        });
    }
    rs.currentOccupant = null;
    db.ref('banheiro_multi_state').set(globalState);
};

window.takeKey = function() {
    const p = safeGet('prof-name')?.value.trim(), l = safeGet('key-select')?.value; 
    if (!p || !l) return alert('Preencha Professor e Local!');
    if (!keysState.active) keysState.active = {};
    if (keysState.active[l]) return alert('Esta chave já está em uso!');
    
    keysState.active[l] = { prof: p, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), timestamp: Date.now() };
    db.ref('banheiro_keys_state').set(keysState)
        .then(() => {
            safeGet('prof-name').value = ''; safeGet('key-select').value = '';
            alert('Chave registrada com sucesso!');
        })
        .catch(err => alert('Erro ao salvar no Firebase: ' + err.message));
};

window.returnKey = function(local) {
    if (!keysState.active[local]) return;
    const d = keysState.active[local];
    keysState.history.push({ 
        local, prof: d.prof, takeTime: d.time, 
        returnTime: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), 
        date: new Date().toLocaleDateString('pt-BR'),
        timestamp: Date.now()
    });
    delete keysState.active[local];
    db.ref('banheiro_keys_state').set(keysState);
};

window.removeStudent = function(id, name) {
    requestAdminAuth(`Excluir permanentemente o aluno "${name}"`, () => {
        const rs = getRoomState();
        rs.students = (rs.students || []).filter(s => s.id !== id);
        rs.queue = (rs.queue || []).filter(sid => sid !== id);
        if (rs.currentOccupant && rs.currentOccupant.id === id) rs.currentOccupant = null;
        db.ref('banheiro_multi_state').set(globalState);
        alert(`Aluno ${name} removido da sala.`);
    });
};

window.attendPed = function(id) {
    requestSuperAuth('Para concluir o atendimento, identifique-se', (sup) => {
        const r = pedState.referrals.find(x => x.id === id);
        if (r && r.status === 'Pendente') {
            r.status = 'Atendido';
            r.attendTime = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            r.supervisor = sup;
            r.attendTimestamp = Date.now();
            db.ref('banheiro_ped_state').set(pedState);
            alert(`Atendimento concluído por ${sup}.`);
        }
    });
};

window.switchTab = function(btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSupervision();
};

window.adminRemoveRoom = function(room) {
    requestAdminAuth(`Remover a ${room}?`, () => { sysConfig.rooms = sysConfig.rooms.filter(r => r !== room); db.ref('banheiro_config').set(sysConfig); });
};
window.adminRemoveSup = function(pass) {
    requestAdminAuth(`Remover esta supervisora?`, () => { delete sysConfig.supervisors[pass]; db.ref('banheiro_config').set(sysConfig); });
};
window.adminRemovePsico = function(pass) {
    requestAdminAuth(`Remover esta psicóloga?`, () => { if(sysConfig.psychologists) { delete sysConfig.psychologists[pass]; db.ref('banheiro_config').set(sysConfig); } });
};

// --- Lógica Interna ---

function getRoomState() {
    if (!globalState.rooms) globalState.rooms = {};
    if (!globalState.rooms[localCurrentRoom]) globalState.rooms[localCurrentRoom] = { students: [], queue: [], currentOccupant: null };
    return globalState.rooms[localCurrentRoom];
}

function renderRoomSelector() {
    safeRender('room-name', (el) => {
        el.innerHTML = sysConfig.rooms.map(r => `<option value="${r}">${r}</option>`).join('');
        el.value = localCurrentRoom;
    });
}

function renderAdminRooms() { safeRender('admin-rooms-list', el => { el.innerHTML = sysConfig.rooms.map(r => `<div class="config-item"><span>${r}</span><button class="btn-icon" onclick="adminRemoveRoom('${r}')">×</button></div>`).join('') || '<p class="empty-msg">Nenhuma sala</p>'; }); }
function renderAdminSups() { safeRender('admin-sups-list', el => { el.innerHTML = Object.entries(sysConfig.supervisors || {}).map(([pass, name]) => `<div class="config-item"><div><strong>${name}</strong> <small style="opacity:0.5">(${pass})</small></div><button class="btn-icon" onclick="adminRemoveSup('${pass}')">×</button></div>`).join('') || '<p class="empty-msg">Nenhuma supervisora</p>'; }); }
function renderAdminPsico() { safeRender('admin-psico-list', el => { el.innerHTML = Object.entries(sysConfig.psychologists || {}).map(([pass, name]) => `<div class="config-item"><div><strong>${name}</strong> <small style="opacity:0.5">(${pass})</small></div><button class="btn-icon" onclick="adminRemovePsico('${pass}')">×</button></div>`).join('') || '<p class="empty-msg">Nenhuma psicóloga</p>'; }); }

function renderStudents() {
    safeRender('student-list', el => {
        const search = safeGet('student-search'), filter = search ? search.value.toLowerCase() : '', rs = getRoomState();
        const filtered = (rs.students || []).filter(s => s.name.toLowerCase().includes(filter));
        if (filtered.length === 0) { el.innerHTML = '<p class="empty-msg">Vazio</p>'; return; }
        el.innerHTML = '';
        filtered.forEach(s => {
            const inQ = (rs.queue || []).includes(s.id), isC = rs.currentOccupant && rs.currentOccupant.id === s.id;
            const div = document.createElement('div'); div.className = 'item student-item';
            div.innerHTML = `<div class="student-info">${createAvatar(s.name)}<div><div class="name">${s.name}</div><div class="count">${s.visits || 0} idas</div></div></div><div style="display:flex;gap:0.5rem;align-items:center;">${(!inQ && !isC) ? `<button class="btn-primary btn-sm" onclick="addToQueue('${s.id}')">Fila</button>` : `<span class="status-tag">${isC ? 'No Banheiro' : 'Na Fila'}</span>`}<button class="btn-icon" style="background:transparent;color:#ef4444;border:1px solid #ef4444;width:28px;height:28px;font-size:1.2rem;" title="Excluir Aluno" onclick="removeStudent('${s.id}', '${s.name}')">×</button></div>`;
            el.appendChild(div);
        });
    });
}

function renderQueue() {
    safeRender('queue-list', el => {
        const rs = getRoomState(); if (!rs.queue || rs.queue.length === 0) { el.innerHTML = '<p class="empty-msg">Vazia</p>'; return; }
        el.innerHTML = '';
        rs.queue.forEach((id, idx) => {
            const s = rs.students.find(x => x.id === id); if (!s) return;
            const div = document.createElement('div'); div.className = 'item queue-item';
            div.innerHTML = `<div class="student-info">${createAvatar(s.name)}<div class="name">${idx+1}. ${s.name}</div></div><button class="btn-icon btn-remove" onclick="removeFromQueue('${id}')">×</button>`;
            el.appendChild(div);
        });
    });
}

function renderCurrent() {
    safeRender('current-occupant', el => {
        const rs = getRoomState();
        if (!rs.currentOccupant) { el.innerHTML = `<div class="empty-state"><p>Livre</p><button class="btn-primary" ${(!rs.queue || rs.queue.length === 0) ? 'disabled' : ''} onclick="nextInQueue()">Chamar</button></div>`; return; }
        const s = rs.students.find(x => x.id === rs.currentOccupant.id);
        if (s) el.innerHTML = `<div class="occupant-card active-occupant">${createAvatar(s.name)}<h3 class="occupant-name">${s.name}</h3><button class="btn-primary" onclick="finishTrip()">Retornou</button></div>`;
    });
}

function renderKeys() {
    safeRender('active-keys-list', el => {
        const ent = Object.entries(keysState.active);
        el.innerHTML = ent.length === 0 ? '<p class="empty-msg">Todas na recepção</p>' : ent.map(([loc, d]) => `<div class="item"><div><div class="name">${loc}</div><div class="count">Prof. ${d.prof}</div></div><button class="btn-action" onclick="returnKey('${loc}')">Devolver</button></div>`).join('');
    });
    safeRender('keys-history-list', el => {
        el.innerHTML = [...keysState.history].reverse().slice(0, 20).map(l => `<tr><td>${l.local}</td><td>${l.prof}</td><td>${l.takeTime}</td><td>${l.returnTime}</td><td>${l.date}</td></tr>`).join('') || '<tr><td colspan="5">Vazio</td></tr>';
    });
}

function renderPed() {
    safeRender('ped-status-list', el => { el.innerHTML = pedState.referrals.slice(-10).reverse().map(r => `<div class="item" style="border-left: 4px solid ${r.status==='Atendido'?'var(--accent)':'var(--warning)'}"><div><div class="name">${r.student}</div><div style="font-size:0.8rem;">${r.status==='Atendido'?`Atendido por ${r.supervisor}`:r.reason}</div></div><span class="status-tag" style="background:${r.status==='Atendido'?'var(--accent)':'var(--warning)'};color:white;">${r.status}</span></div>`).join('') || '<p class="empty-msg">Vazio</p>'; });
    safeRender('coord-pending-list', el => { el.innerHTML = pedState.referrals.filter(r => r.status === 'Pendente').map(r => `<div class="card ped-card"><span class="prof-tag">Prof. ${r.prof}</span><h3>${r.student}</h3><div class="reason-text">"${r.reason}"</div><button class="btn-primary" onclick="attendPed('${r.id}')" style="width:100%">Assinar</button></div>`).join('') || '<p class="empty-msg">Vazio</p>'; });
    safeRender('coord-attended-list', el => { el.innerHTML = pedState.referrals.filter(r => r.status === 'Atendido').reverse().slice(0, 15).map(r => `<tr><td>${r.student}</td><td>${r.prof}</td><td>${r.time} → ${r.attendTime}</td><td>${r.supervisor}</td></tr>`).join('') || '<tr><td colspan="4">Vazio</td></tr>'; });
}

function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
}

function renderPsicoAlerts() {
    safeRender('psico-alerts', el => {
        const room = localCurrentRoom;
        const pending = (psicoState.queue || []).filter(q => q.room === room && q.status === 'Pendente_Liberacao');
        
        let newCall = false;
        pending.forEach(p => {
            if (!notifiedPsicoCalls.has(p.id)) {
                notifiedPsicoCalls.add(p.id);
                newCall = true;
            }
        });
        
        if (newCall) playNotificationSound();

        el.innerHTML = pending.map(p => `
            <div style="background:var(--warning); color:white; padding:1rem; border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
                <div><strong>Atenção:</strong> A Psicologia solicita a liberação imediata de <strong>${p.student}</strong>.</div>
                <button class="btn-primary" style="background:white; color:var(--warning);" onclick="releaseStudentPsico('${p.id}')">Liberar Aluno</button>
            </div>
        `).join('');
    });
}

function renderPsicoDashboard() {
    safeRender('psico-pending-list', el => {
        const queue = psicoState.queue || [];
        el.innerHTML = queue.map(q => {
            const isPendingRelease = q.status === 'Pendente_Liberacao';
            const color = isPendingRelease ? 'var(--text-muted)' : 'var(--warning)';
            return `
                <div class="card" style="border-left:4px solid ${color};">
                    <span class="prof-tag">${q.room}</span>
                    <h3 style="margin-top:0.5rem;">${q.student}</h3>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
                        ${q.type === 'encaminhado_sala' ? `Encaminhado pela sala:<br><i>"${q.reason}"</i>` : 'Chamado pela Psicologia'}
                    </div>
                    ${isPendingRelease 
                        ? `<button class="btn-secondary" disabled style="width:100%">Aguardando Professor Liberar</button>` 
                        : `<button class="btn-primary" onclick="openPsicoAttendModal('${q.id}', '${q.student}')" style="width:100%; background:${color}; border:none;">Atender</button>`}
                </div>
            `;
        }).join('') || '<p class="empty-msg">Fila vazia</p>';
    });

    safeRender('psico-history-list', el => {
        el.innerHTML = (psicoState.history || []).slice().reverse().slice(0, 15).map(h => `
            <tr>
                <td><strong>${h.student}</strong></td>
                <td>${h.room}</td>
                <td>${h.reason}</td>
                <td>${h.psico}</td>
                <td>${h.date} às ${h.time}</td>
            </tr>
        `).join('') || '<tr><td colspan="5">Nenhum atendimento concluído</td></tr>';
    });
}

window.releaseStudentPsico = function(id) {
    const q = (psicoState.queue || []).find(x => x.id === id);
    if (q) {
        q.status = 'Aguardando_Atendimento';
        db.ref('banheiro_psico_state/queue').set(psicoState.queue);
        alert(`Aluno ${q.student} liberado para a Psicologia.`);
    }
};

window.openPsicoAttendModal = function(id, studentName) {
    safeRender('psico-attend-student-name', el => el.innerText = studentName);
    safeGet('modal-psico-attend').classList.add('active');
    safeGet('psico-attend-reason').value = '';
    
    safeGet('btn-psico-cancel-attend').onclick = () => safeGet('modal-psico-attend').classList.remove('active');
    safeGet('btn-psico-confirm-attend').onclick = () => {
        const reason = safeGet('psico-attend-reason').value.trim();
        if (!reason) return alert('Descreva o motivo/resumo do atendimento.');
        requestPsicoAuth('Assinatura do Atendimento', (psicoName) => {
            safeGet('modal-psico-attend').classList.remove('active');
            
            const qIndex = (psicoState.queue || []).findIndex(x => x.id === id);
            if (qIndex > -1) {
                const q = psicoState.queue[qIndex];
                psicoState.queue.splice(qIndex, 1);
                
                if (!psicoState.history) psicoState.history = [];
                psicoState.history.push({
                    id: q.id,
                    student: q.student,
                    room: q.room,
                    reason: reason,
                    psico: psicoName,
                    time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                    date: new Date().toLocaleDateString('pt-BR'),
                    timestamp: Date.now()
                });
                db.ref('banheiro_psico_state').update({
                    queue: psicoState.queue,
                    history: psicoState.history
                });
                alert('Atendimento registrado com sucesso!');
            }
        });
    };
};

function renderSupervision() {
    safeRender('history-list', el => {
        const tabBtn = document.querySelector('.tab-btn.active'), tab = tabBtn ? tabBtn.dataset.shift : 'Todos';
        const filtered = tab === 'Todos' ? globalLogs : globalLogs.filter(l => l.shift === tab);
        el.innerHTML = [...filtered].reverse().map(l => `<tr><td>${l.roomName}</td><td>${l.studentName}</td><td>${new Date(l.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td><td>${l.shift}</td><td>${l.date}</td></tr>`).join('') || '<tr><td colspan="5">Vazio</td></tr>';
    });
}

function renderMonitor() {
    safeRender('global-feed', el => {
        const evs = [];
        const getT = (obj, strDate, strTime) => {
            if (obj.timestamp) return obj.timestamp;
            if (obj.attendTimestamp) return obj.attendTimestamp;
            if (obj.endTime) return obj.endTime;
            if (obj.startTime) return obj.startTime;
            try {
                const parts = strDate.split('/');
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${strTime}`).getTime() || 0;
            } catch(e) { return 0; }
        };

        globalLogs.forEach(l => evs.push({ t: getT(l, l.date, ''), icon: '🏫', type: 'Sala', class: 'type-sala', content: `<strong>${l.studentName}</strong> retornou (${l.roomName}).` }));
        keysState.history.forEach(l => evs.push({ t: getT(l, l.date, l.returnTime), icon: '🔑', type: 'Chaves', class: 'type-chaves', content: `Chave <strong>${l.local}</strong> devolvida por Prof. ${l.prof}.` }));
        pedState.referrals.forEach(r => evs.push({ t: getT(r, r.date, r.attendTime || r.time), icon: '👩‍🏫', type: 'Pedagógico', class: 'type-pedagogico', content: r.status === 'Atendido' ? `Encaminhamento de <strong>${r.student}</strong> atendido.` : `Novo encaminhamento: <strong>${r.student}</strong>.` }));
        (saidasState.history || []).forEach(s => evs.push({ t: s.timestamp, icon: '🏃', type: 'Saída Liberada', class: 'type-saida', content: `<strong>${s.aluno}</strong> (${s.turma}) liberado para ${s.responsavel}. <br><small>Assinado digitalmente por ${s.supervisor}</small>` }));
        (tiState.tickets || []).forEach(t => evs.push({ t: t.timestamp, icon: '💻', type: 'TI', class: 'type-sala', content: `Chamado de <strong>${t.room}</strong>: ${t.problem} (${t.status}).` }));
        
        // Add Psicologia events
        (psicoState.history || []).forEach(h => evs.push({ t: getT(h, h.date, h.time), icon: '🧠', type: 'Psicologia', class: 'type-psicologia', content: `Atendimento de <strong>${h.student}</strong> concluído.` }));
        
        evs.sort((a,b) => (b.t || 0) - (a.t || 0));
        
        el.innerHTML = evs.length === 0 ? '<p class="empty-msg">Nenhuma movimentação ainda</p>' : evs.map(e => `<div class="feed-item"><div class="feed-time">${new Date(e.t || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div><div class="feed-icon">${e.icon}</div><div class="feed-content"><div class="feed-type ${e.class}">${e.type}</div><div class="feed-text">${e.content}</div></div></div>`).join('');
    });
}

function renderTiDashboard() {
    const tickets = (tiState.tickets || []).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const columns = {
        'Aberto': safeGet('list-aberto'),
        'Atendimento': safeGet('list-atendimento'),
        'Finalizado': safeGet('list-finalizado')
    };
    
    // Limpar listas
    Object.values(columns).forEach(el => { if(el) el.innerHTML = ''; });
    
    // Contadores
    const counts = { 'Aberto': 0, 'Atendimento': 0, 'Finalizado': 0 };
    
    tickets.forEach(t => {
        const el = columns[t.status];
        if (!el) return;
        counts[t.status]++;
        
        const elapsedMin = Math.floor((Date.now() - (t.timestamp || Date.now())) / 60000);
        let timeClass = '';
        let elapsedLabel = `${elapsedMin} min`;
        let elapsedClass = '';

        if (t.status !== 'Finalizado') {
            if (elapsedMin > 10) {
                timeClass = 'time-red';
                elapsedClass = 'elapsed-red';
            } else if (elapsedMin > 5) {
                timeClass = 'time-yellow';
                elapsedClass = 'elapsed-yellow';
            } else {
                timeClass = 'time-green';
                elapsedClass = 'elapsed-green';
            }
        }

        const card = document.createElement('div');
        card.className = `ti-card status-${t.status.toLowerCase()} ${timeClass}`;
        
        let actions = '';
        if (t.status === 'Aberto') {
            actions = `<button class="btn-primary btn-sm" onclick="updateTiStatus('${t.id}', 'Atendimento')">Atender</button>`;
        } else if (t.status === 'Atendimento') {
            actions = `<button class="btn-action btn-sm" onclick="updateTiStatus('${t.id}', 'Finalizado')">Finalizar</button>`;
        }
        
        card.innerHTML = `
            <div class="meta">
                <span>${t.room}</span> 
                <span class="time-elapsed ${elapsedClass}">${elapsedLabel}</span>
            </div>
            <h3 style="margin: 0.5rem 0;">${t.problem}</h3>
            <div class="meta"><span>${t.date} às ${t.time}</span></div>
            ${actions ? `<div class="ti-actions">${actions}</div>` : ''}
        `;
        el.appendChild(card);
    });
    
    // Atualizar contadores na UI
    if (safeGet('count-aberto')) safeGet('count-aberto').innerText = counts['Aberto'];
    if (safeGet('count-atendimento')) safeGet('count-atendimento').innerText = counts['Atendimento'];
    if (safeGet('count-finalizado')) safeGet('count-finalizado').innerText = counts['Finalizado'];
}

window.updateTiStatus = function(id, newStatus) {
    const t = tiState.tickets.find(x => x.id === id);
    if (t) {
        t.status = newStatus;
        if (newStatus === 'Finalizado') t.finishTimestamp = Date.now();
        db.ref('banheiro_ti_state').set(tiState);
    }
};

function createAvatar(name) {
    const colors = ['#1e40af', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const color = colors[Math.abs(hash) % colors.length], initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `<div class="avatar" style="background: ${color}">${initials}</div>`;
}

function updateHubStats() {
    safeRun(() => {
        const ban = safeGet('stat-banheiro'), key = safeGet('stat-chaves'), ped = safeGet('stat-ped'), ti = safeGet('stat-ti');
        if (!ban && !key && !ped && !ti) return;
        const today = new Date().toLocaleDateString('pt-BR');
        if (ban) ban.textContent = (globalLogs || []).filter(l => l.date === today).length;
        if (key) key.textContent = Object.keys(keysState.active || {}).length;
        if (ped) ped.textContent = (pedState.referrals || []).filter(r => r.status === 'Pendente').length;
        if (ti) ti.textContent = (tiState.tickets || []).filter(t => t.status === 'Aberto').length;
    });
}

function init() {
    safeBind('btn-admin-login', 'onclick', () => {
        const pass = safeGet('admin-password-input').value;
        if (pass === sysConfig.adminPassword) { safeGet('admin-login').style.display = 'none'; safeGet('admin-main').classList.add('active'); renderAdminRooms(); renderAdminSups(); } 
        else { alert('Senha incorreta!'); }
    });
    safeBind('btn-add-room', 'onclick', () => { const name = safeGet('new-room-input').value.trim(); if (name && !sysConfig.rooms.includes(name)) { sysConfig.rooms.push(name); db.ref('banheiro_config').set(sysConfig); safeGet('new-room-input').value = ''; } });
    safeBind('btn-add-sup', 'onclick', () => { const name = safeGet('new-sup-name').value.trim(), pass = safeGet('new-sup-pass').value.trim().toLowerCase(); if (name && pass) { sysConfig.supervisors[pass] = name; db.ref('banheiro_config').set(sysConfig); safeGet('new-sup-name').value = ''; safeGet('new-sup-pass').value = ''; } });
    safeBind('btn-update-master', 'onclick', () => { const pass = safeGet('new-master-pass').value.trim(); if (pass.length >= 4 && confirm('Alterar Senha Mestra?')) { sysConfig.adminPassword = pass; db.ref('banheiro_config').set(sysConfig); alert('Senha alterada!'); location.reload(); } });

    // Banheiro
    const modal = safeGet('modal-add');
    safeBind('btn-add-student', 'onclick', () => modal?.classList.add('active'));
    safeBind('btn-cancel', 'onclick', () => modal?.classList.remove('active'));
    safeBind('btn-save', 'onclick', () => { const n = safeGet('new-student-name').value.trim(); if (n) { const rs = getRoomState(); if (!rs.students) rs.students = []; rs.students.push({ id: Date.now().toString() + Math.random().toString(36).substr(2,5), name: n, visits: 0 }); db.ref('banheiro_multi_state').set(globalState); modal?.classList.remove('active'); safeGet('new-student-name').value = ''; } });
    if (safeGet('room-name')) { 
        renderRoomSelector(); 
        safeBind('room-name', 'onchange', (e) => { 
            localCurrentRoom = e.target.value; 
            localStorage.setItem('sesi_last_room', localCurrentRoom);
            renderStudents(); renderQueue(); renderCurrent(); renderPsicoAlerts();
        }); 
    }
    safeBind('btn-reset-room', 'onclick', () => { requestAdminAuth('Zerar a sala atual?', () => { if(confirm('Resetar a sala atual? Todos os alunos serão removidos.')) { globalState.rooms[localCurrentRoom] = {students:[], queue:[], currentOccupant:null}; db.ref('banheiro_multi_state').set(globalState); } }); });
    safeBind('student-search', 'oninput', () => renderStudents());
    
    // Admin: Psicologia
    if (safeGet('psico-room-select')) { 
        safeGet('psico-room-select').innerHTML = '<option value="" disabled selected>Selecione a Sala</option>' + sysConfig.rooms.map(r => `<option value="${r}">${r}</option>`).join(''); 
    }
    
    safeBind('btn-add-psico', 'onclick', () => { 
        const name = safeGet('new-psico-name').value.trim(), pass = safeGet('new-psico-pass').value.trim().toLowerCase(); 
        if (name && pass) { 
            if(!sysConfig.psychologists) sysConfig.psychologists = {};
            sysConfig.psychologists[pass] = name; 
            db.ref('banheiro_config').set(sysConfig); 
            safeGet('new-psico-name').value = ''; safeGet('new-psico-pass').value = ''; 
        } 
    });

    // Psicologia - Solicitar Aluno
    safeBind('btn-psico-call', 'onclick', () => {
        const room = safeGet('psico-room-select')?.value;
        const student = safeGet('psico-student-name')?.value.trim();
        if (!room || !student) return alert('Selecione a sala e digite o nome do aluno.');
        
        const newEntry = {
            id: Date.now().toString(),
            type: 'chamado_psico',
            student: student,
            room: room,
            status: 'Pendente_Liberacao',
            time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        };

        // Adicionar apenas à fila sem mexer no resto
        if (!psicoState.queue) psicoState.queue = [];
        psicoState.queue.push(newEntry);
        
        db.ref('banheiro_psico_state/queue').set(psicoState.queue)
            .then(() => {
                safeGet('psico-student-name').value = '';
                alert('Chamado enviado para a sala!');
            });
    });

    // Banheiro - Enviar para Psicologia
    safeBind('btn-send-psico-modal', 'onclick', () => {
        const rs = getRoomState();
        if (!rs.students || rs.students.length === 0) return alert('Não há alunos na sala.');
        safeRender('psico-send-student-select', el => {
            el.innerHTML = '<option value="" disabled selected>Selecione um aluno</option>' + rs.students.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        });
        safeGet('modal-send-psico').classList.add('active');
    });

    safeBind('btn-cancel-psico-send', 'onclick', () => safeGet('modal-send-psico').classList.remove('active'));
    safeBind('btn-confirm-psico-send', 'onclick', () => {
        const student = safeGet('psico-send-student-select').value;
        const reason = safeGet('psico-send-reason').value.trim();
        if (!student || !reason) return alert('Preencha o aluno e o motivo.');
        
        const newEntry = {
            id: Date.now().toString(),
            type: 'encaminhado_sala',
            student: student,
            room: localCurrentRoom,
            reason: reason,
            status: 'Aguardando_Atendimento',
            time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        };

        if (!psicoState.queue) psicoState.queue = [];
        psicoState.queue.push(newEntry);
        
        db.ref('banheiro_psico_state/queue').set(psicoState.queue)
            .then(() => {
                safeGet('modal-send-psico').classList.remove('active');
                safeGet('psico-send-reason').value = '';
                alert('Aluno encaminhado para a Psicologia.');
            });
    });

    safeBind('btn-clear-psico', 'onclick', () => { requestAdminAuth('Limpar histórico da Psicologia', () => { db.ref('banheiro_psico_state').set({queue:[], history:[]}); alert('Histórico limpo.'); }); });

    // Excel

    const fileImp = safeGet('file-import');
    safeBind('btn-import-excel', 'onclick', () => fileImp?.click());
    if (fileImp) {
        fileImp.onchange = (e) => {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader(); r.onload = (evt) => {
                try { const wb = XLSX.read(new Uint8Array(evt.target.result), {type:'array'}), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1}), rs = getRoomState(); if (!rs.students) rs.students = []; rows.forEach(row => { const n = row[0]?.toString().trim(); if (n && n.toLowerCase() !== 'nome' && !rs.students.find(s => s.name === n)) rs.students.push({id:Date.now().toString()+Math.random().toString(36).substr(2,5), name:n, visits:0}); }); db.ref('banheiro_multi_state').set(globalState); alert('Alunos importados!'); } catch(e) { alert("Erro ao ler o Excel."); }
            }; r.readAsArrayBuffer(f);
        };
    }

    // Pedagógico & Chaves
    safeBind('btn-send-ped', 'onclick', () => { const p = safeGet('ped-prof-name')?.value.trim(), s = safeGet('ped-student-name')?.value.trim(), r = safeGet('ped-reason')?.value.trim(); if (!p || !s || !r) return alert('Preencha os campos!'); pedState.referrals.push({ id: Date.now().toString(), prof: p, student: s, reason: r, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), status: 'Pendente', date: new Date().toLocaleDateString('pt-BR'), timestamp: Date.now() }); db.ref('banheiro_ped_state').set(pedState); safeGet('ped-student-name').value = ''; safeGet('ped-reason').value = ''; alert('Encaminhado ao Pedagógico.'); });
    safeBind('btn-clear-ped', 'onclick', () => { requestAdminAuth('Limpar encaminhamentos pendentes?', () => { db.ref('banheiro_ped_state').set({referrals:[]}); }); });
    
    // Exportações Globais
    safeBind('btn-export-master', 'onclick', () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(globalLogs.map(l => ({'Data':l.date, 'Sala':l.roomName, 'Aluno':l.studentName, 'Início':new Date(l.startTime).toLocaleTimeString()}))), "Banheiro"); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(keysState.history), "Chaves"); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pedState.referrals), "Pedagogico"); XLSX.writeFile(wb, `Relatorio_Global.xlsx`); });
    safeBind('btn-export-backup', 'onclick', () => { const b = { b: JSON.stringify(globalState), l: JSON.stringify(globalLogs), k: JSON.stringify(keysState), p: JSON.stringify(pedState), c: JSON.stringify(sysConfig) }; const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(b)); a.download = `Backup_Cloud_Full.json`; a.click(); });
    safeBind('btn-clear-banheiro', 'onclick', () => { requestAdminAuth('Limpar histórico de Salas', () => { db.ref('banheiro_global_log').set(null); alert('Histórico limpo.'); }); });
    safeBind('btn-clear-chaves', 'onclick', () => { requestAdminAuth('Limpar histórico de Chaves', () => { db.ref('banheiro_keys_state').set({active:{},history:[]}); alert('Histórico limpo.'); }); });
    safeBind('btn-clear-pedagogico', 'onclick', () => { requestAdminAuth('Limpar histórico Pedagógico', () => { db.ref('banheiro_ped_state').set({referrals:[]}); alert('Histórico limpo.'); }); });
    safeBind('btn-clear-global', 'onclick', () => { requestAdminAuth('Apagar TODOS os históricos permanentemente', () => { db.ref('banheiro_global_log').set(null); db.ref('banheiro_keys_state').set({active:{},history:[]}); db.ref('banheiro_ped_state').set({referrals:[]}); alert('Todos os históricos foram limpos.'); }); });

    // Exportação Pedagógico com filtro de data (Coordenação)
    safeBind('btn-export-ped-modal', 'onclick', () => {
        const today = new Date().toISOString().split('T')[0];
        if (safeGet('ped-export-start')) safeGet('ped-export-start').value = today;
        if (safeGet('ped-export-end')) safeGet('ped-export-end').value = today;
        safeGet('modal-export-ped')?.classList.add('active');
    });
    safeBind('btn-ped-export-cancel', 'onclick', () => safeGet('modal-export-ped')?.classList.remove('active'));
    safeBind('btn-ped-export-confirm', 'onclick', () => {
        const start = safeGet('ped-export-start')?.value;
        const end = safeGet('ped-export-end')?.value;
        if (!start || !end) return alert('Selecione a data inicial e final.');
        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T23:59:59');
        const filtered = pedState.referrals.filter(r => {
            if (!r.date) return false;
            const parts = r.date.split('/');
            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
            return d >= startDate && d <= endDate;
        });
        if (filtered.length === 0) return alert('Nenhum registro encontrado no período selecionado.');
        const data = filtered.map(r => ({ 'Data': r.date, 'Aluno': r.student, 'Professor': r.prof, 'Motivo': r.reason, 'Status': r.status, 'Supervisor': r.supervisor || '-', 'Horário': r.time }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Pedagogico');
        XLSX.writeFile(wb, `Pedagogico_${start}_a_${end}.xlsx`);
        safeGet('modal-export-ped')?.classList.remove('active');
    });

    // Exportação Psicologia com filtro de data
    safeBind('btn-export-psico', 'onclick', () => {
        const today = new Date().toISOString().split('T')[0];
        if (safeGet('psico-export-start')) safeGet('psico-export-start').value = today;
        if (safeGet('psico-export-end')) safeGet('psico-export-end').value = today;
        safeGet('modal-export-psico')?.classList.add('active');
    });
    safeBind('btn-psico-export-cancel', 'onclick', () => safeGet('modal-export-psico')?.classList.remove('active'));
    safeBind('btn-psico-export-confirm', 'onclick', () => {
        const start = safeGet('psico-export-start')?.value;
        const end = safeGet('psico-export-end')?.value;
        if (!start || !end) return alert('Selecione a data inicial e final.');
        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T23:59:59');
        const filtered = (psicoState.history || []).filter(h => {
            if (!h.date) return false;
            const parts = h.date.split('/');
            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
            return d >= startDate && d <= endDate;
        });
        if (filtered.length === 0) return alert('Nenhum registro encontrado no período selecionado.');
        const data = filtered.map(h => ({ 'Data': h.date, 'Horário': h.time, 'Aluno': h.student, 'Sala': h.room, 'Motivo/Resumo': h.reason, 'Psicóloga': h.psico }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Psicologia');
        XLSX.writeFile(wb, `Psicologia_${start}_a_${end}.xlsx`);
        safeGet('modal-export-psico')?.classList.remove('active');
    });

    // Agendamento
    if (safeGet('space-select')) {
        safeBind('space-select', 'onchange', () => safeRun(renderAgendamento));
        safeBind('btn-prev-week', 'onclick', () => { currentWeekOffset--; safeRun(renderAgendamento); });
        safeBind('btn-next-week', 'onclick', () => { currentWeekOffset++; safeRun(renderAgendamento); });
        
        safeBind('btn-cancel-agendar', 'onclick', () => safeGet('modal-agendar')?.classList.remove('active'));
        safeBind('btn-confirm-agendar', 'onclick', () => safeRun(saveSlotBooking));
        safeBind('btn-close-modal-cancel', 'onclick', () => safeGet('modal-cancelar-agendamento')?.classList.remove('active'));
        safeBind('btn-confirm-cancel-slot', 'onclick', () => safeRun(executeCancelSlot));

        const inProf = safeGet('agendar-prof-name');
        if (inProf) inProf.addEventListener('keyup', (e) => { if (e.key === 'Enter') safeRun(saveSlotBooking); });
        const inDisc = safeGet('agendar-disciplina');
        if (inDisc) inDisc.addEventListener('keyup', (e) => { if (e.key === 'Enter') safeRun(saveSlotBooking); });

        safeRun(renderAgendamento);
    }

    // Iniciar loop seguro do monitor
    if (safeGet('global-feed')) { safeRun(renderMonitor); setInterval(() => safeRun(renderMonitor), 5000); }

    // Refresh TI Dashboard a cada minuto para atualizar cores de tempo
    if (safeGet('list-aberto')) { 
        setInterval(() => safeRun(renderTiDashboard), 60000); 
    }
    
    // Atualizar métricas do Hub se estiver na página inicial
    updateHubStats();
}

// Toasts Seguros
const originalAlert = window.alert;
window.alert = (msg) => {
    try {
        let c = safeGet('toast-container'); if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
        const t = document.createElement('div'); t.className = `toast ${msg.includes('Erro') || msg.includes('incorreta') ? 'error' : 'success'}`;
        t.innerHTML = `<span>${msg.includes('Erro') || msg.includes('incorreta') ? '❌' : '✅'}</span> <span>${msg}</span>`;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    } catch(e) { console.log(msg); }
};

// --- Agendamento Digital ---
function getWeekRangeStr(offset) {
    const today = new Date(), day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    monday.setDate(monday.getDate() + (offset * 7));
    const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
    return `${monday.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} a ${friday.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
}

function getWeekId(offset) {
    const today = new Date(), day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + (offset * 7));
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const d = String(monday.getDate()).padStart(2, '0');
    return `W_${y}_${m}_${d}`;
}

function getLegacyWeekId(offset) {
    const today = new Date(), day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + (offset * 7));
    return `W${monday.getTime()}`;
}

let currentSlotBooking = null;
let currentSlotCancel = null;

function renderAgendamento() {
    safeRender('week-display', el => el.innerText = getWeekRangeStr(currentWeekOffset));
    const space = safeGet('space-select')?.value;
    if (!space) return;
    
    const weekId = getWeekId(currentWeekOffset);
    const legacyWeekId = getLegacyWeekId(currentWeekOffset);
    const weekObj = (agendamentoState && (agendamentoState[weekId] || agendamentoState[legacyWeekId])) || {};
    const weekData = weekObj[space] || {};
    
    // Feriados Nacionais Fixos
    const feriados = { '01-01': 'Ano Novo', '01-05': 'Dia do Trabalho', '07-09': 'Independência', '12-10': 'N. Sra. Ap.', '02-11': 'Finados', '15-11': 'República', '25-12': 'Natal' };
    const daysNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    const currentDates = [];
    
    const today = new Date(), day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    monday.setDate(monday.getDate() + (currentWeekOffset * 7));

    for(let i=0; i<5; i++) {
        const d = new Date(monday); d.setDate(monday.getDate() + i); currentDates.push(d);
    }

    const buildHeaders = (headerId) => {
        safeRender(headerId, el => {
            let html = '<th>Horário / Data</th>';
            currentDates.forEach((d, i) => {
                const dayStr = String(d.getDate()).padStart(2, '0'), monthStr = String(d.getMonth() + 1).padStart(2, '0');
                const feriado = feriados[`${dayStr}-${monthStr}`];
                html += `<th>${daysNames[i]}<br><span style="font-size:0.75rem;font-weight:normal;">${dayStr}/${monthStr}</span>${feriado ? `<br><span style="background:#ef4444;color:white;font-size:0.65rem;padding:0.2rem 0.4rem;border-radius:4px;display:inline-block;margin-top:0.25rem;">${feriado}</span>` : ''}</th>`;
            });
            el.innerHTML = html;
        });
    };
    buildHeaders('matutino-headers');
    buildHeaders('vespertino-headers');

    const slotsConfig = sysConfig.timeSlots || defaultTimeSlots;

    const buildTable = (bodyId, timeSlots) => {
        safeRender(bodyId, el => {
            el.innerHTML = '';
            (timeSlots || []).forEach(time => {
                let row = `<tr><td class="time-col">${time}</td>`;
                currentDates.forEach((d, i) => {
                    const dayIndex = i + 1, key = `${dayIndex}-${time}`, res = weekData[key];
                    const dayStr = String(d.getDate()).padStart(2, '0'), monthStr = String(d.getMonth() + 1).padStart(2, '0');
                    const dateLabel = `${daysNames[i]} (${dayStr}/${monthStr})`;
                    
                    if (res) {
                        const profText = res.prof || 'Ocupado';
                        row += `<td class="slot-cell"><button class="slot-btn slot-occupied" data-space="${space}" data-week="${weekId}" data-legacy-week="${legacyWeekId}" data-key="${key}" data-date="${dateLabel}" data-time="${time}" title="${profText}">${profText}</button></td>`;
                    } else {
                        row += `<td class="slot-cell"><button class="slot-btn slot-free" data-space="${space}" data-week="${weekId}" data-legacy-week="${legacyWeekId}" data-key="${key}" data-date="${dateLabel}" data-time="${time}">Livre</button></td>`;
                    }
                });
                row += '</tr>';
                el.innerHTML += row;
            });

            el.querySelectorAll('.slot-free').forEach(btn => {
                btn.onclick = () => {
                    const sp = btn.getAttribute('data-space');
                    const wk = btn.getAttribute('data-week');
                    const ky = btn.getAttribute('data-key');
                    const dt = btn.getAttribute('data-date');
                    const tm = btn.getAttribute('data-time');
                    openReserveModal(sp, wk, ky, dt, tm);
                };
            });

            el.querySelectorAll('.slot-occupied').forEach(btn => {
                btn.onclick = () => {
                    const sp = btn.getAttribute('data-space');
                    const wk = btn.getAttribute('data-week');
                    const ky = btn.getAttribute('data-key');
                    const dt = btn.getAttribute('data-date');
                    const tm = btn.getAttribute('data-time');
                    openCancelModal(sp, wk, ky, dt, tm);
                };
            });
        });
    };

    buildTable('matutino-body', slotsConfig.matutino);
    buildTable('vespertino-body', slotsConfig.vespertino);
}

window.openReserveModal = function(space, weekId, timeKey, dateLabel, timeLabel) {
    currentSlotBooking = { space, weekId, timeKey, dateLabel, timeLabel };
    if (safeGet('modal-agendar')) {
        if (safeGet('modal-agendar-space-info')) safeGet('modal-agendar-space-info').innerText = space;
        if (safeGet('modal-agendar-date-info')) safeGet('modal-agendar-date-info').innerText = dateLabel;
        if (safeGet('modal-agendar-time-info')) safeGet('modal-agendar-time-info').innerText = timeLabel;
        if (safeGet('agendar-prof-name')) safeGet('agendar-prof-name').value = '';
        if (safeGet('agendar-disciplina')) safeGet('agendar-disciplina').value = '';
        safeGet('modal-agendar').classList.add('active');
        setTimeout(() => safeGet('agendar-prof-name')?.focus(), 100);
    } else {
        // Fallback caso o modal não esteja presente
        window.reserveSlot(space, weekId, timeKey);
    }
};

window.saveSlotBooking = function() {
    if (!currentSlotBooking) return;
    const prof = safeGet('agendar-prof-name')?.value.trim();
    const disciplina = safeGet('agendar-disciplina')?.value.trim();
    if (!prof) {
        alert('Por favor, informe o nome do professor ou solicitante.');
        return;
    }

    const { space, weekId, timeKey } = currentSlotBooking;
    const displayProf = disciplina ? `${prof} (${disciplina})` : prof;

    if (!agendamentoState[weekId]) agendamentoState[weekId] = {};
    if (!agendamentoState[weekId][space]) agendamentoState[weekId][space] = {};
    agendamentoState[weekId][space][timeKey] = {
        prof: displayProf,
        profName: prof,
        disciplina: disciplina || '',
        ts: Date.now()
    };

    safeGet('modal-agendar')?.classList.remove('active');
    renderAgendamento();

    db.ref('banheiro_agendamento').set(agendamentoState)
        .then(() => {
            alert('Agendamento realizado com sucesso!');
            currentSlotBooking = null;
        })
        .catch(err => {
            console.error('Erro ao salvar agendamento:', err);
            alert('Erro ao salvar no banco de dados. Tente novamente.');
        });
};

window.openCancelModal = function(space, weekId, timeKey, dateLabel, timeLabel) {
    const legacyWeekId = getLegacyWeekId(currentWeekOffset);
    const actualWeekKey = (agendamentoState && agendamentoState[weekId]) ? weekId : legacyWeekId;
    const weekObj = (agendamentoState && agendamentoState[actualWeekKey]) || {};
    const weekData = weekObj[space] || {};
    const res = weekData[timeKey];
    if (!res) return;

    currentSlotCancel = { space, actualWeekKey, timeKey, res };
    if (safeGet('modal-cancelar-agendamento')) {
        if (safeGet('modal-cancel-space-info')) safeGet('modal-cancel-space-info').innerText = space;
        if (safeGet('modal-cancel-datetime-info')) safeGet('modal-cancel-datetime-info').innerText = `${dateLabel} - ${timeLabel}`;
        if (safeGet('modal-cancel-prof-info')) safeGet('modal-cancel-prof-info').innerText = res.profName || res.prof;
        
        if (res.disciplina) {
            if (safeGet('modal-cancel-disciplina-info')) safeGet('modal-cancel-disciplina-info').innerText = res.disciplina;
            if (safeGet('modal-cancel-disciplina-row')) safeGet('modal-cancel-disciplina-row').style.display = 'block';
        } else {
            if (safeGet('modal-cancel-disciplina-row')) safeGet('modal-cancel-disciplina-row').style.display = 'none';
        }

        if (res.ts && safeGet('modal-cancel-ts-info')) {
            safeGet('modal-cancel-ts-info').innerText = `Agendado em: ${new Date(res.ts).toLocaleString('pt-BR')}`;
        }

        safeGet('modal-cancelar-agendamento').classList.add('active');
    } else {
        // Fallback
        window.cancelSlot(space, actualWeekKey, timeKey, res.prof);
    }
};

window.executeCancelSlot = function() {
    if (!currentSlotCancel) return;
    const { space, actualWeekKey, timeKey, res } = currentSlotCancel;
    const profName = res.profName || res.prof;

    requestAdminAuth(`CANCELAR reserva de "${profName}"?`, () => {
        if (agendamentoState[actualWeekKey] && agendamentoState[actualWeekKey][space]) {
            delete agendamentoState[actualWeekKey][space][timeKey];
            safeGet('modal-cancelar-agendamento')?.classList.remove('active');
            renderAgendamento();

            db.ref('banheiro_agendamento').set(agendamentoState)
                .then(() => {
                    alert('Reserva cancelada com sucesso.');
                    currentSlotCancel = null;
                })
                .catch(err => {
                    console.error('Erro ao cancelar reserva:', err);
                    alert('Erro ao sincronizar cancelamento.');
                });
        }
    });
};

window.reserveSlot = function(space, weekId, timeKey) {
    const prof = prompt(`Agendar ${space} (${timeKey.split('-')[1] || ''}).\nSeu Nome e Disciplina:`);
    if (prof && prof.trim()) {
        if (!agendamentoState[weekId]) agendamentoState[weekId] = {};
        if (!agendamentoState[weekId][space]) agendamentoState[weekId][space] = {};
        agendamentoState[weekId][space][timeKey] = { prof: prof.trim(), ts: Date.now() };
        renderAgendamento();
        db.ref('banheiro_agendamento').set(agendamentoState).then(() => {
            alert('Agendamento realizado!');
        }).catch(() => {
            alert('Erro ao salvar agendamento.');
        });
    }
};

window.cancelSlot = function(space, weekId, timeKey, prof) {
    requestAdminAuth(`CANCELAR reserva de "${prof}"?`, () => {
        if (agendamentoState[weekId] && agendamentoState[weekId][space]) {
            delete agendamentoState[weekId][space][timeKey];
            renderAgendamento();
            db.ref('banheiro_agendamento').set(agendamentoState).then(() => {
                alert('Reserva cancelada.');
            }).catch(() => {
                alert('Erro ao sincronizar cancelamento.');
            });
        }
    });
};

// --- Registro de Atrasos ---

function renderAtrasosTable() {
    safeRender('atrasos-table-body', el => {
        el.innerHTML = '';
        const today = new Date().toLocaleDateString('pt-BR');
        
        // Filtrar apenas registros de hoje para a tabela principal
        const todayLogs = (atrasosState.logs || []).filter(log => log.date === today);
        
        // Inverter para mostrar os mais recentes primeiro
        [...todayLogs].reverse().forEach(log => {
            const normalized = normalizeName(log.aluno);
            const count = (atrasosState.logs || []).filter(l => normalizeName(l.aluno) === normalized).length;
            
            el.innerHTML += `
                <tr class="${count >= 3 ? 'row-alert' : ''}">
                    <td><strong>${log.time}</strong></td>
                    <td>${log.aluno}</td>
                    <td>${log.turma}</td>
                    <td>
                        <span class="badge ${count >= 3 ? 'badge-danger' : 'badge-info'}">
                            ${count}º atraso
                        </span>
                    </td>
                </tr>
            `;
        });

        if (todayLogs.length === 0) {
            el.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum atraso registrado hoje.</td></tr>';
        }
    });
}

function renderSupervisaoAtrasosAlerts() {
    const section = safeGet('atrasos-alerts-section');
    const list = safeGet('atrasos-alerts-list');
    if (!section || !list) return;

    const activeAlerts = atrasosState.alerts || [];
    if (activeAlerts.length > 0) {
        section.style.display = 'block';
        list.innerHTML = activeAlerts.map(alert => `
            <div class="alert-item glass animate-in" style="border-left: 4px solid var(--danger);">
                <div style="flex: 1;">
                    <strong style="color: var(--danger);">RECORRÊNCIA: ${alert.aluno} (${alert.nivel})</strong>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
                        Turma: ${alert.turma} | Aluno excedeu o limite de 3 atrasos.
                        <br>Último: ${alert.date} às ${alert.time}
                    </p>
                </div>
            </div>
        `).join('');
    } else {
        section.style.display = 'none';
    }
}

function initAtrasosPage() {
    const alunoInput = safeGet('atraso-aluno');
    const turmaSelect = safeGet('atraso-turma');
    const timeInput = safeGet('atraso-horario');
    const saveBtn = safeGet('btn-save-atraso');

    if (!alunoInput || !turmaSelect || !timeInput) return;

    // Lista oficial de turmas SESI
    const turmasSesi = [
        "6AM", "6BM", "6AV", "6BV",
        "7AM", "7BM", "7AV", "7BV",
        "8AM", "8BM", "8AV", "8BV",
        "9AM", "9BM", "9AV", "9BV",
        "1AM", "1BM", "1AV", "1BV",
        "2AM", "2BM", "2AV", "2BV",
        "3AM", "3BM", "3AV", "3BV"
    ];

    // Preencher turmas
    turmaSelect.innerHTML = '<option value="">Selecione a turma...</option>' + 
        turmasSesi.map(t => `<option value="${t}">${t}</option>`).join('');

    // Preencher horário atual
    const now = new Date();
    timeInput.value = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    saveBtn.onclick = () => {
        const aluno = alunoInput.value.trim();
        const turma = turmaSelect.value;
        const time = timeInput.value;

        if (!aluno || !turma || !time) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        const today = new Date().toLocaleDateString('pt-BR');
        const newLog = {
            aluno,
            turma,
            time,
            date: today,
            ts: Date.now()
        };

        if (!atrasosState.logs) atrasosState.logs = [];
        atrasosState.logs.push(newLog);

        // Checar recorrência (95% de compatibilidade = normalização + trimming)
        const normalized = normalizeName(aluno);
        const count = atrasosState.logs.filter(l => normalizeName(l.aluno) === normalized).length;

        if (count >= 3) {
            if (!atrasosState.alerts) atrasosState.alerts = [];
            
            // Determinar nível de ensino
            const firstChar = turma.charAt(0);
            const nivel = ['1', '2', '3'].includes(firstChar) ? 'ENSINO MÉDIO' : 'FUNDAMENTAL';

            // Adicionar alerta apenas se não existir um idêntico (evitar spam)
            const exists = atrasosState.alerts.some(a => normalizeName(a.aluno) === normalized && a.date === today);
            if (!exists) {
                atrasosState.alerts.push({
                    aluno,
                    turma,
                    nivel,
                    date: today,
                    time: time,
                    ts: Date.now()
                });
            }
        }

        db.ref('banheiro_atrasos_state').set(atrasosState).then(() => {
            alunoInput.value = '';
            alert(`Atraso de ${aluno} registrado com sucesso!${count >= 3 ? '\n⚠️ ALERTA DE RECORRÊNCIA ENVIADO.' : ''}`);
        });
    };

    // Exportação
    safeBind('btn-export-atrasos', 'onclick', () => safeGet('modal-export-atrasos').classList.add('active'));
    safeBind('btn-atrasos-export-confirm', 'onclick', () => {
        const start = safeGet('export-atraso-inicio').value;
        const end = safeGet('export-atraso-fim').value;
        if (!start || !end) return alert('Selecione o período.');

        const filtered = atrasosState.logs.filter(log => {
            const [d, m, y] = log.date.split('/');
            const logDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            return logDate >= start && logDate <= end;
        });

        if (filtered.length === 0) return alert('Nenhum dado no período.');

        const data = filtered.map(l => ({
            'Data': l.date,
            'Horário': l.time,
            'Aluno': l.aluno,
            'Turma': l.turma
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Atrasos");
        XLSX.writeFile(wb, `Atrasos_${start}_a_${end}.xlsx`);
        safeGet('modal-export-atrasos').classList.remove('active');
    });
}

// Iniciar binders específicos
document.addEventListener('DOMContentLoaded', () => {
    initAtrasosPage();
    
    // Iniciar formulário de Saídas Antecipadas
    const saidaTurmaSelect = safeGet('saida-turma-select');
    if (saidaTurmaSelect) {
        const turmasSesi = ["6AM", "6BM", "6AV", "6BV", "7AM", "7BM", "7AV", "7BV", "8AM", "8BM", "8AV", "8BV", "9AM", "9BM", "9AV", "9BV", "1AM", "1BM", "1AV", "1BV", "2AM", "2BM", "2AV", "2BV", "3AM", "3BM", "3AV", "3BV"];
        saidaTurmaSelect.innerHTML = '<option value="">Selecione a turma...</option>' + turmasSesi.map(t => `<option value="${t}">${t}</option>`).join('');
        
        // Data de hoje por padrão
        if (safeGet('saida-data')) safeGet('saida-data').value = new Date().toISOString().split('T')[0];
        
        safeBind('btn-registrar-saida', 'onclick', () => {
            const aluno = safeGet('saida-aluno').value.trim();
            const turma = saidaTurmaSelect.value;
            const responsavel = safeGet('saida-responsavel').value.trim();
            const data = safeGet('saida-data').value;
            
            if (!aluno || !turma || !responsavel || !data) return alert('Preencha todos os campos para a liberação.');
            
            requestSuperAuth('Assinatura Digital para Liberação de Aluno', (supervisor) => {
                const newSaida = {
                    id: Date.now().toString(),
                    aluno,
                    turma,
                    responsavel,
                    data: new Date(data + 'T12:00:00').toLocaleDateString('pt-BR'),
                    supervisor,
                    timestamp: Date.now()
                };
                
                if (!saidasState.history) saidasState.history = [];
                saidasState.history.push(newSaida);
                
                db.ref('banheiro_saidas_state').set(saidasState).then(() => {
                    safeGet('saida-aluno').value = '';
                    safeGet('saida-responsavel').value = '';
                    alert(`Saída de ${aluno} registrada com sucesso!`);
                });
            });
        });
    }
    
    // Chamados TI - Solicitação na Sala
    safeBind('btn-open-ti-modal', 'onclick', () => safeGet('modal-ti').classList.add('active'));
    safeBind('btn-cancel-ti', 'onclick', () => safeGet('modal-ti').classList.remove('active'));
    safeBind('btn-confirm-ti', 'onclick', () => {
        const desc = safeGet('ti-problem-desc').value.trim();
        if (!desc) return alert('Descreva brevemente o problema.');
        
        const newTicket = {
            id: Date.now().toString(),
            room: localCurrentRoom,
            problem: desc,
            status: 'Aberto',
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            date: new Date().toLocaleDateString('pt-BR')
        };
        
        if (!tiState.tickets) tiState.tickets = [];
        tiState.tickets.push(newTicket);
        
        db.ref('banheiro_ti_state').set(tiState).then(() => {
            safeGet('modal-ti').classList.remove('active');
            safeGet('ti-problem-desc').value = '';
            alert('Chamado de TI enviado com sucesso!');
        });
    });

    safeBind('btn-clear-ti', 'onclick', () => {
        requestAdminAuth('Limpar histórico de TI?', () => {
            db.ref('banheiro_ti_state').set({ tickets: [] });
            alert('Histórico limpo.');
        });
    });

    // Suporte Técnico
    const btnSupport = safeGet('btn-send-support');
    if (btnSupport) {
        btnSupport.onclick = () => {
            const subject = safeGet('support-subject').value.trim();
            const message = safeGet('support-message').value.trim();
            const user = auth.currentUser;
            
            if (!subject || !message) return alert('Por favor, preencha o assunto e a mensagem.');
            
            const userEmail = user ? user.email : 'Usuário não identificado';
            const body = `Suporte SESI Gestão\n\nDe: ${userEmail}\nAssunto: ${subject}\n\nMensagem:\n${message}\n\n---\nEnviado via App Gestão de Processos`;
            
            // Salvar no Firebase para histórico
            db.ref('banheiro_support_logs').push({
                user: userEmail,
                subject,
                message,
                timestamp: Date.now(),
                date: new Date().toLocaleString('pt-BR')
            });

            // Abrir e-mail preenchido
            const mailtoUrl = `mailto:mateussilva@rn.sesi.org.br?subject=${encodeURIComponent('[SUPORTE SESI] ' + subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoUrl;
            
            alert('Seu cliente de e-mail será aberto. Por favor, confirme o envio da mensagem.');
            safeGet('support-subject').value = '';
            safeGet('support-message').value = '';
        };
    }

    if (safeGet('btn-clear-atrasos-alerts')) {
        safeGet('btn-clear-atrasos-alerts').onclick = () => {
            requestSuperAuth('Limpar alertas de atrasos?', () => {
                atrasosState.alerts = [];
                db.ref('banheiro_atrasos_state').set(atrasosState);
            });
        };
    }
});

// Start
safeRun(init);
