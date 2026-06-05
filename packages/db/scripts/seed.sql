-- Insert test tenants
INSERT INTO "Tenant" (id, name, slug, "primaryColor", "isActive", "createdAt", "updatedAt")
VALUES
  ('tenant_demo_clinic', 'Demo Clinic', 'demo-clinic', '#3B82F6', true, NOW(), NOW()),
  ('tenant_test_salon', 'Test Salon', 'test-salon', '#EC4899', true, NOW(), NOW());

-- Insert schedules for tenants
INSERT INTO "Schedule" (id, "tenantId", timezone, "workingDays", "workStart", "workEnd", "slotInterval", "breakTimes", "bufferTime", "createdAt", "updatedAt")
VALUES
  ('schedule_1', 'tenant_demo_clinic', 'Asia/Kolkata', '{"mon": true, "tue": true, "wed": true, "thu": true, "fri": true, "sat": false, "sun": false}', '09:00', '18:00', 30, '[]', 0, NOW(), NOW()),
  ('schedule_2', 'tenant_test_salon', 'Asia/Kolkata', '{"mon": true, "tue": true, "wed": true, "thu": true, "fri": true, "sat": true, "sun": false}', '10:00', '20:00', 30, '[]', 0, NOW(), NOW());

-- Insert services for demo clinic
INSERT INTO "Service" (id, "tenantId", name, "durationMinutes", price, "isActive", "isStaffService", "createdAt", "updatedAt")
VALUES
  ('service_1', 'tenant_demo_clinic', 'General Consultation', 30, 500.00, true, false, NOW(), NOW()),
  ('service_2', 'tenant_demo_clinic', 'Extended Consultation', 60, 1000.00, true, false, NOW(), NOW()),
  ('service_3', 'tenant_demo_clinic', 'Follow-up', 15, 300.00, true, false, NOW(), NOW());

-- Insert services for test salon
INSERT INTO "Service" (id, "tenantId", name, "durationMinutes", price, "isActive", "isStaffService", "createdAt", "updatedAt")
VALUES
  ('service_4', 'tenant_test_salon', 'Haircut', 45, 600.00, true, false, NOW(), NOW()),
  ('service_5', 'tenant_test_salon', 'Hair Color', 90, 2000.00, true, false, NOW(), NOW()),
  ('service_6', 'tenant_test_salon', 'Facial', 60, 1500.00, true, false, NOW(), NOW());
