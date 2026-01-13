let db; 
let editID = null;
let showArchived = false;
let currentDateRange = 'all';
let selectedCurrency = 'USD';

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

const incomeCategories = [
    '💼 Salary', '💻 Freelance', '📈 Investment', '🎁 Gift', '💵 Other Income'
];

const expenseCategories = [
    '🍔 Food', '🚗 Transport', '📚 Education', '🛍️ Shopping', '📄 Bills',
    '🎬 Entertainment', '🏥 Health', '✈️ Travel', '🏠 Rent', '💳 Other Expense'
];

// Database Functions
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
        req.onerror = () => resolve();
    });
}

function put(store, obj) {
    return new Promise(resolve => {
        const tx = db.transaction(store, "readwrite");
        const req = tx.objectStore(store).put(obj);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
    });
}

function del(store, key) {
    return new Promise(resolve => {
        const tx = db.transaction(store, "readwrite");
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
    });
}

// Currency Functions
function getCurrencySymbol() {
    return currencySymbols[selectedCurrency] || '$';
}

function formatAmount(amount) {
    const symbol = getCurrencySymbol();
    return `${symbol}${parseFloat(amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

async function saveCurrency() {
    selectedCurrency = document.getElementById('currencySelect').value;
    
    // Get existing settings or create new
    let settings = await get('settings', 1);
    if (!settings) {
        settings = {id: 1};
    }
    
    // Update only currency, keep other properties like budget
    settings.currency = selectedCurrency;
    
    await put('settings', settings);
    
    console.log('Currency saved:', selectedCurrency, 'Full settings:', settings);
    
    loadExpenses();
    updateBudgetProgress();
    showToast('<i class="bi bi-currency-exchange"></i> Currency updated!');
}

async function loadCurrency() {
    let settings = await get('settings', 1);
    
    if (!settings) {
        // Create default settings
        settings = {
            id: 1,
            currency: 'USD'
        };
        await put('settings', settings);
        selectedCurrency = 'USD';
    } else if (settings.currency) {
        selectedCurrency = settings.currency;
    } else {
        // Settings exist but no currency set
        settings.currency = 'USD';
        await put('settings', settings);
        selectedCurrency = 'USD';
    }
    
    document.getElementById('currencySelect').value = selectedCurrency;
    console.log('Currency loaded:', selectedCurrency, 'Full settings:', settings);
}

// Modal Functions
function openModal() {
    document.getElementById("expenseModal").style.display = "flex";
    document.getElementById("expenseDate").valueAsDate = new Date();
    updateCategoryOptions();
}

function closeModal() {
    document.getElementById("expenseModal").style.display = "none";
    editID = null;
    document.getElementById("expenseTitle").value = "";
    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseCategory").value = "";
    document.getElementById("expenseDate").value = "";
    document.getElementById("expenseDesc").value = "";
    document.getElementById("expenseType").value = "expense";
    document.getElementById("paymentMethod").value = "Cash";
    document.getElementById("recurringCheck").checked = false;
    toggleRecurring();
    updateCategoryOptions();
}

function updateCategoryOptions() {
    const type = document.getElementById('expenseType').value;
    const categorySelect = document.getElementById('expenseCategory');
    const categories = type === 'income' ? incomeCategories : expenseCategories;
    
    categorySelect.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.substring(2).trim();
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
}

function toggleRecurring() {
    const checked = document.getElementById('recurringCheck').checked;
    document.getElementById('recurringOptions').style.display = checked ? 'block' : 'none';
}

// Save Expense
async function saveExpense() {
    let pinnedState = false;
    let favState = false;
    let archivedState = false;
    
    if (editID) {
        const existing = await get("expenses", editID);
        pinnedState = existing && existing.pinned ? true : false;
        favState = existing && existing.fav ? true : false;
        archivedState = existing && existing.archived ? true : false;
    }
    
    const amount = parseFloat(document.getElementById("expenseAmount").value) || 0;
    
    let expense = {
        title: document.getElementById("expenseTitle").value || "Untitled",
        amount: amount,
        type: document.getElementById("expenseType").value,
        category: document.getElementById("expenseCategory").value,
        date: document.getElementById("expenseDate").value,
        paymentMethod: document.getElementById("paymentMethod").value,
        description: document.getElementById("expenseDesc").value,
        recurring: document.getElementById("recurringCheck").checked,
        recurringFrequency: document.getElementById("recurringCheck").checked ? document.getElementById("recurringFrequency").value : null,
        pinned: pinnedState,
        fav: favState,
        archived: archivedState,
        currency: selectedCurrency,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    
    if (editID) {
        expense.id = editID;
        await put("expenses", expense);
        showToast('<i class="bi bi-check-circle"></i> Transaction updated!');
    } else {
        await add("expenses", expense);
        showToast('<i class="bi bi-check-circle"></i> Transaction added!');
    }
    
    closeModal();
    loadExpenses();
}

// Date Range Functions
function setDateRange(range) {
    currentDateRange = range;
    
    // Update active tab
    document.querySelectorAll('.date-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    if (range === 'custom') {
        document.getElementById('customDateRange').style.display = 'block';
    } else {
        document.getElementById('customDateRange').style.display = 'none';
        loadExpenses();
    }
}

function filterByDateRange(list) {
    if (currentDateRange === 'all') return list;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (currentDateRange === 'custom') {
        const from = document.getElementById('dateFrom').value;
        const to = document.getElementById('dateTo').value;
        if (from && to) {
            return list.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= new Date(from) && itemDate <= new Date(to);
            });
        }
        return list;
    }
    
    return list.filter(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        
        if (currentDateRange === 'today') {
            return itemDate.getTime() === today.getTime();
        } else if (currentDateRange === 'week') {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return itemDate >= weekAgo;
        } else if (currentDateRange === 'month') {
            return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
        } else if (currentDateRange === 'year') {
            return itemDate.getFullYear() === today.getFullYear();
        }
        return true;
    });
}

// Load Expenses
async function loadExpenses() {
    const container = document.getElementById("expenseList");
    container.innerHTML = "";
    const search = document.getElementById("searchInput").value.toLowerCase();
    const typeFilterVal = document.getElementById("typeFilter").value;
    const categoryFilterVal = document.getElementById("categoryFilter").value;
    const sortVal = document.getElementById("sortBy").value;

    let list = await getAll("expenses");
    
    // Filter archived
    list = list.filter(c => showArchived ? c.archived : !c.archived);
    
    // Date range filter
    list = filterByDateRange(list);
    
    // Search filter
    list = list.filter(c =>
        c.title.toLowerCase().includes(search) ||
        (c.description && c.description.toLowerCase().includes(search)) ||
        (c.category && c.category.toLowerCase().includes(search))
    );
    
    // Type filter
    list = list.filter(c => typeFilterVal === "all" || c.type === typeFilterVal);
    
    // Category filter
    list = list.filter(c => categoryFilterVal === "all" || c.category === categoryFilterVal);
    
    // Sort
    if (sortVal === 'date-desc') list.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortVal === 'date-asc') list.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (sortVal === 'amount-desc') list.sort((a, b) => b.amount - a.amount);
    else if (sortVal === 'amount-asc') list.sort((a, b) => a.amount - b.amount);
    else if (sortVal === 'name-asc') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (sortVal === 'name-desc') list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    
    // Pinned to top
    list = list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    
    updateStats();
    updateBudgetProgress();
    
    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3><i class="bi bi-inbox"></i> No transactions found</h3>
                <p>Add your first transaction or adjust your filters</p>
            </div>
        `;
        return;
    }

    list.forEach(c => {
        const archivedClass = c.archived ? 'archived' : '';
        const typeClass = c.type === 'income' ? 'income-card' : 'expense-card-type';
        const amountClass = c.type === 'income' ? 'amount-income' : 'amount-expense';
        const symbol = c.currency ? currencySymbols[c.currency] || '$' : '$';
        
        container.innerHTML += `
        <div class="expense-card ${typeClass} ${archivedClass}">
           <span class="pin ${c.pinned ? "active" : ""}" onclick="togglePin(${c.id},${c.pinned})"><i class="bi bi-pin-angle-fill"></i></span>
           <span class="fav ${c.fav ? "active" : ""}" onclick="toggleFav(${c.id},${c.fav})"><i class="bi bi-heart-fill"></i></span>
           
           ${c.recurring ? '<span class="recurring-badge"><i class="bi bi-arrow-repeat"></i> Recurring</span>' : ''}
           
           <h3>${c.title}</h3>
           <div class="amount-display ${amountClass}">${symbol}${parseFloat(c.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
           
           <span class="category-badge"><i class="bi bi-tag"></i> ${c.category}</span>
           <p><b><i class="bi bi-calendar"></i> Date:</b> ${c.date}</p>
           <p><b><i class="bi bi-credit-card"></i> Payment:</b> ${c.paymentMethod}</p>
           ${c.description ? `<p><i class="bi bi-card-text"></i> ${c.description}</p>` : ''}
           
           <small><i class="bi bi-clock"></i> ${c.time}</small>
           
           <div class="actions">
               <button onclick="editExpense(${c.id})"><i class="bi bi-pencil"></i> Edit</button>
               <button onclick="duplicateExpense(${c.id})"><i class="bi bi-files"></i> Duplicate</button>
               ${c.archived
                ? `<button onclick="unarchiveExpense(${c.id})"><i class="bi bi-arrow-up-circle"></i> Restore</button>`
                : `<button onclick="archiveExpense(${c.id})"><i class="bi bi-archive"></i> Archive</button>`
            }
               <button onclick="deleteExpense(${c.id})" style="background:#ffcccc;"><i class="bi bi-trash"></i> Delete</button>
           </div>
        </div>`;
    });
}

