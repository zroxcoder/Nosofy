let db;
let editID=null;
let watchEditID=null;
let showArchived = false;
let currentMode = 'tasks';

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

// ============= MODE SWITCHING =============
function switchMode(mode) {
    currentMode = mode;
    
    if(mode === 'tasks') {
        document.getElementById('tasksSection').classList.remove('hidden');
        document.getElementById('watchlistSection').classList.add('hidden');
        document.getElementById('tasksTab').classList.add('active');
        document.getElementById('watchlistTab').classList.remove('active');
        document.getElementById('randomPickBtn').classList.add('hidden');
        loadTasks();
    } else {
        document.getElementById('tasksSection').classList.add('hidden');
        document.getElementById('watchlistSection').classList.remove('hidden');
        document.getElementById('tasksTab').classList.remove('active');
        document.getElementById('watchlistTab').classList.add('active');
        document.getElementById('randomPickBtn').classList.remove('hidden');
        loadWatchlist();
    }
}

// ============= ADD MODAL OPENER =============
function openAddModal() {
    if(currentMode === 'tasks') {
        openModal();
    } else {
        openWatchModal();
    }
}

// ============= TASKS FUNCTIONS (UNCHANGED) =============
function openModal(isEdit=false){ document.getElementById("taskModal").style.display="flex"; }

function closeModal(){ 
    document.getElementById("taskModal").style.display="none";
    editID=null; 
    taskTitle.value=""; 
    taskDesc.value=""; 
    taskDeadline.value=""; 
    taskPriority.value="Low";
    taskTags.value="";
    taskCategory.value="";
    taskTime.value="";
    taskReminder.checked=false;
    document.getElementById("modalTitle").innerText="Add New Task";
}

function openViewModal(id){
    get("tasks",id).then(t=>{
        if(!t) return;
        document.getElementById("viewTaskTitle").innerText = t.title;
        const status = getTaskStatus(t);
        document.getElementById("viewTaskStatus").innerHTML = `<span class="status-badge status-${status.class}">${status.text}</span>`;
        
        let content = `
            <p><strong>Description:</strong> ${t.desc || 'N/A'}</p>
            <p><strong>Category:</strong> ${t.category || 'N/A'}</p>
            <p><strong>Tags:</strong> ${t.tags || 'N/A'}</p>
            <p><strong>Deadline:</strong> ${t.deadline || 'N/A'} ${t.taskTime ? t.taskTime : ''}</p>
            <p><strong>Priority:</strong> <span class="priority-${t.priority.toLowerCase()}">${t.priority}</span></p>
            <p><strong>Status:</strong> ${t.done ? 'Completed' : 'Pending'}</p>
            <p><strong>Created:</strong> ${t.createdTime}</p>
            ${t.reminder ? '<p><strong>Reminder:</strong> Set</p>' : ''}
        `;
        
        document.getElementById("viewTaskContent").innerHTML = content;
        document.getElementById("viewTaskModal").style.display = "flex";
    });
}

function closeViewModal(){ document.getElementById("viewTaskModal").style.display="none"; }

function openArchiveModal(){ 
    loadArchivedTasks();
    document.getElementById("archiveModal").style.display="flex"; 
}
function closeArchiveModal(){ document.getElementById("archiveModal").style.display="none"; }

function openExportModal(){ document.getElementById("exportModal").style.display="flex"; }
function closeExportModal(){ document.getElementById("exportModal").style.display="none"; }

