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
// CLOUD SYNC (Firestore)
// ============================================================

// Generate a device ID so each device has its own data set
// (or share the same ID across devices to share data)
function getDeviceId() {
    let deviceId = localStorage.getItem('cherryl-device-id');
    if (!deviceId) {
        deviceId = 'device_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('cherryl-device-id', deviceId);
    }
    return deviceId;
}

const DEVICE_ID = getDeviceId();

// Save all data to Firestore
async function saveToCloud() {
    if (!isFirebaseReady) return;

    try {
        await db.collection('study-tracker').doc(DEVICE_ID).set({
            topics: topics,
            examDate: examDate ? examDate.toISOString() : null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error('Cloud save failed:', e);
    }
}

// Load all data from Firestore
async function loadFromCloud() {
    if (!isFirebaseReady) return false;

    try {
        const doc = await db.collection('study-tracker').doc(DEVICE_ID).get();
        if (doc.exists) {
            const data = doc.data();
            if (data.topics) topics = data.topics;
            if (data.examDate) {
                examDate = new Date(data.examDate);
                if (isNaN(examDate.getTime())) examDate = null;
            }
            return true;
        }
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
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    countdownDateLabel.textContent = `Exam: ${examDate.toLocaleDateString('en-US', options)}`;
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
    const filtered = topics.filter(t => {
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

    const topic = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name,
        status: statusSelect.value,
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
    examDate = new Date(val + 'T23:59:59');
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

    if (examDate) {
        showCountdown();
    }

    render();
})();