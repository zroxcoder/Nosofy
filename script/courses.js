let db; 
let editID=null;
let showArchived = false;
let courseMaterials = [];

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

function openModal(){ 
    document.getElementById("courseModal").style.display="flex";
    courseMaterials = [];
    updateMaterialsList();
}

function closeModal(){ 
    document.getElementById("courseModal").style.display="none"; 
    editID=null;
    courseTitle.value=""; courseDesc.value=""; courseTags.value=""; courseStart.value=""; courseEnd.value=""; coursePriority.value="Low";
    courseURL.value=""; courseInstructor.value=""; courseCategory.value=""; courseProgress.value=0; progressValue.innerText=0;
    courseMaterials = [];
    updateMaterialsList();
}

// NEW: View Course Modal
function openViewModal(id){
    get("courses",id).then(c=>{
        if(!c) return;
        document.getElementById("viewCourseTitle").innerText = c.title;
        const status = getCourseStatus(c);
        document.getElementById("viewCourseStatus").innerHTML = `<span class="status-badge status-${status.class}">${status.text}</span>`;
        
        let content = `
            <p><strong>Description:</strong> ${c.description || 'N/A'}</p>
            <p><strong>Category:</strong> ${c.category || 'N/A'}</p>
            <p><strong>Instructor:</strong> ${c.instructor || 'N/A'}</p>
            <p><strong>Tags:</strong> ${c.tags || 'N/A'}</p>
            <p><strong>Start Date:</strong> ${c.startDate || 'N/A'}</p>
            <p><strong>End Date:</strong> ${c.endDate || 'N/A'}</p>
            <p><strong>Priority:</strong> <span class="priority-${c.priority.toLowerCase()}">${c.priority}</span></p>
            <p><strong>Progress:</strong> ${c.progress || 0}%</p>
            <div class="progress-container"><div class="progress-bar" style="width:${c.progress || 0}%"></div></div>
        `;
        
        if(c.url){
            content += `<p><strong>Course Link:</strong> <a href="${c.url}" target="_blank">${c.url}</a></p>`;
        }
        
        if(c.materials && c.materials.length > 0){
            content += `<p><strong>Materials:</strong></p><ul>`;
            c.materials.forEach(m => {
                if(m.startsWith('http')){
                    content += `<li><a href="${m}" target="_blank">${m}</a></li>`;
                } else {
                    content += `<li>${m}</li>`;
                }
            });
            content += `</ul>`;
        }
        
        document.getElementById("viewCourseContent").innerHTML = content;
        document.getElementById("viewCourseModal").style.display = "flex";
    });
}

function closeViewModal(){ document.getElementById("viewCourseModal").style.display="none"; }

// NEW: Archive Modal
function openArchiveModal(){ 
    loadArchivedCourses();
    document.getElementById("archiveModal").style.display="flex"; 
}
function closeArchiveModal(){ document.getElementById("archiveModal").style.display="none"; }

// NEW: Export Modal
function openExportModal(){ document.getElementById("exportModal").style.display="flex"; }
function closeExportModal(){ document.getElementById("exportModal").style.display="none"; }

// NEW: Progress Value Update
function updateProgressValue(val){
    document.getElementById("progressValue").innerText = val;
}

// NEW: Materials Management
function addMaterial(){
    const input = document.getElementById("materialInput");
    if(input.value.trim()){
        courseMaterials.push(input.value.trim());
        input.value = "";
        updateMaterialsList();
    }
}

function removeMaterial(index){
    courseMaterials.splice(index, 1);
    updateMaterialsList();
}

function updateMaterialsList(){
    const container = document.getElementById("materialsList");
    container.innerHTML = "";
    courseMaterials.forEach((m, i) => {
        container.innerHTML += `
            <div class="material-item">
                <span>${m}</span>
                <button onclick="removeMaterial(${i})"><i class="bi bi-x"></i></button>
            </div>
        `;
    });
}

