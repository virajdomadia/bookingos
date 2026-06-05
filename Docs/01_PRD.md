**PRODUCT REQUIREMENTS DOCUMENT**

**Multi-Tenant SaaS Booking System**

Version 1.0 · Viraj Patil

Portfolio Project --- Freelance + Job Switch

**1. Purpose & Problem Statement**

Independent service businesses in India --- clinics, salons, coaching
institutes, fitness studios --- manage appointments through WhatsApp
messages, paper diaries, or phone calls. This creates double-bookings,
no-shows without notice, and zero visibility into their schedule for
customers.

Existing SaaS solutions (Calendly, SimplyBook, Acuity) charge
₹1,500--5,000/month per business and are not localised for Indian
phone/timezone conventions. This project delivers a self-hosted,
white-label booking platform where a developer (you) runs one deployment
and sells subdomain-based instances to multiple independent businesses.

**2. Goals**

**Business Goals**

-   Demonstrate a complete, deployable fullstack product to freelance
    clients and hiring managers

-   Serve as the foundation for real freelance revenue --- a live clinic
    or salon pays ₹8,000--20,000 for setup

-   Prove multi-tenancy, auth, and database isolation concepts in
    interviews

**User Goals**

-   Business owners: replace WhatsApp-based booking with a professional
    system that runs itself

-   Customers: book an appointment without calling, get an email
    confirmation, reschedule without friction

-   Staff: see the day\'s schedule in one view, not scattered across
    three messaging apps

**3. User Personas**

  ------------- ------------- ------------------- -------------------------
  **Persona**   **Role**      **Primary Need**    **Pain Today**

  Dr. Anita     Clinic Owner  See all             Receptionist misses
                (Tenant)      appointments, avoid WhatsApp messages
                              double-bookings     

  Ravi          Salon Staff   View today\'s       Has to call owner every
                              bookings, mark      morning for schedule
                              complete            

  Priya         Customer /    Book at 11pm        Clinic is closed when she
                Booker        without calling     has time to call

  Viraj         Super Admin   Onboard new         None --- this is the
                (You)         tenants, monitor    operator dashboard
                              usage               
  ------------- ------------- ------------------- -------------------------

**4. Scope --- Version 1.0**

**In Scope**

-   Tenant registration and subdomain provisioning

-   Public booking flow at \[tenant\].yourdomain.com

-   Service catalogue management (admin)

-   Schedule configuration: working days, hours, breaks, slot interval

-   Real-time availability calculation (no double-booking)

-   Booking confirmation and reminder emails via Resend

-   Admin dashboard: view, confirm, cancel, complete bookings

-   Staff accounts with role-based access (Owner / Admin / Staff)

-   Customer cancel/reschedule via email link

-   Super-admin panel: view tenants, activate/deactivate

**Out of Scope --- V1**

-   Online payments (Razorpay integration --- V2)

-   SMS notifications --- V2

-   Multi-staff scheduling (one staff calendar per tenant in V1)

-   Waitlist management

-   Custom domain (tenant brings their own domain --- V2)

-   Native mobile app --- permanently OUT OF SCOPE for all three
    portfolio projects. The public booking flow is mobile-responsive
    (works in any phone browser at 375px) but there is no React Native,
    Expo, or app store component. When pitching to clients: \"works on
    any phone without downloading anything\" is the correct framing.

**5. Functional Requirements**

**FR-01: Tenant Onboarding**

-   A new tenant signs up with business name, email, password, and
    desired slug

-   System validates slug uniqueness and provisions subdomain routing

-   Default schedule created: Mon--Sat, 09:00--18:00, 30-min slots

-   Confirmation email sent to tenant owner

**FR-02: Public Booking Flow**

-   Step 1 --- Customer visits \[slug\].yourdomain.com, sees service
    list

-   Step 2 --- Selects a service, sees available dates (blocked =
    greyed)

-   Step 3 --- Picks a time slot from the available list

-   Step 4 --- Fills name, email, phone, optional notes

-   Step 5 --- Sees confirmation page with booking details

-   Step 6 --- Receives confirmation email with .ics calendar attachment
    and cancel link

**FR-03: Admin Dashboard**

-   Login at \[slug\].yourdomain.com/admin