// Update Statistics
async function updateStats() {
    let items = await getAll("expenses");
    items = items.filter(c => !c.archived);
    items = filterByDateRange(items);
    
    const income = items.filter(i => i.type === 'income').reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const expenses = items.filter(i => i.type === 'expense').reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const balance = income - expenses;
    const pinned = items.filter(i => i.pinned).length;
    
    document.getElementById("totalIncome").innerText = formatAmount(income);
    document.getElementById("totalExpenses").innerText = formatAmount(expenses);
    document.getElementById("totalBalance").innerText = formatAmount(balance);
    document.getElementById("totalCount").innerText = items.length;
    document.getElementById("pinnedCount").innerText = pinned;
    
    // Update category breakdown
    updateCategoryBreakdown(items);
}

// Update Budget Progress
async function updateBudgetProgress() {
    const settings = await get('settings', 1);
    
    if (!settings || !settings.budget) {
        document.getElementById('budgetProgressSection').style.display = 'none';
        return;
    }
    
    const budget = settings.budget;
    let items = await getAll("expenses");
    items = items.filter(c => !c.archived && c.type === 'expense');
    
    // Filter for current month
    const today = new Date();
    items = items.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
    });
    
    const totalExpenses = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const percentage = (totalExpenses / budget) * 100;
    
    const fill = document.getElementById('budgetFill');
    fill.style.width = Math.min(percentage, 100) + '%';
    
    if (percentage < 70) {
        fill.className = 'budget-fill';
    } else if (percentage < 90) {
        fill.className = 'budget-fill warning';
    } else {
        fill.className = 'budget-fill danger';
    }
    
    document.getElementById('budgetText').innerHTML = `
        Spent: ${formatAmount(totalExpenses)} / ${formatAmount(budget)} 
        (${percentage.toFixed(1)}%)
        ${percentage > 100 ? '<span style="color:red;font-weight:800;"> ⚠️ Over Budget!</span>' : ''}
    `;
    
    document.getElementById('budgetProgressSection').style.display = 'block';
}

