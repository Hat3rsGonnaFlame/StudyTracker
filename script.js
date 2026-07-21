// ============================================================
// 🔥 FIREBASE SETUP
// ============================================================
// To use cloud sync across devices, create a Firebase project:
// 1. Go to https://console.firebase.google.com/
// 2. Create a project (or use existing)
// 3. Go to Project Settings > General > Your apps > Add app > Web
// 4. Copy the config object below and replace the placeholder values
// 5. In Firestore Database, create a database (start in test mode)
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyDLI3tLx8eLaXtOcWa4Fhi9xWImUI6W4e4",
    authDomain: "cherryltracker.firebaseapp.com",
    projectId: "cherryltracker",
    storageBucket: "cherryltracker.firebasestorage.app",
    messagingSenderId: "43502910840",
    appId: "1:43502910840:web:5e610f0a757ff573339c8d",
    measurementId: "G-QWNEJ8C9G0"
};

// Initialize Firebase
let db = null;
let isFirebaseReady = false;

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        isFirebaseReady = true;
        console.log('🔥 Firebase connected!');
    } else {
        console.log('📦 Using localStorage (configure Firebase for cloud sync)');
    }
} catch (e) {
    console.log('📦 Firebase not configured, using localStorage');
}

// ============================================================
// STATE
// ============================================================
let topics = [];
let currentFilter = 'all';
let examDate = null;
let countdownInterval = null;
let dataLoaded = false;
let currentView = 'list'; // 'list' or 'calendar'
let calendarDateFilter = null; // YYYY-MM-DD string when a day is selected in calendar
let calendarMonth = new Date();
calendarMonth.setDate(1); // First of current month for calendar rendering

// Fixed document ID so all devices share the same data
const SHARED_DOC_ID = 'cherryl-shared-data';

// DOM Elements
const topicInput = document.getElementById('topicInput');
const topicDateInput = document.getElementById('topicDateInput');
const statusSelect = document.getElementById('statusSelect');
const addBtn = document.getElementById('addBtn');
const topicList = document.getElementById('topicList');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const doneCount = document.getElementById('doneCount');
const filterBtns = document.querySelectorAll('.filter-btn');

// View toggle elements
const viewBtns = document.querySelectorAll('.view-btn');
const calendarView = document.getElementById('calendarView');

// Filter info bar
const filterInfo = document.getElementById('filterInfo');
const filterInfoText = document.getElementById('filterInfoText');
const clearDateFilterBtn = document.getElementById('clearDateFilterBtn');

// Calendar elements
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const calendarPrevBtn = document.getElementById('calendarPrevBtn');
const calendarNextBtn = document.getElementById('calendarNextBtn');

// Exam countdown elements
const examSetup = document.getElementById('examSetup');
const examCountdown = document.getElementById('examCountdown');
const examDateInput = document.getElementById('examDateInput');
const examSetBtn = document.getElementById('examSetBtn');
const examClearBtn = document.getElementById('examClearBtn');
const countdownDays = document.getElementById('countdownDays');
const countdownHours = document.getElementById('countdownHours');
const countdownMinutes = document.getElementById('countdownMinutes');
const countdownSeconds = document.getElementById('countdownSeconds');
const countdownDateLabel = document.getElementById('countdownDateLabel');

// Pie chart elements
const pieChart = document.getElementById('pieChart');
const chartCenterText = document.getElementById('chartCenterText');
const legendTodo = document.getElementById('legendTodo');
const legendProgress = document.getElementById('legendProgress');
const legendDone = document.getElementById('legendDone');

// ============================================================
// CLOUD SYNC (Firestore) — shared across all devices
// ============================================================

