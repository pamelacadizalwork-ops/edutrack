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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0F1E", flexDirection: "column", gap: 16 }}>
      {/* Glow orbs */}
      <div style={{ position: "absolute", top: "30%", left: "40%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,163,255,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "30%", right: "40%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, rgba(0,163,255,0.15), rgba(168,85,247,0.15))", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(0,163,255,0.3)", boxShadow: "0 0 30px rgba(0,163,255,0.2)" }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <defs><linearGradient id="ld-grad" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#A855F7"/><stop offset="100%" stopColor="#00A3FF"/></linearGradient></defs>
          <path d="M8 30 L16 22 L24 28 L32 12" stroke="url(#ld-grad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M8 22 L16 14 L24 20 L32 4" stroke="url(#ld-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5"/>
          <path d="M26 4 L32 4 L32 10" stroke="url(#ld-grad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>
      <div style={{ fontWeight: 900, fontSize: 22, background: "linear-gradient(135deg, #00A3FF, #A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontFamily: "system-ui" }}>SeenKa</div>
      <div style={{ color: "#3D5A80", fontSize: 13, fontFamily: "system-ui" }}>Be Seen. Be Counted.</div>
    </div>
  );

  // If student arrives via QR link but not logged in, show login first
  // After login, StudentApp will auto-process the QR session
  if (!user || !userProfile) return <LoginPage dark={dark} setDark={setDark} qrSessionId={qrSessionId} />;

  if (userProfile.role === "teacher") return <TeacherApp user={userProfile} onSignOut={handleSignOut} dark={dark} setDark={setDark} />;
  if (userProfile.role === "student") return <StudentApp user={userProfile} onSignOut={handleSignOut} dark={dark} setDark={setDark} qrSessionId={qrSessionId} />;

  return <LoginPage dark={dark} setDark={setDark} />;
}
