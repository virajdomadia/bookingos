**APPLICATION FLOW DOCUMENT**

**Multi-Tenant SaaS Booking System**

All user journeys --- Happy paths + edge cases

**Flow 1: Tenant Onboarding (New Business Signs Up)**

Actor: A clinic owner visiting yourdomain.com for the first time.

+-----+----------------------------------------------------------------+
| **  | **Lands on marketing page**                                    |
| 1** |                                                                |
|     | yourdomain.com --- sees headline, 3 feature bullets, \"Start   |
|     | Free\" CTA                                                     |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Clicks \"Start Free\"**                                      |
| 2** |                                                                |
|     | Navigated to /register form: Business Name, Slug               |
|     | (auto-suggested from name), Email, Password                    |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Slug availability check**                                    |
| 3** |                                                                |
|     | As user types slug, debounced API call checks uniqueness.      |
|     | Green tick or red cross shown inline.                          |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Submits registration form**                                  |
| 4** |                                                                |
|     | POST /auth/register --- creates Tenant, User (OWNER role),     |
|     | default Schedule. Returns access token.                        |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Email sent to tenant owner**                                 |
| 5** |                                                                |
|     | Resend sends \"Welcome to \[BusinessName\] --- your booking    |
|     | link is ready\" email with subdomain URL                       |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Redirected to onboarding wizard**                            |
| 6** |                                                                |
|     | /admin/onboarding --- 3-step setup: (1) Add first service, (2) |
|     | Confirm schedule, (3) Customise brand                          |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Onboarding complete**                                        |
| 7** |                                                                |
|     | Redirect to /admin/dashboard --- booking link displayed        |
|     | prominently with copy button                                   |
+-----+----------------------------------------------------------------+

  -----------------------------------------------------------------------
  **Edge cases:**

  • Slug taken → inline error, suggest alternatives (slug-2, slug-clinic,
  slug-bookings)

  • Email already registered → \"An account with this email exists ---
  log in instead\"

  • Network error on submit → form stays filled, toast error, retry
  button
  -----------------------------------------------------------------------

**Flow 2: Customer Books an Appointment**

Actor: Priya, a customer who received the clinic\'s subdomain link from
a receptionist or Google Business listing.

+-----+----------------------------------------------------------------+
| **  | **Visits clinic.yourdomain.com**                               |
| 1** |                                                                |
|     | Next.js middleware detects subdomain \"clinic\", rewrites to   |
|     | /booking/clinic. Tenant branding loaded.                       |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Service selection page**                                     |
| 2** |                                                                |
|     | List of active services with name, duration, and price (if     |
|     | set). Priya taps \"General Consultation -- 30 min\"            |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Date picker shown**                                          |
| 3** |                                                                |
|     | Calendar grid --- past dates greyed, dates with no slots       |
|     | available greyed. Priya selects tomorrow.                      |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Time slot list loads**                                       |
| 4** |                                                                |
|     | GET /public/clinic/availability?serviceId=X&date=Y --- returns |
|     | array of {start, end} slots. Displayed as pills.               |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **No slots available on selected date**                        |
| 5** |                                                                |
|     | If API returns empty array → \"No slots available on this date |
|     | --- try another day\" with next-available-date suggestion.     |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Priya selects 10:30 AM**                                     |
| 6** |                                                                |
|     | Time slot pill highlighted. \"Next: Your details\" button      |
|     | enabled.                                                       |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Customer details form**                                      |
| 7** |                                                                |
|     | Name (required), Email (required), Phone (optional), Notes     |
|     | (optional). No account creation required.                      |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Booking submitted**                                          |
| 8** |                                                                |
|     | POST /public/clinic/bookings --- server runs SELECT FOR UPDATE |
|     | within a SERIALIZABLE transaction. Only creates booking if no  |
|     | conflicting row found. This is database-level enforcement, not |
|     | application code.                                              |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Race condition: slot taken**                                 |
| 9** |                                                                |
|     | If another booking was created between step 6 and step 8 → 409 |
|     | Conflict → \"This slot was just taken. Please choose another   |
|     | time.\" Redirect back to step 4. Enforced at DB level via      |
|     | SERIALIZABLE isolation.                                        |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **1 | **Confirmation page**                                          |
| 0** |                                                                |
|     | Booking summary shown: service, date/time, name, email. Unique |
|     | booking reference displayed.                                   |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **1 | **Confirmation email sent**                                    |
| 1** |                                                                |
|     | Resend: booking details, .ics calendar attachment, cancel link |
|     | (contains cancelToken)                                         |
+-----+----------------------------------------------------------------+