// Category Breakdown
function updateCategoryBreakdown(items) {
    const expenseItems = items.filter(i => i.type === 'expense');
    const categoryTotals = {};
    let maxAmount = 0;
    
    expenseItems.forEach(item => {
        const cat = item.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(item.amount || 0);
        maxAmount = Math.max(maxAmount, categoryTotals[cat]);
    });
    
    const chart = document.getElementById('categoryChart');
    chart.innerHTML = '';
    
    Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
        const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
        const emoji = expenseCategories.find(c => c.includes(cat))?.split(' ')[0] || '💳';
        
        chart.innerHTML += `
        <div class="category-item">
            <h4>${emoji} ${cat}</h4>
            <p style="font-size:18px;font-weight:800;margin:5px 0;">${formatAmount(amount)}</p>
            <div class="category-bar">
                <div class="category-bar-fill" style="width:${percentage}%"></div>
            </div>
        </div>`;
    });
}

// Edit Expense
async function editExpense(id) {
    let c = await get("expenses", id);
    editID = id;
    openModal();
    document.getElementById("expenseTitle").value = c.title;
    document.getElementById("expenseAmount").value = c.amount;
    document.getElementById("expenseType").value = c.type;
    updateCategoryOptions();
    document.getElementById("expenseCategory").value = c.category;
    document.getElementById("expenseDate").value = c.date;
    document.getElementById("paymentMethod").value = c.paymentMethod || 'Cash';
    document.getElementById("expenseDesc").value = c.description || '';
    document.getElementById("recurringCheck").checked = c.recurring || false;
    if (c.recurring) {
        document.getElementById("recurringFrequency").value = c.recurringFrequency || 'monthly';
    }
    toggleRecurring();
}