-   Home: count of today\'s bookings, upcoming 7 days, and pending
    confirmations

-   Calendar view: day / week toggle, click booking to see detail

-   List view: filter by status, date range, service

-   Booking actions: Confirm, Cancel (with reason), Mark Complete, Add
    Note

-   Service CRUD: name, description, duration, price (optional)

-   Schedule settings: working days, start/end time, break windows, slot
    interval

-   Staff management: invite by email, assign role, deactivate

-   Branding: upload logo, set primary colour

**FR-04: Notifications (Resend)**

  ------------------ --------------- ----------------------------------------
  **Trigger**        **Recipient**   **Contents**

  Booking created    Customer        Booking summary, service, date/time,
                                     cancel link, .ics file

  Booking created    Admin           New booking alert with customer details

  Booking confirmed  Customer        Confirmation, reminder of appointment
                                     details

  Booking cancelled  Customer        Cancellation confirmed, invitation to
                                     rebook

  Booking cancelled  Admin           Cancellation alert with reason

  24hr reminder      Customer        Reminder with date/time and cancel link
  ------------------ --------------- ----------------------------------------

**6. Non-Functional Requirements**

-   Response time: all API endpoints respond in under 500ms under normal
    load

-   Availability: target 99.5% uptime using Railway managed hosting

-   Data isolation: tenant data isolation enforced by Postgres Row-Level
    Security at the database layer --- not just application WHERE
    clauses. Verified by integration test before go-live.

-   Security: passwords hashed with bcrypt (12 rounds minimum), JWTs
    rotated every 15 minutes, refresh tokens httpOnly cookie only

-   Mobile responsive: booking flow must work on a 375px viewport

-   Accessibility: semantic HTML, keyboard navigable booking flow

**7. Success Metrics**

  ---------------------- ------------------ -------------------------------
  **Metric**             **Target**         **How to Measure**

  Time to complete a     \< 90 seconds      Manual walkthrough timing
  booking                                   

  Booking confirmation   \< 30 seconds      Timestamp comparison
  email                                     

  Availability           Zero duplicate     Concurrent booking load test
  calculation accuracy   bookings under 50  
                         concurrent users   
                         --- verified by    
                         load test before   
                         claiming           
                         production-ready   

  Portfolio demo         1 paying client in Track outreach responses
  conversion             60 days            
  ---------------------- ------------------ -------------------------------

**8. Constraints**

-   Budget: zero --- all hosting on free tiers (Vercel, Railway free,
    Resend free 3,000 emails/month)

-   Timeline: realistic estimate 70--100 hours (35--50 days at 2hr/day).
    Original 56-hour estimate assumed zero integration issues --- that
    is not realistic. Budget: Backend 25--35hr + Frontend 25--35hr +
    Emails/Deploy 6--10hr + Bug fixing 10--20hr.

-   Solo developer --- no QA team, no design team, no PM

-   Domain: one cheap domain (\~₹700/year) required for wildcard
    subdomain DNS

**9. Assumptions & Risks**

  -----------------------------------------------------------------------
  **Assumptions**

  • One staff member per tenant is sufficient for V1 --- salons and
  clinics with one practitioner

  • English UI is acceptable for the demo; localisation is V2

  • Railway free tier sustains portfolio-level traffic without throttling

  • Platform is web-only for all three portfolio projects.
  Mobile-responsive does not mean native app.

  • Primary freelance target: personal trainers, yoga instructors,
  tutors, photographers, consultants. NOT clinics first --- easier to
  acquire, simpler workflows, fewer legal concerns. Move to healthcare
  clients after 2-3 non-healthcare clients are live.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Risks**

  • Subdomain wildcard SSL certificates require domain registrar support
  --- verify before buying domain

  • Resend free tier (3,000 emails/month) is sufficient for demo but
  verify before pitching to real clients

  • RLS policy misconfiguration could create data leakage --- must be
  covered by integration tests before launch

  • V1 deliberately omits: tenant billing, monitoring/alerting, database
  backups beyond Railway defaults, GDPR data export, support workflow.
  These are real SaaS concerns --- budget 60+ additional hours before
  charging recurring fees.

  • Concurrent booking claim requires load test validation. Do not claim
  \"no double-bookings\" without passing 50-user concurrent test first.
  -----------------------------------------------------------------------
