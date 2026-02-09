
let db;

// ============ DATABASE FUNCTIONS ============
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

function get(store,key){
    return new Promise((resolve,reject)=>{
        try{
            if(!db){
                const raw = localStorage.getItem('edumate_'+store) || '[]';
                const arr = JSON.parse(raw);
                const res = arr.find(i=>i.id === key) || null;
                return resolve(res);
            }
            const tx = db.transaction(store,"readonly");
            const req = tx.objectStore(store).get(key);
            req.onsuccess = ()=>resolve(req.result);
            req.onerror = ()=>resolve(null);
        }catch(err){ resolve(null); }
    });
}

function getAll(store){
    return new Promise((resolve,reject)=>{
        try{
            if(!db){
                const raw = localStorage.getItem('edumate_'+store) || '[]';
                const arr = JSON.parse(raw);
                return resolve(arr || []);
            }
            const tx = db.transaction(store,"readonly");
            const req = tx.objectStore(store).getAll();
            req.onsuccess = ()=>resolve(req.result || []);
            req.onerror = ()=>resolve([]);
        }catch(err){ resolve([]); }
    });
}

function add(store,obj){
    return new Promise((resolve,reject)=>{
        try{
            if(!db){ 
                const raw = localStorage.getItem('edumate_'+store) || '[]';
                const arr = JSON.parse(raw);
                const id = (arr.length ? Math.max(...arr.map(x=>x.id||0)) : 0) + 1;
                const item = Object.assign({id}, obj);
                arr.push(item);
                localStorage.setItem('edumate_'+store, JSON.stringify(arr));
                return resolve(id);
            }
            const tx = db.transaction(store,"readwrite");
            const req = tx.objectStore(store).add(obj);
            req.onsuccess = ()=>resolve(req.result);
            req.onerror = ()=>reject(req.error);
        }catch(err){ reject(err); }
    });
}

function put(store,obj){
    return new Promise((resolve,reject)=>{
        try{
            if(!db){ 
                const raw = localStorage.getItem('edumate_'+store) || '[]';
                const arr = JSON.parse(raw);
                const idx = arr.findIndex(x=>x.id === obj.id);
                if(idx >= 0) arr[idx] = obj; else arr.push(obj);
                localStorage.setItem('edumate_'+store, JSON.stringify(arr));
                return resolve(obj.id);
            }
            const tx = db.transaction(store,"readwrite");
            const req = tx.objectStore(store).put(obj);
            req.onsuccess = ()=>resolve(req.result);
            req.onerror = ()=>reject(req.error);
        }catch(err){ reject(err); }
    });
}

function del(store,key){
    return new Promise((resolve,reject)=>{
        try{
            if(!db){ 
                const raw = localStorage.getItem('edumate_'+store) || '[]';
                const arr = JSON.parse(raw);
                const filtered = arr.filter(x=>x.id !== key);
                localStorage.setItem('edumate_'+store, JSON.stringify(filtered));
                return resolve();
            }
            const tx = db.transaction(store,"readwrite");
            const req = tx.objectStore(store).delete(key);
            req.onsuccess = ()=>resolve();
            req.onerror = ()=>reject(req.error);
        }catch(err){ reject(err); }
    });
}

// ============ CHAT UI FUNCTIONS ============
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