async function saveTask(){
    let doneState = false;
    let pinnedState = false;
    let favState = false;
    let archivedState = false;
    
    if(editID){
        const existing = await get("tasks", editID);
        doneState = existing && existing.done ? true : false;
        pinnedState = existing && existing.pinned ? true : false;
        favState = existing && existing.fav ? true : false;
        archivedState = existing && existing.archived ? true : false;
    }
    
    let task={
        title: taskTitle.value || "Untitled Task",
        desc: taskDesc.value,
        deadline: taskDeadline.value,
        priority: taskPriority.value,
        tags: taskTags.value,
        category: taskCategory.value,
        taskTime: taskTime.value,
        reminder: taskReminder.checked,
        pinned: pinnedState,
        fav: favState,
        done: doneState,
        archived: archivedState,
        time: new Date().toLocaleString(),
        createdTime: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    
    if(editID){ 
        task.id=editID; 
        await put("tasks",task);
        showToast('<i class="bi bi-check-circle"></i> Task updated successfully!');
    }
    else {
        await add("tasks",task);
        showToast('<i class="bi bi-check-circle"></i> Task created successfully!');
    }
    
    closeModal(); 
    loadTasks();
}

function getTaskStatus(task){
    if(task.done) return {text: 'Completed', class: 'completed'};
    if(!task.deadline) return {text: 'Pending', class: 'pending'};
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const deadline = new Date(task.deadline);
    deadline.setHours(0,0,0,0);
    
    if(deadline < today) return {text: 'Overdue', class: 'overdue'};
    if(deadline.getTime() === today.getTime()) return {text: 'Due Today', class: 'due-today'};
    return {text: 'Pending', class: 'pending'};
}

async function loadTasks(){
    const container=document.getElementById("taskList");
    container.innerHTML="";
    const search=searchInput.value.toLowerCase();
    const priorityFilterVal=priorityFilter.value;
    const statusFilterVal=statusFilter.value;
    const categoryFilterVal=categoryFilter.value;
    const sortVal=sortBy.value;

    let list=await getAll("tasks");
    
    list = list.filter(t => showArchived ? t.archived : !t.archived);
    
    list = list.filter(t=>
        t.title.toLowerCase().includes(search) || 
        (t.desc && t.desc.toLowerCase().includes(search)) ||
        (t.tags && t.tags.toLowerCase().includes(search))
    );
    
    list = list.filter(t=>priorityFilterVal==="all"||t.priority===priorityFilterVal);
    
    if(categoryFilterVal !== 'all'){
        list = list.filter(t => t.category === categoryFilterVal);
    }
    
    if(statusFilterVal !== 'all'){
        list = list.filter(t => {
            const status = getTaskStatus(t);
            return status.class === statusFilterVal;
        });
    }
    
    if(sortVal === 'date-desc') list.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
    else if(sortVal === 'date-asc') list.sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
    else if(sortVal === 'deadline-asc') list.sort((a,b) => new Date(a.deadline || '9999') - new Date(b.deadline || '9999'));
    else if(sortVal === 'deadline-desc') list.sort((a,b) => new Date(b.deadline || '0') - new Date(a.deadline || '0'));
    else if(sortVal === 'title-asc') list.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
    else if(sortVal === 'title-desc') list.sort((a,b) => (b.title || '').localeCompare(a.title || ''));
    else if(sortVal === 'priority') {
        const priorityOrder = {High: 3, Medium: 2, Low: 1};
        list.sort((a,b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
    }
    
    list=list.sort((a,b)=>b.pinned-a.pinned);
    
    updateStats();
    
    if(list.length === 0){
        container.innerHTML = `
            <div class="empty-state">
                <h3><i class="bi bi-inbox"></i> No tasks found</h3>
                <p>Add your first task or adjust your filters</p>
            </div>
        `;
        return;
    }

    list.forEach(task=>{
        const status = getTaskStatus(task);
        const archivedClass = task.archived ? 'archived' : '';
        
        container.innerHTML+=`
        <div class="task-card ${archivedClass}">
            <span class="pin ${task.pinned?"active":""}" onclick="togglePin(${task.id},${task.pinned})" title="${task.pinned ? 'Unpin' : 'Pin'}"><i class="bi bi-pin-angle-fill"></i></span>
            <span class="fav ${task.fav?"active":""}" onclick="toggleFav(${task.id},${task.fav})" title="${task.fav ? 'Remove Favorite' : 'Add Favorite'}"><i class="bi bi-heart-fill"></i></span>
            
            <span class="status-badge status-${status.class}">${status.text}</span>
            ${task.category ? `<span class="category-badge">${task.category}</span>` : ''}
            
            <label style="display:inline-block;margin-left:5px;margin-bottom:5px;font-size:12px;">
                <input type="checkbox" onchange="toggleDone(${task.id}, this.checked)" ${task.done ? "checked" : ""}> Done
            </label>
            
            <h3>${task.title}</h3>
            <p>${task.desc || 'No description'}</p>
            
            ${task.tags ? `<p><b><i class="bi bi-tags"></i></b> ${task.tags}</p>` : ''}
            <p><b><i class="bi bi-calendar"></i></b> ${task.deadline || 'No deadline'} ${task.taskTime ? '⏰ ' + task.taskTime : ''}</p>
            <p class="priority-${task.priority.toLowerCase()}" style="font-size:12px;">Priority: ${task.priority}</p>
            
            ${task.reminder ? '<p style="font-size:11px;"><i class="bi bi-bell"></i> Reminder Set</p>' : ''}
            
            <small><i class="bi bi-clock"></i> ${task.time}</small>
            
            <div class="actions">
                <button onclick="openViewModal(${task.id})" title="Quick View"><i class="bi bi-eye"></i> View</button>
                <button onclick="editTask(${task.id})" title="Edit"><i class="bi bi-pencil"></i> Edit</button>
                <button onclick="duplicateTask(${task.id})" title="Duplicate"><i class="bi bi-files"></i> Copy</button>
                ${task.archived 
                    ? `<button onclick="unarchiveTask(${task.id})" title="Unarchive"><i class="bi bi-arrow-up-circle"></i> Restore</button>` 
                    : `<button onclick="archiveTask(${task.id})" title="Archive"><i class="bi bi-archive"></i> Archive</button>`
                }
                <button onclick="deleteTask(${task.id})" title="Delete" style="background:#ffcccc;"><i class="bi bi-trash"></i> Delete</button>
            </div>
        </div>`;
    });
}

async function updateStats(){
    let items = await getAll("tasks");
    const total = items.filter(t => !t.archived).length;
    const completed = items.filter(t => t.done && !t.archived).length;
    const pending = items.filter(t => !t.done && !t.archived).length;
    const overdue = items.filter(t => {
        const status = getTaskStatus(t);
        return status.class === 'overdue' && !t.archived;
    }).length;
    const pinned = items.filter(t => t.pinned && !t.archived).length;
    const archived = items.filter(t => t.archived).length;
    
    document.getElementById("totalCount").innerText = total;
    document.getElementById("completedCount").innerText = completed;
    document.getElementById("pendingCount").innerText = pending;
    document.getElementById("overdueCount").innerText = overdue;
    document.getElementById("pinnedCount").innerText = pinned;
    document.getElementById("archivedCount").innerText = archived;
}

async function editTask(id){
    let t=await get("tasks",id);
    editID=id;
    taskTitle.value=t.title; 
    taskDesc.value=t.desc; 
    taskDeadline.value=t.deadline; 
    taskPriority.value=t.priority;
    taskTags.value=t.tags || "";
    taskCategory.value=t.category || "";
    taskTime.value=t.taskTime || "";
    taskReminder.checked=t.reminder || false;
    document.getElementById("modalTitle").innerText="Edit Task";
    openModal(true);
}

async function toggleDone(id, state){
    let t = await get("tasks", id);
    if(!t) return;
    t.done = !!state;
    await put("tasks", t);
    try{ localStorage.setItem('edumate-update', JSON.stringify({time:Date.now(), store:'tasks'})); }catch(e){}
    loadTasks();
    showToast(state ? '<i class="bi bi-check-circle"></i> Task marked as completed!' : '<i class="bi bi-arrow-repeat"></i> Task marked as pending');
}

async function deleteTask(id){ 
    if(confirm("Are you sure you want to delete this task?")){
        await del("tasks",id); 
        loadTasks();
        showToast('<i class="bi bi-trash"></i> Task deleted');
    }
}

async function togglePin(id,state){
    let t=await get("tasks",id);
    t.pinned=!state;
    await put("tasks",t);
    loadTasks();
    showToast(t.pinned ? '<i class="bi bi-pin-angle-fill"></i> Task pinned' : '<i class="bi bi-pin-angle"></i> Task unpinned');
}

async function toggleFav(id,state){ 
    let t=await get("tasks",id); 
    t.fav=!state; 
    await put("tasks",t); 
    loadTasks();
    showToast(t.fav ? '<i class="bi bi-heart-fill"></i> Added to favorites' : '<i class="bi bi-heart"></i> Removed from favorites');
}

async function duplicateTask(id){
    let t = await get("tasks",id);
    let copy = {
        title: t.title + " (Copy)",
        desc: t.desc,
        deadline: t.deadline,
        priority: t.priority,
        tags: t.tags,
        category: t.category,
        taskTime: t.taskTime,
        reminder: t.reminder,
        pinned: false,
        fav: false,
        done: false,
        archived: false,
        time: new Date().toLocaleString(),
        createdTime: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    await add("tasks", copy);
    loadTasks();
    showToast('<i class="bi bi-files"></i> Task duplicated');
}

async function archiveTask(id){
    let t = await get("tasks",id);
    t.archived = true;
    await put("tasks",t);
    loadTasks();
    showToast('<i class="bi bi-archive"></i> Task archived');
}

async function unarchiveTask(id){
    let t = await get("tasks",id);
    t.archived = false;
    await put("tasks",t);
    loadTasks();
    loadArchivedTasks();
    showToast('<i class="bi bi-arrow-up-circle"></i> Task restored');
}

function toggleArchiveView(){
    showArchived = !showArchived;
    document.getElementById("archiveViewText").innerHTML = showArchived ? '<i class="bi bi-journal-text"></i> Show Active' : '<i class="bi bi-archive"></i> Show Archived';
    loadTasks();
}

async function loadArchivedTasks(){
    let items = await getAll("tasks");
    items = items.filter(t => t.archived);
    const container = document.getElementById("archiveList");
    
    if(items.length === 0){
        container.innerHTML = `<div class="empty-state"><p>No archived tasks</p></div>`;
        return;
    }
    
    container.innerHTML = "";
    items.forEach(t => {
        const status = getTaskStatus(t);
        container.innerHTML += `
        <div class="task-card" style="margin-bottom:10px;">
            <span class="status-badge status-${status.class}">${status.text}</span>
            <h3>${t.title}</h3>
            <p>${t.desc || 'No description'}</p>
            <p><b>Deadline:</b> ${t.deadline || 'N/A'}</p>
            <small>${t.time}</small>
            <div class="actions">
                <button onclick="unarchiveTask(${t.id})"><i class="bi bi-arrow-up-circle"></i> Restore</button>
                <button onclick="deleteTask(${t.id})" style="background:#ffcccc;"><i class="bi bi-trash"></i> Delete</button>
            </div>
        </div>`;
    });
}

async function exportTasks(){
    let items = await getAll("tasks");
    const dataStr = JSON.stringify(items, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-tasks-${Date.now()}.json`;
    link.click();
    document.getElementById("exportPreview").innerText = dataStr;
    showToast('<i class="bi bi-download"></i> Tasks exported as JSON!');
}

async function exportTasksText(){
    let items = await getAll("tasks");
    let text = "EDUMATE TASKS EXPORT\n";
    text += "=".repeat(50) + "\n\n";
    
    items.forEach((t, i) => {
        text += `[${i+1}] ${t.title}\n`;
        text += `Description: ${t.desc || 'N/A'}\n`;
        text += `Category: ${t.category || 'N/A'}\n`;
        text += `Tags: ${t.tags || 'None'}\n`;
        text += `Deadline: ${t.deadline || 'N/A'}\n`;
        text += `Priority: ${t.priority}\n`;
        text += `Status: ${t.done ? 'Completed' : 'Pending'}\n`;
        text += `Date: ${t.time}\n`;
        text += "-".repeat(50) + "\n\n";
    });
    
    const dataBlob = new Blob([text], {type: 'text/plain'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-tasks-${Date.now()}.txt`;
    link.click();
    document.getElementById("exportPreview").innerText = text;
    showToast('<i class="bi bi-file-text"></i> Tasks exported as text!');
}

async function exportTasksCSV(){
    let items = await getAll("tasks");
    let csv = "Title,Description,Category,Tags,Deadline,Priority,Status,Created\n";
    
    items.forEach(t => {
        csv += `"${t.title}","${t.desc || ''}","${t.category || ''}","${t.tags || ''}","${t.deadline || ''}","${t.priority}","${t.done ? 'Completed' : 'Pending'}","${t.time}"\n`;
    });
    
    const dataBlob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-tasks-${Date.now()}.csv`;
    link.click();
    showToast('<i class="bi bi-file-earmark-spreadsheet"></i> Tasks exported as CSV!');
}

async function importTasks(){
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
                await add("tasks", item);
            }
            
            loadTasks();
            closeExportModal();
            showToast(`<i class="bi bi-upload"></i> ${data.length} tasks imported successfully!`);
        } catch(err){
            alert("Error importing file: " + err.message);
        }
    };
    reader.readAsText(file);
}

function toggleViewMode(){
    const mode = document.getElementById("viewMode").value;
    const container = document.getElementById("taskList");
    
    if(mode === 'list'){
        container.classList.remove('task-grid');
        container.classList.add('task-list');
    } else {
        container.classList.remove('task-list');
        container.classList.add('task-grid');
    }
}

function clearAllFilters(){
    document.getElementById("searchInput").value = "";
    document.getElementById("priorityFilter").value = "all";
    document.getElementById("statusFilter").value = "all";
    document.getElementById("categoryFilter").value = "all";
    document.getElementById("sortBy").value = "date-desc";
    showArchived = false;
    document.getElementById("archiveViewText").innerHTML = '<i class="bi bi-archive"></i> Show Archived';
    loadTasks();
    showToast('<i class="bi bi-arrow-clockwise"></i> Filters reset');
}

// ============= WATCHLIST FUNCTIONS (NEW) =============

function openWatchModal(isEdit=false){ 
    document.getElementById("watchModal").style.display="flex"; 
}

function closeWatchModal(){ 
    document.getElementById("watchModal").style.display="none";
    watchEditID=null; 
    watchTitle.value=""; 
    watchDesc.value=""; 
    watchType.value="Movie";
    watchStatus.value="Plan to Watch";
    watchPlatform.value="";
    watchSeasons.value="";
    watchEpisodes.value="";
    watchCurrentSeason.value="";
    watchCurrentEpisode.value="";
    watchRating.value="0";
    watchGenre.value="";
    watchYear.value="";
    watchDirector.value="";
    watchCast.value="";
    watchFavorite.checked=false;
    document.getElementById("ratingValue").innerText="0";
    document.getElementById("watchModalTitle").innerText="Add to Watchlist";
}

async function saveWatch(){
    let pinnedState = false;
    let favState = false;
    
    if(watchEditID){
        const existing = await get("watchlist", watchEditID);
        pinnedState = existing && existing.pinned ? true : false;
        favState = existing && existing.fav ? true : false;
    }
    
    const totalEp = parseInt(watchEpisodes.value) || 0;
    const currentEp = parseInt(watchCurrentEpisode.value) || 0;
    const progress = totalEp > 0 ? Math.round((currentEp / totalEp) * 100) : 0;
    
    let watch={
        title: watchTitle.value || "Untitled",
        desc: watchDesc.value,
        type: watchType.value,
        status: watchStatus.value,
        platform: watchPlatform.value,
        seasons: parseInt(watchSeasons.value) || 0,
        episodes: totalEp,
        currentSeason: parseInt(watchCurrentSeason.value) || 0,
        currentEpisode: currentEp,
        progress: progress,
        rating: parseFloat(watchRating.value) || 0,
        genre: watchGenre.value,
        year: parseInt(watchYear.value) || 0,
        director: watchDirector.value,
        cast: watchCast.value,
        favorite: watchFavorite.checked,
        pinned: pinnedState,
        fav: favState || watchFavorite.checked,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    
    if(watchEditID){ 
        watch.id=watchEditID; 
        await put("watchlist",watch);
        showToast('<i class="bi bi-check-circle"></i> Watchlist item updated!');
    }
    else {
        await add("watchlist",watch);
        showToast('<i class="bi bi-check-circle"></i> Added to watchlist!');
    }
    
    closeWatchModal(); 
    loadWatchlist();
}

async function loadWatchlist(){
    const container=document.getElementById("watchList");
    container.innerHTML="";
    const search=watchSearchInput.value.toLowerCase();
    const typeFilterVal=watchTypeFilter.value;
    const statusFilterVal=watchStatusFilter.value;
    const platformFilterVal=watchPlatformFilter.value;
    const sortVal=watchSortBy.value;

    let list=await getAll("watchlist");
    
    list = list.filter(w=>
        w.title.toLowerCase().includes(search) || 
        (w.desc && w.desc.toLowerCase().includes(search)) ||
        (w.genre && w.genre.toLowerCase().includes(search)) ||
        (w.cast && w.cast.toLowerCase().includes(search))
    );
    
    if(typeFilterVal !== 'all'){
        list = list.filter(w => w.type === typeFilterVal);
    }
    
    if(statusFilterVal !== 'all'){
        list = list.filter(w => w.status === statusFilterVal);
    }
    
    if(platformFilterVal !== 'all'){
        list = list.filter(w => w.platform.includes(platformFilterVal));
    }
    
    if(sortVal === 'date-desc') list.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
    else if(sortVal === 'date-asc') list.sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
    else if(sortVal === 'title-asc') list.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
    else if(sortVal === 'title-desc') list.sort((a,b) => (b.title || '').localeCompare(a.title || ''));
    else if(sortVal === 'rating-desc') list.sort((a,b) => (b.rating || 0) - (a.rating || 0));
    else if(sortVal === 'rating-asc') list.sort((a,b) => (a.rating || 0) - (b.rating || 0));
    
    list=list.sort((a,b)=>b.pinned-a.pinned);
    
    updateWatchStats();
    
    if(list.length === 0){
        container.innerHTML = `
            <div class="empty-state">
                <h3><i class="bi bi-camera-reels"></i> No items in watchlist</h3>
                <p>Add your first movie or series!</p>
            </div>
        `;
        return;
    }

    list.forEach(watch=>{
        const typeClass = `type-${watch.type.toLowerCase()}`;
        const statusClass = `status-${watch.status.toLowerCase().replace(/ /g, '-')}`;
        const stars = '★'.repeat(Math.floor(watch.rating)) + '☆'.repeat(10 - Math.floor(watch.rating));
        
        container.innerHTML+=`
        <div class="watch-card">
            <span class="pin ${watch.pinned?"active":""}" onclick="toggleWatchPin(${watch.id},${watch.pinned})" title="${watch.pinned ? 'Unpin' : 'Pin'}"><i class="bi bi-pin-angle-fill"></i></span>
            <span class="fav ${watch.fav?"active":""}" onclick="toggleWatchFav(${watch.id},${watch.fav})" title="${watch.fav ? 'Remove Favorite' : 'Add Favorite'}"><i class="bi bi-heart-fill"></i></span>
            
            <span class="${typeClass}">${watch.type}</span>
            <span class="status-badge ${statusClass}">${watch.status}</span>
            
            <h3>${watch.title}</h3>
            ${watch.year ? `<p><b>Year:</b> ${watch.year}</p>` : ''}
            ${watch.genre ? `<p><b>Genre:</b> ${watch.genre}</p>` : ''}
            ${watch.platform ? `<span class="platform-badge">${watch.platform}</span>` : ''}
            
            ${watch.seasons > 0 ? `<p><b>Seasons:</b> ${watch.seasons} | <b>Episodes:</b> ${watch.episodes}</p>` : ''}
            ${watch.currentSeason > 0 || watch.currentEpisode > 0 ? `<p><b>Progress:</b> S${watch.currentSeason} E${watch.currentEpisode}</p>` : ''}
            
            ${watch.progress > 0 ? `
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width:${watch.progress}%"></div>
                </div>
                <p style="font-size:11px;text-align:center;">${watch.progress}% Complete</p>
            ` : ''}
            
            ${watch.rating > 0 ? `<div class="rating-stars">${stars} (${watch.rating}/10)</div>` : ''}
            
            <p>${watch.desc || 'No description'}</p>
            
            ${watch.director ? `<p style="font-size:11px;"><b>Director:</b> ${watch.director}</p>` : ''}
            ${watch.cast ? `<p style="font-size:11px;"><b>Cast:</b> ${watch.cast}</p>` : ''}
            
            <small><i class="bi bi-clock"></i> ${watch.time}</small>
            
            <div class="actions">
                <button onclick="openViewWatchModal(${watch.id})" title="Quick View"><i class="bi bi-eye"></i> View</button>
                <button onclick="editWatch(${watch.id})" title="Edit"><i class="bi bi-pencil"></i> Edit</button>
                <button onclick="duplicateWatch(${watch.id})" title="Duplicate"><i class="bi bi-files"></i> Copy</button>
                <button onclick="updateProgress(${watch.id})" title="Update Progress"><i class="bi bi-arrow-up-circle"></i> Progress</button>
                <button onclick="deleteWatch(${watch.id})" title="Delete" style="background:#ffcccc;"><i class="bi bi-trash"></i> Delete</button>
            </div>
        </div>`;
    });
}

async function updateWatchStats(){
    let items = await getAll("watchlist");
    const total = items.length;
    const watching = items.filter(w => w.status === 'Watching').length;
    const watched = items.filter(w => w.status === 'Watched').length;
    const plan = items.filter(w => w.status === 'Plan to Watch').length;
    const fav = items.filter(w => w.fav).length;
    
    document.getElementById("watchTotalCount").innerText = total;
    document.getElementById("watchWatchingCount").innerText = watching;
    document.getElementById("watchWatchedCount").innerText = watched;
    document.getElementById("watchPlanCount").innerText = plan;
    document.getElementById("watchFavCount").innerText = fav;
}

async function editWatch(id){
    let w=await get("watchlist",id);
    watchEditID=id;
    watchTitle.value=w.title; 
    watchDesc.value=w.desc; 
    watchType.value=w.type;
    watchStatus.value=w.status;
    watchPlatform.value=w.platform || "";
    watchSeasons.value=w.seasons || "";
    watchEpisodes.value=w.episodes || "";
    watchCurrentSeason.value=w.currentSeason || "";
    watchCurrentEpisode.value=w.currentEpisode || "";
    watchRating.value=w.rating || 0;
    watchGenre.value=w.genre || "";
    watchYear.value=w.year || "";
    watchDirector.value=w.director || "";
    watchCast.value=w.cast || "";
    watchFavorite.checked=w.favorite || false;
    document.getElementById("ratingValue").innerText=w.rating || 0;
    document.getElementById("watchModalTitle").innerText="Edit Watchlist Item";
    openWatchModal(true);
}

async function deleteWatch(id){ 
    if(confirm("Are you sure you want to remove this from watchlist?")){
        await del("watchlist",id); 
        loadWatchlist();
        showToast('<i class="bi bi-trash"></i> Removed from watchlist');
    }
}

async function toggleWatchPin(id,state){
    let w=await get("watchlist",id);
    w.pinned=!state;
    await put("watchlist",w);
    loadWatchlist();
    showToast(w.pinned ? '<i class="bi bi-pin-angle-fill"></i> Pinned' : '<i class="bi bi-pin-angle"></i> Unpinned');
}

async function toggleWatchFav(id,state){ 
    let w=await get("watchlist",id); 
    w.fav=!state; 
    await put("watchlist",w); 
    loadWatchlist();
    showToast(w.fav ? '<i class="bi bi-heart-fill"></i> Added to favorites' : '<i class="bi bi-heart"></i> Removed from favorites');
}

async function duplicateWatch(id){
    let w = await get("watchlist",id);
    let copy = {
        title: w.title + " (Copy)",
        desc: w.desc,
        type: w.type,
        status: w.status,
        platform: w.platform,
        seasons: w.seasons,
        episodes: w.episodes,
        currentSeason: 0,
        currentEpisode: 0,
        progress: 0,
        rating: w.rating,
        genre: w.genre,
        year: w.year,
        director: w.director,
        cast: w.cast,
        favorite: false,
        pinned: false,
        fav: false,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    await add("watchlist", copy);
    loadWatchlist();
    showToast('<i class="bi bi-files"></i> Item duplicated');
}

async function updateProgress(id){
    let w = await get("watchlist",id);
    const newEp = prompt(`Current Episode (Total: ${w.episodes})`, w.currentEpisode || 0);
    if(newEp === null) return;
    
    const newSeason = prompt(`Current Season (Total: ${w.seasons})`, w.currentSeason || 0);
    if(newSeason === null) return;
    
    w.currentEpisode = parseInt(newEp) || 0;
    w.currentSeason = parseInt(newSeason) || 0;
    w.progress = w.episodes > 0 ? Math.round((w.currentEpisode / w.episodes) * 100) : 0;
    
    if(w.progress >= 100) {
        w.status = 'Watched';
    } else if(w.progress > 0) {
        w.status = 'Watching';
    }
    
    await put("watchlist",w);
    loadWatchlist();
    showToast('<i class="bi bi-arrow-up-circle"></i> Progress updated!');
}

function openViewWatchModal(id){
    get("watchlist",id).then(w=>{
        if(!w) return;
        document.getElementById("viewWatchTitle").innerText = w.title;
        
        const stars = '★'.repeat(Math.floor(w.rating)) + '☆'.repeat(10 - Math.floor(w.rating));
        
        let content = `
            <p><strong>Type:</strong> ${w.type}</p>
            <p><strong>Status:</strong> ${w.status}</p>
            <p><strong>Platform:</strong> ${w.platform || 'N/A'}</p>
            ${w.seasons > 0 ? `<p><strong>Seasons:</strong> ${w.seasons}</p>` : ''}
            ${w.episodes > 0 ? `<p><strong>Episodes:</strong> ${w.episodes}</p>` : ''}
            ${w.currentSeason > 0 || w.currentEpisode > 0 ? `<p><strong>Current Progress:</strong> Season ${w.currentSeason}, Episode ${w.currentEpisode}</p>` : ''}
            ${w.progress > 0 ? `<p><strong>Completion:</strong> ${w.progress}%</p>` : ''}
            <p><strong>Rating:</strong> ${stars} (${w.rating}/10)</p>
            <p><strong>Genre:</strong> ${w.genre || 'N/A'}</p>
            <p><strong>Year:</strong> ${w.year || 'N/A'}</p>
            <p><strong>Director:</strong> ${w.director || 'N/A'}</p>
            <p><strong>Cast:</strong> ${w.cast || 'N/A'}</p>
            <p><strong>Description:</strong> ${w.desc || 'N/A'}</p>
            <p><strong>Added:</strong> ${w.time}</p>
        `;
        
        document.getElementById("viewWatchContent").innerHTML = content;
        document.getElementById("viewWatchModal").style.display = "flex";
    });
}

function closeViewWatchModal(){ document.getElementById("viewWatchModal").style.display="none"; }

function clearWatchFilters(){
    document.getElementById("watchSearchInput").value = "";
    document.getElementById("watchTypeFilter").value = "all";
    document.getElementById("watchStatusFilter").value = "all";
    document.getElementById("watchPlatformFilter").value = "all";
    document.getElementById("watchSortBy").value = "date-desc";
    loadWatchlist();
    showToast('<i class="bi bi-arrow-clockwise"></i> Filters reset');
}

// ============= RANDOM PICK FEATURE =============

async function showRandomPick(){
    let items = await getAll("watchlist");
    
    // Filter only items that are "Plan to Watch" or "Watching"
    items = items.filter(w => w.status === 'Plan to Watch' || w.status === 'Watching');
    
    if(items.length === 0){
        showToast('<i class="bi bi-exclamation-circle"></i> No items in your watchlist to pick from!');
        return;
    }
    
    const randomIndex = Math.floor(Math.random() * items.length);
    const pick = items[randomIndex];
    
    const stars = '★'.repeat(Math.floor(pick.rating)) + '☆'.repeat(10 - Math.floor(pick.rating));
    
    let content = `
        <h3>${pick.title}</h3>
        <p><strong>Type:</strong> ${pick.type}</p>
        ${pick.genre ? `<p><strong>Genre:</strong> ${pick.genre}</p>` : ''}
        ${pick.platform ? `<p><strong>Available on:</strong> ${pick.platform}</p>` : ''}
        ${pick.rating > 0 ? `<p><strong>Rating:</strong> ${stars} (${pick.rating}/10)</p>` : ''}
        ${pick.seasons > 0 ? `<p><strong>Seasons:</strong> ${pick.seasons} | <strong>Episodes:</strong> ${pick.episodes}</p>` : ''}
        ${pick.desc ? `<p style="margin-top:15px;">${pick.desc}</p>` : ''}
        <p style="margin-top:20px;font-size:18px;"><strong>🍿 Time to watch this!</strong></p>
    `;
    
    document.getElementById("randomContent").innerHTML = content;
    document.getElementById("randomModal").style.display = "flex";
}

function closeRandomModal(){ 
    document.getElementById("randomModal").style.display="none"; 
}

// ============= EXPORT/IMPORT WATCHLIST =============

async function exportWatchlist(){
    let items = await getAll("watchlist");
    const dataStr = JSON.stringify(items, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-watchlist-${Date.now()}.json`;
    link.click();
    document.getElementById("exportPreview").innerText = dataStr;
    showToast('<i class="bi bi-download"></i> Watchlist exported as JSON!');
}

async function exportWatchlistText(){
    let items = await getAll("watchlist");
    let text = "EDUMATE WATCHLIST EXPORT\n";
    text += "=".repeat(50) + "\n\n";
    
    items.forEach((w, i) => {
        text += `[${i+1}] ${w.title} (${w.type})\n`;
        text += `Status: ${w.status}\n`;
        text += `Platform: ${w.platform || 'N/A'}\n`;
        text += `Genre: ${w.genre || 'N/A'}\n`;
        text += `Rating: ${w.rating}/10\n`;
        if(w.seasons > 0) text += `Seasons: ${w.seasons} | Episodes: ${w.episodes}\n`;
        if(w.progress > 0) text += `Progress: ${w.progress}%\n`;
        text += `Description: ${w.desc || 'N/A'}\n`;
        text += `Added: ${w.time}\n`;
        text += "-".repeat(50) + "\n\n";
    });
    
    const dataBlob = new Blob([text], {type: 'text/plain'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-watchlist-${Date.now()}.txt`;
    link.click();
    document.getElementById("exportPreview").innerText = text;
    showToast('<i class="bi bi-file-text"></i> Watchlist exported as text!');
}

async function exportWatchlistCSV(){
    let items = await getAll("watchlist");
    let csv = "Title,Type,Status,Platform,Genre,Rating,Seasons,Episodes,Progress,Year,Director,Description,Added\n";
    
    items.forEach(w => {
        csv += `"${w.title}","${w.type}","${w.status}","${w.platform || ''}","${w.genre || ''}",${w.rating},${w.seasons},${w.episodes},${w.progress},"${w.year || ''}","${w.director || ''}","${w.desc || ''}","${w.time}"\n`;
    });
    
    const dataBlob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-watchlist-${Date.now()}.csv`;
    link.click();
    showToast('<i class="bi bi-file-earmark-spreadsheet"></i> Watchlist exported as CSV!');
}

async function importWatchlist(){
    const file = document.getElementById("importWatchFile").files[0];
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
                await add("watchlist", item);
            }
            
            loadWatchlist();
            closeExportModal();
            showToast(`<i class="bi bi-upload"></i> ${data.length} items imported to watchlist!`);
        } catch(err){
            alert("Error importing file: " + err.message);
        }
    };
    reader.readAsText(file);
}

// ============= UTILITIES =============

function showToast(message){
    const toast = document.getElementById("toast");
    toast.innerHTML = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

// ============= INITIALIZATION =============

openDB().then(() => {
    loadTasks();
    updateStats();
    updateWatchStats();
});
