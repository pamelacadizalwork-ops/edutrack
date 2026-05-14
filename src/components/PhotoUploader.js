import { useState, useRef } from "react";
import { db } from "../firebase/config";
import { doc, updateDoc } from "firebase/firestore";

const CLOUDINARY_CLOUD_NAME = "dqjkfjgxc";
const CLOUDINARY_UPLOAD_PRESET = "edutrack_uploads"; // unsigned preset we'll create

// Upload image to Cloudinary
async function uploadToCloudinary(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "edutrack/profiles");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      const res = JSON.parse(xhr.responseText);
      if (xhr.status === 200) resolve(res.secure_url);
      else reject(new Error(res.error?.message || "Upload failed"));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

// Avatar component - shows photo or colored initials
export function Avatar({ name = "?", size = 36, photoURL = null, style = {} }) {
  const colors = ["#4f46e5","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#db2777"];
  const idx = (name.charCodeAt(0) || 0) % colors.length;
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          border: "2px solid #e2e8f0", ...style
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: colors[idx], display: "flex", alignItems: "center",
      justifyContent: "center", color: "#fff", fontWeight: 700,
      fontSize: size * 0.35, flexShrink: 0, ...style
    }}>
      {initials}
    </div>
  );
}

// Full photo uploader for Settings page
export function PhotoUploader({ userId, currentPhotoURL, userName, collection = "users", onUploadComplete, dark }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(currentPhotoURL || null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const surface2 = dark ? "#334155" : "#f1f5f9";
  const border = dark ? "#334155" : "#e2e8f0";
  const textMuted = dark ? "#94a3b8" : "#64748b";
  const accent = "#4f46e5";

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError("");
    setSuccess(false);

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPG, PNG, etc.)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB");
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    setUploading(true);
    setProgress(0);

    try {
      const url = await uploadToCloudinary(file, setProgress);

      // Save URL to Firestore
      await updateDoc(doc(db, collection, userId), { photoURL: url });

      setPreview(url);
      setSuccess(true);
      setUploading(false);
      if (onUploadComplete) onUploadComplete(url);
    } catch (err) {
      setError("Upload failed: " + err.message);
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      {/* Photo preview */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar name={userName} size={80} photoURL={preview} style={{ border: `3px solid ${accent}` }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            position: "absolute", bottom: 0, right: 0,
            width: 28, height: 28, borderRadius: "50%",
            background: accent, border: "2px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: uploading ? "not-allowed" : "pointer", fontSize: 13
          }}
        >
          📷
        </button>
      </div>

      {/* Upload controls */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{userName}</div>

        {uploading ? (
          <div>
            <div style={{ fontSize: 13, color: textMuted, marginBottom: 6 }}>Uploading... {progress}%</div>
            <div style={{ background: surface2, borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: accent, borderRadius: 6, transition: "width 0.3s" }} />
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "#ede9fe", color: accent, border: "none",
                borderRadius: 8, padding: "7px 16px", cursor: "pointer",
                fontWeight: 600, fontSize: 13, marginBottom: 4, display: "block"
              }}
            >
              📷 {preview ? "Change Photo" : "Upload Photo"}
            </button>
            <div style={{ fontSize: 11, color: textMuted }}>JPG, PNG · Max 5MB</div>
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>❌ {error}</div>}
        {success && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 6 }}>✅ Photo saved successfully!</div>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
}

// Small uploader for student list rows
export function SmallPhotoUploader({ userId, currentPhotoURL, userName, collectionName = "students", onUploadComplete, dark }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentPhotoURL || null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef(null);
  const accent = "#4f46e5";

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Max file size is 5MB"); return; }

    setUploading(true);
    setDone(false);

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    try {
      const url = await uploadToCloudinary(file, null);
      await updateDoc(doc(db, collectionName, userId), { photoURL: url });
      setPreview(url);
      setDone(true);
      setUploading(false);
      if (onUploadComplete) onUploadComplete(url);
    } catch (err) {
      alert("Upload failed: " + err.message);
      setUploading(false);
    }
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }} title="Click 📷 to upload student photo">
      <Avatar name={userName} size={44} photoURL={preview} />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        title="Upload photo"
        style={{
          position: "absolute", bottom: -2, right: -2,
          width: 20, height: 20, borderRadius: "50%",
          background: done ? "#22c55e" : uploading ? "#94a3b8" : accent,
          border: "2px solid #fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          fontSize: 9, color: "#fff", fontWeight: 700
        }}
      >
        {uploading ? "⏳" : done ? "✅" : "📷"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
