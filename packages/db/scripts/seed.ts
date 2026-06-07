import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Dev-only credentials so the seeded tenants are actually loginable.
const DEMO_PASSWORD = "DemoPass1!";

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // Create test tenants (let CUID generate IDs)
  const tenant1 = await prisma.tenant.upsert({
    where: { slug: "demo-clinic" },
    update: {},
    create: {
      name: "Demo Clinic",
      slug: "demo-clinic",
      primaryColor: "#3B82F6",
    },
  });
  console.log(`✓ Created tenant: ${tenant1.name} (ID: ${tenant1.id})`);

  const tenant2 = await prisma.tenant.upsert({
    where: { slug: "test-salon" },
    update: {},
    create: {
      name: "Test Salon",
      slug: "test-salon",
      primaryColor: "#EC4899",
    },
  });
  console.log(`✓ Created tenant: ${tenant2.name} (ID: ${tenant2.id})`);

  // Create schedules
  const schedule1 = await prisma.schedule.upsert({
    where: { tenantId: tenant1.id },
    update: {},
    create: {
      tenantId: tenant1.id,
      timezone: "Asia/Kolkata",
      workStart: "09:00",
      workEnd: "18:00",
      slotInterval: 30,
    },
  });
  console.log(`✓ Created schedule for ${tenant1.name}`);

  const schedule2 = await prisma.schedule.upsert({
    where: { tenantId: tenant2.id },
    update: {},
    create: {
      tenantId: tenant2.id,
      timezone: "Asia/Kolkata",
      workStart: "10:00",
      workEnd: "20:00",
      slotInterval: 30,
    },
  });
  console.log(`✓ Created schedule for ${tenant2.name}`);

  // Create services for clinic
  const clinicServices = await prisma.service.createMany({
    data: [
      {
        tenantId: tenant1.id,
        name: "General Consultation",
        durationMinutes: 30,
        price: 500,
      },
      {
        tenantId: tenant1.id,
        name: "Extended Consultation",
        durationMinutes: 60,
        price: 1000,
      },
      {
        tenantId: tenant1.id,
        name: "Follow-up",
        durationMinutes: 15,
        price: 300,
      },
    ],
    skipDuplicates: true,
  });
  console.log(`✓ Created ${clinicServices.count} services for ${tenant1.name}`);

  // Create services for salon
  const salonServices = await prisma.service.createMany({
    data: [
      {
        tenantId: tenant2.id,
        name: "Haircut",
        durationMinutes: 45,
        price: 600,
      },
      {
        tenantId: tenant2.id,
        name: "Hair Color",
        durationMinutes: 90,
        price: 2000,
      },
      {
        tenantId: tenant2.id,
        name: "Facial",
        durationMinutes: 60,
        price: 1500,
      },
    ],
    skipDuplicates: true,
  });
  console.log(`✓ Created ${salonServices.count} services for ${tenant2.name}`);

  // Owner users so the demo tenants can actually be logged into.
  await prisma.user.upsert({
    where: { email: "owner@demo-clinic.test" },
    update: {},
    create: { tenantId: tenant1.id, email: "owner@demo-clinic.test", passwordHash, role: "OWNER" },
  });
  await prisma.user.upsert({
    where: { email: "owner@test-salon.test" },
    update: {},
    create: { tenantId: tenant2.id, email: "owner@test-salon.test", passwordHash, role: "OWNER" },
  });
  console.log("✓ Created owner users for both tenants");

  // Demo bookings in varied statuses so the admin dashboard (F5) has data to
  // show. Explicit IDs keep this idempotent (re-running upserts the same rows).
  // Must run BEFORE setup-rls.sql is applied — these inserts have no tenant
  // context and RLS would otherwise block them.
  const dayAt = (offsetDays: number, hour: number) => {
    const d = new Date();
    d.setUTCHours(hour, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d;
  };

  const seedBookings = async (
    slug: string,
    tenantId: string,
    serviceId: string,
    durationMinutes: number
  ) => {
    const rows: Array<{ n: number; offset: number; hour: number; status: string }> = [
      { n: 1, offset: 1, hour: 4, status: "CONFIRMED" }, // tomorrow
      { n: 2, offset: 2, hour: 5, status: "PENDING" },
      { n: 3, offset: -1, hour: 4, status: "COMPLETED" }, // yesterday
      { n: 4, offset: 3, hour: 6, status: "CANCELLED" },
      { n: 5, offset: -2, hour: 8, status: "NO_SHOW" },
    ];
    for (const r of rows) {
      const startsAt = dayAt(r.offset, r.hour);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
      const id = `seed-${slug}-${r.n}`;
      await prisma.booking.upsert({
        where: { id },
        update: {},
        create: {
          id,
          tenantId,
          serviceId,
          customerName: `Demo Customer ${r.n}`,
          customerEmail: `customer${r.n}@example.com`,
          customerPhone: "+919876543210",
          startsAt,
          endsAt,
          status: r.status,
        },
      });
    }
  };

  const clinicService = await prisma.service.findFirst({
    where: { tenantId: tenant1.id },
    orderBy: { createdAt: "asc" },
  });
  const salonService = await prisma.service.findFirst({
    where: { tenantId: tenant2.id },
    orderBy: { createdAt: "asc" },
  });
  if (clinicService) {
    await seedBookings("demo-clinic", tenant1.id, clinicService.id, clinicService.durationMinutes);
  }
  if (salonService) {
    await seedBookings("test-salon", tenant2.id, salonService.id, salonService.durationMinutes);
  }
  console.log("✓ Created demo bookings (varied statuses) for both tenants");

  console.log("\n✅ Seed complete!");
  console.log("\n📝 Demo tenants (login with these):");
  console.log(`   - ${tenant1.name}: owner@demo-clinic.test / ${DEMO_PASSWORD}`);
  console.log(`   - ${tenant2.name}: owner@test-salon.test / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
