import { config } from "dotenv";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Fixed seed ensuring deterministic data generation and stable demo links. */
const RANDOM_SEED = 20260908;
const TOTAL_MEMBERS = 12_400;
const EVENTS_PER_BRANCH = { min: 28, max: 42 };
const HISTORY_MONTHS = 18;
const DEMO_PASSWORD = "membrio-demo";

const NOW = new Date("2026-09-08T00:00:00.000Z");
if (Number.isNaN(NOW.getTime())) {
  throw new Error(`Invalid NOW constant in seed.ts — check the ISO string`);
}
const HISTORY_START = new Date(NOW);
HISTORY_START.setMonth(HISTORY_START.getMonth() - HISTORY_MONTHS);
const FUTURE_END = new Date(NOW);
FUTURE_END.setMonth(FUTURE_END.getMonth() + 2);

const BRANCH_SEEDS = [
  {
    code: "SKP",
    name: "Skopje",
    city: "Skopje",
    country: "North Macedonia",
    weight: 16,
  },
  {
    code: "TET",
    name: "Tetovo",
    city: "Tetovo",
    country: "North Macedonia",
    weight: 11,
  },
  {
    code: "GOS",
    name: "Gostivar",
    city: "Gostivar",
    country: "North Macedonia",
    weight: 8,
  },
  {
    code: "KUM",
    name: "Kumanovo",
    city: "Kumanovo",
    country: "North Macedonia",
    weight: 7,
  },
  {
    code: "OHR",
    name: "Ohrid",
    city: "Ohrid",
    country: "North Macedonia",
    weight: 6,
  },
  {
    code: "BIT",
    name: "Bitola",
    city: "Bitola",
    country: "North Macedonia",
    weight: 7,
  },
  {
    code: "STR",
    name: "Struga",
    city: "Struga",
    country: "North Macedonia",
    weight: 5,
  },
  {
    code: "PRN",
    name: "Prishtina",
    city: "Prishtina",
    country: "Kosovo",
    weight: 14,
  },
  {
    code: "PRZ",
    name: "Prizren",
    city: "Prizren",
    country: "Kosovo",
    weight: 9,
  },
  {
    code: "TIR",
    name: "Tirana",
    city: "Tirana",
    country: "Albania",
    weight: 10,
  },
  {
    code: "SHK",
    name: "Shkoder",
    city: "Shkodër",
    country: "Albania",
    weight: 4,
  },
  {
    code: "ULC",
    name: "Ulcinj",
    city: "Ulcinj",
    country: "Montenegro",
    weight: 3,
  },
] as const;

const FIRST_NAMES = [
  "Arben",
  "Blerta",
  "Driton",
  "Elira",
  "Fatmir",
  "Gentiana",
  "Ilir",
  "Jeta",
  "Kushtrim",
  "Lira",
  "Mirjeta",
  "Nderim",
  "Orhan",
  "Pranvera",
  "Rina",
  "Shpend",
  "Teuta",
  "Valon",
  "Xhemal",
  "Zana",
  "Aleksandar",
  "Biljana",
  "Dejan",
  "Elena",
  "Filip",
  "Gordana",
  "Igor",
  "Jasmina",
  "Kristina",
  "Ljubica",
  "Marko",
  "Natasha",
  "Ognen",
  "Petar",
  "Radmila",
  "Stefan",
  "Tamara",
  "Vlatko",
  "Zoran",
  "Milena",
  "Amar",
  "Ajla",
  "Emir",
  "Lejla",
  "Nikos",
  "Eleni",
  "Danilo",
  "Ivana",
];

const LAST_NAMES = [
  "Krasniqi",
  "Berisha",
  "Hoxha",
  "Gashi",
  "Shala",
  "Rexhepi",
  "Bytyqi",
  "Morina",
  "Zeqiri",
  "Ademi",
  "Sulejmani",
  "Ismaili",
  "Stojanovski",
  "Petrovski",
  "Nikolov",
  "Jovanovska",
  "Todorov",
  "Angelovski",
  "Ristovski",
  "Dimitrov",
  "Trajkovska",
  "Velkovski",
  "Mitrevski",
  "Popovski",
  "Hadzhi",
  "Osmani",
  "Ferati",
  "Dervishi",
  "Kastrati",
  "Lleshi",
  "Nushi",
  "Prifti",
  "Cela",
  "Basha",
  "Mema",
  "Hasani",
];

