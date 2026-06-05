import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create test tenants
  const tenant1 = await prisma.tenant.create({
    data: {
      name: "Demo Clinic",
      slug: "demo-clinic",
      primaryColor: "#3B82F6",
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: "Test Salon",
      slug: "test-salon",
      primaryColor: "#EC4899",
    },
  });

  // Create schedules
  await prisma.schedule.create({
    data: {
      tenantId: tenant1.id,
      timezone: "Asia/Kolkata",
      workStart: "09:00",
      workEnd: "18:00",
      slotInterval: 30,
    },
  });

  await prisma.schedule.create({
    data: {
      tenantId: tenant2.id,
      timezone: "Asia/Kolkata",
      workStart: "10:00",
      workEnd: "20:00",
      slotInterval: 30,
    },
  });

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