async function saveCourse(){
    let doneState = false;
    let pinnedState = false;
    let favState = false;
    let archivedState = false;
    
    if(editID){
        const existing = await get("courses", editID);
        doneState = existing && existing.done ? true : false;
        pinnedState = existing && existing.pinned ? true : false;
        favState = existing && existing.fav ? true : false;
        archivedState = existing && existing.archived ? true : false;
    }
    
    let course={
         title: courseTitle.value || "Untitled Course",
         description: courseDesc.value,
         tags: courseTags.value,
         startDate: courseStart.value,
         endDate: courseEnd.value,
         priority: coursePriority.value,
         url: courseURL.value,
         instructor: courseInstructor.value,
         category: courseCategory.value,
         progress: parseInt(courseProgress.value) || 0,
         materials: [...courseMaterials],
         pinned: pinnedState,
         fav: favState,
         done: doneState,
         archived: archivedState,
         time: new Date().toLocaleString(),
         timestamp: Date.now()
     };
     
     if(editID){ 
         course.id=editID; 
         await put("courses",course);
         showToast('<i class="bi bi-check-circle"></i> Course updated successfully!');
     }
     else {
         await add("courses",course);
         showToast('<i class="bi bi-check-circle"></i> Course created successfully!');
     }
     
     closeModal(); 
     loadCourses();
 }
 
// NEW: Get Course Status
function getCourseStatus(course){
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if(course.done) return {text: 'Completed', class: 'completed'};
    if(!course.startDate || !course.endDate) return {text: 'Active', class: 'active'};
    
    const start = new Date(course.startDate);
    const end = new Date(course.endDate);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    
    if(today < start) return {text: 'Upcoming', class: 'upcoming'};
    if(today > end) return {text: 'Overdue', class: 'overdue'};
    return {text: 'Active', class: 'active'};
}

