let db;
let editID = null;
let showArchived = false;
let isUnlocked = false;
let masterPasswordHash = null;
let sessionKey = null;

// Simple encryption functions (for demonstration - in production use Web Crypto API)
function simpleEncrypt(text, key) {
    try {
        let result = '';
        for(let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(result); // Base64 encode
    } catch(e) {
        console.error('Encryption error:', e);
        return text;
    }
}

function simpleDecrypt(encrypted, key) {
    try {
        let decoded = atob(encrypted); // Base64 decode
        let result = '';
        for(let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    } catch(e) {
        console.error('Decryption error:', e);
        return encrypted;
    }
}

function hashPassword(password) {
    // Simple hash (in production, use proper hashing like SHA-256)
    let hash = 0;
    for(let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("MateDB", 3);
        req.onupgradeneeded = e => {
            db = e.target.result;
            ["notes", "tasks", "projects", "courses", "profile", "activity", "certificates", "chats", "searches", "watchlist", "expenses", "settings", "passwords", "cloudhub", "timersessions", "productivity"].forEach(store => {
                if (!db.objectStoreNames.contains(store)) {
                    db.createObjectStore(store, {keyPath: "id", autoIncrement: true});
                }
            });
        };
        req.onsuccess = e => { 
            db = e.target.result; 
            resolve(db); 
        };
        req.onerror = e => reject(e);
    });
}

function get(store, key) {
    return new Promise(resolve => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

function getAll(store) {
    return new Promise(resolve => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
    });
}

function add(store, obj) {
    return new Promise(resolve => {
        const tx = db.transaction(store, "readwrite");
        const req = tx.objectStore(store).add(obj);
        req.onsuccess = () => resolve();
    });
}

function put(store, obj) {
    return new Promise(resolve => {
        const tx = db.transaction(store, "readwrite");
        const req = tx.objectStore(store).put(obj);
        req.onsuccess = () => resolve();
    });
}

function del(store, key) {
    return new Promise(resolve => {
        const tx = db.transaction(store, "readwrite");
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => resolve();
    });
}

// Master Password Functions
async function checkMasterPassword() {
    const settings = await getAll("settings");
    const masterSetting = settings.find(s => s.key === "masterPassword");
    
    if(masterSetting && masterSetting.value) {
        masterPasswordHash = masterSetting.value;
        document.getElementById("masterScreenTitle").innerText = "Password Manager Locked";
        document.getElementById("masterScreenDesc").innerText = "Enter your master password to continue";
        document.getElementById("masterPasswordConfirm").style.display = "none";
        document.getElementById("masterBtnText").innerText = "Unlock";
        document.getElementById("toggleModeText").style.display = "none";
        return true;
    } else {
        // First time setup
        document.getElementById("masterPasswordConfirm").style.display = "block";
        document.getElementById("toggleModeText").style.display = "none";
        return false;
    }
}

async function handleMasterPassword() {
    const masterInput = document.getElementById("masterPasswordInput").value;
    const masterConfirm = document.getElementById("masterPasswordConfirm").value;
    const errorEl = document.getElementById("masterError");
    const successEl = document.getElementById("masterSuccess");
    
    errorEl.innerText = "";
    successEl.innerText = "";
    
    if(!masterInput) {
        errorEl.innerText = "Please enter a master password";
        return;
    }
    
    if(!masterPasswordHash) {
        // Setting up new master password
        if(masterInput.length < 6) {
            errorEl.innerText = "Master password must be at least 6 characters";
            return;
        }
        
        if(masterInput !== masterConfirm) {
            errorEl.innerText = "Passwords do not match";
            return;
        }
        
        const hash = hashPassword(masterInput);
        await add("settings", { key: "masterPassword", value: hash });
        masterPasswordHash = hash;
        sessionKey = masterInput;
        
        successEl.innerText = "Master password set successfully!";
        setTimeout(() => {
            document.getElementById("masterPasswordScreen").style.display = "none";
            isUnlocked = true;
            loadPasswords();
        }, 1000);
    } else {
        // Verifying existing master password
        const hash = hashPassword(masterInput);
        if(hash === masterPasswordHash) {
            sessionKey = masterInput;
            isUnlocked = true;
            document.getElementById("masterPasswordScreen").style.display = "none";
            loadPasswords();
        } else {
            errorEl.innerText = "Incorrect master password";
            document.getElementById("masterPasswordInput").value = "";
        }
    }
}

function lockVault() {
    isUnlocked = false;
    sessionKey = null;
    document.getElementById("lockedOverlay").style.display = "flex";
    showToast('<i class="bi bi-lock"></i> Password vault locked');
}

function showUnlockScreen() {
    document.getElementById("lockedOverlay").style.display = "none";
    document.getElementById("masterPasswordScreen").style.display = "flex";
    document.getElementById("masterPasswordInput").value = "";
    document.getElementById("masterError").innerText = "";
    document.getElementById("masterSuccess").innerText = "";
}

// Password strength checker
function checkPasswordStrength(password) {
    if(!password) return { strength: 'none', score: 0, text: '' };
    
    let score = 0;
    if(password.length >= 8) score++;
    if(password.length >= 12) score++;
    if(/[a-z]/.test(password)) score++;
    if(/[A-Z]/.test(password)) score++;
    if(/[0-9]/.test(password)) score++;
    if(/[^a-zA-Z0-9]/.test(password)) score++;
    
    if(score <= 2) return { strength: 'weak', score: score, text: 'Weak Password', color: '#e74c3c' };
    if(score <= 4) return { strength: 'medium', score: score, text: 'Medium Password', color: '#f39c12' };
    return { strength: 'strong', score: score, text: 'Strong Password', color: '#2ecc71' };
}

function updatePasswordStrength() {
    const password = document.getElementById("pwdPassword").value;
    const strengthEl = document.getElementById("passwordStrength");
    const result = checkPasswordStrength(password);
    
    if(result.strength === 'none') {
        strengthEl.innerHTML = '';
        return;
    }
    
    strengthEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <div class="strength-bar" style="flex:1;">
                <div class="strength-fill strength-${result.strength}"></div>
            </div>
            <small style="color:${result.color};font-weight:600;">${result.text}</small>
        </div>
    `;
}

// Monitor password input for strength
setInterval(() => {
    if(document.getElementById("pwdPassword")) {
        updatePasswordStrength();
    }
}, 500);

// Password Generator
function generatePassword(length = 16, options = {}) {
    const uppercase = options.uppercase !== false;
    const lowercase = options.lowercase !== false;
    const numbers = options.numbers !== false;
    const symbols = options.symbols !== false;
    const excludeAmbiguous = options.excludeAmbiguous || false;
    
    let chars = '';
    if(uppercase) chars += excludeAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if(lowercase) chars += excludeAmbiguous ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    if(numbers) chars += excludeAmbiguous ? '23456789' : '0123456789';
    if(symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    if(!chars) chars = 'abcdefghijklmnopqrstuvwxyz';
    
    let password = '';
    for(let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function generateQuickPassword() {
    const password = generatePassword(16);
    document.getElementById("pwdPassword").value = password;
    updatePasswordStrength();
}

function updateLength() {
    const length = document.getElementById("pwdLength").value;
    document.getElementById("lengthValue").innerText = length;
}

function generatePasswordInModal() {
    const length = parseInt(document.getElementById("pwdLength").value);
    const options = {
        uppercase: document.getElementById("genUppercase").checked,
        lowercase: document.getElementById("genLowercase").checked,
        numbers: document.getElementById("genNumbers").checked,
        symbols: document.getElementById("genSymbols").checked,
        excludeAmbiguous: document.getElementById("genAmbiguous").checked
    };
    
    const password = generatePassword(length, options);
    document.getElementById("generatedPassword").value = password;
}

function copyGeneratedPassword() {
    const password = document.getElementById("generatedPassword").value;
    if(!password) {
        generatePasswordInModal();
        return;
    }
    
    navigator.clipboard.writeText(password).then(() => {
        showToast('<i class="bi bi-clipboard-check"></i> Password copied to clipboard!');
    });
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// Modal Functions
function openModal(isEdit = false) {
    document.getElementById("passwordModal").style.display = "flex";
    document.getElementById("modalTitle").innerHTML = isEdit ? 
        '<i class="bi bi-pencil-square"></i> Edit Password' : 
        '<i class="bi bi-plus-circle"></i> Add New Password';
}

function closeModal() {
    document.getElementById("passwordModal").style.display = "none";
    editID = null;
    document.getElementById("pwdTitle").value = "";
    document.getElementById("pwdUsername").value = "";
    document.getElementById("pwdPassword").value = "";
    document.getElementById("pwdWebsite").value = "";
    document.getElementById("pwdCategory").value = "Social Media";
    document.getElementById("pwdNotes").value = "";
    document.getElementById("passwordStrength").innerHTML = "";
}

function openViewModal(id) {
    get("passwords", id).then(p => {
        if(!p) return;
        
        const decryptedPassword = simpleDecrypt(p.password, sessionKey);
        const categoryClass = p.category.toLowerCase().replace(' ', '-');
        const strength = checkPasswordStrength(decryptedPassword);
        
        document.getElementById("viewPwdTitle").innerHTML = `<i class="bi bi-key-fill"></i> ${p.title}`;
        
        let content = `
            <div style="margin:10px 0;">
                <span class="category-badge cat-${categoryClass.replace('-', '')}">${p.category}</span>
            </div>
            <p><strong><i class="bi bi-person"></i> Username:</strong> ${p.username || 'N/A'}</p>
            <p><strong><i class="bi bi-key"></i> Password:</strong></p>
            <div class="password-display">
                <input type="password" id="viewPwdField" value="${decryptedPassword}" readonly>
                <i class="bi bi-eye toggle-pwd" onclick="togglePasswordVisibility('viewPwdField')" title="Show/Hide"></i>
                <i class="bi bi-clipboard toggle-pwd" onclick="copyPassword('${decryptedPassword}')" title="Copy"></i>
            </div>
            <div style="margin:10px 0;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="strength-bar" style="flex:1;">
                        <div class="strength-fill strength-${strength.strength}"></div>
                    </div>
                    <small style="color:${strength.color};font-weight:600;">${strength.text}</small>
                </div>
            </div>
            ${p.website ? `<p><strong><i class="bi bi-link-45deg"></i> Website:</strong> <a href="${p.website}" target="_blank">${p.website}</a></p>` : ''}
            ${p.notes ? `<p><strong><i class="bi bi-sticky"></i> Notes:</strong><br>${p.notes}</p>` : ''}
            <p><small><i class="bi bi-clock"></i> Created: ${p.time}</small></p>
        `;
        
        document.getElementById("viewPwdContent").innerHTML = content;
        document.getElementById("viewPasswordModal").style.display = "flex";
    });
}

function closeViewModal() {
    document.getElementById("viewPasswordModal").style.display = "none";
}

function openGeneratorModal() {
    document.getElementById("generatorModal").style.display = "flex";
    generatePasswordInModal();
}

function closeGeneratorModal() {
    document.getElementById("generatorModal").style.display = "none";
}

function openExportModal() {
    document.getElementById("exportModal").style.display = "flex";
}

function closeExportModal() {
    document.getElementById("exportModal").style.display = "none";
}

// Save Password
async function savePassword() {
    const title = document.getElementById("pwdTitle").value.trim();
    const username = document.getElementById("pwdUsername").value.trim();
    const password = document.getElementById("pwdPassword").value;
    
    if(!title) {
        alert("Please enter a title");
        return;
    }
    
    if(!password) {
        alert("Please enter a password");
        return;
    }
    
    const strength = checkPasswordStrength(password);
    const encryptedPassword = simpleEncrypt(password, sessionKey);
    
    let favState = false;
    let archivedState = false;
    
    if(editID) {
        const existing = await get("passwords", editID);
        favState = existing && existing.fav ? true : false;
        archivedState = existing && existing.archived ? true : false;
    }
    
    let passwordObj = {
        title: title,
        username: username,
        password: encryptedPassword,
        website: document.getElementById("pwdWebsite").value.trim(),
        category: document.getElementById("pwdCategory").value,
        notes: document.getElementById("pwdNotes").value.trim(),
        strength: strength.strength,
        fav: favState,
        archived: archivedState,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    
    if(editID) {
        passwordObj.id = editID;
        await put("passwords", passwordObj);
        showToast('<i class="bi bi-check-circle"></i> Password updated successfully!');
    } else {
        await add("passwords", passwordObj);
        showToast('<i class="bi bi-check-circle"></i> Password saved successfully!');
    }
    
    closeModal();
    loadPasswords();
}

// Load Passwords
async function loadPasswords() {
    if(!isUnlocked) return;
    
    const container = document.getElementById("passwordList");
    container.innerHTML = "";
    
    const search = document.getElementById("searchInput").value.toLowerCase();
    const categoryFlt = document.getElementById("categoryFilter").value;
    const favFlt = document.getElementById("favFilter").value;
    const sort = document.getElementById("sortBy").value;
    
    let list = await getAll("passwords");
    
    // Filter archived
    list = list.filter(p => showArchived ? p.archived : !p.archived);
    
    // Search filter
    list = list.filter(p => 
        p.title.toLowerCase().includes(search) ||
        (p.username && p.username.toLowerCase().includes(search)) ||
        (p.website && p.website.toLowerCase().includes(search)) ||
        (p.notes && p.notes.toLowerCase().includes(search))
    );
    
    // Category filter
    if(categoryFlt !== 'all') {
        list = list.filter(p => p.category === categoryFlt);
    }
    
    // Favorite filter
    list = list.filter(p => favFlt === "all" || p.fav);
    
    // Sort
    if(sort === "newest") list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    else if(sort === "oldest") list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    else if(sort === "name") list.sort((a, b) => a.title.localeCompare(b.title));
    else if(sort === "strength") {
        const strengthOrder = { strong: 3, medium: 2, weak: 1, none: 0 };
        list.sort((a, b) => (strengthOrder[b.strength] || 0) - (strengthOrder[a.strength] || 0));
    }
    
    updateStats();
    
    if(list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-key"></i>
                <h3>No passwords found</h3>
                <p>Add your first password or adjust your filters</p>
            </div>
        `;
        return;
    }
    
    list.forEach(p => {
        const decryptedPassword = simpleDecrypt(p.password, sessionKey);
        const categoryClass = (p.category || 'other').toLowerCase().replace(' ', '');
        const archivedClass = p.archived ? 'archived' : '';
        const strength = checkPasswordStrength(decryptedPassword);
        
        container.innerHTML += `
        <div class="password-card ${archivedClass}">
            <span class="fav ${p.fav ? "active" : ""}" onclick="toggleFav(${p.id}, ${p.fav})" title="${p.fav ? 'Remove Favorite' : 'Add Favorite'}">
                <i class="bi bi-heart-fill"></i>
            </span>
            
            <h3>
                <i class="bi bi-key-fill"></i>
                ${p.title}
            </h3>
            
            <span class="category-badge cat-${categoryClass}">${p.category}</span>
            ${p.archived ? '<span class="category-badge" style="background:#999;color:#fff;">Archived</span>' : ''}
            
            <p><i class="bi bi-person"></i> <b>Username:</b> ${p.username || 'N/A'}</p>
            
            <div class="password-display">
                <input type="password" id="pwd-${p.id}" value="${decryptedPassword}" readonly>
                <i class="bi bi-eye toggle-pwd" onclick="togglePasswordVisibility('pwd-${p.id}')" title="Show/Hide"></i>
                <i class="bi bi-clipboard toggle-pwd" onclick="copyPassword('${decryptedPassword}')" title="Copy"></i>
            </div>
            
            <div style="margin:8px 0;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="strength-bar" style="flex:1;">
                        <div class="strength-fill strength-${strength.strength}"></div>
                    </div>
                    <small style="color:${strength.color};font-weight:600;">${strength.text}</small>
                </div>
            </div>
            
            ${p.website ? `<p><i class="bi bi-link-45deg"></i> <a href="${p.website}" target="_blank" style="color:#0066cc;">Visit Site</a></p>` : ''}
            
            <small><i class="bi bi-clock"></i> ${p.time}</small>
            
            <div class="actions">
                <button onclick="openViewModal(${p.id})" title="View Details"><i class="bi bi-eye"></i> View</button>
                <button onclick="editPassword(${p.id})" title="Edit"><i class="bi bi-pencil"></i> Edit</button>
                <button class="copy-btn" onclick="copyPassword('${decryptedPassword}')" title="Copy Password"><i class="bi bi-clipboard"></i> Copy</button>
                ${p.archived ? 
                    `<button onclick="unarchivePassword(${p.id})" title="Restore"><i class="bi bi-arrow-up-circle"></i> Restore</button>` : 
                    `<button onclick="archivePassword(${p.id})" title="Archive"><i class="bi bi-archive"></i> Archive</button>`
                }
                <button onclick="deletePassword(${p.id})" title="Delete" style="background:#ffcccc;"><i class="bi bi-trash"></i> Delete</button>
            </div>
        </div>`;
    });
}

// Edit Password
async function editPassword(id) {
    let p = await get("passwords", id);
    editID = id;
    
    document.getElementById("pwdTitle").value = p.title;
    document.getElementById("pwdUsername").value = p.username || "";
    document.getElementById("pwdPassword").value = simpleDecrypt(p.password, sessionKey);
    document.getElementById("pwdWebsite").value = p.website || "";
    document.getElementById("pwdCategory").value = p.category || "Social Media";
    document.getElementById("pwdNotes").value = p.notes || "";
    
    openModal(true);
}

// Delete Password
async function deletePassword(id) {
    if(confirm("Are you sure you want to delete this password?")) {
        await del("passwords", id);
        loadPasswords();
        showToast('<i class="bi bi-trash"></i> Password deleted');
    }
}

// Toggle Favorite
async function toggleFav(id, state) {
    let p = await get("passwords", id);
    p.fav = !state;
    await put("passwords", p);
    loadPasswords();
    showToast(p.fav ? '<i class="bi bi-heart-fill"></i> Added to favorites' : '<i class="bi bi-heart"></i> Removed from favorites');
}

// Archive/Unarchive
async function archivePassword(id) {
    let p = await get("passwords", id);
    p.archived = true;
    await put("passwords", p);
    loadPasswords();
    showToast('<i class="bi bi-archive"></i> Password archived');
}

async function unarchivePassword(id) {
    let p = await get("passwords", id);
    p.archived = false;
    await put("passwords", p);
    loadPasswords();
    showToast('<i class="bi bi-arrow-up-circle"></i> Password restored');
}

// Toggle Archive View
function toggleArchiveView() {
    showArchived = !showArchived;
    document.getElementById("archiveViewText").innerHTML = showArchived ? 
        '<i class="bi bi-journal-text"></i> Show Active' : 
        '<i class="bi bi-archive"></i> Show Archived';
    loadPasswords();
}

// Copy Password
function copyPassword(password) {
    navigator.clipboard.writeText(password).then(() => {
        showToast('<i class="bi bi-clipboard-check"></i> Password copied to clipboard!');
    });
}

// Update Statistics
async function updateStats() {
    let items = await getAll("passwords");
    const nonArchived = items.filter(p => !p.archived);
    
    document.getElementById("totalCount").textContent = nonArchived.length;
    document.getElementById("favCount").textContent = nonArchived.filter(p => p.fav).length;
    document.getElementById("weakCount").textContent = nonArchived.filter(p => p.strength === 'weak').length;
    document.getElementById("archivedCount").textContent = items.filter(p => p.archived).length;
}

// Clear Filters
function clearAllFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("categoryFilter").value = "all";
    document.getElementById("favFilter").value = "all";
    document.getElementById("sortBy").value = "newest";
    showArchived = false;
    document.getElementById("archiveViewText").innerHTML = '<i class="bi bi-archive"></i> Show Archived';
    loadPasswords();
    showToast('<i class="bi bi-arrow-clockwise"></i> Filters reset');
}

