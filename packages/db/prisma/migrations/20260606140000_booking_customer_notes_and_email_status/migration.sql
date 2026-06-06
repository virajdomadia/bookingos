-- F4 prep: customer-supplied notes on a booking (optional free text from the
-- public booking form), and a saner default for the email status. Nothing is
-- sent at creation time until F6, so a fresh booking is "PENDING", not "SENT".
ALTER TABLE "Booking" ADD COLUMN "customerNotes" TEXT;
ALTER TABLE "Booking" ALTER COLUMN "confirmationEmailStatus" SET DEFAULT 'PENDING';
