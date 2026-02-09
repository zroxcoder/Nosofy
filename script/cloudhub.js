
let db;
let editID = null;
let selectedTagFilter = null;
let currentViewLink = null;

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

function get(store,key){return new Promise(resolve=>{ const tx=db.transaction(store,"readonly"); const req=tx.objectStore(store).get(key); req.onsuccess=()=>resolve(req.result); req.onerror=()=>resolve(null);});}
function getAll(store){return new Promise(resolve=>{ const tx=db.transaction(store,"readonly"); const req=tx.objectStore(store).getAll(); req.onsuccess=()=>resolve(req.result); req.onerror=()=>resolve([]);});}
function add(store,obj){return new Promise(resolve=>{ const tx=db.transaction(store,"readwrite"); const req=tx.objectStore(store).add(obj); req.onsuccess=()=>resolve(); });}
function put(store,obj){return new Promise(resolve=>{ const tx=db.transaction(store,"readwrite"); const req=tx.objectStore(store).put(obj); req.onsuccess=()=>resolve(); });}
function del(store,key){return new Promise(resolve=>{ const tx=db.transaction(store,"readwrite"); const req=tx.objectStore(store).delete(key); req.onsuccess=()=>resolve(); });}

// Modal Functions
function openModal(){ 
    document.getElementById("cloudModal").style.display="flex"; 
}

function closeModal(){ 
    document.getElementById("cloudModal").style.display="none";
    editID = null;
    title.value = link.value = description.value = tags.value = timeline.value = "";
    serviceType.value = "gdrive";
    modalTitle.innerText = "Add Cloud Item";
}

function openViewModal(id){
    get("cloudhub",id).then(item=>{
        if(!item) return;
        currentViewLink = item.link;
        
        document.getElementById("viewTitle").innerText = item.title;
        
        const serviceIcons = {
            gdrive: '📁 Google Drive',
            gmail: '📧 Gmail',
            onedrive: '☁️ OneDrive',
            dropbox: '📦 Dropbox',
            other: '🔗 Other'
        };
        document.getElementById("viewService").innerHTML = serviceIcons[item.serviceType] || '🔗 Link';
        
        document.getElementById("viewLinkPreview").innerHTML = `
            <a href="${item.link}" target="_blank">${item.link}</a>
            <button onclick="copyText('${item.link.replace(/'/g, "\\'")}')"><i class="bi bi-clipboard"></i></button>
        `;
        
        document.getElementById("viewDescription").innerText = item.description || 'No description provided';
        
        if(item.timeline){
            document.getElementById("viewTimelineContainer").innerHTML = `
                <h4 style="margin-bottom:8px;">Timeline</h4>
                <div class="timeline-item"><i class="bi bi-calendar-event"></i> ${item.timeline}</div>
            `;
        } else {
            document.getElementById("viewTimelineContainer").innerHTML = '';
        }
        
        document.getElementById("viewTags").innerText = item.tags || 'No tags';
        document.getElementById("viewTime").innerText = item.time;
        document.getElementById("viewModified").innerText = item.modified || item.time;
        
        document.getElementById("viewModal").style.display = "flex";
    });
}

function closeViewModal(){ 
    document.getElementById("viewModal").style.display="none"; 
    currentViewLink = null;
}

function openLink(){
    if(currentViewLink){
        window.open(currentViewLink, '_blank');
    }
}

function openQuickAccessModal(){ 
    loadFavoritesQuick();
    document.getElementById("quickAccessModal").style.display="flex"; 
}

function closeQuickAccessModal(){ 
    document.getElementById("quickAccessModal").style.display="none"; 
}

function openImportExportModal(){ 
    document.getElementById("importExportModal").style.display="flex"; 
}

function closeImportExportModal(){ 
    document.getElementById("importExportModal").style.display="none"; 
}

