import React, { useState } from "react";
import { Upload, X, Eye, Download } from "lucide-react";
import { PhotoItem } from "../types.ts";

interface PhotosViewProps {
  photos: PhotoItem[];
  onUploadPhoto?: (file: File) => void;
}

export const PhotosView: React.FC<PhotosViewProps> = ({ photos, onUploadPhoto }) => {
  const [tab, setTab] = useState<"all" | "albums" | "recent">("all");
  const [activePhoto, setActivePhoto] = useState<PhotoItem | null>(null);

  const filtered = photos.filter((p) => {
    if (tab === "albums") return p.album !== "";
    return true;
  });

  return (
    <div
      className="animate-fade-in"
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "48px 32px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            className="font-serif"
            style={{
              fontSize: "28px",
              fontWeight: 500,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            Photos
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Visual inspirations and media library
          </p>
        </div>

        {/* Upload Button */}
        <label className="btn-primary" style={{ cursor: "pointer" }}>
          <Upload size={16} /> + Upload
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0] && onUploadPhoto) {
                onUploadPhoto(e.target.files[0]);
              }
            }}
          />
        </label>
      </div>

      {/* Tabs (Matching Figma: All, Albums, Recent) */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "32px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
        <button
          onClick={() => setTab("all")}
          style={{
            background: "transparent",
            border: "none",
            color: tab === "all" ? "var(--accent)" : "var(--text-secondary)",
            fontSize: "13px",
            fontWeight: tab === "all" ? 600 : 400,
            cursor: "pointer",
          }}
        >
          All
        </button>
        <button
          onClick={() => setTab("albums")}
          style={{
            background: "transparent",
            border: "none",
            color: tab === "albums" ? "var(--accent)" : "var(--text-secondary)",
            fontSize: "13px",
            fontWeight: tab === "albums" ? 600 : 400,
            cursor: "pointer",
          }}
        >
          Albums
        </button>
        <button
          onClick={() => setTab("recent")}
          style={{
            background: "transparent",
            border: "none",
            color: tab === "recent" ? "var(--accent)" : "var(--text-secondary)",
            fontSize: "13px",
            fontWeight: tab === "recent" ? 600 : 400,
            cursor: "pointer",
          }}
        >
          Recent
        </button>
      </div>

      {/* Grid Layout (4 columns matching Figma artboard) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "20px",
        }}
      >
        {filtered.map((photo) => (
          <div
            key={photo.id}
            onClick={() => setActivePhoto(photo)}
            style={{
              position: "relative",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              aspectRatio: "16/10",
              cursor: "pointer",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.02)";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <img
              src={photo.url}
              alt={photo.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "24px 12px 8px 12px",
                background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {photo.name}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          onClick={() => setActivePhoto(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "32px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "#FFFFFF" }}>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>{activePhoto.name}</span>
              <button
                onClick={() => setActivePhoto(null)}
                className="btn-icon"
                style={{ color: "#FFFFFF" }}
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={activePhoto.url}
              alt={activePhoto.name}
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                borderRadius: "var(--radius-md)",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