// Save all data to Firestore using a fixed document ID
async function saveToCloud() {
    if (!isFirebaseReady) return;

    try {
        await db.collection('study-tracker').doc(SHARED_DOC_ID).set({
            topics: topics,
            examDate: examDate ? examDate.toISOString() : null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('Cloud save failed:', e);
    }
}

// Migrate data from old per-device documents to the shared document
async function migrateOldData() {
    if (!isFirebaseReady) return false;

    try {
        const snapshot = await db.collection('study-tracker').get();
        let migrated = false;
        snapshot.forEach((doc) => {
            if (doc.id === SHARED_DOC_ID) return; // skip the shared doc itself
            const data = doc.data();
            if (data && data.topics && data.topics.length > 0) {
                topics = data.topics;
                if (data.examDate) {
                    examDate = new Date(data.examDate);
                    if (isNaN(examDate.getTime())) examDate = null;
                }
                migrated = true;
            }
        });
        if (migrated) {
            // Save the migrated data to the shared document
            await saveToCloud();
            console.log('✅ Migrated old data to shared document');
            return true;
        }
    } catch (e) {
        console.error('Migration check failed:', e);
    }
    return false;
}

// Load all data from Firestore using the fixed document ID
async function loadFromCloud() {
    if (!isFirebaseReady) return false;

    try {
        const doc = await db.collection('study-tracker').doc(SHARED_DOC_ID).get();
        if (doc.exists) {
            const data = doc.data();
            if (data.topics) topics = data.topics;
            if (data.examDate) {
                examDate = new Date(data.examDate);
                if (isNaN(examDate.getTime())) examDate = null;
            }
            return true;
        }

        // Shared doc doesn't exist — check for old per-device docs to migrate
        const migrated = await migrateOldData();
        return migrated;
    } catch (e) {
        console.error('Cloud load failed:', e);
    }
    return false;
}

// ============================================================
// LOCAL STORAGE (fallback)
// ============================================================

function loadFromLocal() {
    const stored = localStorage.getItem('cherryl-tracker-topics');
    if (stored) {
        try {
            topics = JSON.parse(stored);
        } catch {
            topics = [];
        }
    }

    const examStored = localStorage.getItem('cherryl-tracker-exam');
    if (examStored) {
        try {
            examDate = new Date(examStored);
            if (isNaN(examDate.getTime())) examDate = null;
        } catch {
            examDate = null;
        }
    }
}

function saveToLocal() {
    localStorage.setItem('cherryl-tracker-topics', JSON.stringify(topics));
    if (examDate) {
        localStorage.setItem('cherryl-tracker-exam', examDate.toISOString());
    } else {
        localStorage.removeItem('cherryl-tracker-exam');
    }
}

// ============================================================
// SAVE & LOAD (unified)
// ============================================================

async function loadData() {
    if (isFirebaseReady) {
        const cloudLoaded = await loadFromCloud();
        if (cloudLoaded) {
            // Also save to localStorage as cache
            saveToLocal();
            dataLoaded = true;
            return;
        }
    }
    // Fallback to localStorage
    loadFromLocal();
    dataLoaded = true;
}

async function saveData() {
    saveToLocal();
    if (isFirebaseReady) {
        await saveToCloud();
    }
}

// ============================================================
// EXAM COUNTDOWN
// ============================================================

function showCountdown() {
    examSetup.style.display = 'none';
    examCountdown.style.display = 'block';
    // Display the exam date in Philippine Time (PHT, UTC+8)
    const phtDate = new Date(examDate.getTime() + (8 * 60 * 60 * 1000));
    const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    countdownDateLabel.textContent = `Exam: ${phtDate.toLocaleDateString('en-US', options)} (PHT)`;
    startCountdown();
}

function showExamSetup() {
    examSetup.style.display = 'block';
    examCountdown.style.display = 'none';
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    if (!examDate) return;
    const now = new Date();
    const diff = examDate.getTime() - now.getTime();

    if (diff <= 0) {
        countdownDays.textContent = '0';
        countdownHours.textContent = '0';
        countdownMinutes.textContent = '0';
        countdownSeconds.textContent = '0';
        countdownDateLabel.textContent = '🎉 Exam day is here! Good luck!';
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    countdownDays.textContent = days;
    countdownHours.textContent = String(hours).padStart(2, '0');
    countdownMinutes.textContent = String(minutes).padStart(2, '0');
    countdownSeconds.textContent = String(seconds).padStart(2, '0');
}

// ============================================================
// PIE CHART
// ============================================================

function renderPieChart() {
    const total = topics.length;
    const todo = topics.filter(t => t.status === 'todo').length;
    const inProgress = topics.filter(t => t.status === 'in-progress').length;
    const done = topics.filter(t => t.status === 'done').length;

    legendTodo.textContent = todo;
    legendProgress.textContent = inProgress;
    legendDone.textContent = done;

    const donePercent = total > 0 ? Math.round((done / total) * 100) : 0;
    chartCenterText.textContent = `${donePercent}%`;

    if (total === 0) {
        pieChart.innerHTML = `<circle cx="120" cy="120" r="100" fill="none" stroke="#f0d4e8" stroke-width="40" />`;
        return;
    }

    const todoAngle = (todo / total) * 360;
    const progressAngle = (inProgress / total) * 360;
    const doneAngle = (done / total) * 360;

    const colors = ['#ffb74d', '#64b5f6', '#81c784'];
    const angles = [todoAngle, progressAngle, doneAngle];

    const segments = [];
    for (let i = 0; i < 3; i++) {
        if (angles[i] > 0) {
            segments.push({ angle: angles[i], color: colors[i] });
        }
    }

    if (segments.length === 0) {
        pieChart.innerHTML = `<circle cx="120" cy="120" r="100" fill="none" stroke="#f0d4e8" stroke-width="40" />`;
        return;
    }

    const circumference = 2 * Math.PI * 100;
    let svgContent = '';
    let currentAngle = -90;

    for (const seg of segments) {
        const segLength = (seg.angle / 360) * circumference;
        const dashArray = `${segLength} ${circumference - segLength}`;
        svgContent += `<circle cx="120" cy="120" r="100" fill="none" stroke="${seg.color}" stroke-width="40" stroke-dasharray="${dashArray}" stroke-dashoffset="0" transform="rotate(${currentAngle} 120 120)" />`;
        currentAngle += seg.angle;
    }

    svgContent = `<circle cx="120" cy="120" r="100" fill="none" stroke="#f0d4e8" stroke-width="40" />` + svgContent;
    pieChart.innerHTML = svgContent;
}

// ============================================================
// DATE HELPERS
// ============================================================

function formatDateLabel(dateStr) {
    if (!dateStr) return '📅 Unscheduled';
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    if (dateStr === todayStr) return '📅 Today';
    if (dateStr === yesterdayStr) return '📅 Yesterday';
    if (dateStr === tomorrowStr) return '📅 Tomorrow';

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return `📅 ${d.toLocaleDateString('en-US', options)}`;
}

// ============================================================
// CALENDAR
// ============================================================

function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    // Set label
    const options = { year: 'numeric', month: 'long' };
    calendarMonthLabel.textContent = calendarMonth.toLocaleDateString('en-US', options);

    // Build date lookup for topics
    const dateCounts = {};
    const todayStr = new Date().toISOString().slice(0, 10);

    topics.forEach(t => {
        const d = t.date || 'unscheduled';
        if (!dateCounts[d]) dateCounts[d] = 0;
        dateCounts[d]++;
    });

    // First day of month (0=Sun)
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    let html = '';

    // Previous month's trailing days
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dateStr = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const count = dateCounts[dateStr] || 0;
        html += `<div class="calendar-day other-month">${day}${count > 0 ? `<span class="day-dot"></span>` : ''}</div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const count = dateCounts[dateStr] || 0;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === calendarDateFilter;
        const hasTopics = count > 0;

        let cls = 'calendar-day';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        if (hasTopics) cls += ' has-topics';

        html += `<div class="${cls}" data-date="${dateStr}">`;
        html += `<span>${day}</span>`;
        if (count > 0) {
            html += `<span class="day-count">${count}</span>`;
        }
        html += `</div>`;
    }

    // Next month's leading days to fill 6 rows (42 cells)
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    for (let day = 1; day <= remaining; day++) {
        const dateStr = `${nextMonthYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const count = dateCounts[dateStr] || 0;
        html += `<div class="calendar-day other-month">${day}${count > 0 ? `<span class="day-dot"></span>` : ''}</div>`;
    }

    calendarGrid.innerHTML = html;

    // Click handlers on calendar days
    calendarGrid.querySelectorAll('.calendar-day:not(.other-month)').forEach(el => {
        el.addEventListener('click', () => {
            const date = el.dataset.date;
            selectCalendarDay(date);
        });
    });
}

function selectCalendarDay(dateStr) {
    // Set the date filter and switch to list view
    calendarDateFilter = dateStr;
    currentView = 'list';

    // Update view buttons
    viewBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === 'list');
    });
    calendarView.style.display = 'none';

    // Show filter info bar
    filterInfo.style.display = 'flex';
    const count = topics.filter(t => (t.date || 'unscheduled') === dateStr).length;
    const label = formatDateLabel(dateStr);
    filterInfoText.textContent = `${label} — ${count} topic${count !== 1 ? 's' : ''}`;

    // Set the topic date input to this date so new topics go here
    topicDateInput.value = dateStr;

    render();

    // Re-render calendar so selected day is highlighted (if we switch back)
    renderCalendar();
}