// Save Cloud Item
async function saveCloudItem(){
    if(!title.value || !link.value){
        alert("Please fill in Title and Link fields!");
        return;
    }
    
    let obj = {
        serviceType: serviceType.value,
        title: title.value,
        link: link.value,
        description: description.value,
        tags: tags.value,
        timeline: timeline.value,
        favorite: false,
        time: new Date().toLocaleString(),
        timestamp: Date.now(),
        modified: new Date().toLocaleString()
    };
    
    if(editID){ 
        let existing = await get("cloudhub", editID);
        obj.id = editID; 
        obj.favorite = existing.favorite;
        obj.time = existing.time;
        await put("cloudhub", obj); 
        showToast('<i class="bi bi-check-circle"></i> Item updated successfully!');
    } else {
        await add("cloudhub", obj);
        showToast('<i class="bi bi-check-circle"></i> Item added successfully!');
    }
    
    closeModal(); 
    loadCloudItems();
}

// Load Cloud Items
async function loadCloudItems(){
    const container = document.getElementById("cloudList");
    container.innerHTML = "";
    let items = await getAll("cloudhub");
    
    // Search filter
    const search = searchBox.value.toLowerCase();
    if(search){
        items = items.filter(item => 
            item.title.toLowerCase().includes(search) || 
            (item.description && item.description.toLowerCase().includes(search)) ||
            (item.tags && item.tags.toLowerCase().includes(search)) ||
            (item.link && item.link.toLowerCase().includes(search))
        );
    }
    
    // Service filter
    const serviceFilter = filterService.value;
    if(serviceFilter !== 'all'){
        items = items.filter(item => item.serviceType === serviceFilter);
    }
    
    // Tag filter
    if(selectedTagFilter){
        items = items.filter(item => item.tags && item.tags.toLowerCase().includes(selectedTagFilter.toLowerCase()));
    }
    
    // Sort
    const sort = sortBy.value;
    if(sort === 'date-desc') items.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
    else if(sort === 'date-asc') items.sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
    else if(sort === 'title-asc') items.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
    else if(sort === 'title-desc') items.sort((a,b) => (b.title || '').localeCompare(a.title || ''));
    
    // Favorites first
    items = items.sort((a,b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
    
    updateStats();
    updateTagFilters();
    
    if(items.length === 0){
        container.innerHTML = `
            <div class="empty-state">
                <h3><i class="bi bi-cloud-slash"></i> No cloud items found</h3>
                <p>Add your first cloud link or adjust your filters</p>
            </div>
        `;
        return;
    }
    
    items.forEach(item => {
        const serviceIcons = {
            gdrive: '<i class="bi bi-google service-icon gdrive"></i> Google Drive',
            gmail: '<i class="bi bi-envelope-fill service-icon gmail"></i> Gmail',
            onedrive: '<i class="bi bi-cloud-fill service-icon onedrive"></i> OneDrive',
            dropbox: '<i class="bi bi-droplet-fill service-icon dropbox"></i> Dropbox',
            other: '<i class="bi bi-link-45deg service-icon other"></i> Other'
        };
        
        const descPreview = item.description 
            ? `${item.description.substring(0,100)}${item.description.length > 100 ? '...' : ''}`
            : '<em>No description</em>';
        
        const timelineInfo = item.timeline 
            ? `<div class="timeline-item"><i class="bi bi-calendar-event"></i> ${item.timeline}</div>`
            : '';
        
        container.innerHTML += `
        <div class="cloud-card">
            <span class="star ${item.favorite?"active":""}" onclick="toggleFavorite(${item.id},${item.favorite})" title="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}">
                <i class="bi bi-star-fill"></i>
            </span>
            <div class="service-badge">${serviceIcons[item.serviceType]}</div>
            <h3>${item.title}</h3>
            <p>${descPreview}</p>
            ${timelineInfo}
            <small><i class="bi bi-tags"></i> ${item.tags || 'No tags'}</small><br>
            <small><i class="bi bi-clock"></i> ${item.time}</small>
            <div class="actions">
                <button onclick="window.open('${item.link}', '_blank')" title="Open Link">
                    <i class="bi bi-box-arrow-up-right"></i> Open
                </button>
                <button onclick="openViewModal(${item.id})" title="View Details">
                    <i class="bi bi-eye"></i> View
                </button>
                <button onclick="editItem(${item.id})" title="Edit">
                    <i class="bi bi-pencil"></i> Edit
                </button>
                <button onclick="copyText('${item.link.replace(/'/g, "\\'")}')">
                    <i class="bi bi-clipboard"></i> Copy
                </button>
                <button onclick="duplicateItem(${item.id})" title="Duplicate">
                    <i class="bi bi-files"></i> Duplicate
                </button>
                <button onclick="deleteItem(${item.id})" title="Delete" style="background:#ffcccc;">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </div>
        </div>`;
    });
}

// Update Statistics
async function updateStats(){
    let items = await getAll("cloudhub");
    
    document.getElementById("totalCount").innerText = items.length;
    document.getElementById("gdriveCount").innerText = items.filter(i => i.serviceType === 'gdrive').length;
    document.getElementById("gmailCount").innerText = items.filter(i => i.serviceType === 'gmail').length;
    document.getElementById("favoriteCount").innerText = items.filter(i => i.favorite).length;
}

// Update Tag Filters
async function updateTagFilters(){
    let items = await getAll("cloudhub");
    let allTags = new Set();
    
    items.forEach(item => {
        if(item.tags){
            item.tags.split(',').forEach(tag => {
                const trimmed = tag.trim();
                if(trimmed) allTags.add(trimmed);
            });
        }
    });
    
    const container = document.getElementById("tagFilters");
    container.innerHTML = "";
    
    if(allTags.size > 0){
        allTags.forEach(tag => {
            const activeClass = selectedTagFilter === tag ? 'active' : '';
            container.innerHTML += `<div class="filter-tag ${activeClass}" onclick="filterByTag('${tag}')">${tag}</div>`;
        });
    }
}

function filterByTag(tag){
    if(selectedTagFilter === tag){
        selectedTagFilter = null;
    } else {
        selectedTagFilter = tag;
    }
    loadCloudItems();
}

// Toggle Favorite
async function toggleFavorite(id, state){
    let item = await get("cloudhub", id);
    item.favorite = !state;
    item.modified = new Date().toLocaleString();
    await put("cloudhub", item);
    loadCloudItems();
    showToast(item.favorite ? '<i class="bi bi-star-fill"></i> Added to favorites' : '<i class="bi bi-star"></i> Removed from favorites');
}

// Edit Item
async function editItem(id){
    let item = await get("cloudhub", id);
    editID = id;
    
    serviceType.value = item.serviceType;
    title.value = item.title; 
    link.value = item.link;
    description.value = item.description; 
    tags.value = item.tags; 
    timeline.value = item.timeline;
    
    modalTitle.innerText = "Edit Cloud Item";
    openModal();
}

// Delete Item
async function deleteItem(id){
    if(confirm("Are you sure you want to delete this item?")){
        await del("cloudhub", id);
        loadCloudItems();
        showToast('<i class="bi bi-trash"></i> Item deleted');
    }
}

// Duplicate Item
async function duplicateItem(id){
    let item = await get("cloudhub", id);
    let copy = {
        serviceType: item.serviceType,
        title: item.title + " (Copy)",
        link: item.link,
        description: item.description,
        tags: item.tags,
        timeline: item.timeline,
        favorite: false,
        time: new Date().toLocaleString(),
        timestamp: Date.now(),
        modified: new Date().toLocaleString()
    };
    await add("cloudhub", copy);
    loadCloudItems();
    showToast('<i class="bi bi-files"></i> Item duplicated');
}

// Copy to Clipboard
function copyText(text){
    if(navigator.clipboard){
        navigator.clipboard.writeText(text).then(() => {
            showToast('<i class="bi bi-clipboard-check"></i> Copied to clipboard!');
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('<i class="bi bi-clipboard-check"></i> Copied to clipboard!');
    }
}

// Clear All Filters
function clearAllFilters(){
    document.getElementById("searchBox").value = "";
    document.getElementById("filterService").value = "all";
    document.getElementById("sortBy").value = "date-desc";
    selectedTagFilter = null;
    loadCloudItems();
    showToast('<i class="bi bi-arrow-clockwise"></i> Filters reset');
}

// Toggle View Mode
function toggleViewMode(){
    const mode = document.getElementById("viewMode").value;
    const container = document.getElementById("cloudList");
    
    if(mode === 'list'){
        container.classList.remove('cloud-grid');
        container.classList.add('cloud-list');
    } else {
        container.classList.remove('cloud-list');
        container.classList.add('cloud-grid');
    }
}

// Load Favorites Quick Access
async function loadFavoritesQuick(){
    let items = await getAll("cloudhub");
    items = items.filter(i => i.favorite);
    
    const container = document.getElementById("favoritesQuickList");
    
    if(items.length === 0){
        container.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No favorite items yet</p>';
        return;
    }
    
    container.innerHTML = "";
    items.slice(0, 10).forEach(item => {
        container.innerHTML += `
        <div style="background:#fff;padding:10px;border-radius:6px;margin:5px 0;display:flex;justify-content:space-between;align-items:center;">
            <div>
                <strong>${item.title}</strong><br>
                <small style="color:#666;">${item.serviceType.toUpperCase()}</small>
            </div>
            <button onclick="window.open('${item.link}', '_blank')" style="background:var(--primary-orange);border:none;padding:8px 15px;border-radius:6px;cursor:pointer;">
                <i class="bi bi-box-arrow-up-right"></i> Open
            </button>
        </div>`;
    });
}

// Export Data
async function exportData(){
    let items = await getAll("cloudhub");
    const dataStr = JSON.stringify(items, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-cloudhub-${Date.now()}.json`;
    link.click();
    document.getElementById("exportPreview").innerText = dataStr;
    showToast('<i class="bi bi-download"></i> Data exported!');
}

async function exportDataText(){
    let items = await getAll("cloudhub");
    let text = "EDUMATE CLOUD HUB EXPORT\n";
    text += "=".repeat(60) + "\n\n";
    
    items.forEach((item, i) => {
        text += `[${i+1}] ${item.title}\n`;
        text += `Service: ${item.serviceType.toUpperCase()}\n`;
        text += `Link: ${item.link}\n`;
        text += `Description: ${item.description || 'N/A'}\n`;
        text += `Tags: ${item.tags || 'None'}\n`;
        text += `Timeline: ${item.timeline || 'N/A'}\n`;
        text += `Added: ${item.time}\n`;
        text += `Favorite: ${item.favorite ? 'Yes' : 'No'}\n`;
        text += "-".repeat(60) + "\n\n";
    });
    
    const dataBlob = new Blob([text], {type: 'text/plain'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-cloudhub-${Date.now()}.txt`;
    link.click();
    document.getElementById("exportPreview").innerText = text;
    showToast('<i class="bi bi-file-text"></i> Data exported as text!');
}

// Import Data
async function importData(){
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
                item.modified = new Date().toLocaleString();
                await add("cloudhub", item);
            }
            
            loadCloudItems();
            closeImportExportModal();
            showToast(`<i class="bi bi-upload"></i> ${data.length} items imported successfully!`);
        } catch(err){
            alert("Error importing file: " + err.message);
        }
    };
    reader.readAsText(file);
}

// Show Toast
function showToast(message){
    const toast = document.getElementById("toast");
    toast.innerHTML = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

// Initialize
openDB().then(() => {
    loadCloudItems();
    updateStats();
});