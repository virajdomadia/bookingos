import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create test tenants
  const tenant1 = await prisma.tenant.upsert({
    where: { slug: "demo-clinic" },
    update: {},
    create: {
      id: "tenant_demo_clinic",
      name: "Demo Clinic",
      slug: "demo-clinic",
      primaryColor: "#3B82F6",
    },
  });

  const tenant2 = await prisma.tenant.upsert({
    where: { slug: "test-salon" },
    update: {},
    create: {
      id: "tenant_test_salon",
      name: "Test Salon",
      slug: "test-salon",
      primaryColor: "#EC4899",
    },
  });

  // Create schedules
  await prisma.schedule.upsert({
    where: { tenantId: tenant1.id },
    update: {},
    create: {
      id: "schedule_1",
      tenantId: tenant1.id,
      timezone: "Asia/Kolkata",
      workStart: "09:00",
      workEnd: "18:00",
      slotInterval: 30,
    },
  });

  await prisma.schedule.upsert({
    where: { tenantId: tenant2.id },
    update: {},
    create: {
      id: "schedule_2",
      tenantId: tenant2.id,
      timezone: "Asia/Kolkata",
      workStart: "10:00",
      workEnd: "20:00",
      slotInterval: 30,
    },
  });

  // Create services for clinic
  await prisma.service.createMany({
    data: [
      {
        id: "service_1",
        tenantId: tenant1.id,
        name: "General Consultation",
        durationMinutes: 30,
        price: 500,
      },
      {
        id: "service_2",
        tenantId: tenant1.id,
        name: "Extended Consultation",
        durationMinutes: 60,
        price: 1000,
      },
      {
        id: "service_3",
        tenantId: tenant1.id,
        name: "Follow-up",
        durationMinutes: 15,
        price: 300,
      },
    ],
    skipDuplicates: true,
  });

  // Create services for salon
  await prisma.service.createMany({
    data: [
      {
        id: "service_4",
        tenantId: tenant2.id,
        name: "Haircut",
        durationMinutes: 45,
        price: 600,
      },
      {
        id: "service_5",
        tenantId: tenant2.id,
        name: "Hair Color",
        durationMinutes: 90,
        price: 2000,
      },
      {
        id: "service_6",
        tenantId: tenant2.id,
        name: "Facial",
        durationMinutes: 60,
        price: 1500,
      },
    ],
    skipDuplicates: true,
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