// Delete Expense
async function deleteExpense(id) {
    if (confirm("Delete this transaction?")) {
        await del("expenses", id);
        loadExpenses();
        showToast('<i class="bi bi-trash"></i> Transaction deleted');
    }
}

// Toggle Pin
async function togglePin(id, state) {
    let c = await get("expenses", id);
    c.pinned = !state;
    await put("expenses", c);
    loadExpenses();
    showToast(c.pinned ? '<i class="bi bi-pin-angle-fill"></i> Pinned' : '<i class="bi bi-pin-angle"></i> Unpinned');
}

// Toggle Favorite
async function toggleFav(id, state) {
    let c = await get("expenses", id);
    c.fav = !state;
    await put("expenses", c);
    loadExpenses();
    showToast(c.fav ? '<i class="bi bi-heart-fill"></i> Favorited' : '<i class="bi bi-heart"></i> Unfavorited');
}

// Duplicate Expense
async function duplicateExpense(id) {
    let c = await get("expenses", id);
    let copy = {
        title: c.title + " (Copy)",
        amount: c.amount,
        type: c.type,
        category: c.category,
        date: c.date,
        paymentMethod: c.paymentMethod,
        description: c.description,
        recurring: false,
        recurringFrequency: null,
        pinned: false,
        fav: false,
        archived: false,
        currency: c.currency || selectedCurrency,
        time: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    await add("expenses", copy);
    loadExpenses();
    showToast('<i class="bi bi-files"></i> Transaction duplicated');
}

// Archive Expense
async function archiveExpense(id) {
    let c = await get("expenses", id);
    c.archived = true;
    await put("expenses", c);
    loadExpenses();
    showToast('<i class="bi bi-archive"></i> Transaction archived');
}

// Unarchive Expense
async function unarchiveExpense(id) {
    let c = await get("expenses", id);
    c.archived = false;
    await put("expenses", c);
    loadExpenses();
    showToast('<i class="bi bi-arrow-up-circle"></i> Transaction restored');
}

// Toggle Archive View
function toggleArchiveView() {
    showArchived = !showArchived;
    document.getElementById("archiveViewText").innerHTML = showArchived ? '<i class="bi bi-journal-text"></i> Show Active' : '<i class="bi bi-archive"></i> Show Archived';
    loadExpenses();
}

// Toggle View Mode
function toggleViewMode() {
    const mode = document.getElementById("viewMode").value;
    const container = document.getElementById("expenseList");
    
    if (mode === 'list') {
        container.classList.remove('expense-grid');
        container.classList.add('expense-list');
    } else {
        container.classList.remove('expense-list');
        container.classList.add('expense-grid');
    }
}

// Clear All Filters
function clearAllFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("typeFilter").value = "all";
    document.getElementById("categoryFilter").value = "all";
    document.getElementById("sortBy").value = "date-desc";
    showArchived = false;
    currentDateRange = 'all';
    document.getElementById("archiveViewText").innerHTML = '<i class="bi bi-archive"></i> Show Archived';
    document.querySelectorAll('.date-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.date-tab')[0].classList.add('active');
    document.getElementById('customDateRange').style.display = 'none';
    loadExpenses();
    showToast('<i class="bi bi-arrow-clockwise"></i> Filters reset');
}

// Toggle Category Breakdown
function toggleCategoryBreakdown() {
    const section = document.getElementById('categoryBreakdown');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
}

// Budget Modal Functions
async function openBudgetModal() {
    document.getElementById('budgetModal').style.display = 'flex';
    
    try {
        const settings = await get('settings', 1);
        if (settings && settings.budget) {
            document.getElementById('budgetAmount').value = settings.budget;
        } else {
            document.getElementById('budgetAmount').value = '';
        }
        console.log('Budget modal opened, settings:', settings);
    } catch (err) {
        console.error('Error opening budget modal:', err);
        document.getElementById('budgetAmount').value = '';
    }
}

function closeBudgetModal() {
    document.getElementById('budgetModal').style.display = 'none';
}

