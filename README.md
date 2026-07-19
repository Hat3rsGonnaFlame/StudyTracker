# 🌸 Study Tracker

A simple, beautiful web-based study tracker to keep track of study topics and their progress. Features cloud sync via Firebase so data persists across all devices.

## Features

- **Add topics** with an initial status (To Do, In Progress, Done)
- **Change status** of any topic with one click
- **Filter** by status to focus on what matters
- **Pie chart** showing your progress breakdown
- **Exam countdown** — set an exam date and see a live countdown
- **Cloud sync** — data syncs across all devices via Firebase Firestore
- **Persistent storage** — falls back to localStorage if Firebase isn't configured
- **Responsive design** — works on desktop and mobile
- **Beautiful UI** with a soft pink gradient theme

## How to Use

1. Open `index.html` in your browser
2. Type a topic name and select its status
3. Click "Add Topic" or press Enter
4. Use the filter buttons to view topics by status
5. Click status buttons to move topics between stages
6. Click "Delete" to remove a topic
7. Set an exam date to see a live countdown

## 🔥 Setting Up Cloud Sync (Firebase)

To sync data across all devices, you need a free Firebase project:

### Step 1: Create a Firebase Project
1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click **Create a project** (or use an existing one)
3. Follow the setup wizard (you can disable Google Analytics)

### Step 2: Register a Web App
1. In your Firebase project, go to **Project Settings** → **General**
2. Scroll down to **Your apps** and click **Add app** → **Web** (</> icon)
3. Give it a nickname (e.g., "Study Tracker")
4. Copy the `firebaseConfig` object shown

### Step 3: Set Up Firestore Database
1. In the Firebase console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (this allows anyone to read/write — fine for a personal tracker)
4. Choose a location (e.g., `eur3` for Europe)

### Step 4: Configure the Tracker
1. Open `script.js` in a text editor
2. Find the `firebaseConfig` object at the top of the file
3. Replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
 
};
```

4. Save the file

### Step 5: Deploy to GitHub Pages
1. Create a new repository on GitHub
2. Upload all files (`index.html`, `style.css`, `script.js`, `README.md`)
3. Go to **Settings** → **Pages**
4. Under "Branch", select `main` (or `master`) and `/ (root)` folder
5. Click **Save**
6. Your tracker will be live at `https://<your-username>.github.io/<repository-name>/`

Now any device that opens the tracker will share the same data! 🎉

> **Note:** If you don't configure Firebase, the tracker still works perfectly using localStorage — it just won't sync between devices.

## How Cloud Sync Works

- Each browser gets a unique device ID stored in localStorage
- When Firebase is configured, all data is saved to Firestore AND localStorage
- When loading, it tries Firestore first, then falls back to localStorage
- To share data between devices, you can manually copy the device ID from one browser's localStorage (`cherryl-device-id`) to another

## Tech Stack

- HTML5
- CSS3 (with Flexbox, animations, glassmorphism)
- Vanilla JavaScript (no frameworks needed)
- Firebase Firestore (optional cloud sync)
- localStorage (fallback persistence)

## License

MIT
