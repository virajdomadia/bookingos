**UI / UX BRIEF**

**Multi-Tenant SaaS Booking System**

Design direction · Component decisions · Interaction patterns

**1. Design Philosophy**

This is a product, not a portfolio flex. The UI must answer one question
above all: \"can a 55-year-old clinic owner in a small Indian city
figure out how to use this without a tutorial?\" If yes, the design is
right. If it requires explanation, it is wrong.

  -----------------------------------------------------------------------
  **Three design principles:**

  • Clarity over cleverness --- every element earns its place by reducing
  confusion, not adding visual interest

  • Mobile-responsive booking flow --- customers book on phone browsers;
  the web app must work at 375px. This is not a native app --- it is a
  responsive web application.

  • Trust through consistency --- a product that looks professionally
  made gets paid for; one that looks like a student project does not
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Platform: web-only across all three portfolio projects**

  • All three projects (Booking System, AI Document Q&A, Analytics
  Dashboard) are web applications only.

  • No React Native, Expo, or app store work is in scope for any project.

  • Mobile-responsive (works in phone browser at 375px) is a requirement
  for the booking flow specifically.

  • The admin dashboard is desktop-first. It works on mobile browsers but
  is not optimised for it.

  • Client pitch: \"Works on any device without downloading anything\"
  --- this is a feature, not a limitation.
  -----------------------------------------------------------------------

**2. Two Distinct UI Contexts**

  ---------------- ------------------- ------------------- --------------------
  **Context**      **Users**           **Device**          **Design Priority**

  Public Booking   Customers booking   Mobile-responsive   Clarity, speed,
  Flow             appointments        web (375px+)        minimal friction ---
                                                           3 taps to booking.
                                                           Works in phone
                                                           browser, no app
                                                           download.

  Admin Dashboard  Business owners and Desktop-first web   Information density,
                   staff managing data                     scannable tables,
                                                           quick actions.
                                                           Functional on mobile
                                                           but optimised for
                                                           desktop.
  ---------------- ------------------- ------------------- --------------------

These two contexts are intentionally designed separately. The public
booking flow is a consumer product --- clean, white, generous
whitespace. The admin dashboard is a productivity tool --- more
information on screen, compact tables, sidebar navigation.

**3. Typography**

  ------------ ------------------ ------------ ----------------------------
  **Role**     **Font**           **Weight**   **Usage**

  Display      Inter              700 / 800    Page titles, section
                                               headers, booking
                                               confirmation headline

  Body         Inter              400 / 500    All body text, labels,
                                               descriptions, form hints

  Monospace    JetBrains Mono     400          Time slots, booking
                                               reference codes, price tags

  Brand        Inter              700          Tenant business name in the
                                               top-left of booking pages
  ------------ ------------------ ------------ ----------------------------

Rationale: Inter is the industry standard for product UIs --- legible at
all sizes, excellent at small sizes on mobile, and has no licensing
cost. JetBrains Mono for time slots makes \"10:30 AM\" and \"11:00 AM\"
immediately scannable in a slot list.

**4. Colour System**

**System Palette --- Default (Tenant-Overridable)**

The admin dashboard uses this system palette. The public booking flow
swaps \--brand-primary and \--brand-primary-dark with the tenant\'s
configured colour.

  ----------------------- ---------- ------------------------------------------
  **Token**               **Hex**    **Usage**

  \--brand-primary        #4F46E5    CTA buttons, active nav, slot selection,
                                     focus rings

  \--brand-primary-dark   #4338CA    Button hover state, active pressed

  \--surface              #FFFFFF    All card backgrounds, form backgrounds

  \--surface-raised       #F7F9FC    Page background, sidebar background

  \--surface-sunken       #EEF2FA    Input backgrounds, code blocks

  \--text-primary         #1A2035    All headings and primary body text

  \--text-secondary       #5A6480    Captions, metadata, placeholder text

  \--border               #DEE3EE    All card borders, dividers, input borders

  \--success              #059669    Confirmed status badge, available slot
                                     hover

  \--warning              #D97706    Pending status badge, reminder callouts

  \--danger               #DC2626    Cancelled status badge, error states,
                                     delete actions
  ----------------------- ---------- ------------------------------------------

**5. Component Decisions**

**Booking Flow --- Public**

  --------------- ---------------------- ---------------------------------
  **Component**   **Decision**           **Rationale**

  Service card    Vertical list, not     Most tenants have 3--8 services;
                  grid. Icon + name +    a list is faster to scan than a
                  duration + price.      grid on mobile

  Date picker     Custom calendar grid,  Native date inputs are ugly and
                  not a native input.    non-uniform on Android. Custom
                                         gives consistent UX.

  Time slot       Pill buttons in a      Pills are easy to tap on mobile.
                  2-column grid.         2-column maximises slots visible
                  Unavailable = greyed + without scrolling.
                  disabled.              

  Customer form   Single-column, large   Single-column is fastest on
                  inputs. Phone          mobile. Large inputs reduce
                  optional, clearly      mis-taps.
                  marked.                

  Confirmation    Full-screen success    Reinforces that the action
  page            state with booking     completed. Not a toast --- a full
                  summary card.          page.
  --------------- ---------------------- ---------------------------------

