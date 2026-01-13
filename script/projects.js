let db;
let editID=null;
let showArchived=false;

//==== Database setup ====
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

function openModal(isEdit=false){
    document.getElementById("projectModal").style.display="flex";
    document.getElementById("modalTitle").innerHTML = isEdit ? '<i class="bi bi-pencil-square"></i> Edit Project' : '<i class="bi bi-plus-circle"></i> Add New Project';
}

function closeModal(){
    document.getElementById("projectModal").style.display="none";
    editID=null;
    projectTitle.value=""; projectDesc.value=""; projectTags.value=""; projectStart.value=""; projectDeadline.value=""; projectPriority.value="Low"; projectSubtasks.value=""; projectStatus.value="Not Started"; projectCategory.value=""; projectReminder.checked=false;
}

function openViewModal(id){
    get("projects",id).then(p=>{
        if(!p) return;
        document.getElementById("viewProjectTitle").innerText = p.title;
        
        const statusClass = (p.status || 'Not Started').toLowerCase().replace(' ','-');
        document.getElementById("viewProjectStatus").innerHTML = `<span class="status-badge status-${statusClass}">${p.status || 'Not Started'}</span>`;
        
        const completedCount = (p.subtasksCompletion || []).filter(Boolean).length;
        const totalCount = (p.subtasks || []).length;
        const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        
        let content = `
            <p><strong>Description:</strong> ${p.description || 'N/A'}</p>
            <p><strong>Category:</strong> ${p.category || 'N/A'}</p>
            <p><strong>Tags:</strong> ${p.tags || 'N/A'}</p>
            <p><strong>Start Date:</strong> ${p.startDate || 'N/A'}</p>
            <p><strong>Deadline:</strong> ${p.deadline || 'N/A'}</p>
            <p><strong>Priority:</strong> <span class="priority-${p.priority.toLowerCase()}">${p.priority}</span></p>
            <p><strong>Status:</strong> ${p.status || 'Not Started'}</p>
            ${totalCount > 0 ? `<p><strong>Progress:</strong> ${completedCount}/${totalCount} subtasks (${progress.toFixed(0)}%)</p>` : ''}
            <p><strong>Created:</strong> ${p.time}</p>
            ${p.reminder ? '<p><strong>Reminder:</strong> Set</p>' : ''}
        `;
        
        if(p.subtasks && p.subtasks.length > 0){
            content += '<p><strong>Subtasks:</strong></p><ul>';
            p.subtasks.forEach((s, idx) => {
                const isCompleted = p.subtasksCompletion && p.subtasksCompletion[idx];
                content += `<li style="${isCompleted ? 'text-decoration:line-through;' : ''}">${isCompleted ? '✓' : '○'} ${s}</li>`;
            });
            content += '</ul>';
        }
        
        document.getElementById("viewProjectContent").innerHTML = content;
        document.getElementById("viewProjectModal").style.display = "flex";
    });
}

function closeViewModal(){ document.getElementById("viewProjectModal").style.display="none"; }

function openArchiveModal(){ 
    loadArchivedProjects();
    document.getElementById("archiveModal").style.display="flex"; 
}
function closeArchiveModal(){ document.getElementById("archiveModal").style.display="none"; }

function openExportModal(){ document.getElementById("exportModal").style.display="flex"; }
function closeExportModal(){ document.getElementById("exportModal").style.display="none"; }

async function saveProject(){
    let doneState = false;
    let subtasksCompletion = [];
    let pinnedState = false;
    let favState = false;
    let archivedState = false;
    
    if(editID){
        const existing = await get("projects", editID);
        doneState = existing && existing.done ? true : false;
        subtasksCompletion = existing && existing.subtasksCompletion ? existing.subtasksCompletion : [];
        pinnedState = existing && existing.pinned ? true : false;
        favState = existing && existing.fav ? true : false;
        archivedState = existing && existing.archived ? true : false;
    }
    
    const subtasksArray = projectSubtasks.value.split("\n").map(s=>s.trim()).filter(s=>s);
    
    if(subtasksCompletion.length !== subtasksArray.length) {
        subtasksCompletion = subtasksArray.map((_, idx) => subtasksCompletion[idx] || false);
    }
    
    let project={
         title: projectTitle.value || "Untitled Project",
         description: projectDesc.value,
         tags: projectTags.value,
         category: projectCategory.value,
         startDate: projectStart.value,
         deadline: projectDeadline.value,
         priority: projectPriority.value,
         status: projectStatus.value,
         subtasks: subtasksArray,
         subtasksCompletion: subtasksCompletion,
         reminder: projectReminder.checked,
         pinned: pinnedState,
         fav: favState,
         done: doneState,
         archived: archivedState,
         time: new Date().toLocaleString(),
         createdTime: new Date().toLocaleString(),
         timestamp: Date.now()
     };
     
     if(editID){ 
         project.id=editID; 
         await put("projects",project);
         showToast('<i class="bi bi-check-circle"></i> Project updated successfully!');
     }
     else {
         await add("projects",project);
         showToast('<i class="bi bi-check-circle"></i> Project created successfully!');
     }
     
     closeModal(); 
     loadProjects();
}

