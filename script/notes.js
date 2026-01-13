let db;
let editID = null;
let showArchived = false;
let selectedTagFilter = null;
let selectedColorFilter = null;
let selectedNoteColor = 'default';

const colorMap = {
    'default': '#ffe0c2',
    'coral': '#f28b82',
    'peach': '#fbbc04',
    'sand': '#fff475',
    'mint': '#ccff90',
    'sage': '#a7ffeb',
    'fog': '#cbf0f8',
    'storm': '#aecbfa',
    'dusk': '#d7aefb',
    'blossom': '#fdcfe8',
    'clay': '#e6c9a8',
    'chalk': '#e8eaed',
    'white': '#ffffff'
};

//===== Database setup =====
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


function get(store,key){return new Promise(resolve=>{ const tx=db.transaction(store,"readonly"); const req=tx.objectStore(store).get(key); req.onsuccess=()=>resolve(req.result); req.onerror=()=>resolve(null);});}
function getAll(store){return new Promise(resolve=>{ const tx=db.transaction(store,"readonly"); const req=tx.objectStore(store).getAll(); req.onsuccess=()=>resolve(req.result); req.onerror=()=>resolve([]);});}
function add(store,obj){return new Promise(resolve=>{ const tx=db.transaction(store,"readwrite"); const req=tx.objectStore(store).add(obj); req.onsuccess=()=>resolve(); });}
function put(store,obj){return new Promise(resolve=>{ const tx=db.transaction(store,"readwrite"); const req=tx.objectStore(store).put(obj); req.onsuccess=()=>resolve(); });}
function del(store,key){return new Promise(resolve=>{ const tx=db.transaction(store,"readwrite"); const req=tx.objectStore(store).delete(key); req.onsuccess=()=>resolve(); });}