**Admin Dashboard**

  --------------- ---------------------- ---------------------------------
  **Component**   **Decision**           **Rationale**

  Layout          Fixed sidebar          Brittany Chiang pattern ---
                  (240px) + scrollable   always know where you are, nav
                  main content area      always accessible

  Booking list    Table with status      Admins need to scan many bookings
                  badges, customer name, quickly --- tables beat cards for
                  service, time, actions this use case
                  column                 

  Booking detail  Slide-over panel from  Keeps context visible. Admin can
                  right (not a new page) close the panel and go back to
                                         the list instantly

  Status badges   Coloured pill: Pending Status must be readable at a
                  (amber), Confirmed     glance without reading the text
                  (green), Cancelled     
                  (red), Completed       
                  (grey)                 

  Forms           Slide-over panels for  Keeps admin in context; no full
                  create/edit, not       page navigation for CRUD
                  separate pages         operations

  Empty states    Illustration + clear   Empty tables without guidance are
                  CTA (e.g. \"No         confusing for non-technical users
                  services yet --- add   
                  your first service\")  

  Toast messages  Bottom-right, 3-second Confirms actions without
                  auto-dismiss, max 1 at interrupting workflow. Not modal.
                  a time                 
  --------------- ---------------------- ---------------------------------

**6. Key Interaction Patterns**

**Optimistic UI Updates**

When an admin confirms or cancels a booking, the status badge updates
immediately in the UI before the API call completes. If the API call
fails, the badge reverts and an error toast is shown. This makes the
dashboard feel fast.

**Availability Loading State**

When a customer selects a date, a loading skeleton (3--4 grey pill
shapes) replaces the slot list while the availability API call runs. If
the call takes more than 2 seconds, a subtle spinner appears. No
full-page loading states.

**Form Validation**

All validation is inline --- errors appear below the relevant field when
the user blurs it, not on submit. Submitting with errors shakes the form
and scrolls to the first error. Required fields are not marked with
asterisks --- instead, optional fields are explicitly labelled
\"(optional)\".

**Mobile Booking Flow --- Back Navigation**

Each step in the booking flow (service → date → time → details →
confirm) is a separate URL. The browser back button works correctly. No
JavaScript history manipulation. This is critical for usability ---
customers frequently go back to change their service or time.

**7. Accessibility Requirements**

-   All interactive elements reachable and usable via keyboard (Tab,
    Enter, Space, arrow keys on date/time pickers)

-   Colour contrast ratio minimum 4.5:1 for all text on background (WCAG
    AA)

-   Form inputs have visible focus rings --- not hidden

-   Status badges communicate status in text, not colour alone (e.g.
    \"Confirmed\" not just a green dot)

-   All images have alt text; decorative images have empty alt

-   Booking confirmation page announced to screen readers as a success
    message

**8. Responsive Breakpoints**

  ---------------- --------------------- ---------------------------------------
  **Breakpoint**   **Target**            **Key Adaptations**

  375px+           Mobile (primary for   Single column, full-width buttons,
                   booking flow)         bottom-sheet modals

  640px+           Large mobile / small  Slot grid becomes 3 columns, form
                   tablet                inputs side by side

  1024px+          Desktop (primary for  Sidebar appears, table columns expand,
                   admin)                slide-overs

  1280px+          Large desktop         Max content width capped at 1200px,
                                         sidebar widens slightly
  ---------------- --------------------- ---------------------------------------

**9. Page-Level UX Specifications**

**Public Booking Home (Service List)**

-   Header: Tenant logo (if set) + business name. No nav links ---
    nothing to navigate to.

-   Below header: business tagline or \"Book your appointment\" default.

-   Service list: each item is a full-width tap target, minimum 56px
    height.

-   No footer --- keep customer focused on booking, nothing else.

**Admin Dashboard Home**

-   Top of main content: 4 KPI cards --- Today\'s Bookings, This Week,
    Pending Confirmation, Upcoming (next booking).

-   Below KPIs: Upcoming bookings list (next 5), each row shows time,
    customer name, service, status badge.

-   Right side: quick actions panel --- \"Block a time slot\", \"Add
    service\", \"View full calendar\".

**Admin Settings**

-   Grouped into tabs: General (name, logo, colour), Schedule, Services,
    Staff, Danger Zone (delete account).

-   Danger Zone is visually separated with a red border callout ---
    \"This cannot be undone\" warning visible before the button.

**10. Loading and Error Hierarchy**

  ---------------- ---------------------- -------------------------------
  **State**        **Pattern**            **Example**

  Initial page     Skeleton screens       Service list: 3 grey
  load             matching content shape pill-height blocks

  API call in      Spinner inside the     \"Booking\...\" with spinner
  progress         triggering button      instead of \"Confirm booking\"

  API success      Optimistic update or   Status badge turns green, toast
                   redirect + toast       \"Booking confirmed\"

  API error        Toast error + retry    \"Connection lost --- please
  (network)        button                 retry\"

  API error        Inline message in      \"This slot was just taken ---
  (business)       context                choose another time\"

  Empty state      Illustration + single  \"No bookings today --- share
                   CTA                    your booking link to get
                                          started\"

  404 tenant not   Branded error page     \"This booking page doesn\'t
  found            with link to home      exist. Are you looking for
                                          yourdomain.com?\"
  ---------------- ---------------------- -------------------------------

*--- End of UI/UX Brief ---*
