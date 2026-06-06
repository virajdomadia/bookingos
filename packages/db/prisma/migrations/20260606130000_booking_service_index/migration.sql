-- F4 availability queries filter/join on serviceId; index prevents full scan.
CREATE INDEX "Booking_serviceId_idx" ON "Booking"("serviceId");