**Flow 3: Admin Views and Manages Bookings**

Actor: Dr. Anita (Owner) logs into her admin dashboard.

+-----+----------------------------------------------------------------+
| **  | **Visits clinic.yourdomain.com/admin**                         |
| 1** |                                                                |
|     | Next.js middleware detects /admin path, does not rewrite.      |
|     | Login page shown if no session.                                |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Login**                                                      |
| 2** |                                                                |
|     | Email + password submitted. POST /auth/login. Access token     |
|     | stored in memory, refresh token in httpOnly cookie.            |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Dashboard home**                                             |
| 3** |                                                                |
|     | Shows: today\'s booking count, next booking (time + customer   |
|     | name), pending confirmations, and week summary chart.          |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Views booking list**                                         |
| 4** |                                                                |
|     | Filtered by Today by default. Toggle to Week/Month. Filter     |
|     | chips: All \| Pending \| Confirmed \| Cancelled.               |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Clicks a booking**                                           |
| 5** |                                                                |
|     | Slide-out panel shows: customer name, email, phone, service,   |
|     | time, notes, status. Action buttons shown.                     |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Confirms a booking**                                         |
| 6** |                                                                |
|     | PATCH /admin/bookings/:id { status: \"CONFIRMED\" } ---        |
|     | booking row updates in place. Confirmation email sent to       |
|     | customer.                                                      |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Cancels a booking**                                          |
| 7** |                                                                |
|     | Modal: \"Reason for cancellation?\" (optional). PATCH with     |
|     | status: \"CANCELLED\". Cancellation email sent to customer.    |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Session expires (15 min)**                                   |
| 8** |                                                                |
|     | Next API call returns 401. Frontend silently calls POST        |
|     | /auth/refresh. If refresh succeeds, original request retried.  |
|     | If refresh fails, redirect to login.                           |
+-----+----------------------------------------------------------------+

**Flow 4: Customer Cancels via Email Link**

Actor: Priya clicks \"Cancel booking\" in her confirmation email.

+-----+----------------------------------------------------------------+
| **  | **Clicks cancel link in email**                                |
| 1** |                                                                |
|     | URL: yourdomain.com/cancel/\[cancelToken\] --- cancelToken is  |
|     | a unique cuid per booking                                      |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Cancel confirmation page**                                   |
| 2** |                                                                |
|     | Shows: booking details. Single large \"Cancel this booking\"   |
|     | button. No login required.                                     |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Token validation**                                           |
| 3** |                                                                |
|     | GET /public/bookings/cancel/:token --- finds booking. If not   |
|     | found or already cancelled, show appropriate message.          |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Booking already cancelled**                                  |
| 4** |                                                                |
|     | If status is already CANCELLED → \"This booking is already     |
|     | cancelled.\" No action taken.                                  |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Customer confirms cancellation**                             |
| 5** |                                                                |
|     | POST /public/bookings/cancel/:token --- status set to          |
|     | CANCELLED. Cancellation emails sent to customer and admin.     |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Success page**                                               |
| 6** |                                                                |
|     | \"Your booking has been cancelled. Want to rebook?\" --- links |
|     | back to the service selection page.                            |
+-----+----------------------------------------------------------------+

**Flow 5: Admin Manages Services and Schedule**

Actor: Dr. Anita wants to add a new service and change lunch break
times.

+-----+----------------------------------------------------------------+
| **  | **Navigates to Services**                                      |
| 1** |                                                                |
|     | /admin/services --- list of active services with duration,     |
|     | price, edit/delete actions                                     |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Creates new service**                                        |
| 2** |                                                                |
|     | \"Add Service\" button → slide-over form: Name, Description,   |
|     | Duration (dropdown: 15/30/45/60/90/120 min), Price (optional)  |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Service appears instantly**                                  |
| 3** |                                                                |
|     | POST /admin/services --- new service appears at bottom of list |
|     | without page reload                                            |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Navigates to Schedule**                                      |
| 4** |                                                                |
|     | /admin/schedule --- shows working days (toggle chips), start   |
|     | time, end time, slot interval, break windows                   |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Adds lunch break**                                           |
| 5** |                                                                |
|     | \"Add Break\" → time range picker: 13:00 -- 14:00. Break       |
|     | appears as a blocked window.                                   |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Saves schedule**                                             |
| 6** |                                                                |
|     | PUT /admin/schedule --- all availability calculations          |
|     | immediately reflect the new break window                       |
+-----+----------------------------------------------------------------+

**Flow 6: Tenant Invites a Staff Member**

Actor: Dr. Anita wants her receptionist Ravi to see bookings without
having full admin access.

+-----+----------------------------------------------------------------+
| **  | **Goes to Staff Management**                                   |
| 1** |                                                                |
|     | /admin/staff --- shows owner account and any existing staff    |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Clicks Invite Staff**                                        |
| 2** |                                                                |
|     | Modal: Email address + Role selector (Admin / Staff). Staff    |
|     | can view and update bookings, not change services or schedule. |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Invitation email sent**                                      |
| 3** |                                                                |
|     | Resend: \"Dr. Anita has invited you to manage bookings at      |
|     | \[clinic name\]. Set your password →\"                         |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Ravi clicks link, sets password**                            |
| 4** |                                                                |
|     | One-time invitation token in URL. POST /auth/accept-invite     |
|     | validates token, sets passwordHash, activates account.         |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Ravi logs in**                                               |
| 5** |                                                                |
|     | Normal login flow. Dashboard shows booking views only ---      |
|     | Services, Schedule, Staff, and Branding tabs hidden.           |
+-----+----------------------------------------------------------------+

**Error States Reference**

  ------------------ ------------------------ ----------------------------
  **Scenario**       **User-Facing Message**  **Technical Response**

  Slot taken during  \"This slot was just     409 Conflict
  booking            booked. Please choose    
                     another time.\"          

  Invalid cancel     \"This cancellation link 404 Not Found
  token              is invalid or has        
                     already been used.\"     

  Tenant slug not    \"We couldn\'t find this 404, custom page
  found              booking page.\"          

  Admin 401 on page  Redirect to /admin/login 401 → client redirect
  load               silently                 

  Service deleted    \"This service is no     410 Gone
  mid-booking        longer available. Please 
                     choose another.\"        

  All slots blocked  \"No times available on  Empty slots array
  (full day)         this date. Try the next  
                     available day.\"         

  Email send failure Booking still created;   Resend webhook + retry
  (Resend)           retry queued. Admin      
                     notified in dashboard.   
  ------------------ ------------------------ ----------------------------

  -----------------------------------------------------------------------
  **Platform note --- all flows are web-only**

  • All flows described in this document are browser-based web
  application flows.

  • There is no native mobile app, React Native, or app store component
  for any of the three portfolio projects.

  • The public booking flow (Flow 2) is mobile-responsive --- it works on
  any phone browser at 375px. This is a responsive web design
  requirement, not a native app.

  • When describing this to clients: \"Your customers can book from any
  device without downloading anything.\"
  -----------------------------------------------------------------------

*--- End of Application Flow Document ---*