function clearDateFilter() {
    calendarDateFilter = null;
    filterInfo.style.display = 'none';
    topicDateInput.value = new Date().toISOString().slice(0, 10);
    render();
}

// ============================================================
// RENDER
// ============================================================

function render() {
    // ---- Sorting ----
    // 1. First sort by rank (ascending) for stable ordering
    // 2. Then sort so that 'done' topics move to the bottom
    const sortedTopics = [...topics].sort((a, b) => {
        // Done status always goes to bottom
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        // Within same status-group, sort by rank
        return (a.rank ?? 0) - (b.rank ?? 0);
    });

    // ---- Filtering ----
    let filtered = sortedTopics.filter(t => {
        // Status filter
        if (currentFilter !== 'all' && t.status !== currentFilter) return false;
        // Date filter (from calendar click)
        if (calendarDateFilter !== null) {
            const topicDate = t.date || 'unscheduled';
            if (topicDate !== calendarDateFilter) return false;
        }
        return true;
    });

    topicList.innerHTML = '';

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
        topicList.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        topicList.style.display = 'block';

        // If there's a date filter active, just show flat list (already scoped to a day)
        if (calendarDateFilter !== null) {
            filtered.forEach((topic) => {
                const li = createTopicElement(topic);
                topicList.appendChild(li);
            });
        } else {
            // Group by date
            const groups = {};
            filtered.forEach(t => {
                const key = t.date || 'unscheduled';
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
            });

            // Sort date keys: dated topics first in chronological order, then unscheduled
            const dateKeys = Object.keys(groups).sort((a, b) => {
                if (a === 'unscheduled') return 1;
                if (b === 'unscheduled') return -1;
                return a.localeCompare(b);
            });

            for (const dateKey of dateKeys) {
                const groupTopics = groups[dateKey];
                const groupDiv = document.createElement('div');
                groupDiv.className = 'date-group';

                const header = document.createElement('div');
                header.className = 'date-group-header';
                header.innerHTML = `
                    <span class="date-group-label">${formatDateLabel(dateKey)}</span>
                    <span class="date-group-count">${groupTopics.length}</span>
                `;
                groupDiv.appendChild(header);

                groupTopics.forEach(topic => {
                    const li = createTopicElement(topic);
                    groupDiv.appendChild(li);
                });

                topicList.appendChild(groupDiv);
            }
        }
    }

    updateStats();
    renderPieChart();
}

