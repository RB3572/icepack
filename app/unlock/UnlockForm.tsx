"use client";

import { useActionState } from "react";
import { unlockAction, type UnlockState } from "./actions";

const INITIAL: UnlockState = { error: null };

export function UnlockForm() {
  const [state, action, pending] = useActionState(unlockAction, INITIAL);

  return (
    <form action={action}>
      <input
        type="password"
        name="password"
        autoFocus
        autoComplete="current-password"
        aria-label="Password"
        placeholder="Password"
        aria-invalid={state.error ? true : undefined}
        style={{ width: "100%", padding: "7px 9px", fontSize: 14 }}
      />
      {state.error && (
        <p className="error" role="alert" style={{ marginTop: 8 }}>
          {state.error}
        </p>
      )}
      <button
        className="btn"
        type="submit"
        disabled={pending}
        style={{ width: "100%", marginTop: 12, padding: "8px 0" }}
      >
        {pending ? <span className="spin" /> : "Unlock"}
      </button>
    </form>
  );
}