const EVENT_TEMPLATES = [
  "Albanian Language Workshop",
  "Traditional Dance Rehearsal",
  "Youth Debate Night",
  "Documentary Screening",
  "Folk Music Evening",
  "Community Volunteer Day",
  "Photography Workshop",
  "Poetry Reading",
  "Heritage Walking Tour",
  "General Assembly",
  "Youth Leadership Training",
  "Craft Workshop",
  "Book Club Meeting",
  "Intercultural Dialogue Forum",
  "Summer Camp Briefing",
  "Choir Practice",
  "Theatre Workshop",
  "Digital Skills Session",
];

/** Attendance behavior profiles used to generate realistic signal data for AI features */
const ENGAGEMENT_PROFILES = [
  { name: "core", weight: 0.12, pull: 6.0 },
  { name: "regular", weight: 0.28, pull: 3.0 },
  { name: "casual", weight: 0.35, pull: 1.0 },
  { name: "lapsed", weight: 0.25, pull: 0.25 },
] as const;

type EngagementProfile = (typeof ENGAGEMENT_PROFILES)[number]["name"];

/** Monthly multipliers modeling seasonal fluctuations in attendance */
const SEASONAL_MULTIPLIER: Record<number, number> = {
  0: 0.85,
  1: 1.0,
  2: 1.05,
  3: 1.0,
  4: 0.95,
  5: 0.8,
  6: 0.55,
  7: 0.45,
  8: 0.9,
  9: 1.1,
  10: 1.05,
  11: 0.7,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Deterministic weighted sampling without replacement using the Efraimidis-Spirakis algorithm
 * key = U^(1/w), take the top k.
 */
function weightedSample<T>(
  items: T[],
  weightOf: (item: T) => number,
  k: number,
): T[] {
  if (k >= items.length) return [...items];
  return items
    .map((item) => ({
      item,
      key: Math.pow(
        faker.number.float({ min: 1e-9, max: 1, fractionDigits: 9 }),
        1 / Math.max(weightOf(item), 1e-6),
      ),
    }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map((entry) => entry.item);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  if (
    process.env.NODE_ENV === "production" &&
    !process.env.ALLOW_PRODUCTION_SEED
  ) {
    throw new Error(
      "Refusing to seed with NODE_ENV=production. Set ALLOW_PRODUCTION_SEED=1 to override.",
    );
  }

  faker.seed(RANDOM_SEED);
  faker.setDefaultRefDate(NOW);

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  const started = Date.now();
  console.log("Truncating existing data…");
  await db.execute(sql`
    truncate table
      ${schema.attendance},
      ${schema.auditLogs},
      ${schema.events},
      ${schema.members},
      ${schema.userBranches},
      ${schema.accounts},
      ${schema.sessions},
      ${schema.verificationTokens},
      ${schema.users},
      ${schema.branches}
    restart identity cascade
  `);

  // -- Branches -------------------------------------------------------------

  const branchRows: (typeof schema.branches.$inferInsert)[] = BRANCH_SEEDS.map(
    (seed) => ({
      id: faker.string.uuid(),
      code: seed.code,
      slug: slugify(seed.name),
      name: seed.name,
      city: seed.city,
      country: seed.country,
      timezone: "Europe/Skopje",
      address: `${faker.location.streetAddress()}, ${seed.city}`,
      foundedOn: faker.date.between({ from: "2009-01-01", to: "2020-12-31" }),
      isActive: true,
    }),
  );

  await db.insert(schema.branches).values(branchRows);
  console.log(`Inserted ${branchRows.length} branches.`);

  // -- Users ----------------------------------------------------------------

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const userRows: (typeof schema.users.$inferInsert)[] = [];
  const assignmentRows: (typeof schema.userBranches.$inferInsert)[] = [];

  const superAdminId = faker.string.uuid();
  userRows.push({
    id: superAdminId,
    name: "Ardita Krasniqi",
    email: "admin@membrio.demo",
    emailVerified: NOW,
    passwordHash,
    role: "super_admin",
    isActive: true,
  });

  // Maps branch IDs to staff to cover single and multi-branch scoping scenarios
  const staffByBranch = new Map<string, string[]>();

  branchRows.forEach((branch, index) => {
    const adminId = faker.string.uuid();
    const first = faker.helpers.arrayElement(FIRST_NAMES);
    const last = faker.helpers.arrayElement(LAST_NAMES);

    userRows.push({
      id: adminId,
      name: `${first} ${last}`,
      email: `admin.${branch.slug}@membrio.demo`,
      emailVerified: NOW,
      passwordHash,
      role: "branch_admin",
      isActive: true,
    });
    assignmentRows.push({
      userId: adminId,
      branchId: branch.id!,
      assignedByUserId: superAdminId,
    });

    // Stores branch staff IDs to attribute manual check-ins
    const branchStaff: string[] = [];
    for (let s = 0; s < 2; s += 1) {
      const staffId = faker.string.uuid();
      const sFirst = faker.helpers.arrayElement(FIRST_NAMES);
      const sLast = faker.helpers.arrayElement(LAST_NAMES);
      userRows.push({
        id: staffId,
        name: `${sFirst} ${sLast}`,
        email: `staff${s + 1}.${branch.slug}@membrio.demo`,
        emailVerified: NOW,
        passwordHash,
        role: "staff",
        isActive: index !== branchRows.length - 1 || s === 0,
      });
      assignmentRows.push({
        userId: staffId,
        branchId: branch.id!,
        assignedByUserId: superAdminId,
      });
      branchStaff.push(staffId);
    }
    staffByBranch.set(branch.id!, branchStaff);
  });

  const regionalScopes = [
    {
      name: "Rina Hoxha",
      email: "regional.kosovo@membrio.demo",
      codes: ["PRN", "PRZ"],
    },
    {
      name: "Valon Ademi",
      email: "regional.west@membrio.demo",
      codes: ["TET", "GOS", "STR"],
    },
  ];

  for (const regional of regionalScopes) {
    const regionalId = faker.string.uuid();
    userRows.push({
      id: regionalId,
      name: regional.name,
      email: regional.email,
      emailVerified: NOW,
      passwordHash,
      role: "branch_admin",
      isActive: true,
    });
    for (const code of regional.codes) {
      const branch = branchRows.find((b) => b.code === code);
      if (!branch?.id) continue;
      assignmentRows.push({
        userId: regionalId,
        branchId: branch.id,
        assignedByUserId: superAdminId,
      });
    }
  }

  await db.insert(schema.users).values(userRows);
  await db.insert(schema.userBranches).values(assignmentRows);
  console.log(
    `Inserted ${userRows.length} users and ${assignmentRows.length} branch assignments.`,
  );

  // -- Members --------------------------------------------------------------

  type SeedMember = {
    id: string;
    branchId: string;
    joinedOn: Date;
    engagement: EngagementProfile;
    pull: number;
    /** Cutoff date after which a lapsed member stops attending */
    activeUntil: Date | null;
  };

  const totalWeight = BRANCH_SEEDS.reduce((sum, b) => sum + b.weight, 0);
  const memberRows: (typeof schema.members.$inferInsert)[] = [];
  const seedMembers: SeedMember[] = [];

  branchRows.forEach((branch, branchIndex) => {
    const branchSeed = BRANCH_SEEDS[branchIndex]!;
    const count = Math.round((TOTAL_MEMBERS * branchSeed.weight) / totalWeight);

    for (let i = 1; i <= count; i += 1) {
      const id = faker.string.uuid();
      const firstName = faker.helpers.arrayElement(FIRST_NAMES);
      const lastName = faker.helpers.arrayElement(LAST_NAMES);

      const joinedOn = faker.date.between({
        from: branch.foundedOn as Date,
        to: NOW,
      });

      const profile = faker.helpers.weightedArrayElement(
        ENGAGEMENT_PROFILES.map((p) => ({ weight: p.weight, value: p })),
      );

      const status = faker.helpers.weightedArrayElement([
        { weight: 0.78, value: "active" as const },
        { weight: 0.12, value: "inactive" as const },
        { weight: 0.08, value: "alumni" as const },
        { weight: 0.02, value: "suspended" as const },
      ]);

      const activeUntil =
        profile.name === "lapsed"
          ? faker.date.between({ from: joinedOn, to: NOW })
          : null;

      const hasEmail = faker.number.float({ min: 0, max: 1 }) > 0.12;
      const slugName = `${slugify(firstName)}.${slugify(lastName)}`;

      memberRows.push({
        id,
        branchId: branch.id!,
        memberCode: `BCN-${branch.code}-${String(i).padStart(5, "0")}`,
        firstName,
        lastName,
        email: hasEmail
          ? `${slugName}${faker.number.int({ min: 1, max: 999 })}@example.org`
          : null,
        phone: `+3897${faker.number.int({ min: 0, max: 9 })} ${faker.string.numeric(6)}`,
        dateOfBirth: toDateString(
          faker.date.birthdate({ mode: "age", min: 15, max: 62 }),
        ),
        status,
        joinedOn: toDateString(joinedOn),
        notes:
          faker.number.float({ min: 0, max: 1 }) > 0.88
            ? faker.lorem.sentence({ min: 5, max: 12 })
            : null,
        createdAt: joinedOn,
        updatedAt: joinedOn,
      });

      seedMembers.push({
        id,
        branchId: branch.id!,
        joinedOn,
        engagement: profile.name,
        pull: status === "suspended" ? 0.01 : profile.pull,
        activeUntil,
      });
    }
  });

  for (const batch of chunk(memberRows, 500)) {
    await db.insert(schema.members).values(batch);
  }
  console.log(`Inserted ${memberRows.length} members.`);

  const membersByBranch = new Map<string, SeedMember[]>();
  for (const member of seedMembers) {
    const list = membersByBranch.get(member.branchId) ?? [];
    list.push(member);
    membersByBranch.set(member.branchId, list);
  }

  // -- Events ---------------------------------------------------------------

  type SeedEvent = {
    id: string;
    branchId: string;
    startsAt: Date;
    capacity: number;
    isPast: boolean;
    cancelled: boolean;
    /** Event draw score, independent of general member engagement. */
    popularity: number;
  };

  const eventRows: (typeof schema.events.$inferInsert)[] = [];
  const seedEvents: SeedEvent[] = [];

  for (const branch of branchRows) {
    const count = faker.number.int(EVENTS_PER_BRANCH);
    const branchAdmin = userRows.find(
      (u) => u.email === `admin.${branch.slug}@membrio.demo`,
    );

    for (let i = 0; i < count; i += 1) {
      const id = faker.string.uuid();
      const startsAt = faker.date.between({
        from: HISTORY_START,
        to: FUTURE_END,
      });
      startsAt.setUTCHours(faker.number.int({ min: 16, max: 20 }), 0, 0, 0);

      const endsAt = new Date(startsAt);
      endsAt.setUTCHours(
        endsAt.getUTCHours() + faker.number.int({ min: 1, max: 4 }),
      );

      const isPast = startsAt < NOW;
      const cancelled = isPast && faker.number.float({ min: 0, max: 1 }) < 0.04;

      const status: (typeof schema.eventStatusEnum.enumValues)[number] =
        cancelled
          ? "cancelled"
          : isPast
            ? "completed"
            : faker.number.float({ min: 0, max: 1 }) < 0.2
              ? "draft"
              : "scheduled";

      const capacity = faker.number.int({ min: 40, max: 260 });

      eventRows.push({
        id,
        branchId: branch.id!,
        title: `${faker.helpers.arrayElement(EVENT_TEMPLATES)} — ${branch.city}`,
        description: faker.lorem.paragraph({ min: 2, max: 4 }),
        location: `${faker.location.streetAddress()}, ${branch.city}`,
        startsAt,
        endsAt,
        capacity,
        status,
        checkInToken: faker.string.uuid(),
        createdByUserId: branchAdmin?.id ?? superAdminId,
        createdAt: new Date(startsAt.getTime() - 1000 * 60 * 60 * 24 * 21),
        updatedAt: startsAt,
      });

      seedEvents.push({
        id,
        branchId: branch.id!,
        startsAt,
        capacity,
        isPast,
        cancelled,
        popularity: faker.number.float({
          min: 0.05,
          max: 0.22,
          fractionDigits: 4,
        }),
      });
    }
  }

  for (const batch of chunk(eventRows, 500)) {
    await db.insert(schema.events).values(batch);
  }
  console.log(`Inserted ${eventRows.length} events.`);

  // -- Attendance -----------------------------------------------------------

  const attendanceRows: (typeof schema.attendance.$inferInsert)[] = [];

  for (const event of seedEvents) {
    if (!event.isPast || event.cancelled) continue;

    const branchMembers = membersByBranch.get(event.branchId) ?? [];
    const eligible = branchMembers.filter(
      (m) =>
        m.joinedOn <= event.startsAt &&
        (m.activeUntil === null || event.startsAt <= m.activeUntil),
    );
    if (eligible.length === 0) continue;

    const seasonal = SEASONAL_MULTIPLIER[event.startsAt.getUTCMonth()] ?? 1;
    const target = Math.min(
      event.capacity,
      Math.max(5, Math.round(eligible.length * event.popularity * seasonal)),
    );

    const attendees = weightedSample(eligible, (m) => m.pull, target);
    const staff = staffByBranch.get(event.branchId) ?? [];

    for (const attendee of attendees) {
      // Arrivals cluster around the door opening, with a long tail of latecomers.
      const offsetMinutes = faker.number.int({ min: -25, max: 70 });
      const checkedInAt = new Date(
        event.startsAt.getTime() + offsetMinutes * 60_000,
      );

      const method = faker.helpers.weightedArrayElement([
        { weight: 0.78, value: "qr" as const },
        { weight: 0.2, value: "manual" as const },
        { weight: 0.02, value: "import" as const },
      ]);

      attendanceRows.push({
        eventId: event.id,
        memberId: attendee.id,
        checkedInAt,
        method,
        checkedInByUserId:
          method === "qr" ? null : (faker.helpers.arrayElement(staff) ?? null),
        note:
          faker.number.float({ min: 0, max: 1 }) > 0.97
            ? faker.lorem.sentence({ min: 3, max: 8 })
            : null,
      });
    }
  }

  for (const batch of chunk(attendanceRows, 1000)) {
    await db.insert(schema.attendance).values(batch);
  }
  console.log(`Inserted ${attendanceRows.length} attendance records.`);

  // -- Audit logs -----------------------------------------------------------

  const adminUsers = userRows.filter((u) => u.role !== "staff");
  const auditRows: (typeof schema.auditLogs.$inferInsert)[] = [];

  for (let i = 0; i < 1800; i += 1) {
    const actor = faker.helpers.arrayElement(adminUsers);
    const branch = faker.helpers.arrayElement(branchRows);
    const action = faker.helpers.weightedArrayElement([
      { weight: 0.34, value: "create" as const },
      { weight: 0.3, value: "update" as const },
      { weight: 0.08, value: "soft_delete" as const },
      { weight: 0.03, value: "restore" as const },
      { weight: 0.09, value: "export" as const },
      { weight: 0.16, value: "login" as const },
    ]);

    const entityType =
      action === "login"
        ? "user"
        : faker.helpers.arrayElement(["member", "event"]);

    auditRows.push({
      actorUserId: actor.id!,
      action,
      entityType,
      entityId: action === "login" ? actor.id! : faker.string.uuid(),
      branchId: action === "login" ? null : branch.id!,
      summary: `${actor.name} performed ${action} on ${entityType}`,
      metadata: { source: "seed", ua: "seed-script/1.0" },
      createdAt: faker.date.between({ from: HISTORY_START, to: NOW }),
    });
  }

  for (const batch of chunk(auditRows, 1000)) {
    await db.insert(schema.auditLogs).values(batch);
  }
  console.log(`Inserted ${auditRows.length} audit log entries.`);

  console.log(
    `\nSeed complete in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  console.log("─".repeat(56));
  console.log(`Super admin      admin@membrio.demo / ${DEMO_PASSWORD}`);
  console.log(
    `Branch admin     admin.skopje-center@membrio.demo / ${DEMO_PASSWORD}`,
  );
  console.log(
    `Regional admin   regional.kosovo@membrio.demo / ${DEMO_PASSWORD}`,
  );
  console.log(
    `Staff            staff1.skopje-center@membrio.demo / ${DEMO_PASSWORD}`,
  );
  console.log("─".repeat(56));

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
