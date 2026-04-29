"use server";

import { google } from "googleapis";
import { db } from "@/db";
import { accounts, accountFields, users, userSettings } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

function getSheetsClient() {
  return google.sheets({
    version: "v4",
    auth: new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
          /\\n/g,
          "\n",
        ),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    }),
  });
}

async function getAuthedUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, session.user!.email!),
  });
  if (!user) throw new Error("User not found");
  return user;
}

export async function saveSpreadsheetId(spreadsheetId: string) {
  const user = await getAuthedUser();
  await db
    .insert(userSettings)
    .values({ userId: user.id, spreadsheetId })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { spreadsheetId },
    });
  revalidatePath("/");
}

export async function getSpreadsheetId(): Promise<string | null> {
  const user = await getAuthedUser();
  const settings = await db.query.userSettings.findFirst({
    where: (s, { eq }) => eq(s.userId, user.id),
  });
  return settings?.spreadsheetId ?? null;
}

export async function importFromSheet(): Promise<{ imported: number }> {
  const user = await getAuthedUser();
  const settings = await db.query.userSettings.findFirst({
    where: (s, { eq }) => eq(s.userId, user.id),
  });
  if (!settings?.spreadsheetId) throw new Error("No Google Sheet configured");

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: settings.spreadsheetId,
    range: "Sheet1",
  });

  const rows = res.data.values ?? [];
  if (rows.length < 2) return { imported: 0 };

  const headers = rows[0] as string[];
  const dataRows = rows.slice(1);

  await db.delete(accounts).where(eq(accounts.userId, user.id));

  let imported = 0;
  for (const row of dataRows) {
    const type = (row[0] as string) ?? "";
    const name = (row[1] as string) ?? "";
    if (!name) continue;

    const accountId = nanoid();
    await db
      .insert(accounts)
      .values({ id: accountId, userId: user.id, type, name });

    const fieldColumns = headers.slice(2);
    const fieldValues: (typeof accountFields.$inferInsert)[] = [];

    fieldColumns.forEach((key, i) => {
      const value = (row[i + 2] as string) ?? "";
      let fieldType: "text" | "password" | "pin" | "email" | "phone" = "text";
      const lower = key.toLowerCase();
      if (lower.includes("password")) fieldType = "password";
      else if (lower.includes("pin")) fieldType = "pin";
      else if (lower.includes("email")) fieldType = "email";
      else if (
        lower.includes("phone") ||
        lower.includes("cell") ||
        lower.includes("mobile")
      )
        fieldType = "phone";

      fieldValues.push({
        id: nanoid(),
        accountId,
        fieldKey: key,
        fieldValueCiphertext: Buffer.from(value),
        fieldValueIv: null,
        fieldType,
        sortOrder: i,
      });
    });

    if (fieldValues.length > 0) {
      await db.insert(accountFields).values(fieldValues);
    }
    imported++;
  }

  revalidatePath("/");
  return { imported };
}

export async function exportToSheet(): Promise<{ exported: number }> {
  const user = await getAuthedUser();
  const settings = await db.query.userSettings.findFirst({
    where: (s, { eq }) => eq(s.userId, user.id),
  });
  if (!settings?.spreadsheetId) throw new Error("No Google Sheet configured");

  const allAccounts = await db.query.accounts.findMany({
    where: (a, { eq }) => eq(a.userId, user.id),
    with: { fields: { orderBy: (f, { asc }) => [asc(f.sortOrder)] } },
  });

  const allKeys = new Set<string>();
  allAccounts.forEach((a) => a.fields.forEach((f) => allKeys.add(f.fieldKey)));
  const keyList = Array.from(allKeys);

  const header = ["Type", "Name", ...keyList];
  const dataRows = allAccounts.map((a) => {
    const fieldMap = Object.fromEntries(
      a.fields.map((f) => [f.fieldKey, f.fieldValueCiphertext ? f.fieldValueCiphertext.toString() : ""]),
    );
    return [a.type, a.name, ...keyList.map((k) => fieldMap[k] ?? "")];
  });

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: settings.spreadsheetId,
    range: "Sheet1",
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: settings.spreadsheetId,
    range: "Sheet1!A1",
    valueInputOption: "RAW",
    requestBody: { values: [header, ...dataRows] },
  });

  return { exported: allAccounts.length };
}
