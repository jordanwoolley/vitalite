"use client";
import React, { useState, useTransition } from "react";

export default function UserListWithDob({ users }: { users: any[] }) {
  const [dobValues, setDobValues] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <ul style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {users.map((u) => (
        <li key={u.id} style={{ fontSize: "0.9rem" }}>
          <span style={{ fontWeight: 500 }}>{u.name || u.stravaAthleteId}</span>
          {u.dob ? (
            <form
              action={`/api/sync?userId=${u.id}`}
              method="post"
              style={{ display: "inline" }}
            >
              <button
                type="submit"
                style={{ marginLeft: "0.4rem", padding: "0.2rem 0.5rem", borderRadius: 4, border: "1px solid #333", background: "#f7f7f7", cursor: "pointer" }}
              >
                Sync
              </button>
            </form>
          ) : (
            <>
              <input
                type="date"
                value={dobValues[u.id] || ""}
                onChange={e => setDobValues({...dobValues, [u.id]: e.target.value })}
                style={{ marginLeft: "0.4rem", padding: "0.2rem 0.5rem", borderRadius: 4, border: "1px solid #333", background: "#f7f7f7" }}
                disabled={pending}
              />
              <button
                onClick={async () => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      const response = await fetch("/api/user/dob", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: u.id, dob: dobValues[u.id] }),
                      });
                      if (!response.ok) throw new Error("Failed to save DOB");
                      window.location.reload();
                    } catch (e) {
                      setError("Failed to save date of birth.");
                    }
                  });
                }}
                disabled={!dobValues[u.id] || pending}
                style={{ marginLeft: "0.4rem", padding: "0.2rem 0.5rem", borderRadius: 4, border: "1px solid #333", background: "#f7f7f7", cursor: pending ? "not-allowed" : "pointer" }}
              >
                Save
              </button>
              {error && (
                <span style={{ color: "#b00", marginLeft: 8, fontSize: "0.85em" }}>{error}</span>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