function selectColor(color) {
    selectedNoteColor = color;
    document.querySelectorAll('.color-palette .color-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.querySelector(`.color-palette .color-option[data-color="${color}"]`).classList.add('selected');
    
    // Update modal background
    const modalContent = document.getElementById('modalContent');
    modalContent.style.background = colorMap[color];
}

function filterByColor(color) {
    const dots = document.querySelectorAll('.color-filter-dot');
    
    if(selectedColorFilter === color) {
        selectedColorFilter = null;
        dots.forEach(d => d.classList.remove('active'));
    } else {
        selectedColorFilter = color;
        dots.forEach(d => d.classList.remove('active'));
        document.querySelector(`.color-filter-dot[data-color="${color}"]`).classList.add('active');
    }
    loadNotes();
}

function openModal(){ 
    document.getElementById("noteModal").style.display="flex"; 
    selectColor('default');
}

function closeModal(){ 
    document.getElementById("noteModal").style.display="none";
    editID = null;
    title.value = content.value = tags.value = "";
    type.value = "note";
    modalTitle.innerText = "Add Note / Bookmark";
    selectColor('default');
}

function openImportExportModal(){ document.getElementById("importExportModal").style.display="flex"; }
function closeImportExportModal(){ document.getElementById("importExportModal").style.display="none"; }

function openArchiveModal(){ 
    loadArchivedNotes();
    document.getElementById("archiveModal").style.display="flex"; 
}
function closeArchiveModal(){ document.getElementById("archiveModal").style.display="none"; }

function openViewModal(id){
    get("notes",id).then(n=>{
        if(!n) return;
        document.getElementById("viewNoteTitle").innerText = n.title;
        document.getElementById("viewNoteType").innerHTML = n.type === 'note' ? '<i class="bi bi-journal-text"></i> Note' : '<i class="bi bi-link-45deg"></i> Bookmark';
        if(n.type === 'bookmark'){
            document.getElementById("viewNoteContent").innerHTML = `<a href="${n.content}" target="_blank">${n.content}</a>`;
        } else {
            document.getElementById("viewNoteContent").innerText = n.content;
        }
        document.getElementById("viewNoteTags").innerText = n.tags || 'No tags';
        document.getElementById("viewNoteTime").innerText = n.time;
        
        // Apply note color to view modal
        const viewModalContent = document.getElementById("viewModalContent");
        viewModalContent.style.background = colorMap[n.color || 'default'];
        
        document.getElementById("viewNoteModal").style.display = "flex";
    });
}
function closeViewModal(){ document.getElementById("viewNoteModal").style.display="none"; }

async function saveNote(){
    let obj = {
        type: type.value,
        title: title.value || "Untitled",
        content: content.value,
        tags: tags.value,
        color: selectedNoteColor,
        pinned: false,
        archived: false,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    if(editID){ 
        let existing = await get("notes", editID);
        obj.id = editID; 
        obj.pinned = existing.pinned;
        obj.archived = existing.archived;
        await put("notes",obj); 
        showToast('<i class="bi bi-check-circle"></i> Note updated successfully!');
    }
    else {
        await add("notes",obj);
        showToast('<i class="bi bi-check-circle"></i> Note created successfully!');
    }
    closeModal(); 
    loadNotes();
}

async function changeNoteColor(id, color) {
    let n = await get("notes", id);
    n.color = color;
    await put("notes", n);
    loadNotes();
    showToast('<i class="bi bi-palette"></i> Color changed!');
    
    // Close any open mini palettes
    document.querySelectorAll('.mini-color-palette').forEach(p => p.classList.remove('show'));
}

function toggleMiniPalette(id, event) {
    event.stopPropagation();
    const palette = document.getElementById(`miniPalette-${id}`);
    const wasOpen = palette.classList.contains('show');
    
    // Close all palettes first
    document.querySelectorAll('.mini-color-palette').forEach(p => p.classList.remove('show'));
    
    if(!wasOpen) {
        palette.classList.add('show');
    }
}

// Close mini palettes when clicking elsewhere
document.addEventListener('click', () => {
    document.querySelectorAll('.mini-color-palette').forEach(p => p.classList.remove('show'));
});

async function loadNotes(){
    const container = notesList;
    container.innerHTML = "";
    let items = await getAll("notes");
    
    items = items.filter(n => showArchived ? n.archived : !n.archived);
    
    const search = searchBox.value.toLowerCase();
    if(search){
        items = items.filter(n => 
            n.title.toLowerCase().includes(search) || 
            n.content.toLowerCase().includes(search) ||
            (n.tags && n.tags.toLowerCase().includes(search))
        );
    }
    
    const typeFilter = filterType.value;
    if(typeFilter !== 'all'){
        items = items.filter(n => n.type === typeFilter);
    }
    
    if(selectedTagFilter){
        items = items.filter(n => n.tags && n.tags.toLowerCase().includes(selectedTagFilter.toLowerCase()));
    }
    
    if(selectedColorFilter){
        items = items.filter(n => (n.color || 'default') === selectedColorFilter);
    }
    
    const sort = sortBy.value;
    if(sort === 'date-desc') items.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
    else if(sort === 'date-asc') items.sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
    else if(sort === 'title-asc') items.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
    else if(sort === 'title-desc') items.sort((a,b) => (b.title || '').localeCompare(a.title || ''));
    else if(sort === 'color') items.sort((a,b) => (a.color || 'default').localeCompare(b.color || 'default'));
    
    items = items.sort((a,b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    
    updateStats();
    updateTagFilters();
    
    if(items.length === 0){
        container.innerHTML = `
            <div class="empty-state">
                <h3><i class="bi bi-inbox"></i> No notes found</h3>
                <p>Create your first note or adjust your filters</p>
            </div>
        `;
        return;
    }
    
    items.forEach(n=>{
        const archivedClass = n.archived ? 'archived' : '';
        const noteColor = colorMap[n.color || 'default'];
        const contentPreview = n.type === 'bookmark' 
            ? `<a href="${n.content}" target="_blank">${n.content.substring(0,50)}${n.content.length > 50 ? '...' : ''}</a>`
            : `${(n.content || '').substring(0,100)}${(n.content || '').length > 100 ? '...' : ''}`;
        
        // Generate mini color palette
        let miniPaletteHTML = `<div class="mini-color-palette" id="miniPalette-${n.id}">`;
        Object.keys(colorMap).forEach(colorKey => {
            miniPaletteHTML += `<div class="mini-color-option" style="background:${colorMap[colorKey]};" onclick="changeNoteColor(${n.id}, '${colorKey}')" title="${colorKey}"></div>`;
        });
        miniPaletteHTML += `</div>`;
        
        container.innerHTML += `
        <div class="note-card ${archivedClass}" style="background:${noteColor};">
            <span class="color-change-btn" onclick="toggleMiniPalette(${n.id}, event)" title="Change Color"><i class="bi bi-palette"></i></span>
            ${miniPaletteHTML}
            <span class="pin ${n.pinned?"active":""}" onclick="togglePin(${n.id},${n.pinned})" title="${n.pinned ? 'Unpin' : 'Pin'}"><i class="bi bi-pin-angle-fill"></i></span>
            <div class="type-badge">${n.type==='note'?'<i class="bi bi-journal-text"></i> Note':'<i class="bi bi-link-45deg"></i> Bookmark'}</div>
            <h3>${n.title}</h3>
            <p>${contentPreview}</p>
            <small><i class="bi bi-tags"></i> ${n.tags || 'No tags'}</small><br>
            <small><i class="bi bi-clock"></i> ${n.time}</small>
            <div class="actions">
                <button onclick="openViewModal(${n.id})" title="Quick View"><i class="bi bi-eye"></i> View</button>
                <button onclick="editNote(${n.id})" title="Edit"><i class="bi bi-pencil"></i> Edit</button>
                <button onclick="duplicateNote(${n.id})" title="Duplicate"><i class="bi bi-files"></i> Copy</button>
                <button onclick="copyToClipboard(${n.id})" title="Copy to Clipboard"><i class="bi bi-clipboard"></i></button>
                ${n.archived 
                    ? `<button onclick="unarchiveNote(${n.id})" title="Unarchive"><i class="bi bi-arrow-up-circle"></i> Restore</button>` 
                    : `<button onclick="archiveNote(${n.id})" title="Archive"><i class="bi bi-archive"></i></button>`
                }
                <button onclick="deleteNote(${n.id})" title="Delete" style="background:rgba(255,100,100,0.4);"><i class="bi bi-trash"></i></button>
            </div>
        </div>`;
    });
}

async function updateStats(){
    let items = await getAll("notes");
    const notes = items.filter(n => n.type === 'note' && !n.archived).length;
    const bookmarks = items.filter(n => n.type === 'bookmark' && !n.archived).length;
    const pinned = items.filter(n => n.pinned && !n.archived).length;
    const archived = items.filter(n => n.archived).length;
    
    document.getElementById("noteCount").innerText = notes;
    document.getElementById("bookmarkCount").innerText = bookmarks;
    document.getElementById("pinnedCount").innerText = pinned;
    document.getElementById("archivedCount").innerText = archived;
}

async function updateTagFilters(){
    let items = await getAll("notes");
    let allTags = new Set();
    
    items.forEach(n => {
        if(n.tags && !n.archived){
            n.tags.split(',').forEach(tag => {
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
    loadNotes();
}

function clearAllFilters(){
    document.getElementById("searchBox").value = "";
    document.getElementById("filterType").value = "all";
    document.getElementById("sortBy").value = "date-desc";
    selectedTagFilter = null;
    selectedColorFilter = null;
    showArchived = false;
    document.getElementById("archiveViewText").innerHTML = '<i class="bi bi-archive"></i> Show Archived';
    document.querySelectorAll('.color-filter-dot').forEach(d => d.classList.remove('active'));
    loadNotes();
    showToast('<i class="bi bi-arrow-clockwise"></i> Filters reset');
}

async function togglePin(id,state){
    let n = await get("notes",id);
    n.pinned = !state;
    await put("notes",n);
    loadNotes();
    showToast(n.pinned ? '<i class="bi bi-pin-angle-fill"></i> Note pinned' : '<i class="bi bi-pin-angle"></i> Note unpinned');
}

async function deleteNote(id){
    if(confirm("Are you sure you want to permanently delete this note?")){
        await del("notes",id);
        loadNotes();
        showToast('<i class="bi bi-trash"></i> Note deleted');
    }
}

async function editNote(id){
    let n = await get("notes",id);
    editID = id;
    title.value = n.title; 
    content.value = n.content; 
    tags.value = n.tags; 
    type.value = n.type;
    selectColor(n.color || 'default');
    modalTitle.innerText = "Edit Note / Bookmark";
    openModal();
}

async function archiveNote(id){
    let n = await get("notes",id);
    n.archived = true;
    await put("notes",n);
    loadNotes();
    showToast('<i class="bi bi-archive"></i> Note archived');
}

async function unarchiveNote(id){
    let n = await get("notes",id);
    n.archived = false;
    await put("notes",n);
    loadNotes();
    loadArchivedNotes();
    showToast('<i class="bi bi-arrow-up-circle"></i> Note restored');
}

async function duplicateNote(id){
    let n = await get("notes",id);
    let copy = {
        type: n.type,
        title: n.title + " (Copy)",
        content: n.content,
        tags: n.tags,
        color: n.color || 'default',
        pinned: false,
        archived: false,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    await add("notes", copy);
    loadNotes();
    showToast('<i class="bi bi-files"></i> Note duplicated');
}

async function copyToClipboard(id){
    let n = await get("notes",id);
    const text = `${n.title}\n\n${n.content}\n\nTags: ${n.tags || 'None'}`;
    
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

function toggleArchiveView(){
    showArchived = !showArchived;
    document.getElementById("archiveViewText").innerHTML = showArchived ? '<i class="bi bi-journal-text"></i> Show Active' : '<i class="bi bi-archive"></i> Show Archived';
    loadNotes();
}

async function loadArchivedNotes(){
    let items = await getAll("notes");
    items = items.filter(n => n.archived);
    const container = document.getElementById("archiveList");
    
    if(items.length === 0){
        container.innerHTML = `<div class="empty-state"><p>No archived notes</p></div>`;
        return;
    }
    
    container.innerHTML = "";
    items.forEach(n => {
        const noteColor = colorMap[n.color || 'default'];
        container.innerHTML += `
        <div class="note-card" style="margin-bottom:10px;background:${noteColor};">
            <div class="type-badge">${n.type==='note'?'<i class="bi bi-journal-text"></i> Note':'<i class="bi bi-link-45deg"></i> Bookmark'}</div>
            <h3>${n.title}</h3>
            <p>${n.content.substring(0,80)}...</p>
            <small>${n.time}</small>
            <div class="actions">
                <button onclick="unarchiveNote(${n.id})"><i class="bi bi-arrow-up-circle"></i> Restore</button>
                <button onclick="deleteNote(${n.id})" style="background:rgba(255,100,100,0.4);"><i class="bi bi-trash"></i> Delete</button>
            </div>
        </div>`;
    });
}

async function exportNotes(){
    let items = await getAll("notes");
    const dataStr = JSON.stringify(items, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-notes-${Date.now()}.json`;
    link.click();
    document.getElementById("exportPreview").innerText = dataStr;
    showToast('<i class="bi bi-download"></i> Notes exported!');
}

async function exportNotesText(){
    let items = await getAll("notes");
    let text = "EDUMATE NOTES EXPORT\n";
    text += "=".repeat(50) + "\n\n";
    
    items.forEach((n, i) => {
        text += `[${i+1}] ${n.title}\n`;
        text += `Type: ${n.type}\n`;
        text += `Content: ${n.content}\n`;
        text += `Tags: ${n.tags || 'None'}\n`;
        text += `Color: ${n.color || 'default'}\n`;
        text += `Date: ${n.time}\n`;
        text += `Pinned: ${n.pinned ? 'Yes' : 'No'}\n`;
        text += `Archived: ${n.archived ? 'Yes' : 'No'}\n`;
        text += "-".repeat(50) + "\n\n";
    });
    
    const dataBlob = new Blob([text], {type: 'text/plain'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-notes-${Date.now()}.txt`;
    link.click();
    document.getElementById("exportPreview").innerText = text;
    showToast('<i class="bi bi-file-text"></i> Notes exported as text!');
}

async function importNotes(){
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
                // Ensure color property exists
                if(!item.color) item.color = 'default';
                await add("notes", item);
            }
            
            loadNotes();
            closeImportExportModal();
            showToast(`<i class="bi bi-upload"></i> ${data.length} notes imported successfully!`);
        } catch(err){
            alert("Error importing file: " + err.message);
        }
    };
    reader.readAsText(file);
}

function toggleViewMode(){
    const mode = document.getElementById("viewMode").value;
    const container = document.getElementById("notesList");
    
    if(mode === 'list'){
        container.classList.remove('notes-grid');
        container.classList.add('notes-list');
    } else {
        container.classList.remove('notes-list');
        container.classList.add('notes-grid');
    }
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
    loadNotes();
    updateStats();
});