async function updateStats(){
    let items = await getAll("projects");
    const nonArchived = items.filter(p => !p.archived);
    
    document.getElementById("totalCount").textContent = nonArchived.length;
    document.getElementById("inProgressCount").textContent = nonArchived.filter(p => p.status === "In Progress").length;
    document.getElementById("completedCount").textContent = nonArchived.filter(p => p.status === "Completed" || p.done).length;
    document.getElementById("pinnedCount").textContent = nonArchived.filter(p => p.pinned).length;
    document.getElementById("favCount").textContent = nonArchived.filter(p => p.fav).length;
    document.getElementById("archivedCount").textContent = items.filter(p => p.archived).length;
}

async function loadProjects(){
    const container=document.getElementById("projectList");
    container.innerHTML="";
    const search=searchInput.value.toLowerCase();
    const filter=priorityFilter.value;
    const statusFlt=statusFilter.value;
    const categoryFlt=categoryFilter.value;
    const favFlt=favFilter.value;
    const sort=sortBy.value;

    let list=await getAll("projects");
    
    // Filter archived
    list = list.filter(p => showArchived ? p.archived : !p.archived);
    
    // Search filter
    list = list.filter(p=>
        p.title.toLowerCase().includes(search) || 
        (p.description && p.description.toLowerCase().includes(search)) ||
        (p.tags && p.tags.toLowerCase().includes(search))
    );
    
    // Priority filter
    list = list.filter(p=>filter==="all"||p.priority===filter);
    
    // Status filter
    list = list.filter(p=>statusFlt==="all"||p.status===statusFlt);
    
    // Category filter
    if(categoryFlt !== 'all'){
        list = list.filter(p => p.category === categoryFlt);
    }
    
    // Favorite filter
    list = list.filter(p=>favFlt==="all"||p.fav);

    // Sort
    if(sort === "newest") list.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
    else if(sort === "oldest") list.sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
    else if(sort === "deadline") list.sort((a,b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
    else if(sort === "priority") {
        const priorityOrder = {High:3, Medium:2, Low:1};
        list.sort((a,b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
    }
    else if(sort === "name") list.sort((a,b) => a.title.localeCompare(b.title));
    else if(sort === "progress") {
        list.sort((a,b) => {
            const progressA = (a.subtasks || []).length > 0 ? ((a.subtasksCompletion || []).filter(Boolean).length / a.subtasks.length) : 0;
            const progressB = (b.subtasks || []).length > 0 ? ((b.subtasksCompletion || []).filter(Boolean).length / b.subtasks.length) : 0;
            return progressB - progressA;
        });
    }
    
    // Pinned always on top
    list.sort((a,b)=>b.pinned-a.pinned);
    
    updateStats();
    
    if(list.length === 0){
        container.innerHTML = `
            <div class="empty-state">
                <h3><i class="bi bi-folder-x"></i> No projects found</h3>
                <p>Add your first project or adjust your filters</p>
            </div>
        `;
        return;
    }

    list.forEach(p=>{
        const completedCount = (p.subtasksCompletion || []).filter(Boolean).length;
        const totalCount = (p.subtasks || []).length;
        const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        
        const statusClass = (p.status || 'Not Started').toLowerCase().replace(' ','-');
        const archivedClass = p.archived ? 'archived' : '';
        
        const subtasksHTML = (p.subtasks || []).map((s, idx) => {
            const isCompleted = p.subtasksCompletion && p.subtasksCompletion[idx];
            return `<li class="${isCompleted ? 'completed' : ''}">
                <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleSubtask(${p.id}, ${idx})">
                <span>${s}</span>
            </li>`;
        }).join("");
        
        container.innerHTML+=`
        <div class="project-card ${archivedClass}">
            <span class="pin ${p.pinned?"active":""}" onclick="togglePin(${p.id},${p.pinned})" title="${p.pinned ? 'Unpin' : 'Pin'}">
                <i class="bi bi-pin-angle-fill"></i>
            </span>
            <span class="fav ${p.fav?"active":""}" onclick="toggleFav(${p.id},${p.fav})" title="${p.fav ? 'Remove Favorite' : 'Add Favorite'}">
                <i class="bi bi-heart-fill"></i>
            </span>
            
            <span class="status-badge status-${statusClass}">${p.status || 'Not Started'}</span>
            ${p.category ? `<span class="category-badge">${p.category}</span>` : ''}
            ${p.archived ? '<span class="status-badge" style="background:#999;color:#fff;">Archived</span>' : ''}
            
            <div class="checkbox-done">
                <input type="checkbox" id="done-${p.id}" onchange="toggleDone(${p.id}, this.checked)" ${p.done ? "checked" : ""}>
                <label for="done-${p.id}"><i class="bi bi-check-square"></i> Mark as Done</label>
            </div>
            
            <h3><i class="bi bi-folder"></i> ${p.title}</h3>
            <p><i class="bi bi-card-text"></i> ${p.description || 'No description'}</p>
            ${p.tags ? `<p><i class="bi bi-tags"></i> <b>Tags:</b> ${p.tags}</p>` : ''}
            <p><i class="bi bi-calendar-event"></i> <b>Start:</b> ${p.startDate || 'N/A'} | <b>Deadline:</b> ${p.deadline || 'N/A'}</p>
            <p class="priority-${p.priority.toLowerCase()}"><i class="bi bi-exclamation-triangle-fill"></i> ${p.priority} Priority</p>
            
            ${totalCount > 0 ? `
                <div style="margin:10px 0;">
                    <small><i class="bi bi-list-check"></i> Progress: ${completedCount}/${totalCount} subtasks (${progress.toFixed(0)}%)</small>
                    <div class="progress-container">
                        <div class="progress-bar" style="width:${progress}%"></div>
                    </div>
                </div>
            ` : ''}
            
            ${subtasksHTML ? `<ul class="subtasks">${subtasksHTML}</ul>` : ''}
            
            ${p.reminder ? '<p style="font-size:11px;"><i class="bi bi-bell"></i> Reminder Set</p>' : ''}
            
            <small><i class="bi bi-clock"></i> ${p.time}</small>
            
            <div class="actions">
                <button onclick="openViewModal(${p.id})" title="Quick View"><i class="bi bi-eye"></i> View</button>
                <button onclick="editProject(${p.id})" title="Edit"><i class="bi bi-pencil"></i> Edit</button>
                <button onclick="duplicateProject(${p.id})" title="Duplicate"><i class="bi bi-files"></i> Copy</button>
                ${p.archived 
                    ? `<button onclick="unarchiveProject(${p.id})" title="Unarchive"><i class="bi bi-arrow-up-circle"></i> Restore</button>` 
                    : `<button onclick="archiveProject(${p.id})" title="Archive"><i class="bi bi-archive"></i> Archive</button>`
                }
                <button onclick="deleteProject(${p.id})" title="Delete" style="background:#ffcccc;"><i class="bi bi-trash"></i> Delete</button>
            </div>
        </div>`;
    });
}

async function editProject(id){
    let p=await get("projects",id);
    editID=id;
    projectTitle.value=p.title; 
    projectDesc.value=p.description; 
    projectTags.value=p.tags || "";
    projectStart.value=p.startDate; 
    projectDeadline.value=p.deadline; 
    projectPriority.value=p.priority;
    projectStatus.value=p.status || "Not Started";
    projectCategory.value=p.category || "";
    projectSubtasks.value=(p.subtasks || []).join("\n");
    projectReminder.checked=p.reminder || false;
    openModal(true);
}

async function toggleSubtask(id, idx){
    let p = await get("projects", id);
    if(!p) return;
    if(!p.subtasksCompletion) p.subtasksCompletion = [];
    p.subtasksCompletion[idx] = !p.subtasksCompletion[idx];
    await put("projects", p);
    
    try{ localStorage.setItem('edumate-update', JSON.stringify({time:Date.now(), store:'projects'})); }catch(e){}
    loadProjects();
}

async function toggleDone(id, state){
    let p = await get("projects", id);
    if(!p) return;
    p.done = !!state;
    if(state) p.status = "Completed";
    await put("projects", p);

    try{ localStorage.setItem('edumate-update', JSON.stringify({time:Date.now(), store:'projects'})); }catch(e){}
    loadProjects();
    showToast(state ? '<i class="bi bi-check-circle"></i> Project marked as completed!' : '<i class="bi bi-arrow-repeat"></i> Project marked as pending');
}

async function deleteProject(id){ 
    if(confirm("Are you sure you want to delete this project?")) {
        await del("projects",id); 
        loadProjects();
        showToast('<i class="bi bi-trash"></i> Project deleted');
    }
}

async function togglePin(id,state){ 
    let p=await get("projects",id); 
    p.pinned=!state; 
    await put("projects",p); 
    loadProjects();
    showToast(p.pinned ? '<i class="bi bi-pin-angle-fill"></i> Project pinned' : '<i class="bi bi-pin-angle"></i> Project unpinned');
}

async function toggleFav(id,state){ 
    let p=await get("projects",id); 
    p.fav=!state; 
    await put("projects",p); 
    loadProjects();
    showToast(p.fav ? '<i class="bi bi-heart-fill"></i> Added to favorites' : '<i class="bi bi-heart"></i> Removed from favorites');
}

async function duplicateProject(id){
    let p = await get("projects",id);
    let copy = {
        title: p.title + " (Copy)",
        description: p.description,
        tags: p.tags,
        category: p.category,
        startDate: p.startDate,
        deadline: p.deadline,
        priority: p.priority,
        status: p.status,
        subtasks: p.subtasks,
        subtasksCompletion: (p.subtasks || []).map(() => false),
        reminder: p.reminder,
        pinned: false,
        fav: false,
        done: false,
        archived: false,
        time: new Date().toLocaleString(),
        createdTime: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    await add("projects", copy);
    loadProjects();
    showToast('<i class="bi bi-files"></i> Project duplicated');
}

async function archiveProject(id){
    let p = await get("projects",id);
    p.archived = true;
    await put("projects",p);
    loadProjects();
    showToast('<i class="bi bi-archive"></i> Project archived');
}

async function unarchiveProject(id){
    let p = await get("projects",id);
    p.archived = false;
    await put("projects",p);
    loadProjects();
    loadArchivedProjects();
    showToast('<i class="bi bi-arrow-up-circle"></i> Project restored');
}

function toggleArchiveView(){
    showArchived = !showArchived;
    document.getElementById("archiveViewText").innerHTML = showArchived ? '<i class="bi bi-journal-text"></i> Show Active' : '<i class="bi bi-archive"></i> Show Archived';
    loadProjects();
}

async function loadArchivedProjects(){
    let items = await getAll("projects");
    items = items.filter(p => p.archived);
    const container = document.getElementById("archiveList");
    
    if(items.length === 0){
        container.innerHTML = `<div class="empty-state"><p>No archived projects</p></div>`;
        return;
    }
    
    container.innerHTML = "";
    items.forEach(p => {
        const statusClass = (p.status || 'Not Started').toLowerCase().replace(' ','-');
        const completedCount = (p.subtasksCompletion || []).filter(Boolean).length;
        const totalCount = (p.subtasks || []).length;
        
        container.innerHTML += `
        <div class="project-card" style="margin-bottom:10px;">
            <span class="status-badge status-${statusClass}">${p.status || 'Not Started'}</span>
            <h3>${p.title}</h3>
            <p>${p.description || 'No description'}</p>
            ${totalCount > 0 ? `<p><b>Progress:</b> ${completedCount}/${totalCount} subtasks</p>` : ''}
            <p><b>Deadline:</b> ${p.deadline || 'N/A'}</p>
            <small>${p.time}</small>
            <div class="actions">
                <button onclick="unarchiveProject(${p.id})"><i class="bi bi-arrow-up-circle"></i> Restore</button>
                <button onclick="deleteProject(${p.id})" style="background:#ffcccc;"><i class="bi bi-trash"></i> Delete</button>
            </div>
        </div>`;
    });
}

async function exportProjects(){
    let items = await getAll("projects");
    const dataStr = JSON.stringify(items, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-projects-${Date.now()}.json`;
    link.click();
    document.getElementById("exportPreview").innerText = dataStr;
    showToast('<i class="bi bi-download"></i> Projects exported as JSON!');
}

async function exportProjectsText(){
    let items = await getAll("projects");
    let text = "EDUMATE PROJECTS EXPORT\n";
    text += "=".repeat(50) + "\n\n";
    
    items.forEach((p, i) => {
        text += `[${i+1}] ${p.title}\n`;
        text += `Description: ${p.description || 'N/A'}\n`;
        text += `Category: ${p.category || 'N/A'}\n`;
        text += `Tags: ${p.tags || 'None'}\n`;
        text += `Start Date: ${p.startDate || 'N/A'}\n`;
        text += `Deadline: ${p.deadline || 'N/A'}\n`;
        text += `Priority: ${p.priority}\n`;
        text += `Status: ${p.status || 'Not Started'}\n`;
        if(p.subtasks && p.subtasks.length > 0){
            text += `Subtasks:\n`;
            p.subtasks.forEach((s, idx) => {
                const done = p.subtasksCompletion && p.subtasksCompletion[idx] ? '✓' : '○';
                text += `  ${done} ${s}\n`;
            });
        }
        text += `Date: ${p.time}\n`;
        text += "-".repeat(50) + "\n\n";
    });
    
    const dataBlob = new Blob([text], {type: 'text/plain'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-projects-${Date.now()}.txt`;
    link.click();
    document.getElementById("exportPreview").innerText = text;
    showToast('<i class="bi bi-file-text"></i> Projects exported as text!');
}

async function exportProjectsCSV(){
    let items = await getAll("projects");
    let csv = "Title,Description,Category,Tags,Start Date,Deadline,Priority,Status,Progress,Created\n";
    
    items.forEach(p => {
        const completedCount = (p.subtasksCompletion || []).filter(Boolean).length;
        const totalCount = (p.subtasks || []).length;
        const progress = totalCount > 0 ? `${completedCount}/${totalCount}` : 'N/A';
        
        csv += `"${p.title}","${p.description || ''}","${p.category || ''}","${p.tags || ''}","${p.startDate || ''}","${p.deadline || ''}","${p.priority}","${p.status || 'Not Started'}","${progress}","${p.time}"\n`;
    });
    
    const dataBlob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-projects-${Date.now()}.csv`;
    link.click();
    showToast('<i class="bi bi-file-earmark-spreadsheet"></i> Projects exported as CSV!');
}

async function importProjects(){
    const file = document.getElementById("importFile").files[0];
    if(!file){
        alert("Please select a file first!");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if(!Array.isArray(data)){
                alert("Invalid file format!");
                return;
            }
            
            for(let item of data){
                delete item.id;
                await add("projects", item);
            }
            
            loadProjects();
            closeExportModal();
            showToast(`<i class="bi bi-upload"></i> ${data.length} projects imported successfully!`);
        } catch(err){
            alert("Error importing file: " + err.message);
        }
    };
    reader.readAsText(file);
}

function toggleViewMode(){
    const mode = document.getElementById("viewMode").value;
    const container = document.getElementById("projectList");
    
    if(mode === 'list'){
        container.classList.remove('project-grid');
        container.classList.add('project-list');
    } else {
        container.classList.remove('project-list');
        container.classList.add('project-grid');
    }
}

function clearAllFilters(){
    document.getElementById("searchInput").value = "";
    document.getElementById("priorityFilter").value = "all";
    document.getElementById("statusFilter").value = "all";
    document.getElementById("categoryFilter").value = "all";
    document.getElementById("favFilter").value = "all";
    document.getElementById("sortBy").value = "newest";
    showArchived = false;
    document.getElementById("archiveViewText").innerHTML = '<i class="bi bi-archive"></i> Show Archived';
    loadProjects();
    showToast('<i class="bi bi-arrow-clockwise"></i> Filters reset');
}

function showToast(message){
    const toast = document.getElementById("toast");
    toast.innerHTML = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

openDB().then(() => {
    loadProjects();
    updateStats();
});