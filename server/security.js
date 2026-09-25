import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString("hex");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password, hash) {
  const [salt, hex] = hash.split(":");
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export const canManage = (role) => ["admin", "academic"].includes(role);
export const canFinance = (role) => ["admin", "finance"].includes(role);