async function loadChat() {
    chatBox.innerHTML = "";
    const chats = await getAll("chats");
    (chats || []).forEach(c=>{
        const div = document.createElement("div");
        div.className = "message " + (c.sender==="user" ? "user" : "ai");
        div.innerHTML = formatMessageToHtml(c.text || '');
        chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(str){
    if(!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMessageToHtml(text){
    const t = String(text || '');
    const lines = t.split(/\r?\n/).map(l => l.trim()).filter(l => l.length>0);
    if(lines.length === 0) return '';

    const isList = lines.every(l => l.startsWith('- ')) && lines.length>0;
    if(isList){
        const items = lines.map(l => '<li>' + escapeHtml(l.replace(/^[-\u2022]\s*/,'').trim()) + '</li>').join('');
        return `<ul style="margin:4px 0 4px 18px;padding:0;">${items}</ul>`;
    }

    const joined = t;
    return linkifyRaw(joined).replace(/\n/g, '<br>');
}

function linkifyRaw(raw){
    if(!raw) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let out = '';
    let lastIndex = 0;
    let m;
    while((m = urlRegex.exec(raw)) !== null){
        const idx = m.index;
        const url = m[0];
        out += escapeHtml(raw.substring(lastIndex, idx));
        const safeHref = escapeHtml(url);
        out += `<a href="${safeHref}" target="_blank" rel="noopener" style="color:#0066cc;text-decoration:underline;">${escapeHtml(url)}</a>`;
        lastIndex = idx + url.length;
    }
    out += escapeHtml(raw.substring(lastIndex));
    return out;
}

// ============ PAST PAPER SUBJECT MAPPING ============
const SUBJECT_MAP = {
    "accounting": "9706",
    "biology": "9700",
    "business": "9609",
    "business studies": "9609",
    "chemistry": "9701",
    "computer science": "9618",
    "computing": "9618",
    "economics": "9708",
    "english general paper": "8021",
    "english": "8021",
    "mathematics": "9709",
    "math": "9709",
    "maths": "9709",
    "mathematics-further": "9231",
    "mathematics further": "9231",
    "further maths": "9231",
    "physics": "9702",
    "psychology": "9990",
    "sociology": "9699"
};

// ============ SEARCH HISTORY FUNCTIONS ============
async function logSearch(query){
    try{
        const item = {query: query, time: new Date().toISOString()};
        try{ await add('searches', item); }catch(e){}
        try{
            const raw = localStorage.getItem('edumate_searches') || '[]';
            const arr = JSON.parse(raw);
            arr.push(item);
            localStorage.setItem('edumate_searches', JSON.stringify(arr));
        }catch(e){}
        try{ 
            if(document.getElementById('searchHistory') && document.getElementById('searchHistory').style.display==='block') 
                loadSearchHistory(); 
        }catch(e){}
    }catch(e){}
}

async function loadSearchHistory(){
    const listEl = document.getElementById('searchHistoryList');
    listEl.innerHTML = 'Loading...';
    try{
        let items = await getAll('searches');
        if(!items || !items.length){
            const raw = localStorage.getItem('edumate_searches') || '[]';
            items = JSON.parse(raw);
        } else {
            try{
                const raw = localStorage.getItem('edumate_searches') || '[]';
                const ls = JSON.parse(raw);
                ls.forEach(s => { if(!items.find(i=>i.time === s.time && i.query === s.query)) items.push(s); });
                items = items.sort((a,b)=> new Date(b.time) - new Date(a.time));
            }catch(e){}
        }
        if(!items || !items.length){ 
            listEl.innerHTML = '<div style="opacity:0.7;padding:8px;">No searches yet.</div>'; 
            return; 
        }
        listEl.innerHTML = '';
        items.slice().reverse().forEach((s, idx)=>{
            const div = document.createElement('div');
            div.style.padding = '8px 0';
            div.style.borderBottom = '1px solid #f0f0f0';
            const q = document.createElement('div'); 
            q.style.marginBottom = '4px'; 
            q.style.fontWeight = '500';
            q.innerText = s.query;
            const meta = document.createElement('div'); 
            meta.style.fontSize='12px'; 
            meta.style.opacity='0.7'; 
            meta.innerText = new Date(s.time).toLocaleString();
            const actions = document.createElement('div'); 
            actions.style.marginTop='6px';
            const openBtn = document.createElement('button'); 
            openBtn.innerText='Open'; 
            openBtn.className='action-btn';
            openBtn.style.marginRight='6px'; 
            openBtn.onclick = ()=>{ openScholarQuery(s.query); };
            const delBtn = document.createElement('button'); 
            delBtn.innerText='Delete'; 
            delBtn.className='action-btn';
            delBtn.onclick = async ()=>{ await deleteSearchEntry(s); await loadSearchHistory(); };
            actions.appendChild(openBtn); 
            actions.appendChild(delBtn);
            div.appendChild(q); 
            div.appendChild(meta); 
            div.appendChild(actions);
            listEl.appendChild(div);
        });
    }catch(err){ 
        listEl.innerHTML = '<div style="color:#b00;padding:8px;">Failed to load history</div>'; 
    }
}

function toggleSearchHistory(){
    const el = document.getElementById('searchHistory');
    if(el.style.display === 'none' || !el.style.display) { 
        el.style.display='block'; 
        loadSearchHistory(); 
    }
    else el.style.display='none';
}

function openScholarQuery(topic){
    const url = 'https://scholar.google.com/scholar?q=' + encodeURIComponent(topic);
    try{ window.open(url, '_blank'); }catch(e){ location.href = url; }
}

async function deleteSearchEntry(entry){
    try{
        if(entry && entry.id){ await del('searches', entry.id); }
    }catch(e){}
    try{
        const raw = localStorage.getItem('edumate_searches') || '[]';
        let arr = JSON.parse(raw);
        arr = arr.filter(s => !(s.time === entry.time && s.query === entry.query));
        localStorage.setItem('edumate_searches', JSON.stringify(arr));
    }catch(e){}
}

async function clearChats(){
    try{
        if(db){
            return new Promise((resolve,reject)=>{
                try{
                    const tx = db.transaction('chats','readwrite');
                    const req = tx.objectStore('chats').clear();
                    req.onsuccess = ()=>{
                        try{ localStorage.setItem('edumate_chats','[]'); }catch(e){}
                        resolve();
                    };
                    req.onerror = ()=>{ 
                        try{ localStorage.setItem('edumate_chats','[]'); }catch(e){}; 
                        resolve(); 
                    };
                }catch(err){ 
                    try{ localStorage.setItem('edumate_chats','[]'); }catch(e){}; 
                    resolve(); 
                }
            });
        } else {
            localStorage.setItem('edumate_chats','[]');
        }
    }catch(e){}
}

// ============ SEND MESSAGE FUNCTION ============
async function sendMessage() {
    const text = chatInput.value.trim();
    if(!text) return;
    sendBtn.disabled = true;
    try{
        await add("chats",{sender:"user", text, time:new Date().toISOString()});
        await logActivity(`Sent chat: ${text}`);
        chatInput.value = "";
        await loadChat();

        const aiText = await getAIResponse(text);
        await add("chats",{sender:"ai", text: aiText, time:new Date().toISOString()});
        await logActivity(`AI replied: ${aiText}`);
        await loadChat();
    }catch(err){
        console.error("Send failed", err);
        try{ 
            await add("chats",{sender:"ai", text: "Sorry, something went wrong. Please try again!", time:new Date().toISOString()}); 
            await loadChat(); 
        }catch(e){}
    }finally{
        sendBtn.disabled = false;
        chatInput.focus();
    }
}

// ============ ENHANCED AI RESPONSE LOGIC ============
async function getAIResponse(userText){
    const tasks = await getAll("tasks");
    const projects = await getAll("projects");
    const courses = await getAll("courses");
    const notes = await getAll("notes");
    const watchlist = await getAll("watchlist");
    const expenses = await getAll("expenses");
    
    const text = (userText || "").toLowerCase();

        // Helper function to get currency symbol
    const getCurrencySymbol = async () => {
        const currencySymbols = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'JPY': '¥', 'CNY': '¥',
            'AUD': 'A$', 'CAD': 'C$', 'CHF': 'Fr', 'SEK': 'kr', 'NZD': 'NZ$',
            'SGD': 'S$', 'HKD': 'HK$', 'NOK': 'kr', 'KRW': '₩', 'TRY': '₺',
            'RUB': '₽', 'BRL': 'R$', 'ZAR': 'R', 'MXN': '$', 'AED': 'د.إ',
            'SAR': '﷼', 'THB': '฿', 'IDR': 'Rp', 'MYR': 'RM', 'PHP': '₱',
            'PKR': '₨', 'BDT': '৳', 'VND': '₫', 'EGP': 'E£', 'NGN': '₦',
            'ILS': '₪', 'DKK': 'kr', 'PLN': 'zł', 'CZK': 'Kč', 'HUF': 'Ft',
            'CLP': '$', 'ARS': '$', 'COP': '$', 'PEN': 'S/.', 'NPR': 'रु'
        };
        
        try {
            const settings = await get('settings', 1);
            const currency = settings && settings.currency ? settings.currency : 'USD';
            return currencySymbols[currency] || '$';
        } catch(e) {
            return '$';
        }
    };
    
    const formatMoney = (amount, symbol) => {
        return `${symbol}${parseFloat(amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    };

    // ===== GREETINGS (ENHANCED) =====
    if(/^(hi|hello|hey|good morning|good afternoon|good evening|greetings|howdy|sup|what's up|yo)\b/i.test(text)){
        const greetings = [
            "Hello! 👋 Great to see you! How can I help you succeed today?",
            "Hi there! 😊 I'm ready to assist with your studies, tasks, and questions!",
            "Hey! 🌟 Let's make today productive. What do you need?",
            "Good to see you! 💪 Ready to tackle your goals together?",
            "Welcome back! 🎓 How can I support your learning journey today?"
        ];
        const tips = [
            "\n\n**Quick suggestions:**\n- \"What should I do first?\" — Get priority tasks\n- \"Study tips\" — Learn effective techniques\n- \"Motivate me\" — Get an energy boost\n- \"Show my tasks\" — See what's pending",
            "\n\n**I can help with:**\n- Task management & priorities\n- Study strategies & exam tips\n- Research papers & past papers\n- Motivation & productivity\n- Subject-specific guidance",
            "\n\n**Popular commands:**\n- \"Past paper [subject] [year]\"\n- \"Research [topic]\"\n- \"How to stay focused\"\n- \"Essay writing tips\"\n- Type 'help' for full list!"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)] + 
               tips[Math.floor(Math.random() * tips.length)];
    }

    // ===== FAREWELL (ENHANCED) =====
    if(/\b(bye|goodbye|see you|see ya|exit|quit|thanks|thank you|thx|cheers|later)\b/i.test(text)){
        const farewells = [
            "Goodbye! 🌟 Keep up the excellent work!",
            "See you later! 💪 Stay focused and motivated!",
            "Take care! 😊 Remember: Progress over perfection!",
            "Bye! 🎓 Come back anytime you need help!",
            "Thanks for chatting! 🚀 You've got this!",
            "Catch you later! ✨ Keep crushing those goals!"
        ];
        return farewells[Math.floor(Math.random() * farewells.length)];
    }

    
    if(/^(help|commands|menu|options|what can you do|capabilities|features|show faq)\b/i.test(text)){
    return `🤖 **I'm here to help you succeed! Here's what I can do:**\n\n` +
        `📚 **Academic Support:**\n` +
        `- Find past papers (2015-2025)\n` +
        `- Search research papers on Google Scholar\n` +
        `- Subject-specific study tips\n` +
        `- Explain concepts (ask "explain [topic]")\n` +
        `- Essay & writing guidance\n` +
        `- Exam preparation strategies\n\n` +
        `✅ **Productivity & Tasks:**\n` +
        `- Show pending tasks/projects/courses\n` +
        `- Suggest priorities ("what should I do first")\n` +
        `- Time management techniques\n` +
        `- Goal setting frameworks\n` +
        `- Progress tracking\n\n` +
        `💡 **Learning Techniques:**\n` +
        `- Study methods (Pomodoro, Feynman, etc.)\n` +
        `- Memory improvement tips\n` +
        `- Note-taking strategies\n` +
        `- Speed reading techniques\n` +
        `- Focus & concentration help\n\n` +
        `🧠 **Mental Wellness:**\n` +
        `- Motivation & encouragement\n` +
        `- Stress & anxiety management\n` +
        `- Test anxiety tips\n` +
        `- Work-life balance advice\n` +
        `- Burnout prevention\n\n` +
        `🔧 **Platform Help:**\n` +
        `- How to use Notes, Planner, Projects\n` +
        `- Feature tutorials\n` +
        `- FAQ answers\n\n` +
        `💰 **Expense Tracking:**\n` +
        `- View expense summaries and balance\n` +
        `- Budget analysis and monitoring\n` +
        `- Financial tips and advice\n` +
        `- Category-wise spending breakdown\n` +
        `- Money-saving strategies\n\n` +
        `🎬 **Watchlist Features:**\n` +
        `- Show your watchlist items\n` +
        `- Random pick suggestions\n` +
        `- Track movies and series\n` +
        `- Progress monitoring\n` +
        `- Rating and organization\n\n` +
        `🔐 **Password Manager:**\n` +
        `- Security tips and best practices\n` +
        `- Generate strong passwords\n` +
        `- Check password strength\n` +
        `- Identify weak passwords\n` +
        `- Password organization tips\n` +
        `- Two-factor authentication advice\n\n` +
        `💬 **Just ask naturally!** Examples:\n` +
        `- "Study tips for biology"\n` +
        `- "How to write better essays"\n` +
        `- "Past paper chemistry 9701 2023"\n` +
        `- "Explain Newton's laws"\n` +
        `- "I'm feeling overwhelmed"\n` +
        `- "Programming resources"\n` +
        `- "Show my expenses"\n` +
        `- "How to save money"\n` +
        `- "Budget tips"\n` +
        `- "Show my watchlist"\n` +
        `- "Random pick" / "What should I watch"\n` +
        `- "Watchlist tips"`;
}
    // ===== PAST PAPERS (ORIGINAL + ENHANCED) =====
    if(/past paper|pastpaper|previous paper|exam paper|question paper/i.test(text)){
        const yearMatch = text.match(/\b(20(?:1[5-9]|2[0-5]))\b/);
        const year = yearMatch ? yearMatch[0] : null;
        const nums = (text.match(/\b(\d{4})\b/g) || []).slice();
        let code = null;
        if(nums.length){
            for(const n of nums){
                if(n === year) continue;
                code = n; break;
            }
        }
        let foundSubject = null;
        for(const key of Object.keys(SUBJECT_MAP)){
            if(text.includes(key)) { foundSubject = key; break; }
        }
        if(foundSubject && !code){ code = SUBJECT_MAP[foundSubject]; }
        if(code && !foundSubject){
            const inv = Object.entries(SUBJECT_MAP).find(([k,v])=>v===code);
            if(inv) foundSubject = inv[0];
        }
        if(!year){
            return '📋 **Past Papers Request**\n\nPlease include the year (2015–2025) with your request.\n\n' +
                   '**Example:** "past paper accounting 9706 2020"\n\n' +
                   '**Tip:** Type "help" to see all supported subjects!';
        }
        if(!code || !/^[0-9]{4}$/.test(code)){
            return '📋 **Subject Not Recognized**\n\nPlease provide a supported subject name or valid code.\n\n' +
                   '**Supported subjects:** accounting, biology, business, chemistry, computer science, economics, english, mathematics, physics, psychology, sociology\n\n' +
                   '**Example:** "past paper biology 9700 2022"';
        }
        const y = parseInt(year,10);
        if(isNaN(y) || y < 2015 || y > 2025){
            return '📋 **Year Not Available**\n\nPlease request a year between 2015 and 2025.\n\n' +
                   '**Example:** "past paper physics 9702 2021"';
        }
        if(foundSubject && SUBJECT_MAP[foundSubject] && SUBJECT_MAP[foundSubject] !== code){
            return `📋 **Code Mismatch**\n\nThe code (${code}) doesn't match '${foundSubject}'.\n\n` +
                   `Correct code for ${foundSubject}: ${SUBJECT_MAP[foundSubject]}`;
        }
        const query = encodeURIComponent(code + ' ' + year);
        const googleLink = `https://www.google.com/search?q=site:pastpapers.papacambridge.com+${query}`;
        try{ await logSearch(`pastpaper:${foundSubject||code} ${year}`); }catch(e){}
        return `📋 **Past Papers Found!**\n\n` +
               `**Subject:** ${foundSubject? (foundSubject.charAt(0).toUpperCase() + foundSubject.slice(1) + ' ('+code+')') : ('Code '+code)}\n` +
               `**Year:** ${year}\n\n` +
               `🔗 Access papers here:\n${googleLink}\n\n` +
               `💡 **Study Tips:**\n` +
               `- Time yourself when practicing\n` +
               `- Review marking schemes\n` +
               `- Identify common question patterns\n` +
               `- Focus on weak areas`;
    }

    // ===== RESEARCH PAPERS (ENHANCED) =====
    if(/\b(research|scholar|academic paper|scientific paper|journal|article|study on|findings on|literature on)\b/i.test(text)){
        let topic = userText;
        const patterns = [
            {regex: /research (?:about|on|for|regarding) (.+)/i, group: 1},
            {regex: /find (?:research|papers|articles) (?:about|on) (.+)/i, group: 1},
            {regex: /(?:papers|articles|studies) on (.+)/i, group: 1},
            {regex: /scholar (.+)/i, group: 1}
        ];
        
        for(const p of patterns){
            const m = userText.match(p.regex);
            if(m && m[p.group]){
                topic = m[p.group].trim();
                break;
            }
        }
        
        if(topic === userText){
            topic = userText.replace(/(find|search|show|give|results|of|research|papers|paper|scholar|academic|scientific)/gi, '').trim();
        }
        
        if(!topic || topic.length < 2) topic = userText;
        
        const qs = encodeURIComponent(topic);
        const url = `https://scholar.google.com/scholar?q=${qs}`;
        try{ await logSearch(topic); }catch(e){}
        
        return `🔬 **Research Papers on "${topic}"**\n\n` +
               `I've opened Google Scholar with results for your topic:\n${url}\n\n` +
               `📚 **Research Tips:**\n` +
               `- Look for recent papers (last 3-5 years)\n` +
               `- Check citation count for credibility\n` +
               `- Read abstracts first to assess relevance\n` +
               `- Use "Cited by" to find related work\n` +
               `- Access full PDFs when available\n` +
               `- Take notes on methodology and findings\n\n` +
               `💡 **Organizing Research:**\n` +
               `- Save important papers to your device\n` +
               `- Use the Notes section to summarize findings\n` +
               `- Create a bibliography as you go`;
    }

    // ===== STUDY TIPS (MASSIVELY ENHANCED) =====
    if(/(study|revision|exam|test|learning|prepare|preparation) (tip|advice|strateg|method|technique|habit|guide|help)/i.test(text) || 
       /how to study|study better|improve learning|effective study/i.test(text)){
        const tips = [
            `📚 **Effective Study Strategies:**\n\n` +
            `**🎯 Active Learning Techniques:**\n` +
            `- Active Recall: Test yourself instead of re-reading\n` +
            `- Spaced Repetition: Review at increasing intervals (1 day, 3 days, 1 week, 2 weeks)\n` +
            `- Feynman Technique: Explain concepts in simple terms as if teaching\n` +
            `- Practice Testing: Do practice problems and past papers\n` +
            `- Interleaving: Mix different topics/subjects in one session\n\n` +
            `**⏰ Time Management:**\n` +
            `- Pomodoro: 25 min focused work + 5 min break\n` +
            `- Time blocking: Dedicate specific hours to subjects\n` +
            `- Study during peak energy hours (find YOUR best time)\n\n` +
            `**📝 Note-Taking:**\n` +
            `- Cornell Method: Notes | Cues | Summary\n` +
            `- Mind mapping for visual connections\n` +
            `- Write in your own words\n` +
            `- Review notes within 24 hours\n\n` +
            `**🧠 Memory Enhancement:**\n` +
            `- Create mnemonics and acronyms\n` +
            `- Use visualization and associations\n` +
            `- Teach material to others\n` +
            `- Sleep well (memory consolidation happens during sleep!)`,

            `🎓 **Study Strategy for Exams:**\n\n` +
            `**📅 Planning (3-4 weeks before):**\n` +
            `- Create study schedule with specific topics\n` +
            `- Gather all materials (notes, textbooks, past papers)\n` +
            `- Identify weak areas that need more time\n` +
            `- Set daily/weekly goals\n\n` +
            `**📖 Content Mastery (2-3 weeks before):**\n` +
            `- Review all material systematically\n` +
            `- Create summary sheets for each topic\n` +
            `- Practice problems and exercises\n` +
            `- Use multiple resources (videos, textbooks, notes)\n` +
            `- Focus on understanding, not memorization\n\n` +
            `**✍️ Practice Phase (1 week before):**\n` +
            `- Complete past papers under timed conditions\n` +
            `- Review marking schemes\n` +
            `- Identify question patterns\n` +
            `- Fill knowledge gaps\n` +
            `- Do quick reviews of all topics\n\n` +
            `**😌 Final Days:**\n` +
            `- Light review only (no new material)\n` +
            `- Review summaries and formulas\n` +
            `- Get 8 hours of sleep\n` +
            `- Stay hydrated and eat well\n` +
            `- Prepare materials (pens, calculator, ID)\n\n` +
            `💡 **I can help find past papers - just ask!**`,

            `🧠 **Memory & Retention Masterclass:**\n\n` +
            `**🔄 Spaced Repetition Schedule:**\n` +
            `- 1st review: Same day (evening)\n` +
            `- 2nd review: Next day\n` +
            `- 3rd review: 3 days later\n` +
            `- 4th review: 1 week later\n` +
            `- 5th review: 2 weeks later\n` +
            `- 6th review: 1 month later\n\n` +
            `**🎨 Visual Memory Techniques:**\n` +
            `- Method of Loci (Memory Palace): Visualize familiar place\n` +
            `- Create vivid, unusual mental images\n` +
            `- Use colors and diagrams\n` +
            `- Draw concept maps\n\n` +
            `**🔤 Verbal Memory Techniques:**\n` +
            `- Acronyms: ROY G BIV (rainbow colors)\n` +
            `- Acrostics: "Please Excuse My Dear Aunt Sally" (math order)\n` +
            `- Rhymes and songs\n` +
            `- Story method: Create narrative linking facts\n\n` +
            `**💪 Lifestyle for Better Memory:**\n` +
            `- Sleep 7-9 hours (REM sleep crucial)\n` +
            `- Exercise 20-30 min daily (boosts BDNF)\n` +
            `- Eat brain foods: omega-3, berries, nuts, dark chocolate\n` +
            `- Stay hydrated (even 2% dehydration impairs cognition)\n` +
            `- Reduce stress through meditation\n` +
            `- Limit multitasking\n\n` +
            `**📱 Digital Tools:**\n` +
            `- Anki (flashcard app with spaced repetition)\n` +
            `- Quizlet for quick reviews\n` +
            `- Forest app for focus\n` +
            `- Use Edumate's Notes section!`
        ];
        return tips[Math.floor(Math.random() * tips.length)];
    }

    // ===== TIME MANAGEMENT (ENHANCED) =====
    if(/time management|manage time|organize time|schedule|planning|productivity|procrastination|avoid distraction|focus|prioritize/i.test(text)){
        return `⏰ **Time Management Mastery:**\n\n` +
            `**🎯 Prioritization Frameworks:**\n\n` +
            `**Eisenhower Matrix:**\n` +
            `- Urgent + Important: Do first (deadlines, crises)\n` +
            `- Important + Not Urgent: Schedule (planning, learning)\n` +
            `- Urgent + Not Important: Delegate or minimize\n` +
            `- Neither: Eliminate\n\n` +
            `**MIT Method (Most Important Tasks):**\n` +
            `- Identify 3 MITs each morning\n` +
            `- Complete these before anything else\n` +
            `- Everything else is bonus\n\n` +
            `**⚡ Productivity Techniques:**\n\n` +
            `**Pomodoro Technique:**\n` +
            `1. Choose a task\n` +
            `2. Set timer for 25 minutes\n` +
            `3. Work with full focus\n` +
            `4. Take 5-minute break\n` +
            `5. After 4 pomodoros, take 15-30 min break\n\n` +
            `**Time Blocking:**\n` +
            `- Divide day into blocks\n` +
            `- Assign specific tasks to blocks\n` +
            `- Include buffer time\n` +
            `- Protect deep work blocks\n\n` +
            `**2-Minute Rule:**\n` +
            `- If task takes <2 min, do it immediately\n` +
            `- Prevents small tasks from piling up\n\n` +
            `**Eat the Frog:**\n` +
            `- Do hardest task first thing in morning\n` +
            `- When energy and willpower are highest\n\n` +
            `**📱 Beat Distractions:**\n` +
            `- Turn off notifications during focus time\n` +
            `- Use website blockers (Freedom, Cold Turkey)\n` +
            `- Put phone in another room\n` +
            `- Use "Do Not Disturb" mode\n` +
            `- Create dedicated study space\n\n` +
            `**📊 Track & Review:**\n` +
            `- Log how you spend time for 1 week\n` +
            `- Identify time-wasters\n` +
            `- Review weekly: What worked? What didn't?\n` +
            `- Adjust and optimize\n\n` +
            `💡 **Ask me "what should I do first" for personalized priorities!**`;
    }

    // ===== MOTIVATION & MINDSET (MASSIVELY ENHANCED) =====
    if(/motivat|inspire|encourage|keep going|give up|lose hope|feel down|feeling down|stress|anxiety|overwhelm|burnout|can't do|feeling stuck/i.test(text)){
        const motivational = [
            `💪 **You've Got This! Here's Why:**\n\n` +
            `✨ **Remember:**\n` +
            `- Every expert was once a beginner\n` +
            `- Progress over perfection\n` +
            `- Small consistent steps > sporadic big efforts\n` +
            `- You've overcome challenges before—you can do it again\n` +
            `- Failure is feedback, not final\n\n` +
            `🎯 **Motivation Strategies:**\n\n` +
            `**1. Visualize Success:**\n` +
            `- Close your eyes\n` +
            `- Picture yourself achieving your goal\n` +
            `- Feel the emotions of success\n` +
            `- Use this when motivation is low\n\n` +
            `**2. Remember Your "Why":**\n` +
            `- Why did you start?\n` +
            `- What's your bigger goal?\n` +
            `- Who are you doing this for?\n` +
            `- Write it down and read daily\n\n` +
            `**3. Celebrate Small Wins:**\n` +
            `- Completed a study session? ✓\n` +
            `- Understood a difficult concept? ✓\n` +
            `- Stayed focused for 25 min? ✓\n` +
            `- Each small win builds momentum\n\n` +
            `**4. Break Tasks Into Tiny Steps:**\n` +
            `- "Write essay" → "Write outline"\n` +
            `- "Study for exam" → "Review chapter 1"\n` +
            `- Small steps feel achievable\n\n` +
            `📌 **Powerful Quotes:**\n` +
            `"Success is the sum of small efforts repeated day in and day out." — Robert Collier\n\n` +
            `"The secret of getting ahead is getting started." — Mark Twain\n\n` +
            `💡 **Action Step:** Choose ONE small task right now and complete it in the next 10 minutes!`,

            `🌟 **When You're Feeling Overwhelmed:**\n\n` +
            `**🛑 Stop and Breathe:**\n` +
            `1. Take 5 deep breaths (4 sec in, 4 sec hold, 4 sec out)\n` +
            `2. Notice how you feel\n` +
            `3. Remind yourself: "This feeling is temporary"\n\n` +
            `**🧩 Overwhelm = Unclear Next Step:**\n\n` +
            `Instead of: "I have so much to do!"\n` +
            `Try: "What is the NEXT SINGLE action?"\n\n` +
            `**Example breakdown:**\n` +
            `❌ "Study for finals" (overwhelming)\n` +
            `✅ "Open biology textbook to chapter 5" (doable)\n\n` +
            `**🎯 The One Thing:**\n` +
            `Ask: "What's the ONE thing I can do such that by doing it, everything else becomes easier or unnecessary?"\n\n` +
            `**📝 Brain Dump:**\n` +
            `1. Write EVERYTHING on your mind\n` +
            `2. Categorize by urgency\n` +
            `3. Pick top 3\n` +
            `4. Focus only on those\n\n` +
            `**💆 Self-Compassion:**\n` +
            `- Talk to yourself like you would a friend\n` +
            `- It's okay to feel stressed\n` +
            `- You're doing your best\n` +
            `- Rest is productive too\n\n` +
            `**🆘 When to Seek Help:**\n` +
            `- Persistent anxiety/depression\n` +
            `- Can't sleep or eat normally\n` +
            `- Thoughts of self-harm\n` +
            `→ Talk to counselor, trusted adult, or call helpline\n\n` +
            `**🌈 Remember:**\n` +
            `"You don't have to see the whole staircase, just take the first step." — Martin Luther King Jr.\n\n` +
            `You're not alone. I'm here to help! 💙`,

            `🚀 **Reignite Your Motivation:**\n\n` +
            `**🔥 The Motivation Cycle:**\n\n` +
            `1. **Small Action** → 2. **Small Win** → 3. **Feel Good** → 4. **Want More**\n\n` +
            `Start the cycle with just 5 minutes of work!\n\n` +
            `**💡 Science-Backed Motivation Boosters:**\n\n` +
            `**Dopamine Hacks:**\n` +
            `- Check off tasks (visual progress)\n` +
            `- Set micro-goals (frequent wins)\n` +
            `- Reward yourself after milestones\n` +
            `- Listen to pump-up music before studying\n\n` +
            `**Environment Design:**\n` +
            `- Clean, organized study space\n` +
            `- Good lighting (natural light best)\n` +
            `- Remove distractions from sight\n` +
            `- Have materials ready\n\n` +
            `**Social Accountability:**\n` +
            `- Study with motivated friends\n` +
            `- Share goals publicly\n` +
            `- Join study groups\n` +
            `- Progress pictures/posts\n\n` +
            `**🎬 Motivation vs. Discipline:**\n\n` +
            `Motivation gets you started.\n` +
            `Discipline keeps you going.\n\n` +
            `**Build Discipline:**\n` +
            `- Same study time daily (habit formation)\n` +
            `- Show up even when you don't feel like it\n` +
            `- Trust the process\n` +
            `- Track streaks (don't break the chain!)\n\n` +
            `**🌟 Daily Affirmations:**\n` +
            `- "I am capable of learning anything"\n` +
            `- "Every day I'm getting better"\n` +
            `- "Challenges help me grow"\n` +
            `- "I choose progress over perfection"\n\n` +
            `**📱 Quick Motivation:**\n` +
            `When stuck, do this 2-min exercise:\n` +
            `1. Stand up and stretch\n` +
            `2. Drink water\n` +
            `3. Set timer for 10 minutes\n` +
            `4. Start with easiest task\n` +
            `5. Momentum will build!\n\n` +
            `"A journey of a thousand miles begins with a single step." 🛤️`
        ];
        return motivational[Math.floor(Math.random() * motivational.length)];
    }

    // ===== FOCUS & CONCENTRATION (ENHANCED) =====
    if(/focus|concentration|concentrate|attention|distract|stay on task|can't focus/i.test(text)){
        return `🎯 **Master Your Focus:**\n\n` +
            `**🧠 Understanding Focus:**\n\n` +
            `Your brain can truly focus for ~25-45 minutes at a time.\n` +
            `Accept this. Use it to your advantage!\n\n` +
            `**⚡ Immediate Focus Boosters:**\n\n` +
            `**1. The 2-Minute Focus Reset:**\n` +
            `- Close eyes\n` +
            `- Deep breathe (4-4-4: in-hold-out)\n` +
            `- Remind yourself of current task\n` +
            `- Resume work\n\n` +
            `**2. Environmental Setup:**\n` +
            `- Clear desk (only current task materials)\n` +
            `- Phone in drawer or other room\n` +
            `- Website blocker active (Freedom, Cold Turkey)\n` +
            `- Noise: Silence, white noise, or lo-fi beats\n` +
            `- Temperature: Slightly cool (better for alertness)\n\n` +
            `**3. Pomodoro Technique:**\n` +
            `- 25 min focused work\n` +
            `- 5 min break (walk, stretch, water)\n` +
            `- After 4 rounds: 15-30 min break\n` +
            `- Apps: Focus Booster, Forest, Tomato Timer\n\n` +
            `**📱 Digital Distractions:**\n\n` +
            `**Phone Management:**\n` +
            `- Do Not Disturb mode\n` +
            `- Turn off ALL notifications\n` +
            `- Grayscale mode (makes phone boring)\n` +
            `- Delete social media during exam periods\n` +
            `- Use Screen Time limits\n\n` +
            `**Computer Management:**\n` +
            `- Close unnecessary tabs/apps\n` +
            `- Full-screen mode for work\n` +
            `- Website blockers during focus time\n` +
            `- Separate user accounts (study vs. entertainment)\n\n` +
            `**🎵 Sound for Focus:**\n\n` +
            `**Try these:**\n` +
            `- Binaural beats (40 Hz for focus)\n` +
            `- White/brown noise\n` +
            `- Lo-fi hip hop\n` +
            `- Classical music (Mozart, Bach)\n` +
            `- Nature sounds (rain, waves)\n` +
            `- Video game soundtracks (designed to maintain focus!)\n\n` +
            `**Avoid:**\n` +
            `- Lyrical music in your language (distracting)\n` +
            `- New music (your brain will analyze it)\n\n` +
            `**💪 Long-term Focus Training:**\n\n` +
            `**Build Attention Span:**\n` +
            `- Week 1: 10-min focus sessions\n` +
            `- Week 2: 15-min sessions\n` +
            `- Week 3: 20-min sessions\n` +
            `- Week 4+: 25-min sessions\n` +
            `- Gradually train your focus muscle\n\n` +
            `**Meditation (5-10 min daily):**\n` +
            `- Improves sustained attention\n` +
            `- Reduces mind-wandering\n` +
            `- Apps: Headspace, Calm, Insight Timer\n\n` +
            `**🍎 Nutrition for Focus:**\n` +
            `- Blueberries (antioxidants)\n` +
            `- Dark chocolate (flavonoids)\n` +
            `- Green tea (L-theanine + caffeine)\n` +
            `- Nuts (omega-3)\n` +
            `- Stay hydrated!\n\n` +
            `**😴 Sleep Impact:**\n` +
            `- 7-9 hours nightly\n` +
            `- Consistent sleep schedule\n` +
            `- No screens 1 hour before bed\n` +
            `- Poor sleep = 40% reduction in focus\n\n` +
            `**🏃 Exercise:**\n` +
            `- 20 min cardio boosts focus for 2-3 hours\n` +
            `- Study after exercise when possible\n` +
            `- Even a 5-min walk helps\n\n` +
            `💡 **Pro Tip:** Start with your hardest task when focus is freshest (usually morning)!`;
    }

    // ===== ESSAY WRITING (COMPREHENSIVE NEW SECTION) =====
    if(/essay|writing|write better|composition|how to write|academic writing|report writing|paper writing/i.test(text)){
        return `✍️ **Essay Writing Mastery:**\n\n` +
            `**📝 The Writing Process:**\n\n` +
            `**1. Pre-Writing (30% of time):**\n` +
            `- Analyze the question/prompt\n` +
            `- Brainstorm ideas (mind map)\n` +
            `- Research and gather sources\n` +
            `- Create thesis statement\n` +
            `- Outline structure\n\n` +
            `**2. Drafting (40% of time):**\n` +
            `- Write freely without editing\n` +
            `- Focus on getting ideas down\n` +
            `- Follow your outline\n` +
            `- Don't worry about perfection\n\n` +
            `**3. Revising (20% of time):**\n` +
            `- Check argument flow\n` +
            `- Strengthen weak points\n` +
            `- Add/remove content\n` +
            `- Improve transitions\n\n` +
            `**4. Editing (10% of time):**\n` +
            `- Grammar and spelling\n` +
            `- Sentence structure\n` +
            `- Word choice\n` +
            `- Citations and formatting\n\n` +
            `**🎯 Essay Structure:**\n\n` +
            `**Introduction:**\n` +
            `- Hook (interesting opening)\n` +
            `- Context/background\n` +
            `- Thesis statement (your main argument)\n` +
            `- Preview of main points\n\n` +
            `**Body Paragraphs (PEEL):**\n` +
            `- Point: Topic sentence\n` +
            `- Evidence: Support with facts/quotes\n` +
            `- Explain: Analyze the evidence\n` +
            `- Link: Connect back to thesis\n\n` +
            `**Conclusion:**\n` +
            `- Restate thesis (in new words)\n` +
            `- Summarize main points\n` +
            `- Broader implications\n` +
            `- Strong closing statement\n\n` +
            `**💡 Power Tips:**\n\n` +
            `**Strong Thesis:**\n` +
            `❌ "This essay is about climate change"\n` +
            `✅ "Human activity is the primary driver of climate change, as evidenced by rising CO2 levels, temperature data, and scientific consensus"\n\n` +
            `**Transitions:**\n` +
            `Use: Furthermore, Moreover, However, Consequently, In contrast, Similarly, Therefore\n\n` +
            `**Active Voice:**\n` +
            `❌ "The experiment was conducted by researchers"\n` +
            `✅ "Researchers conducted the experiment"\n\n` +
            `**Specific Language:**\n` +
            `❌ "Many people think..."\n` +
            `✅ "73% of respondents in Smith's 2022 study believe..."\n\n` +
            `**Varied Sentences:**\n` +
            `Mix short and long sentences. This creates rhythm. It keeps readers engaged and emphasizes important points.\n\n` +
            `**🔍 Editing Checklist:**\n\n` +
            `□ Clear thesis statement?\n` +
            `□ Each paragraph = one main idea?\n` +
            `□ Evidence supports claims?\n` +
            `□ Smooth transitions?\n` +
            `□ Logical flow?\n` +
            `□ Conclusion ties everything together?\n` +
            `□ Citations correct?\n` +
            `□ Grammar/spelling checked?\n` +
            `□ Read aloud (catches awkward phrasing)\n\n` +
            `**🛠️ Tools:**\n` +
            `- Grammarly (grammar/style)\n` +
            `- Hemingway Editor (readability)\n` +
            `- Zotero (citations)\n` +
            `- Google Docs (collaboration)\n\n` +
            `**📚 Improve Writing:**\n` +
            `- Read quality writing regularly\n` +
            `- Write daily (journal, blog)\n` +
            `- Get feedback from others\n` +
            `- Study good examples in your field\n` +
            `- Practice, practice, practice!\n\n` +
            `💡 **Use Edumate's Notes to save outlines and drafts!**`;
    }

    // ===== EXPLAIN CONCEPTS (NEW COMPREHENSIVE SECTION) =====
    if(/^explain |what is |define |tell me about |how does |why does /i.test(text)){
        const topic = userText.replace(/^(explain|what is|define|tell me about|how does|why does)\s+/i, '').trim();
        
        return `🎓 **Understanding: ${topic}**\n\n` +
            `I can guide you to understand this concept!\n\n` +
            `**📚 Learning Strategy:**\n\n` +
            `**1. Start with Basics:**\n` +
            `- Look up definition in textbook/Wikipedia\n` +
            `- Understand key terms\n` +
            `- Read slowly and carefully\n\n` +
            `**2. Use Multiple Resources:**\n` +
            `- YouTube (search "${topic} explained")\n` +
            `- Khan Academy\n` +
            `- Course textbook\n` +
            `- Your class notes\n\n` +
            `**3. Feynman Technique:**\n` +
            `a) Study the concept\n` +
            `b) Explain it in simple terms (as if to a child)\n` +
            `c) Identify gaps in your explanation\n` +
            `d) Review and simplify further\n\n` +
            `**4. Active Learning:**\n` +
            `- Draw diagrams\n` +
            `- Create mind maps\n` +
            `- Teach it to someone\n` +
            `- Relate to real-world examples\n` +
            `- Do practice problems\n\n` +
            `**🔬 Research Resources:**\n\n` +
            `Would you like me to search academic papers on "${topic}"?\n` +
            `Just ask: "research ${topic}"\n\n` +
            `**📝 Recommended:**\n` +
            `- Take notes while learning\n` +
            `- Summarize in your own words\n` +
            `- Create flashcards for key points\n` +
            `- Review after 24 hours\n\n` +
            `**🎯 Subject-Specific Help:**\n` +
            `For detailed help, ask:\n` +
            `- "Biology study tips" (if biology topic)\n` +
            `- "Math help" (if math topic)\n` +
            `- "Chemistry resources" (if chemistry topic)\n\n` +
            `💡 **Use Edumate's Notes section to save your understanding of ${topic}!**`;
    }

    // ===== SUBJECT-SPECIFIC HELP (MASSIVELY EXPANDED) =====
    
    // Mathematics
    if(/\b(math|maths|mathematics|algebra|calculus|geometry|trigonometry|statistics)\b.*\b(help|tips|study|learn|understand|struggle|difficult|hard)\b/i.test(text)){
        return `📐 **Mathematics Study Guide:**\n\n` +
            `**🎯 Core Principles:**\n\n` +
            `Mathematics is about **understanding patterns and logic**, not memorization!\n\n` +
            `**✅ Effective Math Study:**\n\n` +
            `**1. Master Prerequisites:**\n` +
            `- Math is cumulative\n` +
            `- If stuck, review earlier concepts\n` +
            `- Build strong foundations\n\n` +
            `**2. Practice, Practice, Practice:**\n` +
            `- Do MANY problems\n` +
            `- Start with easy, progress to hard\n` +
            `- Don't just watch solutions—DO them\n` +
            `- Repetition builds pattern recognition\n\n` +
            `**3. Show All Work:**\n` +
            `- Write every step\n` +
            `- Helps catch errors\n` +
            `- Clarifies thinking process\n` +
            `- Makes review easier\n\n` +
            `**4. Learn from Mistakes:**\n` +
            `- Don't just get answer\n` +
            `- Understand WHERE you went wrong\n` +
            `- Identify WHY\n` +
            `- Redo problem correctly\n\n` +
            `**5. Conceptual Understanding:**\n` +
            `- Don't just memorize formulas\n` +
            `- Understand WHEN to use each\n` +
            `- Know WHY formulas work\n` +
            `- Connect concepts together\n\n` +
            `**📚 Study Techniques:**\n\n` +
            `**Formula Sheet:**\n` +
            `- Create summary of all formulas\n` +
            `- Include when to use each\n` +
            `- Review before exams\n\n` +
            `**Problem Categories:**\n` +
            `- Group similar problem types\n` +
            `- Master one type before moving on\n` +
            `- Recognize patterns\n\n` +
            `**Visual Learning:**\n` +
            `- Draw graphs and diagrams\n` +
            `- Use colors to differentiate\n` +
            `- Geometric visualizations\n\n` +
            `**🛠️ Resources:**\n\n` +
            `**Free Online:**\n` +
            `- Khan Academy (comprehensive, free)\n` +
            `- PatrickJMT (YouTube, calculus)\n` +
            `- 3Blue1Brown (visual explanations)\n` +
            `- Wolfram Alpha (step-by-step solutions)\n` +
            `- Desmos (graphing calculator)\n\n` +
            `**Problem Practice:**\n` +
            `- Your textbook exercises\n` +
            `- Past papers (I can help find these!)\n` +
            `- IXL, Brilliant.org\n\n` +
            `**🎓 Exam Tips:**\n\n` +
            `**Before Exam:**\n` +
            `- Do timed practice tests\n` +
            `- Review common mistakes\n` +
            `- Memorize key formulas\n` +
            `- Check calculator battery\n\n` +
            `**During Exam:**\n` +
            `- Read questions carefully\n` +
            `- Do easy questions first\n` +
            `- Show ALL work (partial credit!)\n` +
            `- Check answers if time permits\n` +
            `- Don't panic if stuck—move on\n\n` +
            `**💡 Specific Topics:**\n\n` +
            `Ask me about:\n` +
            `- "Calculus help"\n` +
            `- "Algebra tips"\n` +
            `- "Geometry strategies"\n` +
            `- "Statistics study guide"\n\n` +
            `Need past papers? Ask:\n` +
            `"Past paper mathematics 9709 [year]"`;
    }

    // Science (Biology, Chemistry, Physics)
    if(/\b(science|biology|chemistry|physics|lab|experiment)\b.*\b(help|tips|study|learn|understand)\b/i.test(text)){
        return `🔬 **Science Study Mastery:**\n\n` +
            `**🎯 Universal Science Study Principles:**\n\n` +
            `**1. Understand, Don't Memorize:**\n` +
            `- Learn the WHY behind facts\n` +
            `- Connect concepts to real world\n` +
            `- Ask "How does this work?"\n\n` +
            `**2. Visual Learning:**\n` +
            `- Draw diagrams extensively\n` +
            `- Label everything\n` +
            `- Use colors for different components\n` +
            `- Watch animations/videos\n\n` +
            `**3. Active Learning:**\n` +
            `- Do practice problems\n` +
            `- Explain concepts aloud\n` +
            `- Teach to others\n` +
            `- Relate to everyday examples\n\n` +
            `**📚 Subject-Specific Strategies:**\n\n` +
            `**BIOLOGY:**\n` +
            `- Create detailed diagrams (cell structure, organs, etc.)\n` +
            `- Use flashcards for terminology\n` +
            `- Understand processes step-by-step\n` +
            `- Connect systems (how they interact)\n` +
            `- Use mnemonics (Kingdom: King Philip Came Over For Good Soup)\n\n` +
            `**CHEMISTRY:**\n` +
            `- Master the periodic table\n` +
            `- Practice balancing equations daily\n` +
            `- Understand reaction types\n` +
            `- Do calculations repeatedly\n` +
            `- Safety first in lab!\n` +
            `- Relate to cooking/everyday chemistry\n\n` +
            `**PHYSICS:**\n` +
            `- Understand units and dimensions\n` +
            `- Draw free-body diagrams\n` +
            `- Master fundamental equations\n` +
            `- Practice problem-solving steps\n` +
            `- Visualize scenarios\n` +
            `- Check answer reasonableness\n\n` +
            `**🧪 Lab Work:**\n\n` +
            `**Before Lab:**\n` +
            `- Read procedure thoroughly\n` +
            `- Understand purpose\n` +
            `- Prepare data tables\n` +
            `- Review safety protocols\n\n` +
            `**During Lab:**\n` +
            `- Follow instructions precisely\n` +
            `- Record observations immediately\n` +
            `- Note anything unusual\n` +
            `- Ask questions if unsure\n\n` +
            `**After Lab:**\n` +
            `- Analyze data promptly\n` +
            `- Calculate results\n` +
            `- Identify sources of error\n` +
            `- Connect to theory\n\n` +
            `**📖 Study Techniques:**\n\n` +
            `**Concept Maps:**\n` +
            `- Central concept in middle\n` +
            `- Branch out to related ideas\n` +
            `- Show connections\n` +
            `- Visual overview of topic\n\n` +
            `**Summary Sheets:**\n` +
            `- One page per major topic\n` +
            `- Key concepts, formulas, diagrams\n` +
            `- Use for quick review\n\n` +
            `**Practice Questions:**\n` +
            `- Do textbook problems\n` +
            `- Past papers (I can help!)\n` +
            `- Online quizzes\n` +
            `- Explain answers\n\n` +
            `**🌐 Resources:**\n\n` +
            `**Video Learning:**\n` +
            `- Khan Academy (all sciences)\n` +
            `- Crash Course (engaging videos)\n` +
            `- Bozeman Science (AP Biology)\n` +
            `- Tyler DeWitt (Chemistry)\n` +
            `- Physics Girl (Physics)\n\n` +
            `**Interactive:**\n` +
            `- PhET Simulations (interactive)\n` +
            `- Quizlet (flashcards)\n` +
            `- Anki (spaced repetition)\n\n` +
            `**Research:**\n` +
            `Ask me: "research [scientific topic]"\n` +
            `I'll search Google Scholar!\n\n` +
            `**📝 Past Papers:**\n` +
            `"Past paper biology 9700 2023"\n` +
            `"Past paper chemistry 9701 2022"\n` +
            `"Past paper physics 9702 2021"\n\n` +
            `💡 **Pro Tip:** Explain concepts to a non-scientist. If you can make it simple, you understand it!`;
    }

    // English & Language Arts
    if(/\b(english|literature|reading|comprehension|vocabulary|grammar)\b.*\b(help|tips|improve|better)\b/i.test(text)){
        return `📚 **English & Literature Mastery:**\n\n` +
            `**📖 Reading Comprehension:**\n\n` +
            `**SQ3R Method:**\n` +
            `1. **Survey:** Skim headings, summaries, questions\n` +
            `2. **Question:** Turn headings into questions\n` +
            `3. **Read:** Read actively to answer questions\n` +
            `4. **Recite:** Summarize in your own words\n` +
            `5. **Review:** Go over key points\n\n` +
            `**Active Reading:**\n` +
            `- Annotate as you read\n` +
            `- Underline key points\n` +
            `- Write questions in margins\n` +
            `- Note unfamiliar words\n` +
            `- Summarize each section\n\n` +
            `**✍️ Writing Skills:**\n\n` +
            `**Build Strong Sentences:**\n` +
            `- Vary sentence length\n` +
            `- Use active voice\n` +
            `- Choose specific words\n` +
            `- Avoid redundancy\n` +
            `- Show, don't tell\n\n` +
            `**Paragraph Structure:**\n` +
            `- Topic sentence (main idea)\n` +
            `- Supporting sentences (evidence/examples)\n` +
            `- Concluding sentence (wrap-up)\n` +
            `- Transition to next paragraph\n\n` +
            `**Essay Writing:**\n` +
            `Ask me: "essay writing tips" for comprehensive guide!\n\n` +
            `**📚 Literature Analysis:**\n\n` +
            `**Understanding Themes:**\n` +
            `- Identify recurring ideas\n` +
            `- Note author's message\n` +
            `- Connect to real world\n` +
            `- Support with textual evidence\n\n` +
            `**Character Analysis:**\n` +
            `- Motivations and goals\n` +
            `- Development/changes\n` +
            `- Relationships with others\n` +
            `- Symbolic significance\n\n` +
            `**Literary Devices:**\n` +
            `- Metaphor/Simile (comparisons)\n` +
            `- Symbolism (deeper meaning)\n` +
            `- Foreshadowing (hints)\n` +
            `- Irony (contrast/unexpected)\n` +
            `- Imagery (sensory details)\n\n` +
            `**🔤 Vocabulary Building:**\n\n` +
            `**Daily Practice:**\n` +
            `- Read widely (books, articles, essays)\n` +
            `- Note unfamiliar words\n` +
            `- Look up definitions\n` +
            `- Use in sentences\n` +
            `- Review regularly\n\n` +
            `**Context Clues:**\n` +
            `- Surrounding words hint at meaning\n` +
            `- Prefixes/suffixes provide clues\n` +
            `- Guess, then verify\n\n` +
            `**Word Roots:**\n` +
            `- Learn common Latin/Greek roots\n` +
            `- Decode unfamiliar words\n` +
            `- Example: "bio" = life (biology, biography)\n\n` +
            `**✅ Grammar Essentials:**\n\n` +
            `**Common Mistakes:**\n` +
            `- Their/There/They're\n` +
            `- Its/It's\n` +
            `- Your/You're\n` +
            `- Effect/Affect\n` +
            `- Then/Than\n\n` +
            `**Sentence Types:**\n` +
            `- Simple (one clause)\n` +
            `- Compound (two independent clauses)\n` +
            `- Complex (independent + dependent)\n` +
            `- Compound-Complex (both)\n\n` +
            `**🛠️ Tools & Resources:**\n\n` +
            `**Writing Help:**\n` +
            `- Grammarly (grammar/style checker)\n` +
            `- Hemingway Editor (readability)\n` +
            `- Thesaurus.com (word variety)\n` +
            `- Purdue OWL (writing guide)\n\n` +
            `**Reading:**\n` +
            `- SparkNotes (literature summaries)\n` +
            `- Project Gutenberg (free classics)\n` +
            `- Goodreads (book recommendations)\n\n` +
            `**💡 Improvement Plan:**\n\n` +
            `**Daily (15-30 min):**\n` +
            `- Read quality writing\n` +
            `- Learn 3-5 new words\n` +
            `- Write in journal\n\n` +
            `**Weekly:**\n` +
            `- Complete practice essays\n` +
            `- Read one short story/article\n` +
            `- Review grammar rules\n\n` +
            `**Monthly:**\n` +
            `- Finish one book\n` +
            `- Write longer piece\n` +
            `- Get feedback on writing\n\n` +
            `Use Edumate's Notes to save vocabulary and quotes!`;
    }

    // Programming & Computer Science (NEW)
    if(/\b(programming|coding|code|computer science|software|python|java|javascript|c\+\+|web development|app development)\b/i.test(text)){
        return `💻 **Programming & Computer Science Guide:**\n\n` +
            `**🎯 Learning to Code:**\n\n` +
            `**Beginner Path:**\n` +
            `1. Choose one language (Python recommended for beginners)\n` +
            `2. Learn basics: variables, data types, operators\n` +
            `3. Control flow: if/else, loops\n` +
            `4. Functions and methods\n` +
            `5. Data structures: lists, dictionaries, etc.\n` +
            `6. Object-oriented programming\n` +
            `7. Build projects!\n\n` +
            `**🔑 Key Principles:**\n\n` +
            `**1. Learn by Doing:**\n` +
            `- Don't just watch tutorials\n` +
            `- Type every example yourself\n` +
            `- Modify code and experiment\n` +
            `- Break things and fix them\n\n` +
            `**2. Build Projects:**\n` +
            `- Start small (calculator, to-do list)\n` +
            `- Gradually increase complexity\n` +
            `- Real projects = real learning\n` +
            `- Portfolio for future opportunities\n\n` +
            `**3. Read Documentation:**\n` +
            `- Official docs are your friend\n` +
            `- Learn to search effectively\n` +
            `- Understand error messages\n` +
            `- Stack Overflow wisely\n\n` +
            `**4. Practice Problem-Solving:**\n` +
            `- LeetCode (algorithms)\n` +
            `- HackerRank (challenges)\n` +
            `- CodeWars (kata problems)\n` +
            `- Project Euler (math problems)\n\n` +
            `**📚 Language-Specific Resources:**\n\n` +
            `**Python:**\n` +
            `- Python.org (official docs)\n` +
            `- Automate the Boring Stuff (free book)\n` +
            `- Real Python (tutorials)\n` +
            `- Corey Schafer (YouTube)\n\n` +
            `**JavaScript:**\n` +
            `- MDN Web Docs\n` +
            `- JavaScript.info\n` +
            `- FreeCodeCamp\n` +
            `- Traversy Media (YouTube)\n\n` +
            `**Java:**\n` +
            `- Oracle Java Tutorials\n` +
            `- Head First Java (book)\n` +
            `- CodingBat (practice)\n\n` +
            `**C++:**\n` +
            `- LearnCpp.com\n` +
            `- The Cherno (YouTube)\n` +
            `- Competitive programming\n\n` +
            `**🌐 Web Development:**\n\n` +
            `**Front-End Path:**\n` +
            `1. HTML (structure)\n` +
            `2. CSS (styling)\n` +
            `3. JavaScript (interactivity)\n` +
            `4. React/Vue (frameworks)\n` +
            `5. Build responsive sites\n\n` +
            `**Back-End Path:**\n` +
            `1. Choose language (Node.js, Python, etc.)\n` +
            `2. Learn databases (SQL, MongoDB)\n` +
            `3. APIs and HTTP\n` +
            `4. Authentication\n` +
            `5. Deployment\n\n` +
            `**🛠️ Essential Tools:**\n\n` +
            `**Code Editors:**\n` +
            `- VS Code (most popular)\n` +
            `- PyCharm (Python)\n` +
            `- IntelliJ (Java)\n\n` +
            `**Version Control:**\n` +
            `- Git (essential skill)\n` +
            `- GitHub (portfolio + collaboration)\n` +
            `- Learn basic commands\n\n` +
            `**🐛 Debugging Skills:**\n\n` +
            `**When Code Doesn't Work:**\n` +
            `1. Read error message carefully\n` +
            `2. Check syntax (typos, brackets, semicolons)\n` +
            `3. Use print statements / console.log\n` +
            `4. Use debugger/breakpoints\n` +
            `5. Google the error\n` +
            `6. Explain problem to rubber duck 🦆\n` +
            `7. Take a break, come back fresh\n\n` +
            `**💡 Study Tips:**\n\n` +
            `**Daily Practice:**\n` +
            `- Code every day (even 30 minutes)\n` +
            `- Consistency > marathon sessions\n` +
            `- Challenge yourself gradually\n\n` +
            `**Learning Resources:**\n` +
            `- FreeCodeCamp (free, comprehensive)\n` +
            `- The Odin Project (web dev)\n` +
            `- CS50 (Harvard, free on YouTube)\n` +
            `- Codecademy (interactive)\n` +
            `- Udemy courses (often on sale)\n\n` +
            `**🎓 Computer Science Concepts:**\n\n` +
            `**Data Structures:**\n` +
            `- Arrays, Lists\n` +
            `- Stacks, Queues\n` +
            `- Trees, Graphs\n` +
            `- Hash Tables\n\n` +
            `**Algorithms:**\n` +
            `- Sorting (bubble, merge, quick)\n` +
            `- Searching (linear, binary)\n` +
            `- Recursion\n` +
            `- Dynamic programming\n\n` +
            `**🚀 Project Ideas:**\n\n` +
            `**Beginner:**\n` +
            `- Calculator\n` +
            `- To-do list\n` +
            `- Number guessing game\n` +
            `- Mad Libs generator\n\n` +
            `**Intermediate:**\n` +
            `- Weather app (API)\n` +
            `- Personal blog\n` +
            `- Quiz application\n` +
            `- Password manager\n\n` +
            `**Advanced:**\n` +
            `- Social media clone\n` +
            `- E-commerce site\n` +
            `- Real-time chat app\n` +
            `- Machine learning project\n\n` +
            `**📖 Past Papers:**\n` +
            `"Past paper computer science 9618 [year]"\n\n` +
            `💡 **Remember:** Every expert was once a beginner. Keep coding! 🚀`;
    }

    // Test Anxiety (NEW)
if (/test anxiety|exam anxiety|exam stress|nervous.*exam|afraid.*test|panic.*exam|exam fear/i.test(text)) {
    return `😌 **Managing Test Anxiety:**\n\n` +
        `**🧠 Understanding Test Anxiety:**\n\n` +
        `Anxiety before tests is NORMAL. Your brain sees it as a threat and triggers fight-or-flight.\n\n` +
        `The goal isn't to eliminate anxiety, but to manage it.\n\n` +
        `**🛡️ Before the Exam:**\n\n` +
        `**Preparation = Confidence:**\n` +
        `- Start studying early (reduces cramming stress)\n` +
        `- Use practice tests (familiarity reduces fear)\n` +
        `- Study in exam-like conditions\n` +
        `- Know the format and rules\n` +
        `- Prepare materials the night before\n\n` +
        `**Physical Preparation:**\n` +
        `- Get 8 hours of sleep\n` +
        `- Eat a balanced breakfast (protein + complex carbs)\n` +
        `- Avoid excessive caffeine\n` +
        `- Exercise lightly (releases tension)\n` +
        `- Arrive early (rushing increases anxiety)\n\n` +
        `**Mental Preparation:**\n` +
        `- Visualize success\n` +
        `- Use positive self-talk: "I am prepared"\n` +
        `- Remember past successes\n` +
        `- Accept some nervousness is okay\n\n` +
        `**😰 During the Exam:**\n\n` +
        `**If Anxiety Strikes:**\n\n` +
        `**1. Breathing Technique (2 minutes):**\n` +
        `- Breathe in for 4 counts\n` +
        `- Hold for 4 counts\n` +
        `- Breathe out for 6 counts\n` +
        `- Repeat 5 times\n` +
        `- Signals body to calm down\n\n` +
        `**2. Grounding Technique (5-4-3-2-1):**\n` +
        `- 5 things you can see\n` +
        `- 4 things you can touch\n` +
        `- 3 things you can hear\n` +
        `- 2 things you can smell\n` +
        `- 1 thing you can taste\n` +
        `- Brings you to present moment\n\n` +
        `**3. Muscle Relaxation:**\n` +
        `- Tense shoulders, then release\n` +
        `- Clench fists, then release\n` +
        `- Releases physical tension\n\n` +
        `**4. Positive Self-Talk:**\n` +
        `- "I've prepared for this"\n` +
        `- "I can handle this"\n` +
        `- "This feeling will pass"\n` +
        `- "I just need to do my best"\n\n` +
        `**📝 Exam Strategies:**\n\n` +
        `**Start Strong:**\n` +
        `- Read instructions carefully\n` +
        `- Do easy questions first\n` +
        `- Build confidence with early wins\n\n` +
        `**If Stuck:**\n` +
        `- Skip and come back later\n` +
        `- Don't panic over one question\n` +
        `- Move on to maintain momentum\n\n` +
        `**Time Management:**\n` +
        `- Budget time per section\n` +
        `- Don't spend too long on one question\n` +
        `- Leave time to review\n\n` +
        `**🧘 Long-Term Anxiety Management:**\n\n` +
        `**Daily Practices:**\n` +
        `- Meditation (5-10 min daily)\n` +
        `- Regular exercise\n` +
        `- Adequate sleep (7-9 hours)\n` +
        `- Balanced diet\n` +
        `- Limit caffeine and sugar\n\n` +
        `**Mindset Shifts:**\n` +
        `- Exam measures knowledge, not worth\n` +
        `- One exam doesn't define future\n` +
        `- Focus on effort, not just results\n` +
        `- Learn from every experience\n\n` +
        `**Building Confidence:**\n` +
        `- Keep record of past successes\n` +
        `- Celebrate small wins\n` +
        `- Practice positive affirmations\n` +
        `- Surround yourself with supportive people\n\n` +
        `**🆘 When to Seek Help:**\n\n` +
        `If anxiety is severe or persistent:\n` +
        `- Interferes with daily life\n` +
        `- Causes physical symptoms (nausea, headaches)\n` +
        `- Leads to avoiding exams\n\n` +
        `→ Talk to school counselor, therapist, or doctor\n\n` +
        `**📚 Additional Resources:**\n\n` +
        `Apps:\n` +
        `- Headspace (meditation)\n` +
        `- Calm (anxiety relief)\n` +
        `- Breathe2Relax (breathing exercises)\n\n` +
        `**💙 Remember:**\n` +
        `You are more than your test scores.\n` +
        `You've prepared. You can do this.\n` +
        `Even if anxious, you can still succeed.\n\n` +
        `Breathe. Focus. You've got this! 💪`;
}


    // ===== GOAL SETTING (ENHANCED) =====
    if(/\b(goal|goals|target|objective|aim|ambition|set.*goal|achieve|achievement)\b/i.test(text)){
        return `🎯 **Effective Goal Setting:**\n\n` +
            `**📋 SMART Goals Framework:**\n\n` +
            `**S - Specific:**\n` +
            `❌ "Study more"\n` +
            `✅ "Study biology for 2 hours daily"\n\n` +
            `**M - Measurable:**\n` +
            `❌ "Get better at math"\n` +
            `✅ "Complete 20 practice problems daily"\n\n` +
            `**A - Achievable:**\n` +
            `❌ "Read 50 books this month" (unrealistic)\n` +
            `✅ "Read 4 books this month" (realistic)\n\n` +
            `**R - Relevant:**\n` +
            `- Aligns with your priorities\n` +
            `- Supports bigger objectives\n` +
            `- Meaningful to YOU\n\n` +
            `**T - Time-bound:**\n` +
            `❌ "Learn Spanish someday"\n` +
            `✅ "Complete Spanish basics course by June 30"\n\n` +
            `**🏆 Types of Goals:**\n\n` +
            `**Long-Term (1+ years):**\n` +
            `- Career aspirations\n` +
            `- University degree\n` +
            `- Major skill mastery\n\n` +
            `**Medium-Term (3-12 months):**\n` +
            `- Complete a course\n` +
            `- Improve grade from B to A\n` +
            `- Build a project portfolio\n\n` +
            `**Short-Term (days to 3 months):**\n` +
            `- Finish assignment\n` +
            `- Learn specific chapter\n` +
            `- Weekly study targets\n\n` +
            `**📝 Goal-Setting Process:**\n\n` +
            `**1. Brainstorm:**\n` +
            `- What do you want to achieve?\n` +
            `- Why is it important?\n` +
            `- Write everything down\n\n` +
            `**2. Prioritize:**\n` +
            `- Which goals matter most?\n` +
            `- Which have deadlines?\n` +
            `- Focus on 3-5 main goals\n\n` +
            `**3. Break Down:**\n` +
            `- Divide big goals into milestones\n` +
            `- Create action steps\n` +
            `- Set mini-deadlines\n\n` +
            `**4. Track Progress:**\n` +
            `- Weekly check-ins\n` +
            `- Adjust as needed\n` +
            `- Celebrate milestones\n\n` +
            `**🔄 Accountability Systems:**\n\n` +
            `- Share goals with friend/family\n` +
            `- Join study group\n` +
            `- Use habit tracker app\n` +
            `- Public commitment (social media)\n` +
            `- Find accountability partner\n\n` +
            `**📊 Use Edumate to Track Goals:**\n\n` +
            `- Add goals to Planner as tasks\n` +
            `- Create Projects for big objectives\n` +
            `- Use Notes to journal progress\n` +
            `- Check Dashboard for statistics\n\n` +
            `**💡 Pro Tips:**\n\n` +
            `- Write goals in present tense: "I am..."\n` +
            `- Visualize achieving them daily\n` +
            `- Review goals every morning\n` +
            `- Reward yourself for progress\n` +
            `- Don't give up after setbacks—adjust!\n\n` +
            `"A goal without a plan is just a wish." — Antoine de Saint-Exupéry`;
    }

    // ===== READING SPEED & COMPREHENSION (ENHANCED) =====
    if(/reading (speed|faster|quickly)|speed reading|read faster|improve.*reading|reading comprehension|understand.*reading/i.test(text)){
        return `📖 **Reading Mastery Guide:**\n\n` +
            `**⚡ Speed Reading Techniques:**\n\n` +
            `**1. Minimize Subvocalization:**\n` +
            `- Don't "say" words in your head\n` +
            `- Your brain can process faster than you can speak\n` +
            `- Practice: Hum while reading to prevent subvocalization\n` +
            `- Takes practice to master\n\n` +
            `**2. Use a Pointer:**\n` +
            `- Finger, pen, or cursor\n` +
            `- Guides eyes smoothly\n` +
            `- Prevents regression (re-reading)\n` +
            `- Gradually increase pointer speed\n\n` +
            `**3. Expand Peripheral Vision:**\n` +
            `- Read in chunks, not individual words\n` +
            `- See 3-5 words at once\n` +
            `- Practice with columns of text\n` +
            `- Your brain recognizes word shapes\n\n` +
            `**4. Reduce Regression:**\n` +
            `- Trust first reading\n` +
            `- Only re-read if truly necessary\n` +
            `- Use pointer to maintain forward momentum\n\n` +
            `**5. Preview Material:**\n` +
            `- Skim headings and subheadings\n` +
            `- Read first and last paragraphs\n` +
            `- Check summaries\n` +
            `- Primes brain for content\n\n` +
            `**📚 Comprehension Strategies:**\n\n` +
            `**SQ3R Method (Proven Effective):**\n\n` +
            `**Survey (5 min):**\n` +
            `- Scan table of contents\n` +
            `- Read chapter summaries\n` +
            `- Note headings and bold terms\n` +
            `- Get overview of structure\n\n` +
            `**Question (2 min):**\n` +
            `- Turn headings into questions\n` +
            `- "What is photosynthesis?" from heading "Photosynthesis"\n` +
            `- Creates purpose for reading\n\n` +
            `**Read (varies):**\n` +
            `- Read actively to answer questions\n` +
            `- Highlight key concepts (sparingly!)\n` +
            `- Take notes in margins\n\n` +
            `**Recite (5-10 min per section):**\n` +
            `- Close book\n` +
            `- Summarize in your own words\n` +
            `- Answer the questions you created\n` +
            `- Tests understanding immediately\n\n` +
            `**Review (10-15 min):**\n` +
            `- Skim material again\n` +
            `- Review notes and highlights\n` +
            `- Ensure retention\n\n` +
            `**✅ Active Reading Techniques:**\n\n` +
            `**Annotation:**\n` +
            `- Underline main ideas\n` +
            `- Circle key terms\n` +
            `- Write questions in margins\n` +
            `- Note connections to other material\n` +
            `- Use symbols (!, ?, *, etc.)\n\n` +
            `**Mental Engagement:**\n` +
            `- Ask questions while reading\n` +
            `- Predict what comes next\n` +
            `- Connect to prior knowledge\n` +
            `- Visualize concepts\n` +
            `- Summarize paragraphs mentally\n\n` +
            `**🎯 Reading for Different Purposes:**\n\n` +
            `**Skimming (Fast Overview):**\n` +
            `- Read first/last paragraphs\n` +
            `- First sentence of each paragraph\n` +
            `- Headings and bold terms\n` +
            `- Use when deciding if material is relevant\n\n` +
            `**Scanning (Finding Specific Info):**\n` +
            `- Look for keywords\n` +
            `- Let eyes jump around page\n` +
            `- Use when answering specific question\n\n` +
            `**Deep Reading (Full Comprehension):**\n` +
            `- Slow, careful reading\n` +
            `- Take notes extensively\n` +
            `- Re-read difficult sections\n` +
            `- Use for important study material\n\n` +
            `**💪 Building Reading Stamina:**\n\n` +
            `**Progressive Training:**\n` +
            `Week 1: Read 15 min daily\n` +
            `Week 2: Read 20 min daily\n` +
            `Week 3: Read 30 min daily\n` +
            `Week 4+: Read 45-60 min daily\n\n` +
            `**📱 Tools & Apps:**\n` +
            `- Spreeder (speed reading practice)\n` +
            `- ReadMe! (RSVP speed reading)\n` +
            `- Kindle (adjustable reading speed)\n` +
            `- Pocket (save articles for later)\n\n` +
            `**📖 What to Read:**\n` +
            `- Start with topics you enjoy\n` +
            `- Gradually tackle harder material\n` +
            `- Mix fiction and non-fiction\n` +
            `- Read quality sources\n\n` +
            `**💡 Pro Tips:**\n\n` +
            `- Read daily (consistency builds speed)\n` +
            `- Good lighting reduces eye strain\n` +
            `- Comfortable seating position\n` +
            `- Take breaks every 45-60 min\n` +
            `- Adjust speed to material complexity\n` +
            `- Comprehension > Speed always!\n\n` +
            `**⚠️ Remember:**\n` +
            `Speed reading works best for familiar topics.\n` +
            `For complex new material, slow down!\n` +
            `Understanding is more important than speed.`;
    }

    // ===== TASKS DISPLAY =====
    if(/show.*(task|todo|to-do)|list.*task|my tasks|pending task|what.*tasks/i.test(text)){
        const pending = (tasks||[]).filter(t=>!t.done).sort((a,b)=> (b.priority||0)-(a.priority||0));
        if(!pending.length) return "🎉 **No Pending Tasks!**\n\nAmazing! You've completed everything!\n\n**What's next?**\n- Add new tasks in the Planner\n- Work on projects\n- Review course materials\n- Take a well-deserved break! 😊\n\n**Want to:**\n- Set new goals?\n- Review completed tasks?\n- Plan upcoming week?";
        
        const top = pending.slice(0,10).map(t=>`- ${t.title || 'Untitled'} (Priority: ${t.priority||'Medium'}${t.deadline?(' — Due: '+t.deadline):''})`).join('\n');
        return `✅ **Your Pending Tasks:**\n\n${top}\n\n` +
               `**Total Pending:** ${pending.length}\n\n` +
               `**💡 Productivity Tips:**\n` +
               `- Focus on high-priority items first\n` +
               `- Break large tasks into smaller steps\n` +
               `- Use Pomodoro Technique (25 min focus)\n` +
               `- Mark items done as you complete them\n\n` +
               `**Need help prioritizing?**\n` +
               `Ask: "What should I do first?"`;
    }

    // ===== PROJECTS DISPLAY =====
    if(/show.*(project|assignment)|list.*project|my projects|pending project/i.test(text)){
        const pending = (projects||[]).filter(p=>!p.done).sort((a,b)=> (b.priority||0)-(a.priority||0));
        if(!pending.length) return "🎉 **No Pending Projects!**\n\nExcellent work completing everything!\n\n**Consider:**\n- Starting a new project\n- Reviewing completed projects for insights\n- Setting new learning goals\n- Exploring new areas of interest\n\n**Project Ideas:**\n- Build something new (coding, writing, design)\n- Research a topic of interest\n- Create a portfolio piece";
        
        const top = pending.slice(0,10).map(p=>`- ${p.title || 'Untitled'} (Priority: ${p.priority||'Medium'}${p.deadline?(' — Due: '+p.deadline):''})`).join('\n');
        return `📁 **Your Pending Projects:**\n\n${top}\n\n` +
               `**Total Pending:** ${pending.length}\n\n` +
               `**💡 Project Management Tips:**\n` +
               `- Break into smaller milestones\n` +
               `- Set interim deadlines\n` +
               `- Track progress regularly\n` +
               `- Use subtasks for complex projects\n` +
               `- Review and adjust as needed\n\n` +
               `**Feeling overwhelmed?** Break your largest project into 3 smaller tasks today!`;
    }

    // ===== COURSES DISPLAY =====
    if(/show.*(course|class|lesson)|list.*course|my courses|pending course/i.test(text)){
        const pending = (courses||[]).filter(c=>!c.done).sort((a,b)=> (b.priority||0)-(a.priority||0));
        if(!pending.length) return "🎓 **No Pending Course Lessons!**\n\nAmazing progress on your learning journey!\n\n**Next Steps:**\n- Enroll in new courses\n- Review completed materials\n- Apply what you've learned\n- Share knowledge with others\n- Practice and build projects\n\n**Learning Resources:**\n- Khan Academy (free, comprehensive)\n- Coursera (university courses)\n- Udemy (affordable courses)\n- edX (quality education)";
        
        const top = pending.slice(0,10).map(c=>`- ${c.title || 'Untitled'}${c.endDate?(' — Ends: '+c.endDate):''})`).join('\n');
        return `🎓 **Your Pending Course Items:**\n\n${top}\n\n` +
               `**Total Pending:** ${pending.length}\n\n` +
               `**💡 Learning Tips:**\n` +
               `- Set consistent study schedule\n` +
               `- Take notes actively\n` +
               `- Apply concepts through practice\n` +
               `- Don't skip fundamentals\n` +
               `- Review regularly (spaced repetition)\n\n` +
               `**Stay Consistent:** Even 30 minutes daily adds up to massive progress!`;
    }

    // ===== NOTES DISPLAY =====
    if(/show.*(note|notebook)|list.*note|my notes/i.test(text)){
        if(!notes || notes.length === 0) return "📝 **No Notes Yet**\n\nYou haven't created any notes yet.\n\n**Why Use Notes?**\n- Organize study materials\n- Save important information\n- Quick reference for exams\n- Track learning progress\n\n**💡 Go to the Notes page to start organizing your knowledge!**\n\n**Note-Taking Tips:**\n- Use clear titles\n- Organize by subject/topic\n- Review and update regularly\n- Include examples\n- Use formatting for clarity";
        
        const recent = notes.slice(-5).reverse().map(n=>`- ${n.title || 'Untitled note'}`).join('\n');
        return `📝 **Your Recent Notes:**\n\n${recent}\n\n` +
               `**Total Notes:** ${notes.length}\n\n` +
               `**💡 Organization Tips:**\n` +
               `- Group by subject or topic\n` +
               `- Use consistent naming\n` +
               `- Add dates for time-sensitive info\n` +
               `- Review notes weekly\n` +
               `- Update as you learn more\n\n` +
               `**Want note-taking tips?** Ask: "note-taking methods"`;
    }

    // ===== WATCHLIST DISPLAY (NEW) =====
if(/show.*(watch|watchlist|movie|series|to watch)|list.*watch|my watchlist|what.*watching/i.test(text)){
    if(!watchlist || watchlist.length === 0) {
        return "🎬 **Your Watchlist is Empty**\n\n" +
               "You haven't added any movies or series yet!\n\n" +
               "**💡 How to Add:**\n" +
               "1. Go to the Planner page\n" +
               "2. Switch to Watchlist tab\n" +
               "3. Click the + button\n" +
               "4. Add your favorite shows!\n\n" +
               "**Why Use Watchlist?**\n" +
               "- Track what you want to watch\n" +
               "- Remember where you left off\n" +
               "- Rate and organize content\n" +
               "- Never forget a recommendation\n" +
               "- Get random suggestions when bored!\n\n" +
               "Start building your watchlist today! 🍿";
    }
    
    const watching = watchlist.filter(w => w.status === 'Watching');
    const planToWatch = watchlist.filter(w => w.status === 'Plan to Watch');
    const watched = watchlist.filter(w => w.status === 'Watched');
    
    let response = "🎬 **Your Watchlist:**\n\n";
    
    if(watching.length > 0) {
        response += "📺 **Currently Watching:**\n";
        watching.slice(0, 5).forEach(w => {
            const progress = w.progress > 0 ? ` (${w.progress}% complete)` : '';
            response += `- ${w.title}${progress}\n`;
        });
        response += "\n";
    }
    
    if(planToWatch.length > 0) {
        response += "📌 **Plan to Watch:**\n";
        planToWatch.slice(0, 5).forEach(w => {
            const rating = w.rating > 0 ? ` ⭐ ${w.rating}/10` : '';
            response += `- ${w.title}${rating}\n`;
        });
        response += "\n";
    }
    
    if(watched.length > 0) {
        response += "✅ **Watched:**\n";
        watched.slice(0, 3).forEach(w => {
            const rating = w.rating > 0 ? ` ⭐ ${w.rating}/10` : '';
            response += `- ${w.title}${rating}\n`;
        });
        response += "\n";
    }
    
    response += `**📊 Summary:**\n` +
                `- Total Items: ${watchlist.length}\n` +
                `- Currently Watching: ${watching.length}\n` +
                `- Plan to Watch: ${planToWatch.length}\n` +
                `- Completed: ${watched.length}\n\n` +
                `**💡 Tips:**\n` +
                `- Update your progress regularly\n` +
                `- Rate shows after watching\n` +
                `- Add notes about where to find them\n` +
                `- Use "Random Pick" when you can't decide!\n\n` +
                `**Want a suggestion?** Ask: "random pick" or "what should I watch"`;
    
    return response;
}

// ===== RANDOM PICK / WATCH SUGGESTION (NEW) =====
if(/random pick|what.*watch|suggest.*watch|pick.*watch|movie.*suggest|series.*suggest|can't decide.*watch|what to watch|recommend.*watch/i.test(text)){
    if(!watchlist || watchlist.length === 0) {
        return "🎬 **Watchlist is Empty!**\n\n" +
               "Add some movies or series to your watchlist first!\n\n" +
               "**Quick Start:**\n" +
               "1. Go to Planner → Watchlist tab\n" +
               "2. Click the + button\n" +
               "3. Add shows you want to watch\n" +
               "4. Come back and ask for a random pick!\n\n" +
               "I'll help you decide what to watch! 🍿";
    }
    
    // Filter for items user hasn't watched yet
    const unwatched = watchlist.filter(w => 
        w.status === 'Plan to Watch' || w.status === 'Watching' || w.status === 'On Hold'
    );
    
    if(unwatched.length === 0) {
        return "🎉 **You've Watched Everything!**\n\n" +
               "Amazing! You've completed your entire watchlist!\n\n" +
               "**What's Next?**\n" +
               "- Add new shows to your watchlist\n" +
               "- Rewatch your favorites\n" +
               "- Browse recommendations online\n" +
               "- Ask friends for suggestions\n\n" +
               "Time to discover something new! 🌟";
    }
    
    // Pick a random item
    const randomIndex = Math.floor(Math.random() * unwatched.length);
    const pick = unwatched[randomIndex];
    
    const stars = pick.rating > 0 ? '⭐'.repeat(Math.floor(pick.rating)) : '';
    const ratingText = pick.rating > 0 ? `${stars} (${pick.rating}/10)` : 'Not rated yet';
    
    let response = `🎬 **Random Pick: ${pick.title}**\n\n`;
    
    response += `**Type:** ${pick.type || 'N/A'}\n`;
    if(pick.genre) response += `**Genre:** ${pick.genre}\n`;
    if(pick.platform) response += `**Available on:** ${pick.platform}\n`;
    response += `**Rating:** ${ratingText}\n`;
    if(pick.year) response += `**Year:** ${pick.year}\n`;
    
    if(pick.seasons > 0) {
        response += `\n**Series Info:**\n`;
        response += `- Seasons: ${pick.seasons}\n`;
        response += `- Episodes: ${pick.episodes}\n`;
        if(pick.progress > 0) {
            response += `- Your Progress: Season ${pick.currentSeason}, Episode ${pick.currentEpisode} (${pick.progress}%)\n`;
        }
    }
    
    if(pick.desc) {
        response += `\n**Description:**\n${pick.desc}\n`;
    }
    
    if(pick.director) response += `\n**Director:** ${pick.director}`;
    if(pick.cast) response += `\n**Cast:** ${pick.cast}`;
    
    response += `\n\n🍿 **Time to watch this!**\n\n`;
    response += `**💡 Pro Tips:**\n`;
    response += `- Set aside time when you won't be interrupted\n`;
    response += `- Grab snacks and get comfortable\n`;
    response += `- Update your progress in the watchlist after\n`;
    response += `- Rate it when you're done!\n\n`;
    response += `**Not feeling it?** Ask for another "random pick"!\n`;
    response += `**Ready to watch?** Go to Planner → Watchlist to track your progress!`;
    
    return response;
}

// ===== WATCHLIST TIPS (NEW) =====
if(/watchlist tips|how.*use watchlist|watchlist help|organize watchlist/i.test(text)){
    return `🎬 **Watchlist Management Guide:**\n\n` +
           `**📝 Adding Items:**\n` +
           `- Include title, type (movie/series), and platform\n` +
           `- Add genre for easier filtering\n` +
           `- Note where it's available (Netflix, Prime, etc.)\n` +
           `- Include year for easier searching\n\n` +
           `**📊 Tracking Progress:**\n` +
           `- Update current episode/season regularly\n` +
           `- Mark status (Watching/Plan to Watch/Watched)\n` +
           `- Rate shows after watching (helps with recommendations)\n` +
           `- Add notes about where you heard about it\n\n` +
           `**🎯 Organization Tips:**\n` +
           `- Use categories: Work, Personal, etc.\n` +
           `- Pin urgent or time-sensitive shows\n` +
           `- Mark favorites with heart icon\n` +
           `- Archive completed seasons\n\n` +
           `**⭐ Rating System:**\n` +
           `- 1-3: Didn't enjoy, won't continue\n` +
           `- 4-6: Okay, might finish eventually\n` +
           `- 7-8: Good, definitely worth watching\n` +
           `- 9-10: Excellent, highly recommend!\n\n` +
           `**🔀 Random Pick Feature:**\n` +
           `- Can't decide what to watch? Ask me!\n` +
           `- I'll suggest from your "Plan to Watch" or "Watching" list\n` +
           `- Just say "random pick" or "what should I watch"\n\n` +
           `**💡 Pro Tips:**\n` +
           `- Add shows as soon as you hear about them\n` +
           `- Update progress to avoid forgetting where you left off\n` +
           `- Export your watchlist as backup\n` +
           `- Share highly-rated shows with friends\n` +
           `- Set reminders for series premieres\n\n` +
           `**🎬 Go to Planner → Watchlist to get started!**`;
}


// ===== PASSWORD MANAGER FEATURES (NEW) =====

// Password Security Tips
if(/password (security|safety|protection)|secure.*password|password.*safe|password.*best.*practice|protect.*password|password.*tip/i.test(text)){
    return `🔐 **Password Security Best Practices:**\n\n` +
           `**✅ Creating Strong Passwords:**\n\n` +
           `**DO:**\n` +
           `- Use 12+ characters minimum\n` +
           `- Mix uppercase, lowercase, numbers, symbols\n` +
           `- Make each password unique\n` +
           `- Use password manager (like Edumate!)\n` +
           `- Enable two-factor authentication (2FA)\n\n` +
           `**DON'T:**\n` +
           `- Use personal info (name, birthday)\n` +
           `- Reuse passwords across sites\n` +
           `- Use common words ("password123")\n` +
           `- Share passwords with others\n` +
           `- Write passwords on paper/sticky notes\n\n` +
           `**🎯 Password Strength Formula:**\n\n` +
           `❌ **Weak:** "password123" (8 chars, common)\n` +
           `⚠️ **Medium:** "MyPassword2024" (14 chars, no symbols)\n` +
           `✅ **Strong:** "T!g3r$Run@M00n47" (16 chars, mixed)\n\n` +
           `**🛡️ Two-Factor Authentication (2FA):**\n\n` +
           `**What it is:**\n` +
           `- Second verification step after password\n` +
           `- Usually a code sent to your phone\n` +
           `- Or generated by authenticator app\n\n` +
           `**Why use it:**\n` +
           `- Even if password is stolen, account is protected\n` +
           `- 99.9% effective against automated attacks\n` +
           `- Essential for important accounts\n\n` +
           `**Enable 2FA on:**\n` +
           `- Email accounts\n` +
           `- Banking/financial\n` +
           `- Social media\n` +
           `- Cloud storage\n` +
           `- Any account with sensitive data\n\n` +
           `**📱 2FA Apps:**\n` +
           `- Google Authenticator\n` +
           `- Microsoft Authenticator\n` +
           `- Authy\n` +
           `- 1Password\n\n` +
           `**🔍 Checking for Breaches:**\n\n` +
           `**Have I Been Pwned:**\n` +
           `- Visit: haveibeenpwned.com\n` +
           `- Enter your email\n` +
           `- Check if data was leaked\n` +
           `- Change passwords if compromised\n\n` +
           `**⚠️ Warning Signs:**\n` +
           `- Unexpected password reset emails\n` +
           `- Unfamiliar login locations\n` +
           `- Account activity you didn't do\n` +
           `- Friends receiving spam from you\n\n` +
           `**Immediate Action if Compromised:**\n` +
           `1. Change password immediately\n` +
           `2. Enable 2FA\n` +
           `3. Check for unauthorized activity\n` +
           `4. Update security questions\n` +
           `5. Monitor account closely\n\n` +
           `**🗂️ Password Organization:**\n\n` +
           `**Use Edumate Password Manager:**\n` +
           `- Store all passwords securely\n` +
           `- Encrypt with master password\n` +
           `- Organize by category\n` +
           `- Mark favorites for quick access\n` +
           `- Check password strength\n` +
           `- Generate strong passwords\n\n` +
           `**Categories to Use:**\n` +
           `- 🌐 Social Media (Facebook, Twitter, Instagram)\n` +
           `- 🏦 Banking (bank accounts, credit cards)\n` +
           `- 📧 Email (Gmail, Outlook, etc.)\n` +
           `- 💼 Work (company accounts, tools)\n` +
           `- 🛒 Shopping (Amazon, eBay, etc.)\n` +
           `- 🎬 Entertainment (Netflix, Spotify, etc.)\n\n` +
           `**🔄 Password Maintenance:**\n\n` +
           `**Regular Updates:**\n` +
           `- Change every 3-6 months (important accounts)\n` +
           `- Immediately if breach suspected\n` +
           `- Update weak passwords first\n\n` +
           `**Monthly Review:**\n` +
           `- Check for weak passwords\n` +
           `- Remove unused accounts\n` +
           `- Update recovery info\n` +
           `- Test backup codes\n\n` +
           `**💡 Pro Tips:**\n\n` +
           `**Memorable Passphrases:**\n` +
           `Instead of random characters, use phrases:\n` +
           `- "Coffee!Morning@Beach2024" (easy to remember!)\n` +
           `- "My2Dogs&3Cats=5Pets!" (personal but secure)\n` +
           `- "ISummerIn@Greece2023" (memorable event)\n\n` +
           `**Password Patterns (Avoid!):**\n` +
           `❌ Don't use: qwerty, 12345, password\n` +
           `❌ Don't use: keyboard patterns (asdfgh)\n` +
           `❌ Don't use: repeated characters (aaaaaa)\n\n` +
           `**🎯 Take Action Now:**\n\n` +
           `1. **Go to Edumate Password Manager**\n` +
           `2. **Check for weak passwords** (red indicators)\n` +
           `3. **Use password generator** for strong ones\n` +
           `4. **Enable 2FA** on important accounts\n` +
           `5. **Set master password** (never forget it!)\n\n` +
           `**🔐 Your security is in your hands!**\n\n` +
           `Type "generate password" for strong password creation tips!`;
}

// Generate Password Help
if(/generate password|password generat|create.*password|make.*password|strong password|random password/i.test(text)){
    return `🔐 **Password Generation Guide:**\n\n` +
           `**🎯 Use Edumate's Built-in Generator!**\n\n` +
           `**Quick Steps:**\n` +
           `1. Go to **Password Manager** page\n` +
           `2. Click **gear icon** (bottom right)\n` +
           `3. Adjust settings:\n` +
           `   • Length: 16-32 characters recommended\n` +
           `   • Enable: Uppercase, Lowercase, Numbers, Symbols\n` +
           `   • Optional: Exclude ambiguous (0,O,l,1)\n` +
           `4. Click **Generate New Password**\n` +
           `5. Click **Copy to Clipboard**\n` +
           `6. Use when creating/updating accounts!\n\n` +
           `**⚙️ Generator Settings Explained:**\n\n` +
           `**Password Length:**\n` +
           `- 8-11 chars: Minimum (not recommended)\n` +
           `- 12-15 chars: Good for most accounts\n` +
           `- 16-20 chars: Excellent security\n` +
           `- 20+ chars: Maximum security (banking, email)\n\n` +
           `**Character Types:**\n\n` +
           `✅ **Uppercase (A-Z):**\n` +
           `- Increases complexity\n` +
           `- Essential for strong passwords\n` +
           `- Always enable!\n\n` +
           `✅ **Lowercase (a-z):**\n` +
           `- Foundation of password\n` +
           `- Always enable!\n\n` +
           `✅ **Numbers (0-9):**\n` +
           `- Adds numerical complexity\n` +
           `- Recommended for all passwords\n\n` +
           `✅ **Symbols (!@#$%):**\n` +
           `- Highest security boost\n` +
           `- Some sites require them\n` +
           `- Enable when possible\n\n` +
           `⚠️ **Exclude Ambiguous:**\n` +
           `- Removes: 0, O, l, 1, I\n` +
           `- Useful if typing manually\n` +
           `- Prevents confusion\n\n` +
           `**🎯 Recommended Configurations:**\n\n` +
           `**🏦 Banking/Email (Maximum Security):**\n` +
           `- Length: 20-24 characters\n` +
           `- All character types: ✓\n` +
           `- Exclude ambiguous: Your choice\n` +
           `- Example: "K9$mP2@xT4&vL8#qW1"\n\n` +
           `**🌐 Social Media (High Security):**\n` +
           `- Length: 16-18 characters\n` +
           `- All character types: ✓\n` +
           `- Exclude ambiguous: ✓\n` +
           `- Example: "Bx7$Nq3@Hp9&Dk5"\n\n` +
           `**🛒 Shopping (Good Security):**\n` +
           `- Length: 14-16 characters\n` +
           `- All character types: ✓\n` +
           `- Exclude ambiguous: ✓\n` +
           `- Example: "Zt5#Mp8@Rx2$Kw"\n\n` +
           `**💡 Manual Password Creation:**\n\n` +
           `If you prefer creating manually:\n\n` +
           `**Method 1: Passphrase:**\n` +
           `1. Think of a memorable phrase\n` +
           `2. Add numbers and symbols\n` +
           `3. Mix uppercase/lowercase\n` +
           `   • "I love coffee every morning!"\n` +
           `   • "!L0v3C0ff33@M0rn!ng"\n\n` +
           `**Method 2: First Letters:**\n` +
           `1. Create a sentence you'll remember\n` +
           `2. Take first letter of each word\n` +
           `3. Add numbers and symbols\n` +
           `   • "My dog has 3 balls and loves 2 play"\n` +
           `   • "Mdh3bal2p!2024"\n\n` +
           `**Method 3: Random + Personal:**\n` +
           `1. Generate random string\n` +
           `2. Add personal memorable element\n` +
           `   • Random: "xK9$mP2"\n` +
           `   • Personal: "Beach2024"\n` +
           `   • Combined: "xK9$mP2@Beach2024"\n\n` +
           `**🔍 Testing Password Strength:**\n\n` +
           `**In Edumate:**\n` +
           `- Real-time strength indicator\n` +
           `- Shows: Weak (red), Medium (orange), Strong (green)\n` +
           `- Visual strength bar\n\n` +
           `**External Tools:**\n` +
           `- howsecureismypassword.net\n` +
           `- passwordmeter.com\n` +
           `- kaspersky.com/password-checker\n\n` +
           `**🎯 Password Strength Checklist:**\n\n` +
           `✓ At least 12 characters\n` +
           `✓ Contains uppercase letters\n` +
           `✓ Contains lowercase letters\n` +
           `✓ Contains numbers\n` +
           `✓ Contains symbols\n` +
           `✓ No personal info (name, birthday)\n` +
           `✓ No common words or patterns\n` +
           `✓ Unique (not used elsewhere)\n` +
           `✓ Not based on dictionary words\n\n` +
           `**⚠️ What Makes Passwords Weak:**\n\n` +
           `❌ Short length (<12 characters)\n` +
           `❌ Common words ("password", "welcome")\n` +
           `❌ Patterns ("12345", "qwerty", "abc123")\n` +
           `❌ Personal info ("john1990", "birthday")\n` +
           `❌ Single character type (all lowercase)\n` +
           `❌ Repeated characters ("aaaaaa")\n` +
           `❌ Simple substitutions ("Pa$$w0rd")\n\n` +
           `**💾 Storing Generated Passwords:**\n\n` +
           `**In Edumate Password Manager:**\n` +
           `1. Generate password\n` +
           `2. Copy to clipboard\n` +
           `3. Go to Add Password form\n` +
           `4. Paste into password field\n` +
           `5. Fill in other details\n` +
           `6. Save!\n\n` +
           `**🔐 Security Reminder:**\n` +
           `- Never share generated passwords\n` +
           `- Don't send via email/text\n` +
           `- Use password manager to store safely\n` +
           `- Enable 2FA when possible\n` +
           `- Change immediately if compromised\n\n` +
           `**🚀 Go to Password Manager now:**\n` +
           `Click "🔐 Passwords" in sidebar to get started!\n\n` +
           `Type "password security" for more security tips!`;
}

// Weak Passwords Check
if(/weak password|check.*password|password.*strength|password.*weak|vulnerable.*password|insecure.*password/i.test(text)){
    return `🔍 **Check Your Password Strength:**\n\n` +
           `**📊 How to Check Weak Passwords:**\n\n` +
           `**In Edumate Password Manager:**\n` +
           `1. Go to **🔐 Password Manager** page\n` +
           `2. Look at **statistics bar** at top\n` +
           `3. See **"Weak"** count (⚠️ icon)\n` +
           `4. Each password card shows strength:\n` +
           `   • 🔴 Red bar = Weak (update urgently!)\n` +
           `   • 🟡 Orange bar = Medium (could improve)\n` +
           `   • 🟢 Green bar = Strong (excellent!)\n\n` +
           `**📋 What Makes a Password Weak?**\n\n` +
           `**Length:**\n` +
           `❌ Less than 8 characters = Very Weak\n` +
           `⚠️ 8-11 characters = Weak\n` +
           `✅ 12+ characters = Good start\n\n` +
           `**Complexity:**\n` +
           `❌ Only lowercase = Weak\n` +
           `⚠️ Lowercase + numbers = Medium\n` +
           `✅ Mixed case + numbers + symbols = Strong\n\n` +
           `**Common Patterns:**\n` +
           `❌ "password123" - Too common\n` +
           `❌ "qwerty12345" - Keyboard pattern\n` +
           `❌ "admin2024" - Predictable\n` +
           `❌ "yourname123" - Personal info\n\n` +
           `**🎯 How to Fix Weak Passwords:**\n\n` +
           `**Method 1: Use Generator (Recommended)**\n` +
           `1. Click **gear icon** in Password Manager\n` +
           `2. Set length to 16+\n` +
           `3. Enable all character types\n` +
           `4. Click **Generate**\n` +
           `5. Copy and update account\n\n` +
           `**Method 2: Strengthen Manually**\n` +
           `If you have: "mypassword"\n` +
           `1. Add uppercase: "MyPassword"\n` +
           `2. Add numbers: "MyPassword2024"\n` +
           `3. Add symbols: "MyP@ssw0rd2024!"\n` +
           `4. Increase length: "MyP@ssw0rd2024!Secure"\n\n` +
           `**📊 Password Strength Scale:**\n\n` +
           `**🔴 WEAK (Score 0-2):**\n` +
           `- Crackable in seconds/minutes\n` +
           `- Immediate update required\n` +
           `- High security risk\n` +
           `Examples:\n` +
           `- "password"\n` +
           `- "12345678"\n` +
           `- "qwerty"\n\n` +
           `**🟡 MEDIUM (Score 3-4):**\n` +
           `- Crackable in hours/days\n` +
           `- Should be improved\n` +
           `- Moderate security risk\n` +
           `Examples:\n` +
           `- "MyPassword2024"\n` +
           `- "JohnSmith99"\n` +
           `- "Summer2024"\n\n` +
           `**🟢 STRONG (Score 5-6):**\n` +
           `- Would take years to crack\n` +
           `- Excellent security\n` +
           `- Safe to use\n` +
           `Examples:\n` +
           `- "T!g3r$Run@M00n47"\n` +
           `- "Bx7$Nq3@Hp9&Dk5Tz2"\n` +
           `- "K9$mP2@xT4&vL8#qW1"\n\n` +
           `**🚨 Priority Update Order:**\n\n` +
           `**1. Banking & Financial (URGENT)**\n` +
           `- Bank accounts\n` +
           `- Credit cards\n` +
           `- PayPal, Venmo\n` +
           `- Investment accounts\n` +
           `→ Update IMMEDIATELY if weak!\n\n` +
           `**2. Email Accounts (HIGH)**\n` +
           `- Primary email\n` +
           `- Recovery emails\n` +
           `- Work email\n` +
           `→ Email = gateway to other accounts\n\n` +
           `**3. Social Media (MEDIUM)**\n` +
           `- Facebook, Instagram\n` +
           `- Twitter, LinkedIn\n` +
           `- TikTok, Snapchat\n` +
           `→ Protect personal information\n\n` +
           `**4. Shopping & Others (NORMAL)**\n` +
           `- Amazon, eBay\n` +
           `- Entertainment sites\n` +
           `- Forums, games\n` +
           `→ Update when convenient\n\n` +
           `**✅ Password Update Checklist:**\n\n` +
           `When updating a weak password:\n\n` +
           `1. ✓ Generate strong password (16+ chars)\n` +
           `2. ✓ Log into account\n` +
           `3. ✓ Go to security settings\n` +
           `4. ✓ Change password\n` +
           `5. ✓ Update in Edumate Password Manager\n` +
           `6. ✓ Enable 2FA if available\n` +
           `7. ✓ Log out of other devices\n` +
           `8. ✓ Update recovery info\n\n` +
           `**📱 External Password Checkers:**\n\n` +
           `Test password strength (safely):\n` +
           `- howsecureismypassword.net\n` +
           `- passwordmeter.com\n` +
           `- Kaspersky Password Checker\n\n` +
           `⚠️ **Never** enter real passwords on these sites!\n` +
           `Test with similar patterns only.\n\n` +
           `**🎯 Monthly Security Routine:**\n\n` +
           `Set a reminder to:\n` +
           `1. Check weak password count\n` +
           `2. Update 2-3 weak passwords\n` +
           `3. Review password manager\n` +
           `4. Delete unused accounts\n` +
           `5. Check for data breaches (haveibeenpwned.com)\n\n` +
           `**💡 Pro Tips:**\n\n` +
           `- **Sort by strength** in Password Manager\n` +
           `- Update weakest passwords first\n` +
           `- Use unique password for each site\n` +
           `- Never reuse banking passwords\n` +
           `- Enable 2FA on weak-password accounts immediately\n\n` +
           `**🔐 Take Action Now:**\n\n` +
           `Go to **Password Manager** → Check weak passwords → Update them!\n\n` +
           `Your security is worth 10 minutes of your time! 💪\n\n` +
           `Type "password security" for comprehensive security guide!`;
}

// Password Manager Usage Guide
if(/password manager|use.*password|how.*password.*manager|password.*help|manage.*password|organize.*password/i.test(text)){
    return `🔐 **Password Manager — Complete Guide:**\n\n` +
           `**🚀 Getting Started:**\n\n` +
           `**First Time Setup:**\n` +
           `1. Click **🔐 Passwords** in sidebar\n` +
           `2. Create **Master Password**\n` +
           `   • Choose strong, memorable password\n` +
           `   • You'll need this to unlock vault\n` +
           `   • ⚠️ Can't be recovered if forgotten!\n` +
           `3. Click **Set Master Password**\n` +
           `4. Start adding passwords!\n\n` +
           `**✨ Key Features:**\n\n` +
           `**1. Add Password:**\n` +
           `- Click **+ button** (bottom right)\n` +
           `- Fill in details:\n` +
           `  • Title (e.g., "Facebook", "Gmail")\n` +
           `  • Username/Email\n` +
           `  • Password (or generate one!)\n` +
           `  • Website URL (optional)\n` +
           `  • Category (Social, Banking, Email, etc.)\n` +
           `  • Notes (security questions, etc.)\n` +
           `- Click **Save**\n\n` +
           `**2. Password Generator:**\n` +
           `- Click **gear icon** (bottom right)\n` +
           `- Adjust length (8-64 characters)\n` +
           `- Select character types\n` +
           `- Click **Generate**\n` +
           `- Copy to clipboard\n\n` +
           `**3. View & Manage:**\n` +
           `- Click **View** to see full details\n` +
           `- Click **Edit** to update info\n` +
           `- Click **Copy** for quick password copy\n` +
           `- Click **Archive** to hide (keep data)\n` +
           `- Click **Delete** to remove permanently\n\n` +
           `**4. Organization:**\n` +
           `- **Search:** Type to filter passwords\n` +
           `- **Categories:** Filter by type\n` +
           `- **Favorites:** ❤️ to mark important ones\n` +
           `- **Sort:** By name, date, or strength\n` +
           `- **Archive:** Hide old/unused passwords\n\n` +
           `**🏷️ Categories Explained:**\n\n` +
           `**🌐 Social Media:**\n` +
           `Facebook, Instagram, Twitter, LinkedIn, TikTok\n\n` +
           `**🏦 Banking:**\n` +
           `Bank accounts, credit cards, PayPal, Venmo\n\n` +
           `**📧 Email:**\n` +
           `Gmail, Outlook, Yahoo, ProtonMail\n\n` +
           `**💼 Work:**\n` +
           `Company accounts, Slack, Microsoft, Zoom\n\n` +
           `**🛒 Shopping:**\n` +
           `Amazon, eBay, Etsy, online stores\n\n` +
           `**🎬 Entertainment:**\n` +
           `Netflix, Spotify, Disney+, gaming accounts\n\n` +
           `**📌 Other:**\n` +
           `Everything else!\n\n` +
           `**📊 Dashboard Statistics:**\n\n` +
           `At the top, you'll see:\n` +
           `- **Total Passwords:** All stored passwords\n` +
           `- **Favorites:** ❤️ marked items\n` +
           `- **Weak:** 🔴 Passwords needing updates\n` +
           `- **Archived:** Hidden passwords\n\n` +
           `**🔒 Security Features:**\n\n` +
           `**Master Password:**\n` +
           `- Encrypts all your passwords\n` +
           `- Never stored anywhere\n` +
           `- Required to unlock vault\n` +
           `- Change in Profile settings\n\n` +
           `**Encryption:**\n` +
           `- All passwords encrypted\n` +
           `- Only you can decrypt with master password\n` +
           `- Safe even if database is accessed\n\n` +
           `**Lock Vault:**\n` +
           `- Click **Lock Vault** button\n` +
           `- Requires master password to unlock\n` +
           `- Use when stepping away\n\n` +
           `**Password Strength:**\n` +
           `- Real-time strength indicator\n` +
           `- Visual bars (red/orange/green)\n` +
           `- Helps you create stronger passwords\n\n` +
           `**💡 Best Practices:**\n\n` +
           `**DO:**\n` +
           `✅ Use unique password for each account\n` +
           `✅ Generate passwords with 16+ characters\n` +
           `✅ Enable all character types\n` +
           `✅ Add notes for security questions\n` +
           `✅ Update weak passwords regularly\n` +
           `✅ Mark banking/email as favorites\n` +
           `✅ Export backup monthly\n\n` +
           `**DON'T:**\n` +
           `❌ Reuse passwords across sites\n` +
           `❌ Use personal info (name, birthday)\n` +
           `❌ Share your master password\n` +
           `❌ Forget to lock vault when away\n` +
           `❌ Ignore weak password warnings\n\n` +
           `**🔄 Export & Import:**\n\n` +
           `**Export (Backup):**\n` +
           `1. Click **Export** button\n` +
           `2. Download encrypted JSON file\n` +
           `3. Store safely (encrypted backup)\n` +
           `4. Do monthly!\n\n` +
           `**Import (Restore):**\n` +
           `1. Click **Export** button\n` +
           `2. Select **Import** tab\n` +
           `3. Choose your backup file\n` +
           `4. Click **Import**\n\n` +
           `**🎯 Workflow Examples:**\n\n` +
           `**New Account:**\n` +
           `1. Click + in Password Manager\n` +
           `2. Click **Generate** for strong password\n` +
           `3. Copy password\n` +
           `4. Create account on website\n` +
           `5. Save details in Password Manager\n\n` +
           `**Update Existing:**\n` +
           `1. Find password in Manager\n` +
           `2. Click **Edit**\n` +
           `3. Generate new password\n` +
           `4. Copy and update on website\n` +
           `5. Save changes\n\n` +
           `**Quick Copy:**\n` +
           `1. Search for account\n` +
           `2. Click **Copy** button\n` +
           `3. Paste into login form\n` +
           `4. Done!\n\n` +
           `**❓ Common Questions:**\n\n` +
           `**Q: Is it safe?**\n` +
           `A: Yes! Uses encryption. Only you have the master password.\n\n` +
           `**Q: What if I forget master password?**\n` +
           `A: Unfortunately, it can't be recovered. Choose wisely!\n\n` +
           `**Q: Can I access on multiple devices?**\n` +
           `A: Use Export/Import to transfer encrypted data.\n\n` +
           `**Q: Should I store banking passwords?**\n` +
           `A: Yes, if you trust your master password. Use 2FA too!\n\n` +
           `**Q: How often to update passwords?**\n` +
           `A: Important accounts: every 3-6 months. Weak passwords: immediately!\n\n` +
           `**🚀 Quick Start Checklist:**\n\n` +
           `□ Set strong master password\n` +
           `□ Add your most important accounts\n` +
           `□ Mark banking/email as favorites\n` +
           `□ Update any weak passwords (red bars)\n` +
           `□ Enable 2FA on important accounts\n` +
           `□ Export first backup\n` +
           `□ Test lock/unlock feature\n\n` +
           `**🔐 Ready to secure your digital life?**\n\n` +
           `Go to **🔐 Passwords** in the sidebar now!\n\n` +
           `**Need more help?**\n` +
           `- Type "password security"\n` +
           `- Type "generate password"\n` +
           `- Type "weak passwords"`;
}

// ===== EXPENSE TRACKING FEATURES =====

// Show Expense Summary
if(/show.*(expense|spending|transaction|money|budget)|my (expense|spending|transaction|budget)|expense (summary|report|overview)|spending (summary|report)|financial (summary|overview)/i.test(text)){
    if(!expenses || expenses.length === 0){
        return `💰 **No Expenses Tracked Yet**\n\n` +
               `You haven't recorded any transactions yet!\n\n` +
               `**💡 Start Tracking:**\n` +
               `1. Go to the Expenses page\n` +
               `2. Click the + button\n` +
               `3. Add your income and expenses\n` +
               `4. Track your financial health!\n\n` +
               `**Why Track Expenses?**\n` +
               `- Know where your money goes\n` +
               `- Identify spending patterns\n` +
               `- Stay within budget\n` +
               `- Achieve financial goals\n` +
               `- Reduce unnecessary spending\n\n` +
               `**📊 I can help you:**\n` +
               `- View expense summaries\n` +
               `- Analyze spending by category\n` +
               `- Give budget advice\n` +
               `- Track financial goals\n\n` +
               `Start your financial journey today! 💪`;
    }
    
    const symbol = await getCurrencySymbol();
    
    // Calculate totals
    const income = expenses.filter(e => e.type === 'income' && !e.archived)
                          .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const expenseTotal = expenses.filter(e => e.type === 'expense' && !e.archived)
                                .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const balance = income - expenseTotal;
    
    // Get current month expenses
    const today = new Date();
    const monthExpenses = expenses.filter(e => {
        if(e.archived || e.type !== 'expense') return false;
        const eDate = new Date(e.date);
        return eDate.getMonth() === today.getMonth() && 
               eDate.getFullYear() === today.getFullYear();
    });
    const monthTotal = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    
    // Category breakdown (top 5)
    const categoryTotals = {};
    expenses.filter(e => e.type === 'expense' && !e.archived).forEach(e => {
        const cat = e.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(e.amount || 0);
    });
    
    const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, amt]) => `  • ${cat}: ${formatMoney(amt, symbol)}`)
        .join('\n');
    
    // Recent transactions
    const recent = expenses.filter(e => !e.archived)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map(e => {
            const emoji = e.type === 'income' ? '💰' : '💸';
            return `  ${emoji} ${e.title}: ${formatMoney(e.amount, symbol)} (${e.date})`;
        })
        .join('\n');
    
    // Budget check
    let budgetText = '';
    try {
        const settings = await get('settings', 1);
        if(settings && settings.budget){
            const budget = settings.budget;
            const percentage = (monthTotal / budget) * 100;
            const remaining = budget - monthTotal;
            
            if(percentage >= 100){
                budgetText = `\n**⚠️ Budget Alert:**\nYou've spent ${formatMoney(monthTotal, symbol)} of your ${formatMoney(budget, symbol)} budget (${percentage.toFixed(1)}%)\n**Over budget by ${formatMoney(Math.abs(remaining), symbol)}!**\n`;
            } else if(percentage >= 80){
                budgetText = `\n**⚡ Budget Warning:**\nYou've spent ${formatMoney(monthTotal, symbol)} of your ${formatMoney(budget, symbol)} budget (${percentage.toFixed(1)}%)\n**${formatMoney(remaining, symbol)} remaining**\n`;
            } else {
                budgetText = `\n**✅ Budget Status:**\nSpent ${formatMoney(monthTotal, symbol)} of ${formatMoney(budget, symbol)} (${percentage.toFixed(1)}%)\n**${formatMoney(remaining, symbol)} remaining**\n`;
            }
        }
    } catch(e) {}
    
    return `💰 **Your Financial Summary**\n\n` +
           `**📊 Overall:**\n` +
           `💚 Income: ${formatMoney(income, symbol)}\n` +
           `💸 Expenses: ${formatMoney(expenseTotal, symbol)}\n` +
           `💰 Balance: ${formatMoney(balance, symbol)}\n` +
           `📝 Total Transactions: ${expenses.filter(e => !e.archived).length}\n` +
           budgetText + `\n` +
           `**📅 This Month:**\n` +
           `Spent: ${formatMoney(monthTotal, symbol)}\n` +
           `Transactions: ${monthExpenses.length}\n\n` +
           `**🏷️ Top Spending Categories:**\n${topCategories || '  No expenses yet'}\n\n` +
           `**📜 Recent Transactions:**\n${recent || '  No transactions yet'}\n\n` +
           `**💡 Quick Actions:**\n` +
           `- View detailed analysis: Go to Expenses page\n` +
           `- Add transaction: Click + button\n` +
           `- Set budget: Click piggy bank icon\n` +
           `- Ask me: "budget tips" for advice\n\n` +
           `**Need help?** Try:\n` +
           `- "Budget tips"\n` +
           `- "How to save money"\n` +
           `- "Expense categories"`;
}

// Add Expense via Chat
if(/add (expense|income|transaction)|record (expense|income|transaction)|log (expense|income|spending)/i.test(text)){
    return `💰 **Add Transaction via Expenses Page**\n\n` +
           `I can't directly add transactions yet, but it's super easy!\n\n` +
           `**📝 Quick Steps:**\n` +
           `1. Go to **Expenses page**\n` +
           `2. Click the **+ button** (bottom right)\n` +
           `3. Fill in details:\n` +
           `   • Type (Income/Expense)\n` +
           `   • Amount\n` +
           `   • Category\n` +
           `   • Date\n` +
           `   • Description\n` +
           `4. Click **Save**\n\n` +
           `**💡 Pro Tips:**\n` +
           `- Add transactions immediately (don't forget!)\n` +
           `- Use clear, consistent titles\n` +
           `- Choose appropriate categories\n` +
           `- Add notes for future reference\n` +
           `- Use recurring for regular expenses\n\n` +
           `**📱 Features:**\n` +
           `- Pin important transactions\n` +
           `- Set recurring payments\n` +
           `- Track by category\n` +
           `- Monthly budget monitoring\n` +
           `- Export your data\n\n` +
           `Start tracking your finances today! 💪`;
}

// Budget Tips & Advice
if(/budget (tip|advice|help)|save money|saving (tip|advice)|financial (tip|advice)|money management|reduce spending|cut (cost|expense)/i.test(text)){
    return `💰 **Smart Budget & Money Management Tips**\n\n` +
           `**🎯 The 50/30/20 Rule:**\n\n` +
           `Divide your income:\n` +
           `- **50%** Needs (rent, food, bills, transport)\n` +
           `- **30%** Wants (entertainment, dining, hobbies)\n` +
           `- **20%** Savings (emergency fund, goals, investments)\n\n` +
           `**💡 Essential Budgeting Steps:**\n\n` +
           `**1. Track Everything:**\n` +
           `- Record ALL expenses (even small ones!)\n` +
           `- Use Edumate Expenses tracker\n` +
           `- Review weekly\n` +
           `- Identify spending patterns\n\n` +
           `**2. Set Clear Goals:**\n` +
           `- Emergency fund (3-6 months expenses)\n` +
           `- Short-term (vacation, gadget)\n` +
           `- Long-term (education, car, house)\n` +
           `- Write them down!\n\n` +
           `**3. Create Realistic Budget:**\n` +
           `- Based on actual spending (track first!)\n` +
           `- Include all categories\n` +
           `- Leave buffer (10-15%)\n` +
           `- Review and adjust monthly\n\n` +
           `**4. Automate Savings:**\n` +
           `- Pay yourself first\n` +
           `- Auto-transfer to savings\n` +
           `- Before you spend anything\n` +
           `- Even small amounts add up!\n\n` +
           `**💸 Practical Money-Saving Tips:**\n\n` +
           `**Daily Savings:**\n` +
           `- Make coffee at home (save $5/day = $150/month!)\n` +
           `- Pack lunch instead of eating out\n` +
           `- Use reusable water bottle\n` +
           `- Walk/bike for short distances\n` +
           `- Cancel unused subscriptions\n\n` +
           `**Shopping Smart:**\n` +
           `- Make shopping lists (avoid impulse buys)\n` +
           `- Compare prices before buying\n` +
           `- Use coupons and discounts\n` +
           `- Buy generic brands\n` +
           `- Wait 24 hours before non-essential purchases\n\n` +
           `**Reduce Bills:**\n` +
           `- Turn off lights when leaving room\n` +
           `- Unplug devices not in use\n` +
           `- Use fans instead of AC when possible\n` +
           `- Fix leaky faucets\n` +
           `- Negotiate phone/internet plans\n\n` +
           `**Student-Specific:**\n` +
           `- Use student discounts (always ask!)\n` +
           `- Buy used textbooks\n` +
           `- Share streaming subscriptions\n` +
           `- Use public libraries\n` +
           `- Cook in bulk, freeze portions\n\n` +
           `**🚫 Avoid These:**\n\n` +
           `- Impulse buying (sleep on it!)\n` +
           `- Lifestyle inflation (don't increase spending with income)\n` +
           `- Ignoring small expenses (they add up!)\n` +
           `- Not having emergency fund\n` +
           `- Using credit cards irresponsibly\n\n` +
           `**📱 Use Edumate Expenses to:**\n\n` +
           `- Set monthly budget limits\n` +
           `- Track spending by category\n` +
           `- Get visual budget progress\n` +
           `- Export reports monthly\n` +
           `- Identify where to cut back\n\n` +
           `**🎯 Challenge: Pick ONE tip and start today!**\n\n` +
           `**Remember:** Small consistent savings = Big results! 💪`;
}

// Expense Categories Info
if(/expense categor|spending categor|what.*categor|transaction.*categor|budget.*categor/i.test(text)){
    return `🏷️ **Expense Categories Guide**\n\n` +
           `**💸 EXPENSE CATEGORIES:**\n\n` +
           `**🍔 Food:**\n` +
           `- Groceries\n` +
           `- Restaurants\n` +
           `- Snacks & drinks\n` +
           `- Food delivery\n\n` +
           `**🚗 Transport:**\n` +
           `- Public transport\n` +
           `- Fuel/gas\n` +
           `- Parking\n` +
           `- Uber/taxi\n` +
           `- Vehicle maintenance\n\n` +
           `**📚 Education:**\n` +
           `- Tuition fees\n` +
           `- Books & supplies\n` +
           `- Online courses\n` +
           `- Stationery\n\n` +
           `**🛍️ Shopping:**\n` +
           `- Clothing\n` +
           `- Electronics\n` +
           `- Personal items\n` +
           `- Gifts\n\n` +
           `**📄 Bills:**\n` +
           `- Utilities (electricity, water, gas)\n` +
           `- Phone/internet\n` +
           `- Subscriptions (Netflix, Spotify)\n` +
           `- Insurance\n\n` +
           `**🎬 Entertainment:**\n` +
           `- Movies\n` +
           `- Games\n` +
           `- Events/concerts\n` +
           `- Hobbies\n\n` +
           `**🏥 Health:**\n` +
           `- Medical appointments\n` +
           `- Medicines\n` +
           `- Gym membership\n` +
           `- Health insurance\n\n` +
           `**✈️ Travel:**\n` +
           `- Flights\n` +
           `- Hotels\n` +
           `- Vacation expenses\n` +
           `- Travel insurance\n\n` +
           `**🏠 Rent:**\n` +
           `- Monthly rent\n` +
           `- Maintenance\n` +
           `- Security deposit\n\n` +
           `**💳 Other Expense:**\n` +
           `- Miscellaneous\n` +
           `- One-time purchases\n` +
           `- Uncategorized\n\n` +
           `**💰 INCOME CATEGORIES:**\n\n` +
           `**💼 Salary:**\n` +
           `- Regular paycheck\n` +
           `- Part-time job\n` +
           `- Internship\n\n` +
           `**💻 Freelance:**\n` +
           `- Contract work\n` +
           `- Gig economy\n` +
           `- Side projects\n\n` +
           `**📈 Investment:**\n` +
           `- Dividends\n` +
           `- Interest\n` +
           `- Returns\n\n` +
           `**🎁 Gift:**\n` +
           `- Birthday money\n` +
           `- Holiday gifts\n` +
           `- Rewards\n\n` +
           `**💵 Other Income:**\n` +
           `- Refunds\n` +
           `- Cashback\n` +
           `- Miscellaneous\n\n` +
           `**💡 Pro Tips:**\n\n` +
           `- Be consistent with categories\n` +
           `- Don't over-categorize\n` +
           `- Review monthly which categories are highest\n` +
           `- Adjust spending in high-expense categories\n` +
           `- Use "Other" sparingly\n\n` +
           `**📊 Track your spending by category in Edumate Expenses!**`;
}

// Financial Goals
if(/financial goal|money goal|saving goal|investment goal|wealth|financial planning|financial future/i.test(text)){
    return `💰 **Financial Goals & Planning Guide**\n\n` +
           `**🎯 Types of Financial Goals:**\n\n` +
           `**Short-Term (0-1 year):**\n` +
           `- Emergency fund (1 month expenses)\n` +
           `- Pay off small debts\n` +
           `- Buy needed items\n` +
           `- Build saving habit\n` +
           `- Track all expenses\n\n` +
           `**Medium-Term (1-5 years):**\n` +
           `- Emergency fund (3-6 months)\n` +
           `- Save for education\n` +
           `- Buy vehicle\n` +
           `- Down payment for house\n` +
           `- Career development courses\n\n` +
           `**Long-Term (5+ years):**\n` +
           `- Retirement savings\n` +
           `- Property ownership\n` +
           `- Investment portfolio\n` +
           `- Financial independence\n` +
           `- Legacy planning\n\n` +
           `**📋 SMART Financial Goals:**\n\n` +
           `**Specific:**\n` +
           `❌ "Save money"\n` +
           `✅ "Save $5,000 for emergency fund"\n\n` +
           `**Measurable:**\n` +
           `- Track progress monthly\n` +
           `- Know exact amount\n` +
           `- Calculate percentage complete\n\n` +
           `**Achievable:**\n` +
           `- Based on your income\n` +
           `- Realistic timeline\n` +
           `- Consider your expenses\n\n` +
           `**Relevant:**\n` +
           `- Aligns with life goals\n` +
           `- Matters to YOU\n` +
           `- Improves your situation\n\n` +
           `**Time-Bound:**\n` +
           `❌ "Save for vacation someday"\n` +
           `✅ "Save $2,000 for vacation by December"\n\n` +
           `**💡 Goal Achievement Strategy:**\n\n` +
           `**1. Calculate Required Savings:**\n` +
           `Goal: $5,000 in 12 months\n` +
           `Required: $417/month\n` +
           `Per week: $104\n` +
           `Per day: $14\n\n` +
           `**2. Automate It:**\n` +
           `- Set up auto-transfer\n` +
           `- Pay yourself first\n` +
           `- Separate savings account\n` +
           `- Don't touch it!\n\n` +
           `**3. Track Progress:**\n` +
           `- Check monthly\n` +
           `- Celebrate milestones (25%, 50%, 75%)\n` +
           `- Adjust if needed\n` +
           `- Stay motivated\n\n` +
           `**4. Find Extra Money:**\n` +
           `- Cut one expense\n` +
           `- Side hustle\n` +
           `- Sell unused items\n` +
           `- Use windfalls (tax refund, bonus)\n\n` +
           `**🚀 Priority Order:**\n\n` +
           `**1. Emergency Fund:**\n` +
           `- Start with $1,000\n` +
           `- Build to 3-6 months expenses\n` +
           `- BEFORE other goals\n` +
           `- Financial safety net\n\n` +
           `**2. High-Interest Debt:**\n` +
           `- Pay off credit cards\n` +
           `- Eliminate bad debt\n` +
           `- Snowball method\n\n` +
           `**3. Retirement (Even Small!):**\n` +
           `- Start early (compound interest!)\n` +
           `- Even $50/month helps\n` +
           `- Increase over time\n\n` +
           `**4. Other Goals:**\n` +
           `- Education\n` +
           `- House\n` +
           `- Investments\n` +
           `- Personal goals\n\n` +
           `**📊 Track in Edumate:**\n\n` +
           `- Set budget in Expenses\n` +
           `- Track income vs. expenses\n` +
           `- Monitor savings rate\n` +
           `- Export monthly reports\n\n` +
           `**💪 Start TODAY:**\n` +
           `Even $1 saved today is progress!\n` +
           `Small steps → Big results! 🎯`;
}

// Monthly Budget Analysis
if(/budget (analys|review|check)|how.*budget|budget.*doing|over budget|under budget|budget (status|progress)/i.test(text)){
    try {
        const settings = await get('settings', 1);
        const symbol = await getCurrencySymbol();
        
        if(!settings || !settings.budget){
            return `📊 **Budget Not Set**\n\n` +
                   `You haven't set a monthly budget yet!\n\n` +
                   `**💡 Set Your Budget:**\n` +
                   `1. Go to **Expenses page**\n` +
                   `2. Click **piggy bank icon** 🐷\n` +
                   `3. Enter your monthly budget\n` +
                   `4. Click **Save**\n\n` +
                   `**Why Set a Budget?**\n` +
                   `- Know your spending limit\n` +
                   `- Avoid overspending\n` +
                   `- Track progress visually\n` +
                   `- Get alerts when approaching limit\n` +
                   `- Build financial discipline\n\n` +
                   `**💰 How to Calculate:**\n` +
                   `1. Total your monthly income\n` +
                   `2. List essential expenses\n` +
                   `3. Set aside savings (20%)\n` +
                   `4. Remaining = spending budget\n\n` +
                   `**Example:**\n` +
                   `Income: $2,000\n` +
                   `Savings: $400 (20%)\n` +
                   `Essentials: $1,000 (rent, bills, food)\n` +
                   `Budget for other expenses: $600\n\n` +
                   `Start budgeting today! 💪`;
        }
        
        const budget = settings.budget;
        const today = new Date();
        
        const monthExpenses = expenses.filter(e => {
            if(e.archived || e.type !== 'expense') return false;
            const eDate = new Date(e.date);
            return eDate.getMonth() === today.getMonth() && 
                   eDate.getFullYear() === today.getFullYear();
        });
        
        const spent = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const remaining = budget - spent;
        const percentage = (spent / budget) * 100;
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysLeft = daysInMonth - today.getDate();
        const avgPerDay = daysLeft > 0 ? remaining / daysLeft : 0;
        
        let status, emoji, advice;
        
        if(percentage >= 100){
            status = "OVER BUDGET";
            emoji = "🚨";
            advice = `**⚠️ URGENT: You've exceeded your budget!**\n\n` +
                    `**Immediate Actions:**\n` +
                    `- Stop non-essential spending NOW\n` +
                    `- Review and cut unnecessary expenses\n` +
                    `- Look for ways to earn extra income\n` +
                    `- Use only cash for remaining days\n` +
                    `- Plan better for next month\n\n` +
                    `**Prevention for Next Month:**\n` +
                    `- Track expenses daily\n` +
                    `- Set alerts at 50%, 75%, 90%\n` +
                    `- Reduce budget in high categories\n` +
                    `- Build buffer for unexpected costs`;
        } else if(percentage >= 90){
            status = "CRITICAL - Almost Over";
            emoji = "⚠️";
            advice = `**⚡ WARNING: Approaching Budget Limit!**\n\n` +
                    `**What To Do:**\n` +
                    `- Limit spending to essentials only\n` +
                    `- Avoid dining out\n` +
                    `- Skip entertainment expenses\n` +
                    `- Use what you have at home\n` +
                    `- Plan carefully for remaining days\n\n` +
                    `**You can spend ~${formatMoney(avgPerDay, symbol)}/day for ${daysLeft} days**`;
        } else if(percentage >= 75){
            status = "Warning Zone";
            emoji = "🟡";
            advice = `**📊 You're in the warning zone**\n\n` +
                    `**Recommendations:**\n` +
                    `- Be mindful of remaining expenses\n` +
                    `- Stick to your budget categories\n` +
                    `- Avoid impulse purchases\n` +
                    `- Cook at home more\n` +
                    `- Review spending so far\n\n` +
                    `**Daily budget: ~${formatMoney(avgPerDay, symbol)} for ${daysLeft} days**`;
        } else if(percentage >= 50){
            status = "On Track";
            emoji = "✅";
            advice = `**👍 Good progress!**\n\n` +
                    `**Keep It Up:**\n` +
                    `- Continue tracking expenses\n` +
                    `- Stay within planned spending\n` +
                    `- Look for more savings opportunities\n` +
                    `- Maintain this discipline\n\n` +
                    `**Daily budget: ~${formatMoney(avgPerDay, symbol)} for ${daysLeft} days**`;
        } else {
            status = "Excellent!";
            emoji = "🌟";
            advice = `**🎉 Fantastic job!**\n\n` +
                    `**You're doing great:**\n` +
                    `- Well below budget\n` +
                    `- Excellent financial discipline\n` +
                    `- Consider saving the surplus\n` +
                    `- Maintain this momentum!\n\n` +
                    `**Daily budget: ~${formatMoney(avgPerDay, symbol)} for ${daysLeft} days**\n\n` +
                    `💡 **Tip:** Move unused budget to savings at month-end!`;
        }
        
        // Category breakdown
        const categoryTotals = {};
        monthExpenses.forEach(e => {
            const cat = e.category || 'Other';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(e.amount || 0);
        });
        
        const topCategories = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cat, amt]) => {
                const catPercent = (amt / spent) * 100;
                return `  • ${cat}: ${formatMoney(amt, symbol)} (${catPercent.toFixed(1)}%)`;
            })
            .join('\n');
        
        return `💰 **Budget Analysis - ${today.toLocaleString('default', { month: 'long', year: 'numeric' })}**\n\n` +
               `${emoji} **Status: ${status}**\n\n` +
               `**📊 Budget Overview:**\n` +
               `Monthly Budget: ${formatMoney(budget, symbol)}\n` +
               `Spent So Far: ${formatMoney(spent, symbol)} (${percentage.toFixed(1)}%)\n` +
               `Remaining: ${formatMoney(remaining, symbol)}\n\n` +
               `**📅 Timeline:**\n` +
               `Days Passed: ${today.getDate()}/${daysInMonth}\n` +
               `Days Left: ${daysLeft}\n` +
               `Avg. per Day Remaining: ${formatMoney(avgPerDay, symbol)}\n\n` +
               `**🏷️ Top Spending Categories:**\n${topCategories || '  No expenses this month'}\n\n` +
               advice + `\n\n` +
               `**📈 Track Progress:**\n` +
               `Go to Expenses page to see visual budget bar!\n\n` +
               `Need help? Ask: "budget tips" or "how to save money"`;
               
    } catch(e) {
        return `❌ **Error analyzing budget**\n\nPlease try again or set your budget in the Expenses page!`;
    }
}


   if(/\b(statistic|stats|progress|how am i doing|show progress|my performance|dashboard|summary)\b/i.test(text)){
    const totalTasks = (tasks||[]).length;
    const doneTasks = (tasks||[]).filter(t=>t.done).length;
    const totalProjects = (projects||[]).length;
    const doneProjects = (projects||[]).filter(p=>p.done).length;
    const totalCourses = (courses||[]).length;
    const doneCourses = (courses||[]).filter(c=>c.done).length;
    const totalWatch = (watchlist||[]).length;
    const watchedItems = (watchlist||[]).filter(w=>w.status==='Watched').length;
    const watchingItems = (watchlist||[]).filter(w=>w.status==='Watching').length;
    
    // ADD THESE LINES ↓
    const passwords = await getAll("passwords") || []; // Get passwords
    const totalPasswords = passwords.filter(p => !p.archived).length;
    const weakPasswords = passwords.filter(p => !p.archived && p.strength === 'weak').length;
    const favPasswords = passwords.filter(p => !p.archived && p.fav).length;
    
    const taskPercent = totalTasks > 0 ? Math.round((doneTasks/totalTasks)*100) : 0;
    const projectPercent = totalProjects > 0 ? Math.round((doneProjects/totalProjects)*100) : 0;
    const coursePercent = totalCourses > 0 ? Math.round((doneCourses/totalCourses)*100) : 0;
    
    const totalCompleted = doneTasks + doneProjects + doneCourses;
    const motivation = totalCompleted > 20 ? "🔥 You're crushing it!" : 
                      totalCompleted > 10 ? "💪 Great momentum!" :
                      totalCompleted > 5 ? "✨ Keep going!" :
                      "🚀 Let's build momentum together!";
    
    return `📊 **Your Progress Dashboard:**\n\n` +
       `**✅ Tasks:**\n` +
       `- Completed: ${doneTasks}/${totalTasks} (${taskPercent}%)\n` +
       `- Pending: ${totalTasks - doneTasks}\n\n` +
       `**📁 Projects:**\n` +
       `- Completed: ${doneProjects}/${totalProjects} (${projectPercent}%)\n` +
       `- Pending: ${totalProjects - doneProjects}\n\n` +
       `**🎓 Courses:**\n` +
       `- Completed: ${doneCourses}/${totalCourses} (${coursePercent}%)\n` +
       `- Pending: ${totalCourses - doneCourses}\n\n` +
       `**🎬 Watchlist:**\n` +
       `- Total Items: ${totalWatch}\n` +
       `- Watched: ${watchedItems}\n` +
       `- Currently Watching: ${watchingItems}\n\n` +
       `**💰 Expenses:**\n` +
       `- Total Transactions: ${expenses.filter(e => !e.archived).length}\n` +
       `- Income: ${expenses.filter(e => e.type === 'income' && !e.archived).length}\n` +
       `- Expenses: ${expenses.filter(e => e.type === 'expense' && !e.archived).length}\n\n` +
       `**🔐 Passwords:**\n` + // ← ADD THIS SECTION
       `- Total Stored: ${totalPasswords}\n` +
       `- Favorites: ${favPasswords}\n` +
       `- Weak (Need Update): ${weakPasswords}${weakPasswords > 0 ? ' ⚠️' : ' ✅'}\n\n` +
       `**📝 Notes:** ${notes.length} total\n\n` +
       motivation;
}

    // ===== CLEAR CHAT =====
    if(/clear chat|delete chat|reset chat|clear conversation|new chat/i.test(text)){
        await clearChats();
        return '✨ **Chat Cleared!**\n\nAll messages have been cleared. Fresh start!\n\n**What can I help you with?**\n- Study tips and strategies\n- Task prioritization\n- Finding resources\n- Motivation and support\n- Platform features\n\nType "help" to see everything I can do!';
    }

    // ===== PRIORITY SUGGESTIONS (ENHANCED) =====
    
    // Find this section and ADD the password check before the return statement:

