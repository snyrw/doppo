"use client";

import { useEffect, useState } from "react";
import { useSession, updateUser, changeEmail, changePassword, listAccounts } from "../../lib/auth-client";
import { shouldShowPasswordChange } from "../../lib/account-ui";

const inputCls = "box-border w-full rounded-md border border-card-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none";
const btnCls = "btn-accent cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50";

export default function AccountSection() {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user.name ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    listAccounts().then((res) => {
      const accounts = (res.data ?? []) as { providerId: string }[];
      setShowPw(shouldShowPasswordChange(accounts));
    }).catch(() => {});
  }, []);

  const saveName = async () => {
    const { error } = await updateUser({ name });
    setMsg(error ? (error.message ?? "Unknown error") : "Name updated.");
  };
  const sendEmailChange = async () => {
    const { error } = await changeEmail({ newEmail, callbackURL: "/projects?settings=account" });
    setMsg(error ? (error.message ?? "Unknown error") : "Check your current inbox to confirm the change.");
  };
  const savePassword = async () => {
    const { error } = await changePassword({ currentPassword: curPw, newPassword: newPw, revokeOtherSessions: true });
    setMsg(error ? (error.message ?? "Unknown error") : "Password updated.");
    if (!error) { setCurPw(""); setNewPw(""); }
  };

  return (
    <div className="flex flex-col gap-6">
      {msg && <p className="m-0 text-xs text-muted">{msg}</p>}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase tracking-[0.08em] text-muted">Display name</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        <button className={btnCls + " self-start"} onClick={saveName}>Save name</button>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase tracking-[0.08em] text-muted">Email — current: {session?.user.email}</label>
        <input className={inputCls} type="email" placeholder="New email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <button className={btnCls + " self-start"} onClick={sendEmailChange} disabled={!newEmail}>Send confirmation</button>
      </div>
      {showPw && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.08em] text-muted">Change password</label>
          <input className={inputCls} type="password" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
          <input className={inputCls} type="password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <button className={btnCls + " self-start"} onClick={savePassword} disabled={!curPw || !newPw}>Update password</button>
        </div>
      )}
    </div>
  );
}