async function saveBudget() {
    const amount = parseFloat(document.getElementById('budgetAmount').value);
    if (!amount || amount <= 0) {
        alert('Please enter a valid budget amount');
        return;
    }
    
    // Get existing settings or create new
    let settings = await get('settings', 1);
    if (!settings) {
        settings = {
            id: 1,
            currency: selectedCurrency
        };
    }
    
    // Update only budget, preserve currency and other properties
    settings.budget = amount;
    
    // Make sure currency is preserved
    if (!settings.currency) {
        settings.currency = selectedCurrency;
    }
    
    await put('settings', settings);
    
    console.log('Budget saved:', settings);
    
    closeBudgetModal();
    updateBudgetProgress();
    showToast('<i class="bi bi-piggy-bank"></i> Budget saved!');
}

async function clearBudget() {
    if (confirm('Clear your budget?')) {
        let settings = await get('settings', 1);
        if (!settings) {
            settings = {id: 1};
        }
        
        // Remove budget but keep currency
        delete settings.budget;
        
        // Preserve currency
        if (!settings.currency) {
            settings.currency = selectedCurrency;
        }
        
        await put('settings', settings);
        
        console.log('Budget cleared, settings:', settings);
        
        closeBudgetModal();
        updateBudgetProgress();
        showToast('<i class="bi bi-trash"></i> Budget cleared');
    }
}

// Export Modal Functions
function openExportModal() {
    document.getElementById('exportModal').style.display = 'flex';
}

function closeExportModal() {
    document.getElementById('exportModal').style.display = 'none';
}

async function exportExpenses() {
    let items = await getAll("expenses");
    const dataStr = JSON.stringify(items, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-expenses-${Date.now()}.json`;
    link.click();
    showToast('<i class="bi bi-download"></i> Exported as JSON!');
}

async function exportExpensesText() {
    let items = await getAll("expenses");
    let text = "EDUMATE EXPENSE TRACKER EXPORT\n";
    text += "=".repeat(60) + "\n\n";
    
    items.forEach((c, i) => {
        const symbol = c.currency ? currencySymbols[c.currency] || '$' : '$';
        text += `[${i + 1}] ${c.title}\n`;
        text += `Type: ${c.type.toUpperCase()}\n`;
        text += `Amount: ${symbol}${c.amount}\n`;
        text += `Category: ${c.category}\n`;
        text += `Date: ${c.date}\n`;
        text += `Payment: ${c.paymentMethod}\n`;
        text += `Description: ${c.description || 'N/A'}\n`;
        text += `Recurring: ${c.recurring ? 'Yes (' + c.recurringFrequency + ')' : 'No'}\n`;
        text += `Created: ${c.time}\n`;
        text += "-".repeat(60) + "\n\n";
    });
    
    const dataBlob = new Blob([text], {type: 'text/plain'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-expenses-${Date.now()}.txt`;
    link.click();
    showToast('<i class="bi bi-file-text"></i> Exported as text!');
}

async function exportExpensesCSV() {
    let items = await getAll("expenses");
    let csv = "Type,Title,Amount,Currency,Category,Date,Payment Method,Description,Recurring,Frequency,Created\n";
    
    items.forEach(c => {
        csv += `"${c.type}","${c.title}","${c.amount}","${c.currency || 'USD'}","${c.category}","${c.date}","${c.paymentMethod}","${c.description || ''}","${c.recurring ? 'Yes' : 'No'}","${c.recurringFrequency || ''}","${c.time}"\n`;
    });
    
    const dataBlob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edumate-expenses-${Date.now()}.csv`;
    link.click();
    showToast('<i class="bi bi-file-earmark-spreadsheet"></i> Exported as CSV!');
}

async function importExpenses() {
    const file = document.getElementById("importFile").files[0];
    if (!file) {
        alert("Please select a file first!");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) {
                alert("Invalid file format!");
                return;
            }
            
            for (let item of data) {
                delete item.id;
                await add("expenses", item);
            }
            
            loadExpenses();
            closeExportModal();
            showToast(`<i class="bi bi-upload"></i> ${data.length} transactions imported!`);
        } catch (err) {
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

// Initialize App
openDB().then(async () => {
    console.log('✅ Database opened successfully');
    
    // Load currency first (must complete before anything else)
    await loadCurrency();
    console.log('✅ Currency loaded:', selectedCurrency);
    
    // Load budget display
    await updateBudgetProgress();
    console.log('✅ Budget progress updated');
    
    // Load all expenses
    await loadExpenses();
    console.log('✅ Expenses loaded');
    
    console.log('✅ App initialized successfully');
}).catch(err => {
    console.error('❌ Database error:', err);
    alert('Error initializing app. Please refresh the page.');
});