if(/what should i do|what to do|where.*start|what.*first|priorit|finish first|begin with|start with/i.test(text)){
    const pendingTasks = (tasks || []).filter(t => !t.done);
    const pendingProjects = (projects || []).filter(p => !p.done);
    const pendingCourses = (courses || []).filter(c => !c.done);
    
    // ADD THIS PASSWORD CHECK ↓
    const passwords = await getAll("passwords") || [];
    const weakPasswords = passwords.filter(p => !p.archived && p.strength === 'weak');

    const parseDate = d => {
        try{ return d ? new Date(d) : null; }catch(e){return null}
    };
    const cmp = (a,b)=>{
        const pa = a.priority||0, pb = b.priority||0;
        if(pa !== pb) return pb - pa;
        const da = parseDate(a.dueDate || a.deadline), db = parseDate(b.dueDate || b.deadline);
        if(da && db) return da - db;
        if(da && !db) return -1;
        if(!da && db) return 1;
        return 0;
    };

    const sortedTasks = pendingTasks.slice().sort(cmp);
    const sortedProjects = pendingProjects.slice().sort(cmp);

    const suggestions = [];
    
    // ADD WEAK PASSWORD SUGGESTION ↓
    if(weakPasswords.length > 0) {
        suggestions.push(`🔐 **SECURITY ALERT:** You have ${weakPasswords.length} weak password${weakPasswords.length > 1 ? 's' : ''}!\n   Update immediately for account security`);
    }
    
    if(sortedTasks.length){
        const t = sortedTasks[0];
        suggestions.push(`📌 **Top Task:** "${t.title || 'Untitled'}"\n   Priority: ${t.priority||'Medium'}${t.dueDate || t.deadline ? ' | Due: '+(t.dueDate||t.deadline) : ''}`);
    }
    if(sortedProjects.length){
        const p = sortedProjects[0];
        suggestions.push(`📁 **Top Project:** "${p.title || 'Untitled'}"\n   Priority: ${p.priority||'Medium'}${p.dueDate || p.deadline ? ' | Due: '+(p.dueDate||p.deadline) : ''}`);
    }
    if(pendingCourses.length){
        const c = pendingCourses[0];
        suggestions.push(`🎓 **Course Lesson:** "${c.title || 'Untitled'}"${c.endDate ? '\n   Ends: '+c.endDate : ''}`);
    }
    

        
        if(suggestions.length) {
            return `🎯 **Here's What to Focus On:**\n\n` +
                   suggestions.join("\n\n") + 
                   `\n\n**📋 Action Plan:**\n\n` +
                   `1. **Start with highest priority** (see above)\n` +
                   `2. **Set a timer** for 25 minutes (Pomodoro)\n` +
                   `3. **Work with full focus** (no distractions)\n` +
                   `4. **Take a 5-min break** after timer\n` +
                   `5. **Repeat** until task is complete\n\n` +
                   `**💡 Quick Tips:**\n` +
                   `- Start with the most urgent/important item\n` +
                   `- Break large tasks into smaller steps\n` +
                   `- Tackle difficult tasks when energy is high\n` +
                   `- Mark items done for satisfaction boost!\n` +
                   `- Celebrate small wins along the way\n\n` +
                   `**Remember:** Progress over perfection!\n\n` +
                   `You've got this! 💪`;
        }
        
        return "🎉 **All Caught Up!**\n\n" +
               "Amazing! All tasks, projects, and courses are complete!\n\n" +
               "**🌟 What's Next?**\n\n" +
               "**Plan Ahead:**\n" +
               "- Set new goals for the week\n" +
               "- Plan upcoming projects\n" +
               "- Review what you've accomplished\n\n" +
               "**Keep Learning:**\n" +
               "- Enroll in new courses\n" +
               "- Explore new topics\n" +
               "- Read a book or article\n\n" +
               "**Maintain Progress:**\n" +
               "- Review and reinforce what you've learned\n" +
               "- Practice skills regularly\n" +
               "- Help others learn\n\n" +
               "**Self-Care:**\n" +
               "- Take a well-deserved break\n" +
               "- Celebrate your achievements\n" +
               "- Recharge for the next challenge\n\n" +
               "**💡 Tip:** Consistent small actions lead to big results!\n\n" +
               "What would you like to work on next? 😊";
    }

    // ===== GROUP STUDY (ENHANCED) =====
    if(/group study|study group|study.*together|collaborative learning|study partner/i.test(text)){
        return `👥 **Effective Group Study Guide:**\n\n` +
            `**✅ Benefits of Group Study:**\n` +
            `- Learn from different perspectives\n` +
            `- Fill knowledge gaps\n` +
            `- Stay motivated and accountable\n` +
            `- Practice explaining concepts\n` +
            `- Make studying more enjoyable\n\n` +
            `**🎯 Best Practices:**\n\n` +
            `**Before Meeting:**\n` +
            `- Study material individually first\n` +
            `- Prepare questions to discuss\n` +
            `- Set clear agenda\n` +
            `- Agree on goals for session\n` +
            `- Choose quiet, comfortable location\n\n` +
            `**During Session:**\n` +
            `- Start with overview of topics\n` +
            `- Take turns explaining concepts\n` +
            `- Quiz each other\n` +
            `- Discuss difficult problems together\n` +
            `- Take short breaks\n` +
            `- Stay on topic (avoid socializing)\n\n` +
            `**After Session:**\n` +
            `- Review what was covered\n` +
            `- Identify remaining gaps\n` +
            `- Set goals for next meeting\n` +
            `- Study individually to reinforce\n\n` +
            `**👥 Group Size & Composition:**\n\n` +
            `**Ideal Size:** 3-5 people\n` +
            `- Large enough for diverse perspectives\n` +
            `- Small enough for everyone to participate\n\n` +
            `**Choose Members Who:**\n` +
            `- Are committed and reliable\n` +
            `- Have similar goals\n` +
            `- Contribute actively\n` +
            `- Stay focused\n\n` +
            `**⚠️ Pitfalls to Avoid:**\n\n` +
            `- Too much socializing\n` +
            `- One person dominating\n` +
            `- No clear structure or goals\n` +
            `- Relying only on group study\n` +
            `- Meeting too frequently (diminishing returns)\n` +
            `- Groups that are too large\n\n` +
            `**📝 Effective Group Activities:**\n\n` +
            `**Teaching Rotation:**\n` +
            `- Each person teaches one topic\n` +
            `- Deepens understanding\n` +
            `- Identifies knowledge gaps\n\n` +
            `**Quiz Each Other:**\n` +
            `- Prepare questions beforehand\n` +
            `- Practice test format\n` +
            `- Discuss answers together\n\n` +
            `**Problem-Solving:**\n` +
            `- Work through difficult problems\n` +
            `- Discuss different approaches\n` +
            `- Learn from mistakes\n\n` +
            `**Concept Mapping:**\n` +
            `- Create visual connections\n` +
            `- Build comprehensive overview\n` +
            `- Identify relationships\n\n` +
            `**💻 Virtual Study Groups:**\n\n` +
            `**Tools:**\n` +
            `- Zoom (video calls)\n` +
            `- Discord (voice + screen share)\n` +
            `- Google Meet (free, simple)\n` +
            `- Microsoft Teams\n\n` +
            `**Tips for Online:**\n` +
            `- Use video for accountability\n` +
            `- Screen share for collaboration\n` +
            `- Use digital whiteboard\n` +
            `- Record sessions (with permission)\n` +
            `- Mute when not speaking\n\n` +
            `**🔄 Hybrid Approach (Best!):**\n\n` +
            `**Individual Study:**\n` +
            `- Learn material first\n` +
            `- Do practice problems\n` +
            `- Identify confusing topics\n\n` +
            `**Group Study:**\n` +
            `- Clarify doubts\n` +
            `- Discuss difficult concepts\n` +
            `- Quiz and practice together\n` +
            `- Gain new perspectives\n\n` +
            `**Individual Review:**\n` +
            `- Reinforce what group covered\n` +
            `- Fill remaining gaps\n` +
            `- Prepare for next session\n\n` +
            `💡 **Remember:** Group study supplements, not replaces, individual study!`;
    }


   // ===== DEFAULT RESPONSE (ENHANCED WITH MORE VARIATIONS) =====
