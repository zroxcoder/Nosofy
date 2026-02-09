let db;
let progressChart = null;
let currentTab = 'profile';

// Achievements data
const achievements = [
    {id:'first-task', icon:'bi-list-check', name:'First Task', desc:'Complete your first task', unlocked:false},
    {id:'task-master', icon:'bi-trophy', name:'Task Master', desc:'Complete 10 tasks', unlocked:false},
    {id:'first-project', icon:'bi-folder-check', name:'First Project', desc:'Complete your first project', unlocked:false},
    {id:'project-hero', icon:'bi-award', name:'Project Hero', desc:'Complete 5 projects', unlocked:false},
    {id:'note-taker', icon:'bi-journal', name:'Note Taker', desc:'Create 10 notes', unlocked:false},
    {id:'scholar', icon:'bi-book', name:'Scholar', desc:'Complete 3 courses', unlocked:false},
    {id:'streak-3', icon:'bi-fire', name:'3-Day Streak', desc:'Use app for 3 days straight', unlocked:false},
    {id:'streak-7', icon:'bi-lightning', name:'Week Warrior', desc:'Use app for 7 days straight', unlocked:false},
    {id:'certified', icon:'bi-patch-check', name:'Certified', desc:'Upload 5 certificates', unlocked:false},
];

function openDB() {
    return new Promise((resolve, reject) => {
       const req = indexedDB.open("Nosofy", 8);
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

function get(store,key){return new Promise(resolve=>{ const tx=db.transaction(store,"readonly"); const req=tx.objectStore(store).get(key); req.onsuccess=()=>resolve(req.result); req.onerror=()=>resolve(null); });}
function getAll(store){return new Promise(resolve=>{ const tx=db.transaction(store,"readonly"); const req=tx.objectStore(store).getAll(); req.onsuccess=()=>resolve(req.result); req.onerror=()=>resolve([]); });}
function add(store,obj){return new Promise(resolve=>{ const tx=db.transaction(store,"readwrite"); const req=tx.objectStore(store).add(obj); req.onsuccess=()=>resolve(); });}
function put(store,obj){return new Promise(resolve=>{ const tx=db.transaction(store,"readwrite"); const req=tx.objectStore(store).put(obj); req.onsuccess=()=>resolve(); });}
function del(store,key){return new Promise(resolve=>{ const tx=db.transaction(store,"readwrite"); const req=tx.objectStore(store).delete(key); req.onsuccess=()=>resolve(); });}

function switchTab(tab){
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tab + '-tab').classList.add('active');
    currentTab = tab;
    
    if(tab === 'progress') loadProgress();
    if(tab === 'achievements') loadAchievements();
    if(tab === 'data') updateDatabaseStats();
}

function openEditProfileModal(){
    const profile = get("profile",1).then(p => {
        p = p || {};
        document.getElementById("editUsername").value = p.username || "";
        document.getElementById("editStatus").value = p.status || "";
        document.getElementById("editFullName").value = p.fullName || "";
        document.getElementById("editEmail").value = p.email || "";
        document.getElementById("editPhone").value = p.phone || "";
        document.getElementById("editLocation").value = p.location || "";
        document.getElementById("editOccupation").value = p.occupation || "";
        document.getElementById("editBirthday").value = p.birthday || "";
    });
    document.getElementById("editProfileModal").style.display = "flex";
}

function closeEditProfileModal(){
    document.getElementById("editProfileModal").style.display = "none";
}

async function loadProfile() {
    const profile = await get("profile",1) || {};
    
    document.getElementById("username").innerText = profile.username || "Your Name";
    document.getElementById("status").innerHTML = `<i class="bi bi-chat-quote"></i> ${profile.status || "Your Status"}`;
    document.getElementById("emailText").innerText = profile.email || "Not set";
    document.getElementById("joinDateText").innerText = profile.joinDate || new Date().toLocaleDateString();
    
    if(profile.pic) document.getElementById("profilePic").src = profile.pic;
    
    document.getElementById("fullName").value = profile.fullName || "";
    document.getElementById("emailInput").value = profile.email || "";
    document.getElementById("phone").value = profile.phone || "";
    document.getElementById("location").value = profile.location || "";
    document.getElementById("occupation").value = profile.occupation || "";
    document.getElementById("birthday").value = profile.birthday || "";
}

async function saveProfile() {
    const existing = await get("profile",1) || {};
    
    const profile = {
        id: 1,
        username: document.getElementById("editUsername").value || existing.username || "Your Name",
        status: document.getElementById("editStatus").value || existing.status || "Your Status",
        fullName: document.getElementById("editFullName").value || existing.fullName || "",
        email: document.getElementById("editEmail").value || existing.email || "",
        phone: document.getElementById("editPhone").value || existing.phone || "",
        location: document.getElementById("editLocation").value || existing.location || "",
        occupation: document.getElementById("editOccupation").value || existing.occupation || "",
        birthday: document.getElementById("editBirthday").value || existing.birthday || "",
        pic: document.getElementById("profilePic").src,
        joinDate: existing.joinDate || new Date().toLocaleDateString(),
        achievements: existing.achievements || []
    };
    
    await put("profile", profile);
    await logActivity(`Updated profile`, 'profile');
    closeEditProfileModal();
    loadProfile();
    showToast('<i class="bi bi-check-circle"></i> Profile updated successfully!');
}

function uploadProfilePic(e){
    const reader = new FileReader();
    reader.onload = ()=>{ 
        document.getElementById("profilePic").src = reader.result;
        showToast('<i class="bi bi-image"></i> Profile picture updated!');
    }
    reader.readAsDataURL(e.target.files[0]);
}

async function uploadCertificates(e){
    const files = Array.from(e.target.files);
    for(const file of files){
        const reader = new FileReader();
        reader.onload = async () => {
            await add("certificates",{file: reader.result, name: file.name, type:file.type, time:new Date().toLocaleString(), timestamp:Date.now()});
            await logActivity(`Added certificate: ${file.name}`, 'certificate');
            loadCertificates();
            showToast(`<i class="bi bi-award"></i> Certificate "${file.name}" uploaded!`);
        };
        reader.readAsDataURL(file);
    }
    e.target.value = '';
}

async function loadCertificates(){
    const grid = document.getElementById("certificatesGrid");
    grid.innerHTML = "";
    const certs = await getAll("certificates");
    
    if(certs.length === 0){
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <i class="bi bi-award"></i>
                <h3>No certificates yet</h3>
                <p>Upload your certificates to showcase your achievements</p>
            </div>
        `;
        return;
    }
    
    certs.forEach(c=>{
        const div = document.createElement("div");
        div.className="certificate-card";
        
        if(c.type.includes("pdf")){
            div.innerHTML=`
                <button class="cert-delete" onclick="deleteCertificate(${c.id})"><i class="bi bi-x"></i></button>
                <i class="bi bi-file-pdf" style="font-size:48px;color:#f44336;margin:20px 0;"></i>
                <p class="cert-name">${c.name}</p>
                <div class="cert-actions">
                    <button onclick="viewCertificate(${c.id})"><i class="bi bi-eye"></i> View</button>
                    <button onclick="downloadCertificate(${c.id})"><i class="bi bi-download"></i> Download</button>
                </div>
            `;
        } else {
            div.innerHTML=`
                <button class="cert-delete" onclick="deleteCertificate(${c.id})"><i class="bi bi-x"></i></button>
                <img src="${c.file}" onclick="viewCertificate(${c.id})" style="cursor:pointer;">
                <p class="cert-name">${c.name}</p>
                <div class="cert-actions">
                    <button onclick="viewCertificate(${c.id})"><i class="bi bi-eye"></i> View</button>
                    <button onclick="downloadCertificate(${c.id})"><i class="bi bi-download"></i> Download</button>
                </div>
            `;
        }
        grid.appendChild(div);
    });
}

async function viewCertificate(id){
    const cert = await get("certificates", id);
    if(!cert) return;
    
    document.getElementById("certModalTitle").innerText = cert.name;
    
    if(cert.type.includes("pdf")){
        document.getElementById("certModalContent").innerHTML = `
            <iframe src="${cert.file}" style="width:100%;height:500px;border:none;"></iframe>
        `;
    } else {
        document.getElementById("certModalContent").innerHTML = `
            <img src="${cert.file}" style="max-width:100%;max-height:70vh;border-radius:8px;">
        `;
    }
    
    document.getElementById("viewCertModal").style.display = "flex";
}

function closeViewCertModal(){
    document.getElementById("viewCertModal").style.display = "none";
}

async function downloadCertificate(id){
    const cert = await get("certificates", id);
    if(!cert) return;
    
    const a = document.createElement('a');
    a.href = cert.file;
    a.download = cert.name;
    a.click();
    showToast('<i class="bi bi-download"></i> Certificate downloaded!');
}

async function deleteCertificate(id){
    if(!confirm("Delete this certificate?")) return;
    await del("certificates", id);
    await logActivity(`Deleted a certificate`, 'certificate');
    loadCertificates();
    showToast('<i class="bi bi-trash"></i> Certificate deleted!');
}

async function logActivity(action, type='general'){
    await add("activity",{action, type, time:new Date().toLocaleString(), timestamp:Date.now()});
}

async function loadActivity(){
    const grid = document.getElementById("activityGrid");
    grid.innerHTML="";
    
    const search = document.getElementById("activitySearch").value.toLowerCase();
    const filter = document.getElementById("activityFilter").value;
    
    let activities = await getAll("activity");
    
    // Apply filters
    if(search) {
        activities = activities.filter(a => a.action.toLowerCase().includes(search));
    }
    if(filter !== 'all') {
        activities = activities.filter(a => a.type === filter);
    }
    
    if(activities.length === 0){ 
        grid.innerHTML=`
            <div class="empty-state">
                <i class="bi bi-clock-history"></i>
                <h3>No activity found</h3>
                <p>Your recent activities will appear here</p>
            </div>
        `; 
        return; 
    }
    
    activities.slice(-50).reverse().forEach(a=>{
        const div = document.createElement("div");
        div.className="activity-card";
        
        let icon = 'bi-circle';
        if(a.type === 'profile') icon = 'bi-person';
        else if(a.type === 'certificate') icon = 'bi-award';
        else if(a.type === 'task') icon = 'bi-list-check';
        else if(a.type === 'project') icon = 'bi-folder';
        else if(a.type === 'course') icon = 'bi-book';
        else if(a.type === 'note') icon = 'bi-sticky';
        
        div.innerHTML = `
            <i class="bi ${icon}"></i>
            <span>${a.action}</span>
            <span class="time">${a.time}</span>
        `;
        grid.appendChild(div);
    });
}

async function exportActivity(){
    const activities = await getAll("activity");
    let text = "EDUMATE ACTIVITY LOG\n" + "=".repeat(50) + "\n\n";
    
    activities.forEach((a, i) => {
        text += `[${i+1}] ${a.time}\n`;
        text += `${a.action}\n`;
        text += `Type: ${a.type || 'general'}\n`;
        text += "-".repeat(50) + "\n";
    });
    
    const blob = new Blob([text], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edumate-activity-${Date.now()}.txt`;
    a.click();
    showToast('<i class="bi bi-download"></i> Activity log exported!');
}

async function clearActivity(){
    if(!confirm("Clear all activity history?")) return;
    const tx=db.transaction("activity","readwrite");
    await tx.objectStore("activity").clear();
    loadActivity();
    showToast('<i class="bi bi-trash"></i> Activity history cleared!');
}

async function loadProgress(){
    try {
        const projects = await getAll("projects");
        const tasks = await getAll("tasks");
        const courses = await getAll("courses");
        
        const counts = [
            projects.filter(p=>p.done || p.status === "Completed").length,
            tasks.filter(t=>t.done).length,
            courses.filter(c=>c.done).length
        ];
        const total = counts.reduce((s,v)=>s+v,0);

        // Update progress bars
        const projectTotal = projects.length;
        const taskTotal = tasks.length;
        const courseTotal = courses.length;
        
        const projectPercent = projectTotal > 0 ? (counts[0] / projectTotal * 100).toFixed(0) : 0;
        const taskPercent = taskTotal > 0 ? (counts[1] / taskTotal * 100).toFixed(0) : 0;
        const coursePercent = courseTotal > 0 ? (counts[2] / courseTotal * 100).toFixed(0) : 0;
        
        document.getElementById("projectProgress").style.width = projectPercent + '%';
        document.getElementById("projectProgress").textContent = projectPercent + '%';
        
        document.getElementById("taskProgress").style.width = taskPercent + '%';
        document.getElementById("taskProgress").textContent = taskPercent + '%';
        
        document.getElementById("courseProgress").style.width = coursePercent + '%';
        document.getElementById("courseProgress").textContent = coursePercent + '%';

        if(progressChart) { progressChart.destroy(); progressChart = null; }

        let chartData, chartType = "doughnut", chartOptions = {
            responsive:true,
            plugins:{
                legend:{ display:true, position:'bottom' },
                tooltip:{ enabled:true }
            }
        };

        if(total === 0){
            chartData = {
                labels: ["No completed items"],
                datasets: [{ data: [1], backgroundColor: ["#e0e0e0"] }]
            };
            chartOptions.plugins.legend.display = false;
        } else {
            chartData = {
                labels: ["Projects Completed","Tasks Completed","Courses Completed"],
                datasets: [{ 
                    data: counts, 
                    backgroundColor:["#4CAF50","#2196F3","#FF9800"],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            };
        }

        const errEl = document.getElementById('progressError');
        errEl.style.display = 'none';
        errEl.innerText = '';

        progressChart = new Chart(document.getElementById("progressChart"), {
            type: chartType,
            data: chartData,
            options: chartOptions
        });
    } catch (err) {
        console.error("loadProgress error:", err);
        const errEl = document.getElementById('progressError');
        errEl.innerText = "Unable to render chart: " + (err && err.message ? err.message : "unknown error");
        errEl.style.display = 'block';
        if(progressChart){ progressChart.destroy(); progressChart = null; }
    }
}

async function loadAchievements(){
    const grid = document.getElementById("achievementGrid");
    grid.innerHTML = "";
    
    const profile = await get("profile", 1) || {};
    const unlockedAchievements = profile.achievements || [];
    
    const projects = await getAll("projects");
    const tasks = await getAll("tasks");
    const notes = await getAll("notes");
    const courses = await getAll("courses");
    const certs = await getAll("certificates");
    
    const completedProjects = projects.filter(p => p.done || p.status === "Completed").length;
    const completedTasks = tasks.filter(t => t.done).length;
    const completedCourses = courses.filter(c => c.done).length;
    
    achievements.forEach(ach => {
        let unlocked = unlockedAchievements.includes(ach.id);
        
        // Check unlock conditions
        if(!unlocked){
            if(ach.id === 'first-task' && completedTasks >= 1) unlocked = true;
            if(ach.id === 'task-master' && completedTasks >= 10) unlocked = true;
            if(ach.id === 'first-project' && completedProjects >= 1) unlocked = true;
            if(ach.id === 'project-hero' && completedProjects >= 5) unlocked = true;
            if(ach.id === 'note-taker' && notes.length >= 10) unlocked = true;
            if(ach.id === 'scholar' && completedCourses >= 3) unlocked = true;
            if(ach.id === 'certified' && certs.length >= 5) unlocked = true;
            
            if(unlocked && !unlockedAchievements.includes(ach.id)){
                unlockedAchievements.push(ach.id);
                profile.achievements = unlockedAchievements;
                put("profile", {...profile, id:1});
                showToast(`<i class="bi bi-trophy"></i> Achievement Unlocked: ${ach.name}!`);
            }
        }
        
        const div = document.createElement("div");
        div.className = `achievement-card ${unlocked ? 'unlocked' : 'locked'}`;
        div.innerHTML = `
            <i class="bi ${ach.icon}"></i>
            <p style="font-weight:700;margin:5px 0;font-size:12px;">${ach.name}</p>
            <p style="font-size:10px;color:#666;margin:0;">${ach.desc}</p>
        `;
        grid.appendChild(div);
    });
}

async function updateStats(){
    const projects = await getAll("projects");
    const tasks = await getAll("tasks");
    const courses = await getAll("courses");
    const profile = await get("profile", 1) || {};
    
    const totalCompleted = 
        projects.filter(p => p.done || p.status === "Completed").length +
        tasks.filter(t => t.done).length +
        courses.filter(c => c.done).length;
    
    document.getElementById("totalCompleted").textContent = totalCompleted;
    document.getElementById("currentStreak").textContent = profile.streak || 0;
    document.getElementById("totalAchievements").textContent = (profile.achievements || []).length;
    
    // Calculate account age
    const joinDate = profile.joinDate ? new Date(profile.joinDate) : new Date();
    const today = new Date();
    const daysDiff = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
    document.getElementById("accountAge").textContent = daysDiff;
}

async function updateDatabaseStats(){
    const notes = await getAll("notes");
    const tasks = await getAll("tasks");
    const projects = await getAll("projects");
    const courses = await getAll("courses");
    const expenses = await getAll("expenses");
    const watchlist = await getAll("watchlist");
    const passwords = await getAll("passwords");
    const cloudhub = await getAll("cloudhub");
    
    document.getElementById("statNotes").textContent = notes.length;
    document.getElementById("statTasks").textContent = tasks.length;
    document.getElementById("statProjects").textContent = projects.length;
    document.getElementById("statCourses").textContent = courses.length;
    document.getElementById("statExpenses").textContent = expenses.length;
    document.getElementById("statWatchlist").textContent = watchlist.length;
    document.getElementById("statPasswords").textContent = passwords.length;
    document.getElementById("statCloudHub").textContent = cloudhub.length;
}

window.addEventListener('storage', (e)=>{
    if(!e.key) return;
    try {
        if(e.key === 'edumate-update'){
            loadProgress().catch(()=>{});
            loadActivity().catch(()=>{});
            loadCertificates().catch(()=>{});
            updateStats().catch(()=>{});
        }
    } catch(err){ console.error(err); }
});

async function exportData(){
    const stores=["notes","tasks","projects","courses","profile","activity","expenses","certificates","watchlist","passwords","cloudhub","timersessions","productivity"];
    const allData={};
    for(const s of stores){ allData[s] = await getAll(s); }
    const blob = new Blob([JSON.stringify(allData,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=`edumate-backup-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('<i class="bi bi-download"></i> Data exported successfully!');
}

async function exportDataCSV(){
    let csv = "Type,Title,Description,Status,Date\n";
    
    const notes = await getAll("notes");
    const tasks = await getAll("tasks");
    const projects = await getAll("projects");
    const courses = await getAll("courses");
    const expenses = await getAll("expenses");
    const watchlist = await getAll("watchlist");
    const passwords = await getAll("passwords");
    const cloudhub = await getAll("cloudhub");
    
    notes.forEach(n => csv += `Note,"${n.title}","${n.content || ''}","","${n.time}"\n`);
    tasks.forEach(t => csv += `Task,"${t.title}","${t.desc || ''}","${t.done ? 'Done' : 'Pending'}","${t.time}"\n`);
    projects.forEach(p => csv += `Project,"${p.title}","${p.description || ''}","${p.status || ''}","${p.time}"\n`);
    courses.forEach(c => csv += `Course,"${c.title}","${c.description || ''}","${c.done ? 'Done' : 'Ongoing'}","${c.time}"\n`);
    expenses.forEach(e => csv += `Expense,"${e.title}","${e.description || ''}","${e.type || ''}","${e.date}","${e.amount}"\n`);
    watchlist.forEach(w => csv += `Watchlist,"${w.title}","${w.desc || ''}","${w.status || ''}","${w.time}","","${w.rating || 0}"\n`);
    passwords.forEach(pw => csv += `Password,"${pw.title}","${pw.username || ''}","${pw.category || ''}","${pw.time}"\n`);
    cloudhub.forEach(c => csv += `CloudHub,"${c.title}","${c.description || ''}","${c.serviceType || ''}","${c.time}","${c.link}"\n`);
    
    
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edumate-export-${Date.now()}.csv`;
    a.click();
    showToast('<i class="bi bi-download"></i> Data exported as CSV!');
}

async function exportDataText(){
    let text = "EDUMATE DATA EXPORT\n" + "=".repeat(70) + "\n\n";
    
    const stores = ["notes","tasks","projects","courses","expenses","watchlist","passwords","cloudhub","timersessions","productivity"];
    for(const store of stores){
        const items = await getAll(store);
        text += `\n${store.toUpperCase()} (${items.length})\n` + "-".repeat(70) + "\n";
        items.forEach((item, i) => {
            text += `\n[${i+1}] ${item.title || 'Untitled'}\n`;
            if(item.content) text += `${item.content}\n`;
            if(item.desc) text += `${item.desc}\n`;
            if(item.description) text += `${item.description}\n`;
            text += `Date: ${item.time || 'N/A'}\n`;
        });
    }
    
    const blob = new Blob([text], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edumate-export-${Date.now()}.txt`;
    a.click();
    showToast('<i class="bi bi-download"></i> Data exported as text!');
}

async function importData(e){
    const file = e.target.files[0];
    if(!file) return;
    
    try {
        const text = await file.text();
        const json = JSON.parse(text);
        
        if(!confirm(`Import data? This will replace existing data.`)) return;
        
        for(const store in json){
            if(!["notes","tasks","projects","courses","profile","activity","certificates","expenses","watchlist","passwords","cloudhub","timersessions","productivity"].includes(store)) continue;
            const tx = db.transaction(store,"readwrite");
            const storeObj = tx.objectStore(store);
            await storeObj.clear();
            for(const item of json[store]) await storeObj.add(item);
        }
        
        loadAll();
        showToast('<i class="bi bi-upload"></i> Data imported successfully!');
    } catch(err){
        alert("Error importing data: " + err.message);
    }
    
    e.target.value = '';
}

async function clearAllData(){
    if(!confirm("⚠️ DELETE ALL DATA? This cannot be undone!")) return;
    if(!confirm("Are you absolutely sure? All your notes, tasks, projects, courses, and certificates will be permanently deleted!")) return;
    
    for(const store of ["notes","tasks","projects","courses","profile","activity","certificates","expenses","watchlist","passwords","cloudhub","timersessions","productivity"]){
        const tx=db.transaction(store,"readwrite");
        tx.objectStore(store).clear();
    }
    
    loadAll();
    showToast('<i class="bi bi-trash"></i> All data cleared!');
}

function showToast(message){
    const toast = document.getElementById("toast");
    toast.innerHTML = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

async function loadAll(){
    await loadProfile();
    await loadCertificates();
    await loadActivity();
    await loadProgress();
    await updateStats();
    await loadAchievements();
    await updateDatabaseStats();
}

openDB().then(loadAll);
