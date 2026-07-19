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

// Fixed document ID so all devices share the same data
const SHARED_DOC_ID = 'cherryl-shared-data';

// DOM Elements
const topicInput = document.getElementById('topicInput');
const statusSelect = document.getElementById('statusSelect');
const addBtn = document.getElementById('addBtn');
const topicList = document.getElementById('topicList');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const doneCount = document.getElementById('doneCount');
const filterBtns = document.querySelectorAll('.filter-btn');

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
// RENDER
// ============================================================

function render() {
    // Sort topics by rank (ascending) for consistent ordering
    const sortedTopics = [...topics].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

    const filtered = sortedTopics.filter(t => {
        if (currentFilter === 'all') return true;
        return t.status === currentFilter;
    });

    topicList.innerHTML = '';

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
        topicList.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        topicList.style.display = 'block';

        filtered.forEach((topic) => {
            const li = document.createElement('li');
            li.className = 'topic-item';

            // Reorder buttons (up / down)
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
            topicList.appendChild(li);
        });
    }

    updateStats();
    renderPieChart();
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

    if (examDate) {
        showCountdown();
    }

    render();
})();