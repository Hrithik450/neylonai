"use client";

import React from "react";

export default function ResumeUploader() {
  const [file, setFile] = React.useState<File | null>(null);
  const [message, setMessage] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first!");
      return;
    }

    setLoading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/resume-assistant/api/v1/generate-resume/",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage(`Upload successful! Download: ${data.message}`);
      } else {
        setMessage(`Error: ${data.error || "Upload failed"}`);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setMessage("Something went wrong while uploading.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-40">
      <h2>Upload Your Resume</h2>
      <input type="file" accept=".pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Uploading..." : "Upload"}
      </button>
      <p>{message}</p>
    </div>
  );
}