const responseVariations = [
    `💬 I heard: **"${userText}"**\n\n` +
    `I'm not sure about that specific query, but I'm here to help!\n\n` +
    `**🤖 I can assist with:**\n` +
    `- Study strategies and learning techniques\n` +
    `- Task and project management\n` +
    `- Finding past papers and research\n` +
    `- Motivation and productivity advice\n` +
    `- Subject-specific study tips\n` +
    `- Exam preparation and test anxiety\n` +
    `- Platform features and how-to guides\n` +
    `- Watchlist management and suggestions\n\n` +
    `**Try asking:**\n` +
    `- "Study tips for [subject]"\n` +
    `- "Show my tasks"\n` +
    `- "How to stay motivated"\n` +
    `- "Past paper [subject] [year]"\n` +
    `- "Research [topic]"\n` +
    `- "Show my watchlist"\n` +
    `- "Random pick" / "What should I watch"\n` +
    `- "Watchlist tips"\n` +
    `- Type **"help"** for full capabilities!`,
    
    `🤔 Interesting question!\n\n` +
    `While I may not have a specific answer for **"${userText}"**, I'm constantly learning!\n\n` +
    `**Here's what I'm great at:**\n\n` +
    `📚 **Academic Support:**\n` +
    `- Subject study guides\n` +
    `- Exam strategies\n` +
    `- Research paper searches\n` +
    `- Past paper access\n\n` +
    `✅ **Productivity:**\n` +
    `- Task prioritization\n` +
    `- Time management\n` +
    `- Goal setting\n` +
    `- Focus techniques\n\n` +
    `💪 **Motivation:**\n` +
    `- Encouragement and support\n` +
    `- Overcoming procrastination\n` +
    `- Managing stress\n` +
    `- Building confidence\n\n` +
    `🎬 **Watchlist:**\n` +
    `- Track movies and series\n` +
    `- Random pick suggestions\n` +
    `- Progress tracking\n\n` +
    `What would you like help with today?`,
    
    `👋 Thanks for your message!\n\n` +
    `I'm still learning to understand all types of questions. If **"${userText}"** is something specific, try rephrasing it!\n\n` +
    `**🎯 I excel at:**\n\n` +
    `- Answering "what should I do first?"\n` +
    `- Providing study tips for any subject\n` +
    `- Finding educational resources\n` +
    `- Helping with time management\n` +
    `- Boosting motivation\n` +
    `- Explaining how to use Edumate features\n` +
    `- Managing your watchlist\n\n` +
    `**💡 Quick Start:**\n` +
    `- Type **"help"** to see all my capabilities\n` +
    `- Ask for **"study tips"**\n` +
    `- Request **"show my tasks"**\n` +
    `- Say **"motivate me"**\n` +
    `- Try **"random pick"** for watch suggestions\n\n` +
    `How can I support your learning journey? 🚀`,

    `🌟 **Let me help you!**\n\n` +
    `I want to make sure I understand correctly. You asked about: **"${userText}"**\n\n` +
    `**If you're looking for:**\n\n` +
    `📖 **Study Help** → Try:\n` +
    `- "Study tips for [subject]"\n` +
    `- "How to prepare for exams"\n` +
    `- "Memory improvement tips"\n\n` +
    `📋 **Task Management** → Try:\n` +
    `- "Show my tasks"\n` +
    `- "What should I do first?"\n` +
    `- "Time management advice"\n\n` +
    `🔍 **Resources** → Try:\n` +
    `- "Research [topic]"\n` +
    `- "Past paper [subject] [year]"\n` +
    `- "Find resources on [topic]"\n\n` +
    `💪 **Motivation** → Try:\n` +
    `- "Motivate me"\n` +
    `- "I'm feeling overwhelmed"\n` +
    `- "How to stay focused"\n\n` +
    `🎬 **Watchlist** → Try:\n` +
    `- "Show my watchlist"\n` +
    `- "Random pick"\n` +
    `- "What should I watch"\n\n` +
    `❓ **Platform Help** → Try:\n` +
    `- "How to add notes"\n` +
    `- "Using the planner"\n` +
    `- Type "help"\n\n` +
    `What would you like to explore? 😊`
];
    
    return responseVariations[Math.floor(Math.random() * responseVariations.length)];
}

