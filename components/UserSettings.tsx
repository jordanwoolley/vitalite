"use client";
import React, { useState } from "react";

type User = {
  id: number;
  name: string;
  stravaAthleteId: number;
  dob?: string | null;
};

export default function UserSettings({
  users,
  authUrl,
}: {
  users: User[];
  authUrl: string;
}) {
  const [showMenu, setShowMenu] = useState(false);

  if (users.length === 0) return null;

  const primaryUser = users[0];

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
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
          {/* click-away overlay */}
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

          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: "0.25rem",
              background: "white",
              border: "1px solid #ccc",
              borderRadius: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              zIndex: 999,
              minWidth: 240,
              padding: "0.5rem 0",
            }}
          >
            <div
              style={{
                padding: "0.5rem 1rem",
                borderBottom: "1px solid #eee",
              }}
            >
              <strong>Settings</strong>
            </div>

            {users.map((u) => {
              const needsDob = !u.dob;

              return (
                <div
                  key={u.id}
                  style={{
                    padding: "0.5rem 1rem",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#666",
                      marginBottom: "0.5rem",
                    }}
                  >
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
                        padding: "0.25rem 0.4rem",
                        fontSize: "0.85rem",
                        border: "1px solid #ccc",
                        borderRadius: 3,
                        flex: 1,
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.85rem",
                        background: "#f6f8fa",
                        border: "1px solid #ccc",
                        borderRadius: 3,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Save DOB
                    </button>
                  </form>

                  {needsDob && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#b00",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Add DOB to enable points from workouts.
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <form
                      action={`/api/sync?userId=${u.id}`}
                      method="post"
                      style={{ display: "inline" }}
                    >
                      <button
                        type="submit"
                        disabled={needsDob}
                        title={needsDob ? "Set DOB first" : "Sync Strava activities"}
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.85rem",
                          background: needsDob ? "#f2f2f2" : "#e7f3ff",
                          border: "1px solid #4a90e2",
                          borderRadius: 3,
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
                        if (!confirm("Disconnect this Strava account?")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <button
                        type="submit"
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.85rem",
                          background: "#fee",
                          border: "1px solid #fcc",
                          borderRadius: 3,
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

            {/* optional connect link if you ever show settings without active user */}
            <div style={{ padding: "0.5rem 1rem" }}>
              <a
                href={authUrl}
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.85rem",
                  border: "1px solid #333",
                  borderRadius: 3,
                  textDecoration: "none",
                  color: "#333",
                }}
              >
                + Connect another Strava account
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