async function loadCourses(){
     const container=document.getElementById("courseList"); 
     container.innerHTML="";
     const search=searchInput.value.toLowerCase();
     const priorityFilterVal=priorityFilter.value;
     const statusFilterVal=statusFilter.value;
     const sortVal=sortBy.value;

     let list=await getAll("courses");
     
     // Filter archived
     list = list.filter(c => showArchived ? c.archived : !c.archived);
     
     // Search filter
     list = list.filter(c=>
         c.title.toLowerCase().includes(search) || 
         (c.description && c.description.toLowerCase().includes(search)) ||
         (c.tags && c.tags.toLowerCase().includes(search))
     );
     
     // Priority filter
     list = list.filter(c=>priorityFilterVal==="all"||c.priority===priorityFilterVal);
     
     // Status filter
     if(statusFilterVal !== 'all'){
         list = list.filter(c => {
             const status = getCourseStatus(c);
             return status.class === statusFilterVal;
         });
     }
     
     // Sort
     if(sortVal === 'date-desc') list.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
     else if(sortVal === 'date-asc') list.sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0));
     else if(sortVal === 'name-asc') list.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
     else if(sortVal === 'name-desc') list.sort((a,b) => (b.title || '').localeCompare(a.title || ''));
     else if(sortVal === 'start-date') list.sort((a,b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
     else if(sortVal === 'end-date') list.sort((a,b) => new Date(a.endDate || 0) - new Date(b.endDate || 0));
     else if(sortVal === 'progress') list.sort((a,b) => (b.progress || 0) - (a.progress || 0));
     
     // Pinned to top
     list=list.sort((a,b)=>b.pinned-a.pinned);
     
     updateStats();
     
     if(list.length === 0){
         container.innerHTML = `
             <div class="empty-state">
                 <h3><i class="bi bi-inbox"></i> No courses found</h3>
                 <p>Add your first course or adjust your filters</p>
             </div>
         `;
         return;
     }
 
     list.forEach(c=>{
         const status = getCourseStatus(c);
         const progress = c.progress || 0;
         const archivedClass = c.archived ? 'archived' : '';
         
         container.innerHTML+=`
         <div class="course-card ${archivedClass}">
            <span class="pin ${c.pinned?"active":""}" onclick="togglePin(${c.id},${c.pinned})" title="${c.pinned ? 'Unpin' : 'Pin'}"><i class="bi bi-pin-angle-fill"></i></span>
            <span class="fav ${c.fav?"active":""}" onclick="toggleFav(${c.id},${c.fav})" title="${c.fav ? 'Remove Favorite' : 'Add Favorite'}"><i class="bi bi-heart-fill"></i></span>
            
            <span class="status-badge status-${status.class}">${status.text}</span>
            ${c.category ? `<span class="status-badge" style="background:#9C27B0;color:white;">${c.category}</span>` : ''}
            
            <h3>${c.title}</h3>
            <p>${c.description || 'No description'}</p>
            
            ${c.instructor ? `<p><b><i class="bi bi-person"></i> Instructor:</b> ${c.instructor}</p>` : ''}
            <p><b><i class="bi bi-tags"></i> Tags:</b> ${c.tags || 'None'}</p>
            <p><b><i class="bi bi-calendar"></i> Start:</b> ${c.startDate || 'N/A'} | <b>End:</b> ${c.endDate || 'N/A'}</p>
            <p class="priority-${c.priority.toLowerCase()}">Priority: ${c.priority}</p>
            
            <div style="margin:10px 0;">
                <label style="display:inline-block;margin-right:15px;">
                    <input type="checkbox" onchange="toggleDone(${c.id}, this.checked)" ${c.done ? "checked" : ""}> Done
                </label>
                <span><b>Progress:</b> ${progress}%</span>
            </div>
            
            <div class="progress-container">
                <div class="progress-bar" style="width:${progress}%"></div>
            </div>
            
            <small><i class="bi bi-clock"></i> ${c.time}</small>
            
            <div class="actions">
                <button onclick="openViewModal(${c.id})" title="Quick View"><i class="bi bi-eye"></i> View</button>
                <button onclick="editCourse(${c.id})" title="Edit"><i class="bi bi-pencil"></i> Edit</button>
                <button onclick="duplicateCourse(${c.id})" title="Duplicate"><i class="bi bi-files"></i> Duplicate</button>
                ${c.url ? `<button onclick="window.open('${c.url}','_blank')" title="Open Course"><i class="bi bi-link-45deg"></i> Open</button>` : ''}
                ${c.archived 
                    ? `<button onclick="unarchiveCourse(${c.id})" title="Unarchive"><i class="bi bi-arrow-up-circle"></i> Restore</button>` 
                    : `<button onclick="archiveCourse(${c.id})" title="Archive"><i class="bi bi-archive"></i> Archive</button>`
                }
                <button onclick="deleteCourse(${c.id})" title="Delete" style="background:#ffcccc;"><i class="bi bi-trash"></i> Delete</button>
            </div>
         </div>`;
     });
 }
 
// NEW: Update Statistics
async function updateStats(){
    let items = await getAll("courses");
    const total = items.filter(c => !c.archived).length;
    const completed = items.filter(c => c.done && !c.archived).length;
    const active = items.filter(c => {
        const status = getCourseStatus(c);
        return status.class === 'active' && !c.archived;
    }).length;
    const pinned = items.filter(c => c.pinned && !c.archived).length;
    const archived = items.filter(c => c.archived).length;
    
    document.getElementById("totalCount").innerText = total;
    document.getElementById("completedCount").innerText = completed;
    document.getElementById("activeCount").innerText = active;
    document.getElementById("pinnedCount").innerText = pinned;
    document.getElementById("archivedCount").innerText = archived;
}

async function editCourse(id){
     let c=await get("courses",id);
     editID=id; 
     openModal();
     courseTitle.value=c.title; 
     courseDesc.value=c.description; 
     courseTags.value=c.tags;
     courseStart.value=c.startDate; 
     courseEnd.value=c.endDate; 
     coursePriority.value=c.priority;
     courseURL.value=c.url || "";
     courseInstructor.value=c.instructor || "";
     courseCategory.value=c.category || "";
     courseProgress.value=c.progress || 0;
     progressValue.innerText=c.progress || 0;
     courseMaterials = c.materials || [];
     updateMaterialsList();
 }

async function toggleDone(id, state){
     let c = await get("courses", id);
     if(!c) return;
     c.done = !!state;
     if(state) c.progress = 100; // Auto set progress to 100% when marked done
     await put("courses", c);
     try{ localStorage.setItem('edumate-update', JSON.stringify({time:Date.now(), store:'courses'})); }catch(e){}
     loadCourses();
     showToast(state ? '<i class="bi bi-check-circle"></i> Course marked as completed!' : '<i class="bi bi-arrow-repeat"></i> Course marked as active');
 }
 
async function deleteCourse(id){ 
    if(confirm("Are you sure you want to delete this course?")){
        await del("courses",id); 
        loadCourses();
        showToast('<i class="bi bi-trash"></i> Course deleted');
    }
}

async function togglePin(id,state){ 
    let c=await get("courses",id); 
    c.pinned=!state; 
    await put("courses",c); 
    loadCourses();
    showToast(c.pinned ? '<i class="bi bi-pin-angle-fill"></i> Course pinned' : '<i class="bi bi-pin-angle"></i> Course unpinned');
}

async function toggleFav(id,state){ 
    let c=await get("courses",id); 
    c.fav=!state; 
    await put("courses",c); 
    loadCourses();
    showToast(c.fav ? '<i class="bi bi-heart-fill"></i> Added to favorites' : '<i class="bi bi-heart"></i> Removed from favorites');
}

// NEW: Duplicate Course
async function duplicateCourse(id){
    let c = await get("courses",id);
    let copy = {
        title: c.title + " (Copy)",
        description: c.description,
        tags: c.tags,
        startDate: c.startDate,
        endDate: c.endDate,
        priority: c.priority,
        url: c.url,
        instructor: c.instructor,
        category: c.category,
        progress: 0,
        materials: c.materials ? [...c.materials] : [],
        pinned: false,
        fav: false,
        done: false,
        archived: false,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    await add("courses", copy);
    loadCourses();
    showToast('<i class="bi bi-files"></i> Course duplicated');
}

// NEW: Archive Course
async function archiveCourse(id){
    let c = await get("courses",id);
    c.archived = true;
    await put("courses",c);
    loadCourses();
    showToast('<i class="bi bi-archive"></i> Course archived');
}

// NEW: Unarchive Course
async function unarchiveCourse(id){
    let c = await get("courses",id);
    c.archived = false;
    await put("courses",c);
    loadCourses();
    loadArchivedCourses();
    showToast('<i class="bi bi-arrow-up-circle"></i> Course restored');
}

// NEW: Toggle Archive View
function toggleArchiveView(){
    showArchived = !showArchived;
    document.getElementById("archiveViewText").innerHTML = showArchived ? '<i class="bi bi-journal-text"></i> Show Active' : '<i class="bi bi-archive"></i> Show Archived';
    loadCourses();
}

// NEW: Load Archived Courses
async function loadArchivedCourses(){
    let items = await getAll("courses");
    items = items.filter(c => c.archived);
    const container = document.getElementById("archiveList");
    
    if(items.length === 0){
        container.innerHTML = `<div class="empty-state"><p>No archived courses</p></div>`;
        return;
    }
    
    container.innerHTML = "";
    items.forEach(c => {
        const status = getCourseStatus(c);
        container.innerHTML += `
        <div class="course-card" style="margin-bottom:10px;">
            <span class="status-badge status-${status.class}">${status.text}</span>
            <h3>${c.title}</h3>
            <p>${c.description || 'No description'}</p>
            <p><b>Progress:</b> ${c.progress || 0}%</p>
            <small>${c.time}</small>
            <div class="actions">
                <button onclick="unarchiveCourse(${c.id})"><i class="bi bi-arrow-up-circle"></i> Restore</button>
                <button onclick="deleteCourse(${c.id})" style="background:#ffcccc;"><i class="bi bi-trash"></i> Delete</button>
            </div>
        </div>`;
    });
}

// NEW: Export Courses
async function exportCourses(){
    let items = await getAll("courses");
    const dataStr = JSON.stringify(items, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-courses-${Date.now()}.json`;
    link.click();
    showToast('<i class="bi bi-download"></i> Courses exported as JSON!');
}

// NEW: Export as Text
async function exportCoursesText(){
    let items = await getAll("courses");
    let text = "EDUMATE COURSES EXPORT\n";
    text += "=".repeat(50) + "\n\n";
    
    items.forEach((c, i) => {
        text += `[${i+1}] ${c.title}\n`;
        text += `Description: ${c.description || 'N/A'}\n`;
        text += `Category: ${c.category || 'N/A'}\n`;
        text += `Instructor: ${c.instructor || 'N/A'}\n`;
        text += `Tags: ${c.tags || 'None'}\n`;
        text += `Start: ${c.startDate || 'N/A'} | End: ${c.endDate || 'N/A'}\n`;
        text += `Priority: ${c.priority}\n`;
        text += `Progress: ${c.progress || 0}%\n`;
        text += `URL: ${c.url || 'N/A'}\n`;
        text += `Completed: ${c.done ? 'Yes' : 'No'}\n`;
        text += `Date: ${c.time}\n`;
        text += "-".repeat(50) + "\n\n";
    });
    
    const dataBlob = new Blob([text], {type: 'text/plain'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-courses-${Date.now()}.txt`;
    link.click();
    showToast('<i class="bi bi-file-text"></i> Courses exported as text!');
}

// NEW: Export as CSV
async function exportCoursesCSV(){
    let items = await getAll("courses");
    let csv = "Title,Description,Category,Instructor,Tags,Start Date,End Date,Priority,Progress,URL,Completed,Created\n";
    
    items.forEach(c => {
        csv += `"${c.title}","${c.description || ''}","${c.category || ''}","${c.instructor || ''}","${c.tags || ''}","${c.startDate || ''}","${c.endDate || ''}","${c.priority}","${c.progress || 0}","${c.url || ''}","${c.done ? 'Yes' : 'No'}","${c.time}"\n`;
    });
    
    const dataBlob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-courses-${Date.now()}.csv`;
    link.click();
    showToast('<i class="bi bi-file-earmark-spreadsheet"></i> Courses exported as CSV!');
}

// NEW: Import Courses
async function importCourses(){
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
                await add("courses", item);
            }
            
            loadCourses();
            closeExportModal();
            showToast(`<i class="bi bi-upload"></i> ${data.length} courses imported successfully!`);
        } catch(err){
            alert("Error importing file: " + err.message);
        }
    };
    reader.readAsText(file);
}

// NEW: Toggle View Mode
function toggleViewMode(){
    const mode = document.getElementById("viewMode").value;
    const container = document.getElementById("courseList");
    
    if(mode === 'list'){
        container.classList.remove('course-grid');
        container.classList.add('course-list');
    } else {
        container.classList.remove('course-list');
        container.classList.add('course-grid');
    }
}

// NEW: Clear All Filters
function clearAllFilters(){
    document.getElementById("searchInput").value = "";
    document.getElementById("priorityFilter").value = "all";
    document.getElementById("statusFilter").value = "all";
    document.getElementById("sortBy").value = "date-desc";
    showArchived = false;
    document.getElementById("archiveViewText").innerHTML = '<i class="bi bi-archive"></i> Show Archived';
    loadCourses();
    showToast('<i class="bi bi-arrow-clockwise"></i> Filters reset');
}

// NEW: Toast Notification
function showToast(message){
    const toast = document.getElementById("toast");
    toast.innerHTML = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

openDB().then(() => {
    loadCourses();
    updateStats();
});