// ============ ACTIVITY LOGGING ============
async function logActivity(action){
    try{ 
        await add("activity",{action,time:new Date().toISOString()}); 
    }catch(e){
        console.error("Activity log failed:", e);
    }
}

// ============ EVENT LISTENERS ============
sendBtn.addEventListener("click", sendMessage);

chatInput.addEventListener("keydown", e => { 
    if(e.key === "Enter"){ 
        e.preventDefault(); 
        sendMessage(); 
    } 
});

chatInput.addEventListener("input", () => {
    sendBtn.disabled = chatInput.value.trim().length === 0;
});

document.getElementById('historyBtn').addEventListener('click', toggleSearchHistory);

document.getElementById('clearSearchHistoryBtn').addEventListener('click', async ()=>{
    if(!confirm('Clear all search history? This cannot be undone.')) return;
    try{
        if(db){
            const items = await getAll('searches');
            for(const it of (items||[])){
                if(it && it.id) await del('searches', it.id);
            }
        }
    }catch(e){
        console.error("Clear searches failed:", e);
    }
    try{ 
        localStorage.setItem('edumate_searches','[]'); 
    }catch(e){}
    await loadSearchHistory();
});

document.getElementById('helpBtn').addEventListener('click', ()=>{
    const panel = document.getElementById('helpPanel');
    const list = document.getElementById('helpSubjectList');
    
    if(panel.style.display === 'block') { 
        panel.style.display = 'none'; 
        panel.setAttribute('aria-hidden','true'); 
        return; 
    }
    
    // Update help intro
    const noteIntro = document.getElementById('helpIntro');
    if(noteIntro) {
        noteIntro.innerHTML = `<strong style="font-size:16px;">🤖 Chat Bot — Quick Guide</strong>
            <div style="margin-top:8px;font-size:14px;line-height:1.6;">
                <div><strong>What I can do:</strong> Help manage tasks, find resources, provide study tips, search research papers, access past papers, answer questions, and boost your motivation!</div>
                <div style="margin-top:6px;"><strong>How to use:</strong> Just ask naturally! I understand conversational language and can help with academics, productivity, and personal development.</div>
            </div>`;
    }

    // Populate subject list
    list.innerHTML = '';
    Object.keys(SUBJECT_MAP).forEach(k => {
        const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, ' ');
        const code = SUBJECT_MAP[k];
        const li = document.createElement('li');
        li.style.marginBottom = '4px';
        li.innerHTML = `<strong>${label}</strong> — Code: ${code}`;
        list.appendChild(li);
    });

    panel.style.display = 'block'; 
    panel.setAttribute('aria-hidden','false');
});

// ============ INITIALIZATION ============
openDB()
    .then(() => {
        console.log("✅ Database opened successfully");
        sendBtn.disabled = false;
        chatInput.focus();
        return loadChat();
    })
    .then(() => {
        console.log("✅ Chat loaded successfully");
    })
    .catch(err => {
        console.error("❌ Initialization error:", err);
        // Still enable send button as fallback to localStorage
        sendBtn.disabled = false;
        chatInput.focus();
    });