// Export Passwords
async function exportPasswords() {
    let items = await getAll("passwords");
    
    // Include encryption info
    const exportData = {
        version: "1.0",
        exported: new Date().toISOString(),
        encrypted: true,
        data: items
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-passwords-${Date.now()}.json`;
    link.click();
    
    document.getElementById("exportPreview").innerText = `Exported ${items.length} passwords (encrypted)\n\n` + dataStr.substring(0, 500) + '...';
    showToast('<i class="bi bi-download"></i> Passwords exported!');
}

// Import Passwords
async function importPasswords() {
    const file = document.getElementById("importFile").files[0];
    if(!file) {
        alert("Please select a file first!");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importData = JSON.parse(e.target.result);
            let data = importData.data || importData;
            
            if(!Array.isArray(data)) {
                alert("Invalid file format!");
                return;
            }
            
            for(let item of data) {
                delete item.id;
                await add("passwords", item);
            }
            
            loadPasswords();
            closeExportModal();
            showToast(`<i class="bi bi-upload"></i> ${data.length} passwords imported successfully!`);
        } catch(err) {
            alert("Error importing file: " + err.message);
        }
    };
    reader.readAsText(file);
}

// Toast Notification
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.innerHTML = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

// Handle Enter key on master password
document.addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && document.getElementById("masterPasswordScreen").style.display !== 'none') {
        handleMasterPassword();
    }
});

// Initialize
openDB().then(() => {
    checkMasterPassword();
});

// Add export button in top controls
document.addEventListener('DOMContentLoaded', () => {
    const topControls = document.querySelector('.top-controls');
    if(topControls) {
        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = '<i class="bi bi-download"></i> Export';
        exportBtn.onclick = openExportModal;
        topControls.appendChild(exportBtn);
    }
});
