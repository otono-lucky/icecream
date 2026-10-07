#!/usr/bin/env node
// Manage who can sign in to the admin website. Admins sign in with a code emailed to them.
//   npm run admin -- add <email> "<name>"      give someone access
//   npm run admin -- disable <email>           take access away (their history is kept)
//   npm run admin -- enable <email>            give it back
//   npm run admin -- list                      everyone with access
// Works on the local database. Add --remote to change the live one.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const [command, rawEmail, name] = args.filter((arg) => arg !== "--remote");
const email = rawEmail?.trim().toLowerCase();
const sql = (value) => `'${String(value).replace(/'/g, "''")}'`;

function d1(statement) {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "icecream-db", remote ? "--remote" : "--local", "--json", "--command", statement],
    { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return JSON.parse(output)[0];
}

const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
const where = remote ? "live" : "local";

if (command === "add" && validEmail && name?.trim()) {
  d1(
    `INSERT INTO admins (id, email, name, created_at) VALUES (${sql(randomUUID())}, ${sql(email)}, ${sql(name.trim())}, ${Date.now()})
     ON CONFLICT (email) DO UPDATE SET name = excluded.name, disabled_at = NULL`,
  );
  console.log(`${name.trim()} <${email}> can now sign in to the ${where} admin website.`);
} else if ((command === "disable" || command === "enable") && validEmail) {
  const { meta } = d1(
    `UPDATE admins SET disabled_at = ${command === "disable" ? Date.now() : "NULL"} WHERE email = ${sql(email)}`,
  );
  if (!meta.changes) {
    console.error(`No admin with the email ${email}.`);
    process.exit(1);
  }
  // Disabling also ends any session they have open.
  if (command === "disable") d1(`DELETE FROM admin_sessions WHERE admin_id IN (SELECT id FROM admins WHERE email = ${sql(email)})`);
  console.log(`${email} ${command === "disable" ? "can no longer" : "can again"} sign in to the ${where} admin website.`);
} else if (command === "list") {
  const { results } = d1("SELECT name, email, disabled_at FROM admins ORDER BY created_at");
  if (!results.length) console.log(`No admins yet. Add one: npm run admin -- add you@example.com "Your Name"`);
  for (const admin of results) console.log(`${admin.name} <${admin.email}>${admin.disabled_at ? "  (disabled)" : ""}`);
} else {
  console.log('Usage: npm run admin -- add <email> "<name>" | disable <email> | enable <email> | list   [--remote]');
  process.exit(1);
}