function createTopicElement(topic) {
    const li = document.createElement('li');
    li.className = 'topic-item';

    // Reorder buttons
    const reorderDiv = document.createElement('div');
    reorderDiv.className = 'reorder-buttons';

    const upBtn = document.createElement('button');
    upBtn.className = 'btn-reorder';
    upBtn.textContent = '▲';
    upBtn.title = 'Move up';
    upBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await moveTopic(topic.id, -1);
    });

    const downBtn = document.createElement('button');
    downBtn.className = 'btn-reorder';
    downBtn.textContent = '▼';
    downBtn.title = 'Move down';
    downBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await moveTopic(topic.id, 1);
    });

    reorderDiv.appendChild(upBtn);
    reorderDiv.appendChild(downBtn);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'topic-name' + (topic.status === 'done' ? ' done-text' : '');
    nameSpan.textContent = topic.name;

    const badge = document.createElement('span');
    badge.className = `status-badge status-${topic.status}`;
    const statusLabels = {
        'todo': '📋 To Do',
        'in-progress': '📖 In Progress',
        'done': '✅ Done'
    };
    badge.textContent = statusLabels[topic.status] || topic.status;

    // Editable date picker (inline)
    const dateEditContainer = document.createElement('span');
    dateEditContainer.className = 'topic-date-edit';

    if (topic.date) {
        const dateBadge = document.createElement('span');
        dateBadge.className = 'topic-date-badge';
        const d = new Date(topic.date + 'T00:00:00');
        const options = { month: 'short', day: 'numeric' };
        dateBadge.textContent = d.toLocaleDateString('en-US', options);
        dateBadge.title = 'Click to change date';
        dateEditContainer.appendChild(dateBadge);
    }

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'topic-date-input';
    dateInput.value = topic.date || '';
    dateInput.style.display = 'none';
    dateInput.addEventListener('change', async () => {
        const newDate = dateInput.value || null;
        const realIndex = topics.findIndex(t => t.id === topic.id);
        if (realIndex !== -1) {
            topics[realIndex].date = newDate;
            await saveData();
            render();
        }
    });
    dateInput.addEventListener('blur', () => {
        dateInput.style.display = 'none';
        const badge = dateEditContainer.querySelector('.topic-date-badge');
        if (badge) badge.style.display = '';
    });

    dateEditContainer.appendChild(dateInput);

    // Click the badge to show the date picker
    dateEditContainer.addEventListener('click', (e) => {
        if (e.target === dateInput) return; // don't toggle if clicking input itself
        const badge = dateEditContainer.querySelector('.topic-date-badge');
        if (badge) badge.style.display = 'none';
        dateInput.style.display = '';
        dateInput.showPicker ? dateInput.showPicker() : dateInput.focus();
    });

    if (calendarDateFilter === null) {
        li.appendChild(dateEditContainer);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';

    const realIndex = topics.findIndex(t => t.id === topic.id);

    if (topic.status !== 'done') {
        const doneBtn = document.createElement('button');
        doneBtn.className = 'btn-status';
        doneBtn.textContent = '✅ Done';
        doneBtn.addEventListener('click', async () => {
            topics[realIndex].status = 'done';
            await saveData();
            render();
        });
        actions.appendChild(doneBtn);
    }

    if (topic.status !== 'in-progress') {
        const progressBtn = document.createElement('button');
        progressBtn.className = 'btn-status';
        progressBtn.textContent = '📖 In Progress';
        progressBtn.addEventListener('click', async () => {
            topics[realIndex].status = 'in-progress';
            await saveData();
            render();
        });
        actions.appendChild(progressBtn);
    }

    if (topic.status !== 'todo') {
        const todoBtn = document.createElement('button');
        todoBtn.className = 'btn-status';
        todoBtn.textContent = '📋 To Do';
        todoBtn.addEventListener('click', async () => {
            topics[realIndex].status = 'todo';
            await saveData();
            render();
        });
        actions.appendChild(todoBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '🗑 Delete';
    deleteBtn.addEventListener('click', async () => {
        topics.splice(realIndex, 1);
        await saveData();
        render();
    });
    actions.appendChild(deleteBtn);

    li.appendChild(reorderDiv);
    li.appendChild(nameSpan);
    li.appendChild(badge);
    li.appendChild(actions);

    return li;
}

function updateStats() {
    const total = topics.length;
    const done = topics.filter(t => t.status === 'done').length;
    totalCount.textContent = `${total} topic${total !== 1 ? 's' : ''}`;
    doneCount.textContent = `${done} completed`;
}

// ============================================================
// REORDER TOPICS
// ============================================================

async function moveTopic(topicId, direction) {
    // Sort by rank to find adjacent topics
    const sorted = [...topics].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const currentIndex = sorted.findIndex(t => t.id === topicId);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const currentTopic = sorted[currentIndex];
    const targetTopic = sorted[targetIndex];

    // Swap ranks
    const tempRank = currentTopic.rank;
    currentTopic.rank = targetTopic.rank;
    targetTopic.rank = tempRank;

    await saveData();
    render();
}

// ============================================================
// ADD TOPIC
// ============================================================

async function addTopic() {
    const name = topicInput.value.trim();
    if (!name) {
        topicInput.focus();
        return;
    }

    if (topics.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        alert('This topic already exists!');
        return;
    }

    // Determine the next rank (highest existing rank + 1)
    const maxRank = topics.reduce((max, t) => Math.max(max, t.rank ?? 0), -1);

    const topic = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name,
        status: statusSelect.value,
        rank: maxRank + 1,
        date: topicDateInput.value || null,
        createdAt: new Date().toISOString()
    };

    topics.push(topic);
    await saveData();
    render();

    topicInput.value = '';
    topicInput.focus();
}

// ============================================================
// FILTER
// ============================================================

function setFilter(filter) {
    currentFilter = filter;
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    render();
}

// ============================================================
// VIEW TOGGLE
// ============================================================

function setView(view) {
    currentView = view;
    viewBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'calendar') {
        calendarView.style.display = 'block';
        // If there's a date filter active, clear it when switching to calendar view
        if (calendarDateFilter !== null) {
            clearDateFilter();
        }
        renderCalendar();
        // Hide the filter info bar in calendar view
        filterInfo.style.display = 'none';
    } else {
        calendarView.style.display = 'none';
    }

    render();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

addBtn.addEventListener('click', addTopic);

topicInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addTopic();
    }
});

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setFilter(btn.dataset.filter);
    });
});

viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setView(btn.dataset.view);
    });
});

clearDateFilterBtn.addEventListener('click', clearDateFilter);

calendarPrevBtn.addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() - 1);
    renderCalendar();
});

calendarNextBtn.addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() + 1);
    renderCalendar();
});

examSetBtn.addEventListener('click', async () => {
    const val = examDateInput.value;
    if (!val) {
        alert('Please select a date!');
        return;
    }

    // Parse the date as Philippine Time (PHT, UTC+8) so all devices see the same countdown
    const parts = val.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // 0-indexed
    const day = parseInt(parts[2]);
    // Midnight PHT = 16:00 UTC the previous day
    examDate = new Date(Date.UTC(year, month, day, 0, 0, 0) - (8 * 60 * 60 * 1000));

    if (isNaN(examDate.getTime())) {
        alert('Invalid date!');
        return;
    }
    await saveData();
    showCountdown();
});

examClearBtn.addEventListener('click', async () => {
    examDate = null;
    await saveData();
    showExamSetup();
});

// ============================================================
// INITIALIZE
// ============================================================

(async function init() {
    await loadData();

    // Ensure all existing topics have a rank assigned (for backward compatibility)
    let needsSave = false;
    topics.forEach((t, i) => {
        if (t.rank === undefined || t.rank === null) {
            t.rank = i;
            needsSave = true;
        }
    });
    if (needsSave) {
        await saveData();
    }

    // Set default date on topic date input to today
    topicDateInput.value = new Date().toISOString().slice(0, 10);

    if (examDate) {
        showCountdown();
    }

    // Initial calendar render (hidden until user clicks Calendar tab)
    renderCalendar();

    render();
})();