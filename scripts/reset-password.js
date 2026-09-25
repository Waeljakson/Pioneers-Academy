import { connect, query } from "../server/db.js";
import { hashPassword } from "../server/security.js";
const email = process.env.RESET_EMAIL?.toLowerCase();
const password = process.env.RESET_PASSWORD;
if (!email || !password || password.length < 12 || password.length > 128)
  throw new Error(
    "Set RESET_EMAIL and RESET_PASSWORD (12–128 characters) in the server environment",
  );
const { db, close } = connect(process.env.DATABASE_URL_DIRECT);
try {
  await db.transaction(async (tx) => {
    const [u] = await query(
      tx,
      "SELECT id FROM users WHERE email=$1 FOR UPDATE",
      [email],
    );
    if (!u) throw new Error("Account not found");
    await query(tx, "UPDATE users SET password_hash=$1 WHERE id=$2", [
      await hashPassword(password),
      u.id,
    ]);
    await query(tx, "DELETE FROM sessions WHERE user_id=$1", [u.id]);
    await query(
      tx,
      "INSERT INTO audit_logs(user_id,action,entity,record_id) VALUES($1,'operator-password-reset','users',$1)",
      [u.id],
    );
  });
  console.log(
    "Password reset; all sessions revoked. Remove RESET_PASSWORD from environment.",
  );
} finally {
  await close();
}
