// ========== DATABASE SETUP ==========
let db;

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

function get(storeName, key) {
    return new Promise(resolve => {
        const tx = db.transaction(storeName,"readonly");
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

function getAll(storeName) {
    return new Promise(resolve => {
        const tx = db.transaction(storeName,"readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
    });
}

function add(storeName, data) {
    return new Promise(resolve => {
        const tx = db.transaction(storeName,"readwrite");
        const req = tx.objectStore(storeName).add(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

function put(storeName, data) {
    return new Promise(resolve => {
        const tx = db.transaction(storeName,"readwrite");
        const req = tx.objectStore(storeName).put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

// ========== QUOTES & RESOURCES ==========
const quotes = [
    { text: "Education is the key to unlocking the world.", author: "Oprah" },
    { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
    { text: "The future belongs to the learners.", author: "Eric Hoffer" },
    { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
    { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X" },
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { text: "Education is what remains after one has forgotten what one has learned in school.", author: "Albert Einstein" },
    { text: "The mind is not a vessel to be filled but a fire to be ignited.", author: "Plutarch" },
    { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { text: "He who opens a school door, closes a prison.", author: "Victor Hugo" },
    { text: "Change is the end result of all true learning.", author: "Leo Buscaglia" },
    { text: "When you return to your studies, remember that knowledge is the food of the soul.", author: "Platon"}
];

const resources = [
    { title: "EdSurge — Education news", url: "https://www.edsurge.com/" },
    { title: "CNET — Tech news", url: "https://www.cnet.com/" },
    { title: "edX — Learning courses", url: "https://www.edx.org/" },
    { title: "Coursera — Learning courses", url: "https://www.coursera.org/" },
    { title: "Codecademy — Learn coding", url: "https://www.codecademy.com/learn" }
];

// ========== CUSTOM TIMER LOGIC ==========
let timerInterval = null;
let timeLeft = 25 * 60;
let isRunning = false;
let currentTimerType = 'work';

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timerDisplay').textContent = 
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function startTimer() {
    if (timerInterval) return;
    isRunning = true;
    
    const startTime = new Date();
    
    timerInterval = setInterval(async () => {
        if (timeLeft > 0) {
            timeLeft--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            isRunning = false;
            
            const endTime = new Date();
            const duration = Math.floor((endTime - startTime) / 1000 / 60);
            
            if (currentTimerType === 'work') {
                await saveTimerSession(duration);
                await updateProductivityMetrics();
                alert('⏰ Work session complete! Great job! 🎉');
            } else {
                alert('☕ Break time is over! Ready to get back to work? 💪');
            }
            
            await loadTimerStats();
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
}

function resetTimer(minutes = null) {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    
    if (minutes === null) {
        minutes = parseInt(document.getElementById('workDuration').value) || 25;
    }
    
    timeLeft = minutes * 60;
    updateTimerDisplay();
}

function applyWorkDuration() {
    const minutes = parseInt(document.getElementById('workDuration').value) || 25;
    currentTimerType = 'work';
    resetTimer(minutes);
    alert(`✅ Work timer set to ${minutes} minutes`);
}

function applyShortBreak() {
    const minutes = parseInt(document.getElementById('shortBreakDuration').value) || 5;
    currentTimerType = 'break';
    resetTimer(minutes);
    alert(`☕ Short break set to ${minutes} minutes`);
}

function applyLongBreak() {
    const minutes = parseInt(document.getElementById('longBreakDuration').value) || 15;
    currentTimerType = 'break';
    resetTimer(minutes);
    alert(`🌴 Long break set to ${minutes} minutes`);
}

async function saveTimerSession(duration) {
    const session = {
        duration: duration,
        type: 'work',
        date: new Date().toISOString(),
        timestamp: Date.now()
    };
    await add('timersessions', session);
}

async function loadTimerStats() {
    const sessions = await getAll('timersessions');
    
    const today = new Date().toDateString();
    const todaySessions = sessions.filter(s => new Date(s.date).toDateString() === today);
    
    document.getElementById('sessionsToday').textContent = todaySessions.length;
    
    const totalMinutesToday = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    document.getElementById('totalMinutesToday').textContent = totalMinutesToday;
    
    document.getElementById('totalSessions').textContent = sessions.length;
}

// ========== PRODUCTIVITY METRICS ==========
async function updateProductivityMetrics() {
    const today = new Date().toDateString();
    
    // Get today's data
    const tasks = await getAll('tasks');
    const tasksCompletedToday = tasks.filter(t => {
        if (!t.completed) return false;
        const completedDate = new Date(t.completedAt || 0).toDateString();
        return completedDate === today;
    }).length;
    
    const sessions = await getAll('timersessions');
    const todaySessions = sessions.filter(s => new Date(s.date).toDateString() === today);
    const focusMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    const focusHours = (focusMinutes / 60).toFixed(1);
    
    // Calculate productivity score (out of 100)
    const taskScore = Math.min(tasksCompletedToday * 10, 40);
    const timeScore = Math.min(focusMinutes / 2, 40);
    const sessionScore = Math.min(todaySessions.length * 5, 20);
    const productivityScore = Math.round(taskScore + timeScore + sessionScore);
    
    // Update display
    document.getElementById('dailyProductivityScore').textContent = productivityScore;
    document.getElementById('tasksCompletedToday').textContent = tasksCompletedToday;
    document.getElementById('focusHoursToday').textContent = focusHours + 'h';
    
    // Calculate weekly average
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    let weeklyScores = [];
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toDateString();
        
        const dayTasks = tasks.filter(t => {
            if (!t.completed) return false;
            return new Date(t.completedAt || 0).toDateString() === dateStr;
        }).length;
        
        const daySessions = sessions.filter(s => new Date(s.date).toDateString() === dateStr);
        const dayMinutes = daySessions.reduce((sum, s) => sum + s.duration, 0);
        
        const dayTaskScore = Math.min(dayTasks * 10, 40);
        const dayTimeScore = Math.min(dayMinutes / 2, 40);
        const daySessionScore = Math.min(daySessions.length * 5, 20);
        const dayScore = Math.round(dayTaskScore + dayTimeScore + daySessionScore);
        
        weeklyScores.push(dayScore);
    }
    
    const weeklyAvg = Math.round(weeklyScores.reduce((a, b) => a + b, 0) / 7);
    document.getElementById('weeklyAvgScore').textContent = weeklyAvg;
    
    // Calculate streak
    let streak = 0;
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toDateString();
        
        const dayTasks = tasks.filter(t => {
            if (!t.completed) return false;
            return new Date(t.completedAt || 0).toDateString() === dateStr;
        }).length;
        
        const daySessions = sessions.filter(s => new Date(s.date).toDateString() === dateStr).length;
        
        if (dayTasks > 0 || daySessions > 0) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    
    document.getElementById('productivityStreak').textContent = streak;
    
    // Update goal progress
    const dailyGoal = 100;
    const dailyPercent = Math.min(Math.round((productivityScore / dailyGoal) * 100), 100);
    document.getElementById('dailyGoalPercent').textContent = dailyPercent + '%';
    document.getElementById('dailyGoalBar').style.width = dailyPercent + '%';
    
    const weeklyGoal = 70;
    const weeklyPercent = Math.min(Math.round((weeklyAvg / weeklyGoal) * 100), 100);
    document.getElementById('weeklyGoalPercent').textContent = weeklyPercent + '%';
    document.getElementById('weeklyGoalBar').style.width = weeklyPercent + '%';
}

// ========== FOCUS GOALS ==========
async function loadFocusGoals() {
    let profile = await get('profile', 1);
    const focusGoals = profile?.focusGoals || [];
    const focusList = document.getElementById('focusList');
    
    if (focusGoals.length === 0) {
        focusList.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">No focus goals yet. Add one above!</p>';
        return;
    }
    
    focusList.innerHTML = '';
    focusGoals.forEach((goal, index) => {
        focusList.innerHTML += `
            <div class="focus-item">
                <input type="checkbox" class="focus-checkbox" ${goal.completed ? 'checked' : ''} 
                       onchange="toggleFocus(${index})">
                <span class="focus-text ${goal.completed ? 'completed' : ''}">${goal.text}</span>
                <button class="focus-delete" onclick="deleteFocus(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    });
}

async function addFocusGoal() {
    const input = document.getElementById('newFocusInput');
    const text = input.value.trim();
    if (!text) return;
    
    let profile = await get('profile', 1);
    if (!profile) {
        profile = { id: 1, username: 'Student', focusGoals: [] };
    }
    if (!profile.focusGoals) profile.focusGoals = [];
    
    profile.focusGoals.push({ text: text, completed: false });
    await put('profile', profile);
    
    input.value = '';
    await loadFocusGoals();
}

async function toggleFocus(index) {
    let profile = await get('profile', 1);
    if (profile && profile.focusGoals && profile.focusGoals[index]) {
        profile.focusGoals[index].completed = !profile.focusGoals[index].completed;
        await put('profile', profile);
        await loadFocusGoals();
        await updateProductivityMetrics();
    }
}

async function deleteFocus(index) {
    let profile = await get('profile', 1);
    if (profile && profile.focusGoals) {
        profile.focusGoals.splice(index, 1);
        await put('profile', profile);
        await loadFocusGoals();
    }
}

// ========== WEEKLY SUMMARY ==========
async function updateWeeklySummary() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const notes = await getAll('notes');
    const weekNotes = notes.filter(n => {
        const created = new Date(n.createdAt || n.timestamp || 0);
        return created >= oneWeekAgo;
    }).length;
    document.getElementById('weekNotes').textContent = weekNotes;
    
    const tasks = await getAll('tasks');
    const weekTasks = tasks.filter(t => {
        if (!t.completed) return false;
        const completed = new Date(t.completedAt || 0);
        return completed >= oneWeekAgo;
    }).length;
    document.getElementById('weekTasks').textContent = weekTasks;
    
    const sessions = await getAll('timersessions');
    const weekSessions = sessions.filter(s => {
        const date = new Date(s.date);
        return date >= oneWeekAgo;
    }).length;
    document.getElementById('weekSessions').textContent = weekSessions;
    
    const activeDays = new Set();
    sessions.forEach(s => {
        const date = new Date(s.date);
        if (date >= oneWeekAgo) {
            activeDays.add(date.toDateString());
        }
    });
    tasks.forEach(t => {
        if (t.completed) {
            const date = new Date(t.completedAt || 0);
            if (date >= oneWeekAgo) {
                activeDays.add(date.toDateString());
            }
        }
    });
    document.getElementById('weekActive').textContent = activeDays.size;
}

// ========== MINI CALENDAR ==========
function renderMiniCalendar() {
    const calendar = document.getElementById('miniCalendar');
    calendar.innerHTML = '';
    
    const today = new Date();
    const currentDay = today.getDay();
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - currentDay + i);
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        if (i === currentDay) dayDiv.classList.add('today');
        
        dayDiv.innerHTML = `<div style="font-size:11px;color:#666;">${days[i]}</div><div>${date.getDate()}</div>`;
        calendar.appendChild(dayDiv);
    }
}

// ========== INITIALIZATION ==========
async function initDashboard() {
    let profile = await get("profile", 1);
    if (!profile) {
        profile = { id: 1, username: "Student", focusGoals: [] };
        await put('profile', profile);
    }
    
    const username = profile.username || "Student";
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
    document.getElementById("greetText").textContent = `${greet}, ${username}!`;

    const q = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById("quote").textContent = `"${q.text}"`;
    document.getElementById("author").textContent = `— ${q.author}`;

    const newsBox = document.getElementById("newscontainer");
    newsBox.innerHTML = "";
    resources.forEach(r => {
        newsBox.innerHTML += `<div><i class="bi bi-link-45deg"></i> <a href="${r.url}" target="_blank" rel="noopener noreferrer"><b>${r.title}</b></a></div>`;
    });

    const stores = ["tasks", "projects", "courses"];
    const notifBox = document.getElementById("notifications");
    notifBox.innerHTML = "";
    let hasDeadline = false;
    for (const store of stores) {
        const items = await getAll(store);
        items.forEach(item => {
            if (item.deadline) {
                hasDeadline = true;
                notifBox.innerHTML += `<div><i class="bi bi-calendar-event"></i> <b>${item.title}</b> — Deadline: ${item.deadline}</div>`;
            }
        });
    }
    if (!hasDeadline) notifBox.innerHTML = '<p style="text-align:center;color:#666;">No upcoming deadlines 🎉</p>';

    const notes = await getAll('notes');
    const tasks = await getAll('tasks');
    const projects = await getAll('projects');
    const courses = await getAll('courses');
    
    document.getElementById('totalNotes').textContent = notes.length;
    document.getElementById('totalTasks').textContent = tasks.filter(t => !t.completed).length;
    document.getElementById('totalProjects').textContent = projects.length;
    document.getElementById('totalCourses').textContent = courses.length;

    await loadFocusGoals();
    await updateWeeklySummary();
    await loadTimerStats();
    await updateProductivityMetrics();
    renderMiniCalendar();
}

// Event listeners
document.getElementById('startTimer').addEventListener('click', startTimer);
document.getElementById('pauseTimer').addEventListener('click', pauseTimer);
document.getElementById('resetTimer').addEventListener('click', () => resetTimer());

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const focusInput = document.getElementById('newFocusInput');
        if (focusInput) {
            focusInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addFocusGoal();
            });
        }
    }, 500);
});

openDB().then(initDashboard);