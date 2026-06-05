import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

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

  console.log("\n✅ Seed complete!");
  console.log("\n📝 Demo tenants:");
  console.log(`   - ${tenant1.name}: slug="${tenant1.slug}", id="${tenant1.id}"`);
  console.log(`   - ${tenant2.name}: slug="${tenant2.slug}", id="${tenant2.id}"`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
