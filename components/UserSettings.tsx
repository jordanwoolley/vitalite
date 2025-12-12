"use client";
import React, { useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  stravaAthleteId: number;
  dob?: string;
};

export default function UserSettings({
  users,
  authUrl, // kept for compatibility, not used (no “connect another” link)
}: {
  users: User[];
  authUrl: string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (users.length === 0) return null;

  const primaryUser = users[0];

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setShowMenu((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.4rem 0.8rem",
          borderRadius: 4,
          border: "1px solid #333",
          background: "transparent",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        <span>{primaryUser.name || `User ${primaryUser.stravaAthleteId}`}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="16px"
          viewBox="0 -960 960 960"
          width="16px"
          fill="#1f1f1f"
        >
          <path d="M480-360 280-560h400L480-360Z" />
        </svg>
      </button>

      {showMenu && (
        <>
          {/* overlay to close */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
            }}
            onClick={() => setShowMenu(false)}
          />

          {/* menu */}
          <div
            style={
              isMobile
                ? {
                    position: "fixed",
                    top: 76,
                    left: 12,
                    right: 12,
                    background: "white",
                    border: "1px solid #ccc",
                    borderRadius: 8,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                    zIndex: 999,
                    padding: "0.75rem",
                    maxHeight: "70vh",
                    overflowY: "auto",
                  }
                : {
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "0.25rem",
                    background: "white",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    zIndex: 999,
                    width: 420,
                    maxWidth: "90vw",
                    padding: "0.75rem",
                  }
            }
          >
            <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>
              Settings
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {users.map((u) => {
                const needsDob = !u.dob;

                return (
                  <div
                    key={u.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 8,
                      padding: "0.75rem",
                    }}
                  >
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      {u.name || `User ${u.stravaAthleteId}`}
                    </div>

                    {/* DOB form */}
                    <form
                      action="/api/user/dob"
                      method="post"
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <input type="hidden" name="userId" value={u.id} />
                      <input
                        type="date"
                        name="dob"
                        defaultValue={u.dob ?? ""}
                        required
                        style={{
                          padding: "0.35rem 0.5rem",
                          fontSize: "0.9rem",
                          border: "1px solid #ccc",
                          borderRadius: 6,
                          flex: 1,
                          minWidth: 160,
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          padding: "0.35rem 0.6rem",
                          fontSize: "0.9rem",
                          background: "#f6f8fa",
                          border: "1px solid #ccc",
                          borderRadius: 6,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Save DOB
                      </button>
                    </form>

                    {needsDob && (
                      <div style={{ fontSize: "0.85rem", color: "#b00", marginBottom: "0.6rem" }}>
                        DOB required to score workout points.
                      </div>
                    )}

                    {/* actions */}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <form action={`/api/sync?userId=${u.id}`} method="post" style={{ display: "inline" }}>
                        <button
                          type="submit"
                          disabled={needsDob}
                          title={needsDob ? "Set DOB first" : "Sync this week"}
                          style={{
                            padding: "0.35rem 0.6rem",
                            fontSize: "0.9rem",
                            background: needsDob ? "#f2f2f2" : "#e7f3ff",
                            border: "1px solid #4a90e2",
                            borderRadius: 6,
                            cursor: needsDob ? "not-allowed" : "pointer",
                            color: "#333",
                            opacity: needsDob ? 0.6 : 1,
                          }}
                        >
                          Sync
                        </button>
                      </form>

                      <form
                        action={`/api/user/delete?userId=${u.id}`}
                        method="post"
                        style={{ display: "inline" }}
                        onSubmit={(e) => {
                          if (!confirm("Disconnect this Strava account?")) e.preventDefault();
                        }}
                      >
                        <button
                          type="submit"
                          style={{
                            padding: "0.35rem 0.6rem",
                            fontSize: "0.9rem",
                            background: "#fee",
                            border: "1px solid #fcc",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          Disconnect
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
