// ============================================================
// SeenKa - Cloudinary Photo Deletion Utility
// ============================================================

const CLOUDINARY_CLOUD_NAME = "dqjkfjgxc";

export function extractPublicId(cloudinaryUrl) {
  if (!cloudinaryUrl || !cloudinaryUrl.includes("cloudinary.com")) return null;
  try {
    const url = new URL(cloudinaryUrl);
    const parts = url.pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    const afterUpload = parts.slice(uploadIdx + 1);
    const versionRemoved = afterUpload[0]?.startsWith("v") && /^v\d+$/.test(afterUpload[0])
      ? afterUpload.slice(1) : afterUpload;
    const joined = versionRemoved.join("/");
    return joined.replace(/\.[^/.]+$/, "");
  } catch { return null; }
}

export function collectStudentPhotoURLs(students) {
  return students
    .filter(s => s.photoURL && s.photoURL.includes("cloudinary.com"))
    .map(s => ({
      studentName: s.name || "Unknown",
      photoURL: s.photoURL,
      publicId: extractPublicId(s.photoURL),
    }));
}

export function generateDeletionReport(photos) {
  if (!photos.length) return null;
  return {
    cloudName: CLOUDINARY_CLOUD_NAME,
    totalPhotos: photos.length,
    publicIds: photos.map(p => p.publicId).filter(Boolean),
    manualDeleteUrl: `https://console.cloudinary.com/console/${CLOUDINARY_CLOUD_NAME}/media_library/folders/edutrack`,
    instructions: [
      "1. Go to your Cloudinary Media Library",
      "2. Navigate to: edutrack/profiles/students/",
      "3. Select the student folders listed",
      "4. Click Delete to remove the photos",
    ],
    photos,
  };
}

export async function tryDeleteCloudinaryPhoto(publicId) {
  if (!publicId) return false;
  try {
    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("upload_preset", "edutrack_uploads");
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
      { method: "POST", body: formData }
    );
    const data = await res.json();
    return data.result === "ok";
  } catch { return false; }
}

export async function deleteStudentPhotos(students) {
  const photos = collectStudentPhotoURLs(students);
  if (!photos.length) return { deleted: 0, failed: 0, manual: 0, report: null };

  let deleted = 0;
  const failedPhotos = [];

  for (const photo of photos) {
    if (!photo.publicId) { failedPhotos.push(photo); continue; }
    const success = await tryDeleteCloudinaryPhoto(photo.publicId);
    if (success) deleted++;
    else failedPhotos.push(photo);
  }

  const report = failedPhotos.length > 0 ? generateDeletionReport(failedPhotos) : null;
  return { deleted, failed: failedPhotos.length, manual: failedPhotos.length, report };
}
