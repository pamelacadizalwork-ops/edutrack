# 🎓 EduTrack — College Attendance Management System

A modern, Firebase-powered attendance system for college teachers and students.

---

## 📁 Folder Structure

```
edutrack/
├── public/
│   └── index.html
├── src/
│   ├── firebase/
│   │   └── config.js         ← Your Firebase config (already set up)
│   ├── pages/
│   │   ├── LoginPage.js      ← Login & Register
│   │   ├── TeacherApp.js     ← Full teacher dashboard
│   │   └── StudentApp.js     ← Student attendance view
│   ├── App.js                ← Auth state & routing
│   └── index.js              ← React entry point
├── firestore.rules           ← Firebase security rules
├── vercel.json               ← Vercel deployment config
├── package.json
└── README.md
```

---

## 🚀 How to Run Locally

### Step 1 — Install Node.js
Download from: https://nodejs.org (choose LTS version)

### Step 2 — Open Terminal / Command Prompt
Navigate to the project folder:
```bash
cd edutrack
```

### Step 3 — Install dependencies
```bash
npm install
```

### Step 4 — Start the app
```bash
npm start
```

The app will open at: **http://localhost:3000**

---

## ☁️ Deploy to Vercel (Free Hosting)

### Option A — Deploy via Vercel website (easiest)

1. Go to https://github.com and create a free account
2. Create a new repository called `edutrack`
3. Upload all project files to the repository
4. Go to https://vercel.com and sign in with GitHub
5. Click **"Add New Project"**
6. Select your `edutrack` repository
7. Click **"Deploy"**
8. Your app will be live at: `https://edutrack-yourname.vercel.app`

### Option B — Deploy via terminal

```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## 🔥 Firebase Setup (Already configured!)

Your Firebase project: **edutrak-f6e7b**

Services used:
- **Firebase Authentication** — Email/Password login
- **Cloud Firestore** — Real-time database

### Apply Firestore Security Rules:
1. Go to https://console.firebase.google.com
2. Open your **edutrak** project
3. Go to **Firestore Database** → **Rules**
4. Copy the contents of `firestore.rules` and paste it
5. Click **Publish**

---

## 👩‍🏫 How to Use

### For Teachers:
1. Go to your app URL
2. Click **Register** → select **Teacher** → fill in details → create account
3. Go to **My Classes** → create your first class (e.g. CS301, section CS3A)
4. Go to **Students** → add students manually
5. Go to **Take Attendance** → select class & date → mark students → click **Save to Firebase**

### For Students:
1. Go to the same app URL
2. Click **Register** → select **Student** → fill in details (use same email teacher has on record)
3. After logging in, students can see their:
   - Attendance records per subject
   - Overall attendance rate
   - Warning if below 75%

---

## 📊 Database Structure (Firestore)

### Collection: `users`
```
{
  name: "Prof. Rodriguez",
  email: "teacher@college.edu",
  role: "teacher" | "student",
  studentId: "2024-001",   ← for students only
  createdAt: timestamp
}
```

### Collection: `classes`
```
{
  name: "Data Structures",
  code: "CS301",
  section: "CS3A",
  schedule: "MWF 8:00-9:00 AM",
  teacherId: "uid-of-teacher",
  teacherName: "Prof. Rodriguez"
}
```

### Collection: `students`
```
{
  name: "Maria Santos",
  studentId: "2024-001",
  course: "BS Computer Science",
  section: "CS3A",
  email: "m.santos@college.edu",
  teacherId: "uid-of-teacher"
}
```

### Collection: `attendance`
```
Document ID: {classId}_{studentId}_{date}
{
  classId: "...",
  className: "Data Structures",
  studentId: "...",
  studentName: "Maria Santos",
  section: "CS3A",
  date: "2026-05-14",
  status: "present" | "late" | "absent" | "excused",
  teacherId: "...",
  updatedAt: timestamp
}
```

---

## 🎨 Features

| Feature | Status |
|---|---|
| Teacher & Student Login | ✅ |
| Firebase Authentication | ✅ |
| Create Classes | ✅ |
| Add Students | ✅ |
| Mark Attendance (Present/Late/Absent/Excused) | ✅ |
| Quick Attendance Mode | ✅ |
| Real-time Firebase sync | ✅ |
| Attendance Rate Calculator | ✅ |
| At-Risk Student Alerts | ✅ |
| Student Attendance View | ✅ |
| Per-Subject Breakdown | ✅ |
| AI Attendance Insight | ✅ |
| Dark Mode | ✅ |
| Reports Page | ✅ |
| Mobile Responsive | ✅ |

---

## 🆘 Troubleshooting

**"Permission denied" error in Firestore?**
→ Go to Firebase Console → Firestore → Rules → set to test mode or apply the rules from `firestore.rules`

**Blank page after deploy?**
→ Make sure `vercel.json` is in the root folder

**Students not seeing attendance?**
→ The student name in the Students list must exactly match the name used during registration

---

## 📞 Support
Built with React + Firebase + Anthropic Claude AI
Designed for Philippine college use 🇵🇭
