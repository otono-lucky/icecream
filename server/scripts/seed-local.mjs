#!/usr/bin/env node
// Seeds the LOCAL dev database and image storage with verified members from seed/.
// Local only by design: there is no --remote option. Safe to re-run; seed members are replaced.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const women = JSON.parse(readFileSync(join(root, "seed/women.json"), "utf8"));
const MAX_PHOTOS = 6;
const IMAGE_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Finds seed/photos/<key>-1, <key>-2 … (.jpg, .jpeg, .png or .webp), in order. At least one is required. */
function photoFiles(key) {
  const found = [];
  for (let position = 1; position <= MAX_PHOTOS; position++) {
    const match = Object.entries(IMAGE_TYPES)
      .map(([extension, contentType]) => ({ file: join(root, "seed/photos", `${key}-${position}.${extension}`), contentType }))
      .find(({ file }) => existsSync(file));
    if (!match) break;
    found.push(match);
  }
  if (!found.length) throw new Error(`Missing seed/photos/${key}-1.jpg (or .png / .webp).`);
  return found;
}

const now = Date.now();

const sql = (value) => (value === null ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replace(/'/g, "''")}'`);
const row = (values) => `(${values.map(sql).join(", ")})`;

// Seed members are updated in place, never deleted: deleting a member would also delete every chat,
// interest and block other (real, local) members have with them. Only their own photos, checks and
// profile are replaced.
const statements = [
  "DELETE FROM verifications WHERE user_id LIKE 'seed-%'",
  "DELETE FROM photos WHERE user_id LIKE 'seed-%'",
  "DELETE FROM profiles WHERE user_id LIKE 'seed-%'",
];
const uploads = [];

for (const woman of women) {
  const userId = `seed-${woman.key}`;
  statements.push(
    `INSERT INTO users (id, email, status, date_of_birth, first_name, gender, city, id_step_completed_at, created_at, updated_at) VALUES ${row([
      userId, `seed-${woman.key}@example.com`, "active", woman.dateOfBirth, woman.firstName, "woman", woman.city, now, now, now,
    ])}
     ON CONFLICT (id) DO UPDATE SET status = excluded.status, date_of_birth = excluded.date_of_birth,
       first_name = excluded.first_name, gender = excluded.gender, city = excluded.city, updated_at = excluded.updated_at`,
  );
  photoFiles(woman.key).forEach((photo, index) => {
    const position = index + 1;
    const photoId = `${userId}-photo-${position}`;
    const objectKey = `users/${userId}/photos/${photoId}`;
    statements.push(`INSERT INTO photos (id, user_id, object_key, position, created_at) VALUES ${row([photoId, userId, objectKey, position, now])}`);
    uploads.push({ objectKey, ...photo });
  });
  if (woman.profile) {
    const columns = Object.keys(woman.profile);
    statements.push(
      `INSERT INTO profiles (user_id, ${columns.join(", ")}, published_at, updated_at) VALUES ${row([
        userId, ...columns.map((column) => woman.profile[column]), now, now,
      ])}`,
    );
  }
  const firstPhotoKey = `users/${userId}/photos/${userId}-photo-1`;
  statements.push(
    `INSERT INTO verifications (id, user_id, kind, status, document_type, object_key, submitted_at, reviewed_at, reviewed_by) VALUES ${row([
      `${userId}-liveness`, userId, "liveness", "passed", null, firstPhotoKey, now, now, "seed",
    ])}`,
  );
  if (woman.idBadge) {
    statements.push(
      `INSERT INTO verifications (id, user_id, kind, status, document_type, object_key, submitted_at, reviewed_at, reviewed_by) VALUES ${row([
        `${userId}-government-id`, userId, "government_id", "passed", "nin", firstPhotoKey, now, now, "seed",
      ])}`,
    );
  }
}

const wrangler = (args) => execFileSync("npx", ["wrangler", ...args], { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString();

const sqlFile = join(mkdtempSync(join(tmpdir(), "icecream-seed-")), "seed.sql");
writeFileSync(sqlFile, statements.join(";\n") + ";\n");
wrangler(["d1", "execute", "icecream-db", "--local", "--file", sqlFile]);
console.log(`Database: ${women.length} verified women with published profiles (${women.filter((w) => w.idBadge).length} with the ID badge).`);

for (const { objectKey, file, contentType } of uploads) {
  wrangler(["r2", "object", "put", `icecream-media/${objectKey}`, "--local", "--file", file, "--content-type", contentType]);
}
console.log(`Images: ${uploads.length} photos uploaded to local storage.`);
for (const woman of women) console.log(`  seed-${woman.key}  ${woman.firstName}, ${woman.city}`);
