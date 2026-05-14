import { useState, useEffect } from "react";
import { auth, db } from "./firebase/config";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import LoginPage from "./pages/LoginPage";
import TeacherApp from "./pages/TeacherApp";
import StudentApp from "./pages/StudentApp";

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  // Check if arriving via QR scan link
  const params = new URLSearchParams(window.location.search);
  const qrSessionId = params.get("session");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const docRef = doc(db, "users", firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile({ uid: firebaseUser.uid, email: firebaseUser.email, ...docSnap.data() });
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSignOut = () => signOut(auth);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? "#0f172a" : "#f0f4ff", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 48, height: 48, background: "#4f46e5", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🎓</div>
      <div style={{ color: "#4f46e5", fontWeight: 700, fontSize: 18, fontFamily: "system-ui" }}>Loading EduTrack...</div>
    </div>
  );

  // If student arrives via QR link but not logged in, show login first
  // After login, StudentApp will auto-process the QR session
  if (!user || !userProfile) return <LoginPage dark={dark} setDark={setDark} qrSessionId={qrSessionId} />;

  if (userProfile.role === "teacher") return <TeacherApp user={userProfile} onSignOut={handleSignOut} dark={dark} setDark={setDark} />;
  if (userProfile.role === "student") return <StudentApp user={userProfile} onSignOut={handleSignOut} dark={dark} setDark={setDark} qrSessionId={qrSessionId} />;

  return <LoginPage dark={dark} setDark={setDark} />;
}
