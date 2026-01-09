Here is the hyper-detailed analysis of the `src/app/` directory, with code-level logic explanations for each file and folder.

---

## `src/app/`

This is the core of the Next.js App Router. All routing, UI pages, and backend API endpoints are defined here. The structure is feature-colocated, meaning routes, UI, and the APIs that serve them are grouped together.

### `src/app/layout.tsx`

* **File:** `src/app/layout.tsx`
* **Purpose:** This is the root layout for the *entire* application. It wraps every single page, public or private.
* **Logic:**
    1.  **Metadata:** Defines the base metadata (like `title` and `description`) for the app, which is used for SEO and the browser tab.
    2.  **Providers:** This file is the "Provider" hub. It wraps the `children` (the rest of the app) with essential context providers:
        * **`ThemeProvider`**: Manages the application's light/dark mode, allowing users to toggle.
        * **`AuthKitProvider`**: (Implicitly required by WorkOS) This would wrap the app to provide client-side session context.
        * **`Toaster`**: This component is included at the root level so that "toast" notifications (e.g., "User created!", "Error!") can be triggered from any component and will render correctly.
    3.  **Styles:** It imports the global stylesheet `globals.css` to apply base styles to the entire application.

You want to update the architectural analysis document to reflect the change made to the root `src/app/page.tsx` file's logic.

---

### `src/app/page.tsx`

* **File:** `src/app/page.tsx`
* **Purpose:** This is the public-facing landing page (the `/` route). It's a **Server Component**.
* **Logic:**
    1.  **Authentication Check:** The page's primary logic is to determine if a user is already authenticated by calling `getTokenClaims()` from WorkOS AuthKit.
    2.  **CRITICAL REDIRECT (Stale Session Fix):** **If a session/claims are detected**, the page no longer renders a client component (`SignedInHomePage`). Instead, it immediately calls `redirect('/dashboard')`. This enforces that **all session validation and expiry checks** are handled by the robust server-side security logic in `src/app/dashboard/layout.tsx`, resolving the issue of rendering a non-functional page with a stale cookie.
    3.  **Conditional Rendering (Signed Out):** If no valid claims are present, it renders the `SignedOutHomePage` component. This component displays a "Sign In" button, initiating the WorkOS login flow.

---

### `src/app/api/` (The Backend)

This folder contains all the application's backend API logic, implemented as Next.js Route Handlers. This is the secure, server-side part of the application.

#### Core Security Principle

Every single API route in this folder follows a critical, multi-tenant security pattern:
1.  **Authentication:** The first step in every handler is to call `getTokenClaims()` from WorkOS AuthKit. This validates the user's session cookie.
2.  **Authorization (Tenancy):** If the claims are valid, the user's `companyId` is fetched from the database (using the `workosUserId` from the claims).
3.  **Data Isolation:** This `companyId` is **always** used as a `where` filter in every Prisma database query (e.g., `prisma.user.findMany({ where: { companyId: user.companyId } })`). This is the core of the multi-tenancy and makes it *impossible* for one company to access another company's data.

#### `src/app/api/me/route.ts`

* **File:** `src/app/api/me/route.ts`
* **Purpose:** The single most important route for client-side authentication. It answers the question, "Who am I?"
* **Logic:**
    1.  **`GET` Handler:** Defines a `GET` function.
    2.  **Get Claims:** Calls `getTokenClaims()` to securely read the user's session cookie.
    3.  **Authorize:** If `claims` or `claims.sub` (the WorkOS User ID) are missing, it returns a 401 Unauthorized error.
    4.  **Database Fetch:** It uses the `claims.sub` to query the database: `prisma.user.findUnique({ where: { workosUserId: claims.sub } })`. This links the WorkOS-authenticated user to your internal database user.
    5.  **Return Data:** It returns the found `currentUser` object (id, email, role, companyId) as JSON. This is what the main `dashboardShell.tsx` component calls to get all its data.

#### `src/app/api/users/`

* **Purpose:** Provides the full CRUD (Create, Read, Update, Delete) API for the User Management page, handling both local database records (Prisma) and WorkOS identity management. It also manages specific credential generation for the mobile apps (Salesman & Technical).
* **`route.ts` (`/api/users`):**
* **`GET`:**
* Fetches all users for the admin's company after validating the session and checking `allowedAdminRoles`.
* Supports a `?current=true` query param to fetch only the logged-in user's profile.

* **`POST`:** Creates a new user and sends an invitation.
1. **Validation:** Manually validates required fields and checks for existing users or pending invites.
2. **Credential Generation:**
* **Salesman:** If the role is executive, it generates a unique `salesmanLoginId` (prefix `EMP-`) and a temporary password.
* **Technical:** If `isTechnical` is true, it generates a unique `techLoginId` (prefix `TSE-`) and a temporary password.

3. **WorkOS Invitation:** Calls `workos.userManagement.sendInvitation()` to create the user in WorkOS and generate an invite token.
4. **Email:** Sends a custom HTML invitation email via **Resend** containing the Invite URL (pointing to Magic Auth) and any generated mobile app credentials.
5. **Database:** Creates or updates the user in Prisma with `status: 'pending'`, storing the `inviteToken` and the generated login IDs.

* **`[userId]/route.ts` (`/api/users/:userId`):**
* **`GET`:** Fetches a single user by ID, ensuring they belong to the admin's company/route.ts].
* **`PUT`:** Updates an existing user.
1. **Validation:** Uses **Zod** (`updateUserSchema`) to validate fields like `firstName`, `role`, `isTechnical`, etc/route.ts].
2. **Dashboard Upgrade:** If `isDashboardUser` is set to true for a user who doesn't have WorkOS access yet, it triggers the WorkOS invitation flow and sends the invite email/route.ts].
3. **Technical Credential Logic:** If `isTechnical` is toggled to `true` (and credentials don't exist):
* It generates a new `techLoginId` and password/route.ts].
* **Specific Notification:** It sends a dedicated "Technical App Credentials" email using **Nodemailer** (via Gmail), distinct from the main invitation email/route.ts].

4. **Dual Update:** Updates the local Prisma database and concurrently updates the WorkOS user profile (syncing attributes like `role`, `region`, `area`)/route.ts].

* **`DELETE`:** Deletes a user. It verifies admin permissions, prevents self-deletion, and removes the user record from the local Prisma database/route.ts].

* **`bulk-invite/route.ts`:**
* **`POST`:** Accepts an array of user objects. It iterates through them, applying the same logic as the single `POST` route (generating Salesman/Technical credentials, sending WorkOS invites, and sending emails via Resend). It handles errors individually and returns a summary of successes and failures (potentially returning a 207 Multi-Status).

* **`app-only/route.ts`:**
* **Purpose:** Creates users who need access *only* to the mobile apps but **not** the dashboard (skipping WorkOS).
* **`POST`:**
1. **Logic:** Validates the admin role and checks for email conflicts.
2. **Credential Generation:** Generates `salesmanLoginId` and/or `techLoginId` based on the role and flags.
3. **Database:** Creates the user in Prisma with `status: 'active'` and `workosUserId: null`.
4. **Email:** Sends the credentials email via **Resend**, but passes an empty string for the `inviteUrl` so no dashboard link is included.

* **`user-locations/route.ts` & `user-roles/route.ts`:**
* **`GET`:** Helper routes for UI filters. They fetch user data for the current company and use Prisma's `distinct` feature to efficiently return unique lists of `region`/`area` or `role`.

#### `src/app/api/dashboardPagesAPI/`

This folder is a key architectural pattern. It doesn't contain generic CRUD logic. Instead, it holds **specialized `GET`, `POST`, `PATCH`, `PUT` and `DELETE` handlers** tailored for specific dashboard pages. This keeps the frontend components "dumb" and fast, as the server handles complex, multi-step logic.

* **`.../reports/` (Folder):**
* Contains a `route.ts` for each report: `competition-reports`, `daily-visit-reports`, `sales-orders`, `technical-visit-reports`.
* **Logic:** Each file defines a `GET` handler that fetches all records for the `currentUser.companyId`. It performs an `include` on the `user` relation to add salesman details (name, role, area, region) to the response, which is then validated against a Zod schema.

* **`.../team-overview/` (Folder):**
* **`dataFetch/route.ts`:** `GET` handler that fetches all users for the team table within the `currentUser.companyId`, supporting an optional `role` filter. It formats the data to include `managedBy` and `manages` strings/arrays.
* **`editRole/route.ts`:** A critical `POST` mutation route.
1. Gets `userId` and `newRole` from the body.
2. Gets the *admin's* role (`currentUserRole`) from `getTokenClaims()`.
3. **RBAC Check:** Performs the most important security check: `if (!canAssignRole(currentUserRole, newRole))`. If this fails, it returns a 403 Forbidden error.
4. **Transaction:** Runs a `prisma.$transaction` to ensure both WorkOS and the local DB are updated.
5. Calls `workos.userManagement.updateOrganizationMembership(...)` and `prisma.user.update(...)` to synchronize the role.

* **`slmLiveLocation/route.ts`:** `GET` handler for the "Live Location" map.
1. Fetches all active `PermanentJourneyPlan` records to identify active salesmen.
2. Makes parallel `axios.get` calls to an *external server* (`process.env.NEXT_PUBLIC_SALESMAN_APP_SERVER_URL`) for each salesman's latest location.
3. Aggregates the results and returns a validated list.

* **`editMapping/route.ts`:** `POST` handler that allows an admin to update a user's `reportsToId` (manager) and `managesIds` (direct reports). It runs a transaction to atomically update all affected user records.
* **`editDealerMapping/route.ts`:**
* **`GET`:** Fetches *all* dealers for the admin's company (with optional `area`/`region` filters) *and* a list of `assignedDealerIds` already mapped to a specific `userId`.
* **`POST`:** Takes a `userId` and a list of `dealerIds`. It un-assigns all dealers from that user and then re-assigns only the dealers in the provided list.

* **`editMasonMapping/route.ts`:**
* **`GET`:** Fetches *all* masons for the company (optionally filtered by area/region via their dealer) and a list of `assignedMasonIds` for a specific user.
* **`POST`:** Similar to dealer mapping, it un-assigns all masons from the user and re-assigns the new list.

* **`.../dealerManagement/` (Folder):**
* **`route.ts`:**
* **`GET`:** Lists all dealers for the `currentUser.companyId` that have `verificationStatus: 'VERIFIED'`.
* **`POST`:** Creates a new dealer, associating it with the `currentUser.id`. It attempts to geocode the address using `OPENCAGE_GEO_API`.
* **`DELETE`:** Removes a dealer based on the `id` query parameter.

* **`dealer-verify/route.ts`:**
* **`GET`:** Lists all dealers for the `currentUser.companyId` that have `verificationStatus: 'PENDING'`.
* **`PUT`:** Takes a `dealerId` from the query param and a `verificationStatus` ("VERIFIED" or "REJECTED") from the body to approve or reject a new dealer.

* **`dealer-brand-mapping/route.ts`:** `GET` handler that fetches all `DealerBrandMapping` records and aggregates them by dealer, creating dynamic keys for each brand name (e.g., `"BrandA": 100`).
* **`dealer-locations/route.ts` & `dealer-types/route.ts`:** `GET` helpers that query the `Dealer` table for `distinct` region, area, and type values to populate UI filter dropdowns.

* **`.../technical-sites/` (Folder):**
* **`route.ts`:** `GET` handler that lists all `TechnicalSite` records linked to the `currentUser.companyId` via the users relationship.

* **`.../masonpc-side/` (Folder):**
* **Purpose:** Provides data for the "Mason/PC Side" of the dashboard, handling data related to Masons, their activities (meetings, schemes), and rewards.
* **`mason-pc/`:**
* **`route.ts` (`GET`):** Fetches all `Mason_PC_Side` records where the associated user belongs to the `currentUser.companyId`.
* **Features:** filters by `kycStatus` (e.g., pending, verified), joins the latest `KYCSubmission`, and normalizes JSONB documents into a usable format for the frontend.

* **`[id]/route.ts` (`PATCH`):** Updates a specific Mason/PC record/route.ts].
* **Logic:** Handles updating assignments (Salesman/Dealer/Site) and KYC Status.
* **Bonus:** If status changes to `VERIFIED`, it triggers `calculateJoiningBonusPoints()` and atomically updates the Mason's point balance and the Points Ledger.

* **`form-options/route.ts` (`GET`):** A helper route that fetches lists of Technical Users, Dealers, and Technical Sites to populate dropdown menus in the Mason edit forms.

* **`bags-lift/`:**
* **`route.ts` (`GET`):** Fetches `BagLift` records.
* **Filter:** Uses a specific `OR` condition to return lifts assigned to the current company **OR** unassigned lifts (where `mason.userId` is null), ensuring no data is lost.
* **Data:** Joins and flattens `masonName`, `dealerName`, and `approverName`.

* **`[id]/route.ts` (`PATCH`):** Handles the Approval or Rejection of a Bag Lift/route.ts].
* **Transaction:** Uses a database transaction to update the status, credit/debit the Mason's balance, and create a `PointsLedger` entry.
* **Calculations:** Triggers `calculateExtraBonusPoints` (for slab milestones) and `checkReferralBonusTrigger` (for referrer rewards) upon approval.

* **`tso-meetings/route.ts` (`GET`):** Lists all `TSOMeeting` records where the `createdBy` user belongs to the `currentUser.companyId`.
* **`schemes-offers/route.ts` (`GET`):** Lists all `SchemesOffers` records. This returns global schemes and is *not* company-filtered.
* **`masonOnMeetings/route.ts` (`GET`):** Lists all `MasonsOnMeetings` (attendance) records where the `mason`'s associated user belongs to the `currentUser.companyId`.
* **`masonOnSchemes/route.ts` (`GET`):** Lists all `MasonOnScheme` (enrollment) records where the `mason`'s associated user belongs to the `currentUser.companyId`.
* **`points-ledger/route.ts` (`GET`):** Lists all `PointsLedger` records filtered by the Mason's company. It flattens the data to include `masonName` for display.
* **`rewards/route.ts` (`GET`):** Lists all `Rewards` records from the master list (not company-filtered) to allow global catalog viewing. Flattens `categoryName`.
* **`reward-categories/route.ts` (`GET`):** Lists all `RewardCategory` records (master list) to populate UI filters.
* **`rewards-redemption/`:**
* **`route.ts` (`GET`):** Lists all `RewardRedemption` records for the `currentUser.companyId` by filtering via the associated mason. Joins and flattens `masonName` and `rewardName`.
* **`[id]/route.ts` (`PATCH`):** Handles the status update of a reward redemption request (e.g., approving, rejecting, shipping)/route.ts].
* **Stock Management:** Automatically deducts stock from `Rewards` when status changes to `approved`. Restores stock if an `approved` order is subsequently `rejected`.
* **Points Management:** Automatically refunds points to the Mason's ledger and balance if a request is `rejected` (whether it was previously approved or just placed).
* **Validation:** Prevents modifying already 'delivered' or 'rejected' orders and checks for insufficient stock before approval.


* **`.../permanent-journey-plan/` (Folder):**
* **`route.ts`:**
* **`GET`:** Lists PJPs with an optional `verificationStatus` filter.
* **`DELETE`:** Deletes a PJP.

* **`pjp-verification/route.ts`:** `GET` handler that lists *only* PJPs with `status: 'PENDING'` or `verificationStatus: 'PENDING'`.
* **`pjp-verification/[id]/route.ts`:**
* **`PUT`:** Updates only the status/verificationStatus (e.g., to 'VERIFIED')/route.ts].
* **`PATCH`:** Allows modification of PJP fields (planDate, area, dealerId/siteId, remarks) and *simultaneously* sets status to 'VERIFIED'.


* **`.../slm-geotracking/route.ts`:**
* **`GET`:** Fetches `GeoTracking` records for the company, including user details.

* **`.../slm-leaves/route.ts`:**
* **`GET`:** Fetches leave applications.
* **`PATCH`:** Updates leave status (Approved/Rejected) and admin remarks.

* **`.../assign-tasks/route.ts`:**
* **`GET`:** Fetches assignable salesmen, dealers, and existing `dailyTasks`.
* **`POST`:** Creates new `DailyTask` records.

* **`.../slm-attendance/route.ts`:**
* **`GET`:** Fetches `SalesmanAttendance` records.

* **`.../update-location/route.ts`:**
* **`POST`:** Updates the `locationName` (address text) of a specific `SalesmanAttendance` record.
* **Security:** Enforces strict role-based access control, allowing only specific roles (e.g., `president`, `general-manager`) to perform this update.
* **Logic:** Validates the input `id` and `address` via Zod and directly updates the database record.

* **`.../scores-ratings/route.ts`:**
* **`GET`:** Fetches `Rating` (for salesmen) or `DealerReportsAndScores` (for dealers) based on the `type` query param.
#### `src/app/api/custom-report-generator/route.ts`

* **`GET`:** The backend for the custom report builder.
* **Logic:** This is a generic, dynamic query builder.
    1.  It reads query parameters: `table`, `columns`, `startDate`, `endDate`, etc.
    2.  It uses a `switch (table)` statement to select the correct Prisma model (e.g., `prisma.dailyVisitReport`, `prisma.salesOrder`).
    3.  It dynamically builds the `where` clause for date ranges and filters.
    4.  It dynamically builds a `select` clause based on the `columns` parameter.
    5.  It runs the query: `prisma[model].findMany({ where, select })` and returns the flat data.

#### Other Root API Routes

* **`src/app/api/company/route.ts`:**
    * **`GET`:** A simple helper that gets the current user's `companyId` (via `getTokenClaims`) and returns their `prisma.company.findUnique(...)` details.
* **`src/app/api/delete-user/route.ts`:**
    * **`POST`:** An *internal* route called by `api/users/[userId]`. It exists to encapsulate the WorkOS SDK call (`workos.userManagement.deleteUser(workosUserId)`) and keep the main `DELETE` logic cleaner.
* **`src/app/api/send-query/route.ts`:**
    * **`POST`:** Powers the "Raise a Query" form. It takes `subject` and `message` from the body. It uses `nodemailer` to create an email transporter and send the query to a hardcoded admin email address.
* **`src/app/api/setup-company/route.ts`:**
    * **`POST`:** The main endpoint for the company onboarding flow.
    * **Logic:** It calls the `createCompanyAndAdmin` function from `lib/company-service.ts`. This single function handles the complex transaction of:
        1.  Calling WorkOS to `createOrganization`.
        2.  Calling WorkOS to `createInvitation` for the admin.
        3.  Creating the `Company` and `User` (admin) in the local Prisma database, linking them all together.
* **`src/app/api/chatbot/chatHistory/route.ts`:**
    * **`POST`:** This is *not* the chat AI endpoint (that's handled by the Vercel AI SDK). This is for *saving* the conversation. It takes the `messages` array and the `chatId` and saves them to the database.

---

### `src/app/auth/`

* **Purpose:** Handles the core authentication redirects from WorkOS.
* **`callback/route.ts`:**
    * **Logic:** This is where WorkOS sends the user back after they log in.
    * It handles the complex logic of running behind a reverse proxy (like Nginx) by checking `x-forwarded-host` headers to build the `correctBaseUrl`.
    * It passes this corrected URL to `handleAuth`, which exchanges the auth `code` for a session cookie and redirects the user to `/dashboard`.
* **`refresh/route.ts`:**
    * **Logic:** An API route used by WorkOS AuthKit to refresh a user's session in the background without requiring a re-login.

---

### `src/app/dashboard/` (The Protected Frontend)

This folder contains all the frontend UI pages and components that are only accessible after logging in. It leverages the "Server Page, Client Component" pattern, where the `page.tsx` file is a Server Component that handles initial auth and data loading, and it renders an interactive Client Component (e.g., `userManagement.tsx`) which contains all the state, event handlers, and client-side data fetching.

### `src/app/dashboard/`

* **`layout.tsx`:**
    * **Purpose:** The root Server Component layout that acts as the primary security and data integrity gate for the dashboard.
    * **Authentication & Sync:**
        * It verifies the WorkOS session via `withAuth`.
        * **Identity Linking:** It ensures the user exists in the local Prisma database. If a user logs in via WorkOS but has no local record, it attempts to link them via email. If that fails, it redirects to `/setup-company`.
        * **Role Sync:** It compares the role in the WorkOS JWT (`claims.role`) with the local database role. If they differ, it updates the local database to match WorkOS.
    * **Security:**
        * **JWT Check:** It checks if the JWT is missing critical data (like `org_id`) and forces a refresh flow if needed.
        * **Access Control:** It validates the user's role against `allowedAdminRoles` and `allowedNonAdminRoles`. If the role is not recognized, it renders a blocking "Access Denied" screen with a logout button.
    * **Rendering:** If authorized, it wraps the children in the `DashboardShell`, passing the synchronized `workosRole`.
* **`dashboardShell.tsx`:**
    * **Purpose:** The interactive Client Component wrapper that provides the persistent UI structure.
    * **Logic:**
        * It initializes the `SidebarProvider` context.
        * It renders the `AppSidebar`, passing the `userRole` so the sidebar can filter menu items based on permissions.
        * It renders the `SiteHeader` and places the page content (`children`) inside the `SidebarInset`.
* **`page.tsx`:**
    * **Purpose:** The main landing view for `/dashboard`.
    * **Logic:** A Server Component that performs specific conditional rendering based on the user's role.
        * **For Executives (Non-Admins):** It detects roles like 'senior-executive' or 'junior-executive' and renders the `<SimpleWelcomePage />`. This prevents them from seeing unauthorized or irrelevant analytics graphs.
        * **For Admins:** It renders the full `<DashboardGraphs />` component, wrapped in a `Suspense` boundary to handle loading states while data is fetched.

* **`dashboardGraphs.tsx`:**
    * **Purpose:** The interactive client component that displays the graphs and stats on the main dashboard page.
    * **Logic:** This is a Client Component (`'use client'`).
    * **Data Fetching**: It contains its own `fetchData` function, which is called in a `useEffect` hook. This function makes parallel, client-side `fetch` calls to multiple API endpoints (`/api/dashboardPagesAPI/slm-geotracking`, `/api/dashboardPagesAPI/reports/daily-visit-reports`, `/api/dashboardPagesAPI/reports/sales-orders`, `/api/users`) to get all the raw data for the dashboard.
    * **State**: It uses `useState` to manage all raw data, loading/error states, and filters (e.g., `selectedRole`, `selectedSalesman`).
    * **Calculation**: It uses `useMemo` to filter and aggregate the raw data based on the selected filters, preparing it for the graphs (e.g., `geoGraphData`, `collectionGraphData`).
    * **Rendering**: It renders `ChartAreaInteractive` components for the graphs and `DataTableReusable` for the tables, passing them the client-side filtered and aggregated data.

* **`data-format.ts`**:
    * **Purpose**: A utility file exporting Zod schemas (e.g., `rawGeoTrackingSchema`, `rawDailyVisitReportSchema`) and inferred TypeScript types (e.g., `RawGeoTrackingRecord`, `RawDailyVisitReportRecord`) for raw API data and aggregated graph data.

* **`src/app/dashboard/assignTasks/`**
    * **`page.tsx`**:
        * **Purpose**: The "Assign Tasks" page.
        * **Logic**: This is a Client Component (`'use client'`).
        * **State**: Manages tasks, salesmen, dealers, loading, and form state (e.g., `selectedSalesmen`, `taskDate`, `visitType`, `selectedDealers`) for creating a new task.
        * **Data Fetching**: In `useEffect`, it calls `fetchAllData` which makes a `fetch` call to `/api/dashboardPagesAPI/assign-tasks` to get data for the dropdowns (salesmen, dealers) and the list of existing tasks. It also uses the `useDealerLocations` hook to get areas and regions for filters.
        * **Mutation**: The `handleSubmit` function validates the form state against `assignTaskFormSchema` and makes a `POST` request to `/api/dashboardPagesAPI/assign-tasks` with the new task data. On success, it shows a toast and re-fetches the tasks.
        * **Rendering**: Renders a `<Dialog>` for the creation form and `DataTableReusable` to display the list of tasks.

* **`src/app/dashboard/dealerManagement/`**
    * **`page.tsx`**:
        * **Purpose**: The server-side entry point for the "Dealer Management" section.
        * **Logic**: This is a Server Component.
        * **RBAC**: It fetches the user's role on the server by calling `getCurrentUserRole()`.
        * It uses `hasPermission()` to check which tabs the user is allowed to see (e.g., `dealerManagement.listDealers`, `dealerManagement.verifyDealers`, `dealerManagement.dealerBrandMapping`).
        * **Data Passing**: It passes these boolean permissions as props to the `<DealerManagementTabs />` client component.
        * If the user has no permissions for this section, it renders an "Access Denied" message.
    * **`tabsLoader.tsx`**:
        * **Purpose**: The client-side container for the "Dealer Management" tabs.
        * **Logic**: This is a Client Component (`'use client'`).
        * **Props**: Receives permission booleans (e.g., `canSeeListDealers`, `canSeeVerifyDealers`) from `page.tsx`.
        * **Rendering**: It renders the shadcn `<Tabs>` component.
        * It conditionally renders the `<TabsTrigger>` and `<TabsContent>` for each sub-page (e.g., `<ListDealersPage />`, `<VerifyDealersPage />`) based on the props it received.
    * **`listDealers.tsx`**:
        * **Purpose**: The client component for the "List Dealers" tab.
        * **Logic**: This is a Client Component (`'use client'`).
        * **State**: Manages data (the list of dealers), loading, and filter states (region, area, type) using `useState`.
        * **Data Fetching**: It has a `fetchDealers` function that fetches from `/api/dashboardPagesAPI/dealerManagement?status=VERIFIED`. This is called inside a `useEffect` hook. It also fetches filter options from `useDealerLocations` and `/api/dashboardPagesAPI/dealerManagement/dealer-types`.
        * **Filtering**: The `filteredDealers` are calculated client-side using `useMemo` based on the filter states.
        * **Mutation**: Includes a "Delete" button in the table. The `handleDelete` function opens a dialog and sends a `DELETE` request to `/api/dashboardPagesAPI/dealerManagement?id=...`.
        * **Rendering**: Renders `DataTableReusable` with the `filteredDealers`.
    * **`verifyDealers.tsx`**:
        * **Purpose**: The client component for the "Verify Dealers" tab.
        * **Logic**: A Client Component (`'use client'`).
        * **Data Fetching**: Its `fetchPendingDealers` function hardcodes a query parameter `?status=PENDING` to ensure it only ever fetches unverified dealers.
        * **Mutation**: Its columns definition for the table includes "Verify" and "Reject" buttons.
            * `handleVerificationAction` makes a `PUT` request to `/api/dashboardPagesAPI/dealerManagement/dealer-verify?id=${dealerId}` with the new status.
            * `handleDeleteDealer` (the "Reject" button) makes a `DELETE` request to `/api/dashboardPagesAPI/dealerManagement?id=${dealerId}`.
        * **Filtering**: Applies client-side filters for name, firm name, and region.
    * **`dealerBrandMapping.tsx`**:
        * **Purpose**: The client component for the "Brand Mapping" tab.
        * **Logic**: A Client Component (`'use client'`).
        * **Data Fetching**: Fetches from `/api/dashboardPagesAPI/dealerManagement/dealer-brand-mapping`.
        * **Dynamic Columns**: It dynamically generates table columns based on the brand names (which are keys in the fetched data object) returned from the API.

* **`src/app/dashboard/masonpcSide/`**
    * **`page.tsx`**:
        * **Purpose**: The server-side entry point for the "Mason/PC Management" section.
        * **Logic**: This is a Server Component.
        * **RBAC**: It fetches the user's role on the server by calling `getCurrentUserRole()`.
        * It uses `hasPermission()` to check for permissions like `masonpcSide.masonpc`, `masonpcSide.tsoMeetings`, `masonpcSide.schemesOffers`, `masonpcSide.bagsLift`, `masonpcSide.pointsLedger`, `masonpcSide.rewardsRedemption`, and `masonpcSide.rewards`.
        * **Data Passing**: It passes all these boolean permissions as props to the `<MasonPcTabs />` client component.
        * If the user has no permissions, it renders an "Access Denied" message.
    * **`tabsLoader.tsx`**:
        * **Purpose**: The client-side container for the "Mason/PC Management" tabs.
        * **Logic**: This is a Client Component (`'use client'`).
        * **Props**: Receives permission booleans (e.g., `canSeeMasonPc`, `canSeeTsoMeetings`, `canSeeBagsLift`, `canSeePointsLedger`, `canSeeRewardsMaster`) from `page.tsx`.
        * **Rendering**: It renders the `<Tabs>` component and conditionally renders the `<TabsTrigger>` and `<TabsContent>` for each sub-page (e.g., `<MasonPcPage />`, `<BagsLiftPage />`, `<RewardsMasterListPage />`) based on the props it received. (Note: `MasonOnSchemesPage` and `MasonOnMeetingsPage` are commented out in this file).
    * **`masonpc.tsx` / `tsoMeetings.tsx` / `schemesOffers.tsx` / `bagsLift.tsx` / `pointsLedger.tsx` / `rewardRedemption.tsx` / `rewards.tsx`**:
        * **Purpose**: These are the client components for each respective tab.
        * **Logic**: They all follow a standard report pattern:
        * **Data Fetching**: `useEffect` calls a data-fetching function (e.g., `fetchMasonPcRecords`, `fetchBagLiftRecords`) that hits its specific API endpoint (e.g., `/api/dashboardPagesAPI/masonpc-side/mason-pc`, `/api/dashboardPagesAPI/masonpc-side/bags-lift`).
        * **Filter Data**: Most also fetch options for filters, like roles and locations (from `/api/users/user-locations` and `/api/users/user-roles`), or categories (from `/api/dashboardPagesAPI/masonpc-side/reward-categories`).
        * **Filtering**: Filters (e.g., search, role, area, region, status, category) are applied client-side using `useMemo`.
        * **Rendering**: They render `DataTableReusable` with paginated data.

* **`src/app/dashboard/permanentJourneyPlan/`**
    * **`page.tsx`**:
        * **Purpose**: The server-side entry point for the PJP section.
        * **Logic**: This is a Server Component that performs RBAC checks.
        * It fetches the user's role and uses `hasPermission()` to check for `permanentJourneyPlan.pjpList` and `permanentJourneyPlan.pjpVerify`.
        * It passes these boolean permissions as props to the `<PermanentJourneyPlanTabs />` client component.
        * If the user has no permissions, it renders an "Access Denied" message.
    * **`tabsLoader.tsx`**:
        * **Purpose**: The client-side container for the PJP tabs.
        * **Logic**: This is a Client Component (`'use client'`).
        * **Props**: Receives `canSeePjpList` and `canSeePjpVerify` as boolean props from `page.tsx`.
        * **Rendering**: It renders the `<Tabs>` component and conditionally renders the "PJP List" and "PJP Verify" triggers and content based on the received props.
    * **`pjpList.tsx`**:
        * **Purpose**: Client component to list and filter PJPs.
        * **Logic**: A Client Component (`'use client'`).
        * **State**: Manages `pjps`, `loading`, `filters` (search, role, status, salesman).
        * **Data Fetching**: Fetches from `/api/dashboardPagesAPI/permanent-journey-plan?verificationStatus=VERIFIED`.
        * **Filtering**: Filters are applied client-side using `useMemo`.
        * **Mutation**: `handleDeletePjp` makes a `DELETE` request to `/api/dashboardPagesAPI/permanent-journey-plan?id=...`.
    * **`pjpVerify.tsx`**:
        * **Purpose**: Client component for managers to approve or reject PJP submissions.
        * **Logic**: A Client Component (`'use client'`).
        * **Data Fetching**: Fetches only pending PJPs from `/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification`. It also calls `fetchLocationsAndDealers` to populate the "Edit & Apply" modal.
        * **Mutation**: The columns definition includes "Verify", "Reject", and "Edit & Apply" buttons.
            * `handleVerificationAction` ("Verify") makes a `PUT` request to the dynamic API route `/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/${pjpId}`.
            * `handlePatchPJP` ("Edit & Apply") makes a `PATCH` request to the same dynamic route with modified PJP data.
            * `handleDeletePjp` ("Reject") makes a `DELETE` request to the base `/api/dashboardPagesAPI/permanent-journey-plan?id=...` route.

* **`src/app/dashboard/reports/`**
    * **`page.tsx`**:
        * **Purpose**: The server-side entry point for the Reports section.
        * **Logic**: A Server Component that performs heavy RBAC checks.
        * It fetches the user's role and uses `hasPermission()` for every report (e.g., `reports.dailyVisitReports`, `reports.salesOrders`, `reports.dvrVpjp`).
        * It passes all these permission booleans as props to the `<ReportsTabs />` client component.
        * If the user can see no reports, it renders an "Access Denied" message.
    * **`tabsLoader.tsx`**:
        * **Purpose**: The client-side container for all report tabs.
        * **Logic**: This is a Client Component (`'use client'`).
        * **Props**: Receives multiple permission booleans (e.g., `canSeeDVR`, `canSeeTVR`, `canSeeDvrVpjp`) from `page.tsx`.
        * **Rendering**: It renders the `<Tabs>` component. It dynamically renders only the `<TabsTrigger>` and `<TabsContent>` for reports the user has permission to see, based on the props.
    * **`dailyVisitReports.tsx` / `salesOrders.tsx` / `technicalVisitReports.tsx` / `competitionReports.tsx`**:
        * **Purpose**: These are the client components for each respective report tab.
        * **Logic**: They all follow the exact same pattern:
        * Client Component (`'use client'`).
        * **State**: Manage `data: any[]`, `loading`, and filter states (search, role, area, region). `competitionReports.tsx` only has search.
        * **Data Fetching**: `useEffect` calls `fetchData` for the report itself (e.g., `fetchReports`, `fetchSalesOrders`). Most also call `fetchLocations` and `fetchRoles` for the filter dropdowns.
        * **Filtering**: Filters are applied client-side using `useMemo` to create the `filteredReports` array.
        * **Rendering**: They render `DataTableReusable` and pass it the paginated, filtered data.
    * **`dvrVpjp.tsx` & `salesVdvr.tsx`**:
        * **Purpose**: These are analytical reports that show ratios.
        * **Logic**: They are also client components that use a custom hook (`useDvrPjpData`) to fetch their data (`sales`, `dvrs`, `filteredPjps`). They have extensive client-side filtering logic (`useMemo`) that re-calculates KPIs (`totalSalesValue`, `salesPerVisit`, `targetAchievementPercentage`) and filtered table data (`filteredSalesData`, `filteredDvrData`, `finalFilteredPjps`) when filters change.

* **`src/app/dashboard/scoresAndRatings/`**
    * **`page.tsx`**:
        * **Purpose**: The server-side entry point for "Scores and Ratings".
        * **Logic**: A Server Component that fetches the user's role.
        * It uses `hasPermission()` to check for `scoresAndRatings.dealerScores` and `scoresAndRatings.salesmanRatings`.
        * It passes these booleans as props to the `<ScoresAndRatingsTabs />` client component.
    * **`tabsLoader.tsx`**:
        * **Purpose**: The client-side container for the "Scores and Ratings" tabs.
        * **Logic**: This is a Client Component (`'use client'`).
        * **Props**: Receives `canSeeSalesmanRatings` and `canSeeDealerScores` as boolean props.
        * **Rendering**: It renders the `<Tabs>` component and conditionally renders the triggers and content for "Salesman Ratings" and "Dealer Scores" based on the props.
    * **`salesmanRatings.tsx`**:
        * **Purpose**: Client component to view salesman ratings.
        * **Logic**: A Client Component (`'use client'`).
        * **Data Fetching**: Fetches from `/api/dashboardPagesAPI/scores-ratings?type=salesman`. Also fetches filter options from `/api/users/user-locations` and `/api/users/user-roles`.
        * **Filtering**: Applies filters for search, role, area, and region client-side via `useMemo`.
    * **`dealerScores.tsx`**:
        * **Purpose**: A client component to display dealer scores.
        * **Logic**: A Client Component (`'use client'`). Fetches from `/api/dashboardPagesAPI/scores-ratings?type=dealer`. Also fetches filter options for locations (`/api/dashboardPagesAPI/dealerManagement/dealer-locations`) and types (`/api/dashboardPagesAPI/dealerManagement/dealer-types`).
        * **Filtering**: Applies filters for search, area, region, and type client-side via `useMemo`.

* **`src/app/dashboard/slmAttendance/`**
    * **`page.tsx`**:
        * **Purpose**: The "Salesman Attendance" report page.
        * **Logic**: A Client Component (`'use client'`).
        * **Pattern**: It follows the standard report pattern: `useState` for data, filters (dateRange, search, role, area, region).
        * **Data Fetching**: `useEffect` calls `fetchAttendanceReports` (which fetches from `/api/dashboardPagesAPI/slm-attendance` with date range) and also `fetchLocations` and `fetchRoles` for filter dropdowns.
        * **Filtering**: Filters are applied client-side using `useMemo`.
        * **Rendering**: Renders `DataTableReusable` and a `<Dialog>` to view full report details.

* **`src/app/dashboard/slmGeotracking/`**
    * **`page.tsx`**:
        * **Purpose**: The "Salesman Journey" tracking page, displayed as a table report.
        * **Logic**: This is a Client Component (`'use client'`).
        * **State**: Manages `tracks`, `loading`, `error`, and filters (search, dateRange, role, area, region).
        * **Data Fetching**: `useEffect` calls `fetchTracks` (which fetches from `/api/dashboardPagesAPI/slm-geotracking` with date range) and also `fetchLocations` and `fetchRoles` for filter dropdowns.
        * **Filtering**: Filters are applied client-side using `useMemo`.
        * **Rendering**: Renders `DataTableReusable` to display the tracking history as a table.

* **`src/app/dashboard/slmLeaves/`**
    * **`page.tsx`**:
        * **Purpose**: The "Salesman Leave" approval page.
        * **Logic**: A Client Component (`'use client'`).
        * **Data Fetching**: Fetches from `/api/dashboardPagesAPI/slm-leaves` with date range. Also fetches filter options from location (`/api/users/user-locations`) and role (`/api/users/user-roles`) endpoints.
        * **Filtering**: Filters (search, date, role, area, region) are applied client-side using `useMemo`.
        * **Mutation**: The `DataTableReusable` has "Accept" and "Reject" buttons for pending leaves.
        * The `handleLeaveAction` function makes a `PATCH` request to `/api/dashboardPagesAPI/slm-leaves`, sending the `id`, new `status`, and `adminRemarks`. It updates the local state on success.

* **`src/app/dashboard/teamOverview/`**
    * **`page.tsx`**:
        * **Purpose**: The server-side entry point for the "Team Overview" section.
        * **Logic**: A Server Component that performs RBAC checks.
        * It fetches the user's role and uses `hasPermission()` to check for `teamOverview.teamTabContent` and `teamOverview.salesmanLiveLocation`.
        * It passes these boolean permissions as props to the `<TeamOverviewTabs />` client component.
        * If the user has no permissions, it renders an "Access Denied" message.
    * **`tabsLoader.tsx`**:
        * **Purpose**: The client-side container for the "Team Overview" tabs.
        * **Logic**: This is a Client Component (`'use client'`).
        * **Props**: Receives `canSeeTeamView` and `canSeeLiveLocation` as boolean props from `page.tsx`.
        * **Rendering**: It renders the `<Tabs>` component and conditionally renders the "Team View" and "Salesman Live Location" triggers and content based on the received props.
    * **`teamTabContent.tsx`**:
        * **Purpose**: The client component for the main "Team" tab, showing hierarchy and allowing edits.
        * **Logic**: A Client Component.
        * **Data Fetching**: Fetches data from `/api/dashboardPagesAPI/team-overview/dataFetch` (with role filter) and the current user's role from `/api/me`.
        * **Mutation (Edit Role)**: The "Edit Role" button opens a popover, checking `canAssignRole` from `roleHierarchy.ts` to determine which roles are assignable. `handleSaveRole` makes a `POST` request to `/api/dashboardPagesAPI/team-overview/editRole`.
        * **Mutation (Edit Mapping)**: The "Edit Mapping" button opens a popover to set `managedBy` and `manages` fields, based on role hierarchy. `handleSaveMapping` makes a `POST` request to `/api/dashboardPagesAPI/team-overview/editMapping`.
        * **Mutation (Edit Dealer Mapping)**: The "Edit Dealer Mapping" button opens a popover that fetches all dealers (with filters) and assigned dealers via a `GET` to `/api/dashboardPagesAPI/team-overview/editDealerMapping`. `handleSaveDealerMapping` makes a `POST` request to the same endpoint.
    * **`salesmanLiveLocation.tsx`**:
        * **Purpose**: The client component for the "Live Location" tab.
        * **Logic**: A Client Component (`'use client'`).
        * **Data Fetching**: `useEffect` fetches from `/api/dashboardPagesAPI/team-overview/slmLiveLocation` on a 30-second interval to get the last known location of all users. It also uses `useUserLocations` to get filters.
        * **Dynamic Import**: It uses `dynamic(() => import('react-leaflet'), { ssr: false })` to load the Leaflet map.
        * **Rendering**: It renders the `<MapContainer>` and then maps over the filtered locations to render a `<Marker>` for each user's last known location.

* **`src/app/dashboard/technicalSites/`**
    * **`page.tsx`**:
        * **Purpose**: The server-side entry point for the "Technical Sites" section.
        * **Logic**: This is a Server Component.
        * **RBAC**: It fetches the user's role on the server by calling `getCurrentUserRole()`.
        * It checks for permission (e.g., `technicalSites.listSites`) or if the role is allowed (e.g., `Admin`, `manager`).
        * **Data Passing**: It passes `canViewSites` as a prop to the `<TechnicalSitesTabs />` client component.
        * If the user has no permissions, it renders an "Access Denied" message.
    * **`tabsLoader.tsx`**:
        * **Purpose**: The client-side container for the "Technical Sites" tabs.
        * **Logic**: This is a Client Component (`'use client'`).
        * **Props**: Receives `canViewSites` boolean prop from `page.tsx`.
        * **Rendering**: It renders the `<Tabs>` component with a "List Sites" tab if authorized.
    * **`listSites.tsx`**:
        * **Purpose**: The client component to display the list of technical sites.
        * **Logic**: This is a Client Component (`'use client'`).
        * **State**: Manages `sites`, `loading`, `error` and filters (search query, region, stage).
        * **Data Fetching**: `useEffect` calls `fetchSites`, which retrieves data from `/api/dashboardPagesAPI/technical-sites`. It also derives available regions and stages for filter dropdowns from the fetched data.
        * **Filtering**: Filters are applied client-side using `useMemo` based on search text and selected dropdown values.
        * **Rendering**: It renders a `DataTableReusable` component with columns for site details (Name, Contact, Phone, Region, Area, Type, Stage, Created On).

#### `src/app/dashboard/users/`

* **`page.tsx`:**
* **Purpose:** The Server Component wrapper that acts as the secure entry point for the User Management page.
* **Logic:**
* **Authentication:** Uses `withAuth` to ensure the user is signed in and `getTokenClaims` to retrieve roles.
* **Data Fetching:** Fetches the full `adminUser` profile (including `company` details) from Prisma using the WorkOS User ID.
* **RBAC (Security):** Strict check against `allowedAdminRoles`. If the user's role is not authorized, they are immediately redirected to `/dashboard`.
* **Rendering:** Passes the fetched `adminUser` object as a prop to the `<UsersManagement />` client component.

* **`userManagement.tsx`:**
* **Purpose:** The main interactive Client Component for viewing and managing users.
* **State & Hooks:**
* Manages local state for `users` list, loading status, filters (Search, Role, Region), and form visibility.
* **`useUserLocations` Hook:** Dynamically fetches available "Regions" and "Areas" to populate dropdowns, ensuring data consistency.

* **CRUD Operations:**
* **Read:** Fetches users via `GET /api/users`.
* **Create (`handleCreateUser`):** Sends a `POST` request to create a standard dashboard user. Displays a success message with generated IDs.
* **Update (`handleUpdateUser`):** Sends a `PUT` request.
* **Dashboard Access:** Includes a specific flow to upgrade an "App-Only" user to a "Dashboard User" (`isDashboardUser: true`), which triggers an invitation email.
* **Device Management:** Includes a "Clear Device ID" action to reset a user's mobile device binding, allowing them to log in on a new phone.

* **Delete (`handleDeleteUser`):** Implements a **Dual-Deletion** strategy:
1. Calls `DELETE /api/users/[id]` to remove the record from the local database.
2. If successful, calls `POST /api/delete-user` to remove the user from WorkOS, ensuring the two systems remain in sync.

* **UI:** Renders `DataTableReusable` with custom columns.
* **Status Logic:** Distinguishes between **Active**, **Pending** (invited but not accepted), and **App-Only** (no WorkOS account, mobile access only).

* **`appOnlyInvite.tsx`:**
* **Purpose:** A specialized Dialog component for creating users who *only* need mobile app access and not the web dashboard.
* **Logic:**
* **Submission:** Sends user details to `POST /api/users/app-only`.
* **Credential Generation:** Unlike the standard invite, this does *not* send an email. Instead, upon success, it immediately displays the generated **Salesman ID** (and Technical ID) in the UI so the admin can manually share it with the employee.

* **`bulkInvite.tsx`:**
* **Purpose:** A Client Component (Dialog) that facilitates bulk user creation via file upload (CSV/TXT) or direct text paste.
* **Validation Logic:**
* **Header Check:** Mandates specific headers: `email`, `firstName`, `lastName`, `phoneNumber`, `role`, `region`, `area`, and `isTechnical`.
* **Role Validation:** Validates every row's role against a hardcoded list of allowed `ROLES`.

* **Execution:** Parses input client-side to catch errors early, then sends the array of objects to `POST /api/users/bulk-invite`. Provides a summary of successful and failed creations.

* **`src/app/dashboard/welcome/`**
    * **`page.tsx`**:
        * **Purpose**: A simple "Welcome" page, primarily for non-admin users or those who land on an unauthorized page.
        * **Logic**: This is a Client Component (`'use client'`).
        * **State**: It uses the `useSearchParams` hook to read the `name` and `error` query parameters from the URL.
        * **Effects**: It uses `useEffect` to check if `error === 'unauthorized'`. If true, it displays an error toast message: "🚫 You do not have access to this page yet. Contact the admin/manager.".
        * **Rendering**: It displays a welcome message to the user (using the `name` param) and includes a "Logout" button.

### `src/app/home/`

* **Purpose:** A secondary authenticated area for users, providing access to specialized tools (AI Chat, Report Generator) outside the main administrative dashboard context.
* **`layout.tsx`:**
    * **Logic:** A **Server Component** that acts as a security gatekeeper.
        1.  **Auth & Sync:** Verifies WorkOS session, ensures the user exists in the local Prisma database (linking by email if necessary), and synchronizes roles/permissions.
        2.  **JWT Refresh:** Checks if the user's token needs a refresh (e.g., missing `org_id`) and redirects if so.
        3.  **Shell:** Wraps the content in `<HomeShell>`, which renders the standard `AppSidebar` and `SiteHeader` to maintain UI consistency with the dashboard.
* **`page.tsx`:**
    * **Purpose:** The landing page for logged-in users.
    * **Logic:** A **Server Component** that verifies token claims. It renders a "Welcome" interface with navigation cards linking to **CemTem AI Chat**, **Dashboard**, and **Account**, utilizing standard Next.js `Link` components rather than dynamic permission-based rendering.
* **`home/cemtemChat/page.tsx`:**
    * **Purpose:** The frontend UI for the real-time AI assistant.
    * **Logic:** A **Client Component** (`'use client'`).
        * **Connection:** Uses `socket.io-client` to establish a WebSocket connection to an external AI service (defined by `NEXT_PUBLIC_SOCKET_SERVER_URL`).
        * **State Management:** Handles connection status (`isConnected`), typing indicators (`isLoading`), and message history.
        * **Interaction:** Sends messages via `socket.emit('send_message')`. It also handles a specific "Confirmation" flow (waiting for a 'Y' input) via `socket.emit('confirm_post')`.
        * **UI:** Renders a chat interface with auto-scrolling, custom styling for user/bot messages, and a "SafeTimeDisplay" for client-side timestamp rendering.
* **`home/customReportGenerator/`:**
    * **`page.tsx`:**
        * **Purpose:** A powerful, interactive UI for building and downloading custom datasets.
        * **Logic:** A **Client Component**.
            1.  **Selection:** Users select a "Data Table" (from `tablesMetadata`) and then toggle specific columns via checkboxes.
            2.  **State:** Tracks selected columns per table (`checkedColumns`) and builds a composite `reportColumns` state.
            3.  **Preview:** Calls `fetchPreview` which sends a **POST** request to `/api/custom-report-generator` (with `{ format: 'json', limit: 100 }`) to populate a `DataTableReusable` preview pane.
            4.  **Download:** `handleDownload` sends a **POST** request to the same API with the selected columns and format ('csv' or 'xlsx'), handling the response as a Blob to trigger a file download.
    * **`customTableHeaders.ts`:**
        * **Config:** A static configuration file exporting `tablesMetadata`. It defines the available tables (e.g., Users, Dealers, Technical Visit Reports) and their corresponding column fields, icons, and titles used by the generator UI.

---

### `src/app/login/`

* **`magicAuth/page.tsx`:**
    * **Purpose:** The client-side User Interface for the passwordless "Magic Code" (Email + OTP) login flow. It serves as both a standard login page and an invitation acceptance landing page.
    * **Logic:** A **Client Component** (`'use client'`).
        1.  **Context Detection:** It uses `useSearchParams` to check for an `inviteKey`. If present, the UI adapts to show "Accept Invitation"; otherwise, it shows "Sign In".
        2.  **Step 1 (Email):** The user enters their email. The component sends a `POST` request to `/auth/magic-auth` to trigger the OTP email.
        3.  **Step 2 (Verification):** The user enters the 6-digit code. The component sends a `POST` request to `/auth/magic-auth/verify`. If the verify response includes a `redirectUrl`, the browser performs a full navigation to that URL (refreshing the session state).
        4.  **Google Fallback:** It renders a "Continue with Google" button. This button constructs a URL to the standard login route (`/login`), appending the `invitation_token` if one exists, allowing users to switch auth methods without losing their invite context.
* **`route.ts` (GET):**
    * **Purpose:** Initiates the standard WorkOS Hosted AuthKit flow (e.g., for Google/Microsoft SSO).
    * **Logic:**
        1.  **Token Persistence:** It checks the URL for an `inviteToken`. If found, it stores this token in a secure, HTTP-only **Cookie**. This ensures the invitation context survives the redirect to the external WorkOS login page and is available upon return (in the callback).
        2.  **Redirect:** It generates the AuthKit sign-in URL using `getSignInUrl()` and redirects the user there.
        3.  **Magic Auth Check:** It includes a check for an `account_activated` flag to potentially shortcut users directly to the dashboard if they have just completed a specific activation flow.

---

### `src/app/setup-company/`

* **Purpose:** The one-time company onboarding flow for the *first* admin of a new organization.
* **`page.tsx`:**
    * **Logic:** A Server Component that fetches the user's email from their session (`getTokenClaims`) and passes it as a prop to the main form.
* **`setupCompanyForm.tsx`:**
    * **Purpose:** The main interactive, multi-step form.
    * **Logic:** A **Client Component**.
    1.  It uses `useState` to manage the form state (`companyName`, `adminFirstName`, etc.) and the current step (`step`).
    2.  It renders different form parts based on the `step`. Step 2 renders the `CompanyLocations` component.
    3.  **`handleSubmit`:** The final "Submit" button makes a `POST` request to `/api/setup-company`. This API route then calls the `company-service.ts` logic to create the `Company` in WorkOS, create the `Company` in Prisma, and create the `User` (admin) in Prisma, all in one transaction.
    4.  On success, it uses `router.push('/dashboard')` to send the user to their new dashboard.

---

### `src/components/`

This folder contains your custom, reusable React components, built using the primitives from `src/components/ui/`. These "smart" components contain the majority of the application's frontend logic, shared UI patterns, and custom hooks.

* **`app-sidebar.tsx`:**
* **Purpose:** The main navigation sidebar for the authenticated dashboard.
* **Logic:**
* **RBAC Rendering:** Accepts the `userRole` as a prop. It filters the navigation menu items (e.g., "User Management", "Dealer Management", "Reports") based on whether the current role is included in the allowed roles for each item.
* **Structure:** Uses the `Sidebar` primitive to render a collapsible, responsive sidebar with a header (Team logo) and footer (User profile/logout).

* **`site-header.tsx`:**
* **Purpose:** The top navigation bar that sits above the main content area.
* **Logic:**
* **Breadcrumbs:** Automatically generates breadcrumb navigation based on the current route path (e.g., `Dashboard > Users > Manage`).
* **Controls:** Houses the `SidebarTrigger` for mobile/desktop toggling and the `ModeToggle` for switching between Light/Dark themes.

* **`conditionalSidebar.tsx`:**
* **Purpose:** A wrapper component that controls the visibility of the sidebar layout.
* **Logic:**
* **Route Check:** Uses `usePathname()` to determine if the user is on a public page (like `/login`, `/setup-company`) or a secure dashboard page.
* **Rendering:** If on a public route, it renders the children directly (full width). If on a protected route, it wraps the children in the `SidebarProvider` and `SidebarInset` to enforce the dashboard layout.

* **`data-table-reusable.tsx`:**
* **Purpose:** A highly powerful, generic table component powered by `@tanstack/react-table`.
* **Logic:**
* **Props:** Accepts `data` (array) and `columns` (column definitions).
* **Features:** Built-in support for **Pagination** (10/20/30/50 rows), **Sorting** (click headers), **Filtering** (search inputs), and **Row Selection**.
* **Styling:** Wraps the table in a unified card layout with consistent borders, spacing, and empty-state handling.

* **`chart-area-reusable.tsx`:**
* **Purpose:** A standardized Area Chart component for dashboard analytics.
* **Logic:**
* **Props:** Accepts `data` (time-series), `categories` (keys to plot), and `colors`.
* **Rendering:** Wraps the `Recharts` library. It handles the responsive container sizing, tooltip formatting, and axis scaling automatically, ensuring all charts on the dashboard look consistent.

* **`section-cards.tsx`:**
* **Purpose:** Layout component for the "Summary Cards" seen at the top of report pages (e.g., "Total Visits", "Active Users").
* **Logic:** Accepts a list of stats (title, value, icon, trend) and renders them as a responsive grid of `Card` components.

* **`reusable-user-locations.tsx`:**
* **Purpose:** A custom React Hook (`useUserLocations`) for location data.
* **Logic:**
* **Data Fetching:** On mount, it fetches unique "Regions" and "Areas" from `/api/users/user-locations`.
* **Caching:** Manages `loading` and `error` states, providing a clean API `{ locations, loading, error }` for dropdown menus in forms (like "User Management" or "Assign Tasks").

* **`reusable-dealer-locations.tsx`:**
* **Purpose:** Similar to the user locations hook, but specifically for Dealer data.
* **Logic:** Fetches from `/api/dashboardPagesAPI/dealerManagement/dealer-locations` to populate "Dealer Region" and "Dealer Area" dropdowns, which often differ from sales team regions.

* **`multi-select.tsx`:**
* **Purpose:** A form component allowing users to select multiple options from a dropdown.
* **Logic:**
* **Interaction:** Wraps the `Command` primitive to allow searching within the dropdown.
* **State:** Manages an array of selected values, rendering them as dismissible `Badge` chips inside the input field.

* **`InvitationEmail.tsx`:**
* **Purpose:** A React Email template component.
* **Logic:**
* **Usage:** Not rendered directly in the dashboard UI. Instead, it is imported by server-side API routes (like `/api/users`) to generate the HTML for email invitations sent via Resend/Nodemailer.
* **Props:** Accepts dynamic data like `companyName`, `inviteUrl`, and `userRole`.

* **`add-schemes-rewards.tsx`:**
* **Purpose:** A specialized modal form for the "Mason/PC" module.
* **Logic:** Handles the creation of new loyalty schemes or rewards, including validation for points required, validity dates, and tier eligibility.

* **`data-comparison-calculation.tsx`:**
* **Purpose:** A utility component/hook for complex report logic.
* **Logic:** likely used in reports like `dvrVpjp.tsx` to calculate ratios (e.g., "Planned vs. Actual Visits") and formatting the percentage differences for display tables.

### `src/components/app-sidebar.tsx`

* **File:** `src/components/app-sidebar.tsx`
* **Purpose:** Renders the main navigation sidebar for the dashboard, implementing **Role-Based Access Control (RBAC)**.
* **Logic:**
    * **Dynamic Permissions:** It imports `WORKOS_ROLE_PERMISSIONS` and defines a local `ITEM_PERMISSIONS` map to associate menu items with specific permission paths (e.g., "Dealer Management" -> `'dealerManagement.listDealers'`).
    * **Recursive Filtering:** Uses a `filterMenuItems` function to recursively check `hasPermission(userRole, item.permission)`. If a user lacks permission for a parent item or all its children, that section is completely hidden from the UI.
    * **Company Info:** Fetches company details (Name, Admin Name) from `/api/company` to display in the sidebar header.
    * **Logout:** Includes a specialized "Logout" item that renders a form submitting to `/account/logout`.

### `src/components/site-header.tsx`

* **File:** `src/components/site-header.tsx`
* **Purpose:** Renders the persistent top navigation bar.
* **Logic:**
    * Contains the `SidebarTrigger` to toggle the sidebar on mobile/desktop.
    * Displays the "Business Dashboard" title.
    * Acts as a placeholder for future global actions (like notifications or profile dropdowns).

### `src/components/data-table-reusable.tsx`

* **File:** `src/components/data-table-reusable.tsx`
* **Purpose:** A highly advanced, generic table component built on **TanStack Table**.
* **Features:**
    * **Generics:** Accepts generic types `<TData, TValue>` to work with any data model (Users, Reports, etc.).
    * **Functionality:** Built-in support for Sorting, Column Visibility toggling, Pagination, and Row Selection.
    * **Drag-and-Drop:** Integrates `@dnd-kit` to allow row reordering via drag handles (`enableRowDragging` prop).
    * **Styling:** Uses a glassmorphism effect (`backdrop-blur-lg`) and integrates seamlessly with shadcn UI components.

### `src/components/reusable-user-locations.tsx` & `src/components/reusable-dealer-locations.tsx`

* **Files:** `src/components/reusable-user-locations.tsx`, `src/components/reusable-dealer-locations.tsx`
* **Purpose:** Custom React hooks (`useUserLocations`, `useDealerLocations`) for fetching filter data.
* **Logic:**
    * They abstract the `fetch` logic to specific API endpoints (`/api/users/user-locations`, etc.).
    * They return standardized objects (e.g., `{ regions: [], areas: [] }`) used to populate dropdown filters across the application, ensuring consistent data without code duplication.

### `src/components/multi-select.tsx`

* **File:** `src/components/multi-select.tsx`
* **Purpose:** A complex form component allowing selection of multiple items from a list.
* **Logic:**
    * Built using `Popover` and `Command` primitives.
    * **Searchable:** Users can type to filter options.
    * **Badges:** Selected items are displayed as removable badges.
    * **Clear All:** Includes a helper to clear the entire selection at once.

### `src/components/chart-area-reusable.tsx`

* **File:** `src/components/chart-area-reusable.tsx`
* **Purpose:** Provides standardized chart wrappers using `recharts`.
* **Components:**
    * **`ChartAreaInteractive`:** Renders an Area chart with a gradient fill, custom tooltips, and a scrollable X-axis. It adapts colors dynamically from the Shadcn `ChartConfig`.
    * **`ChartPieReusable`:** Renders a Pie chart with an interactive "active shape" that expands on hover. It automatically generates a legend and assigns colors from a predefined palette.

### `src/components/conditionalSidebar.tsx`

* **File:** `src/components/conditionalSidebar.tsx`
* **Purpose:** A context-aware wrapper that decides *which* sidebar configuration to show based on the user's location.
* **Logic:**
    * **Context Switching:** It checks `usePathname()`. If the user is in `/home` or `/auth`, it might hide the sidebar entirely.
    * **Role Fetching:** For the main dashboard context, it fetches the *current user's* specific role from `/api/users?current=true` to ensure the `AppSidebar` renders the correct permission-gated links.

### `src/components/section-cards.tsx`

* **File:** `src/components/section-cards.tsx`
* **Purpose:** Displays high-level KPI cards on the main dashboard (e.g., "Scheduled Visits", "Registered Dealers").
* **Logic:** Currently renders static placeholder data, designed to be replaced with real metrics. Uses responsive grid classes (`@container`) to adapt card sizes.

### `src/components/data-comparison-calculation.tsx`

* **File:** `src/components/data-comparison-calculation.tsx`
* **Purpose:** Contains the **Business Logic** and **Hooks** for dashboard analytics, specifically relating to DVR (Daily Visit Reports) vs PJP (Journey Plans) and Sales.
* **Logic:**
    * **`useDvrPjpData` Hook:** Fetches PJP, DVR, and Sales data in parallel. It performs client-side validation using Zod schemas to ensure data integrity before processing.
    * **Calculation Functions:** Pure functions like `calculateDVRvPJPAnalytics` and `calculateSalesvDVRAnalytics` that perform Month-over-Month (MoM) comparisons and target achievement percentages.

### `src/components/InvitationEmail.tsx`

* **File:** `src/components/InvitationEmail.tsx`
* **Purpose:** Defines the HTML email templates using `@react-email/components`.
* **Templates:**
    * **`InvitationEmail`:** A rich HTML email including the user's role, specific login credentials (for Salesman/Technical apps), and a call-to-action button.
    * **`MagicAuthEmail`:** A simple template for sending One-Time Passwords (OTP).

---

### `src/lib/`

This folder contains the core "business logic," database connections, type definitions, and utility functions that power the backend and shared logic.

### `src/lib/prisma.ts`
* **Purpose:** Instantiates the **Prisma Client**. It implements a singleton pattern to prevent exhausting database connections during Next.js hot-reloading in development.

### `src/lib/permissions.ts`
* **Purpose:** The source of truth for **Feature-Based Access Control**.
* **Logic:**
    * Defines the `DashboardPermissions` interface (a massive object mapping every feature to a boolean).
    * Exports `WORKOS_ROLE_PERMISSIONS`: A matrix defining exactly which features are enabled (`true`) or disabled (`false`) for every role (e.g., `president`, `senior-executive`).
    * Exports `hasPermission()`: A utility used by UI components to check if a feature should be visible.

### `src/lib/roleHierarchy.ts`
* **Purpose:** Defines **Hierarchical Access Control** (who can manage whom).
* **Logic:**
    * `ROLE_HIERARCHY`: An ordered array from `president` (top) to `junior-executive` (bottom).
    * `canAssignRole(currentUser, targetRole)`: Prevents users from creating or updating users with a role equal to or higher than their own.

### `src/lib/utils.ts`
* **Purpose:** Exports the `cn` utility, which combines `clsx` (conditional classes) and `tailwind-merge` (resolving class conflicts), essential for styling components.

### `src/lib/download-utils.ts`
* **Purpose:** Server-side utilities for generating downloadable files.
* **Logic:**
    * **`generateAndStreamCsv`:** Converts data arrays to CSV format strings and returns a `NextResponse` with the correct headers for file download.
    * **`generateAndStreamXlsx`:** Uses `ExcelJS` to create professional Excel sheets (with auto-sized columns and bold headers) and streams them to the client.
    * **`exportTablesToCSVZip`:** Uses `JSZip` to bundle multiple CSVs into a single ZIP file.

### `src/lib/company-service.ts`
* **Purpose:** A service to fetch aggregated company statistics.
* **Logic:** `getCompanyInfo` fetches the current user's company details and runs counts on the User table to return metrics like "Total Users," "Active Users," and "Pending Users."

### `src/lib/shared-zod-schema.ts`
* **Purpose:** A centralized repository of **Zod** schemas.
* **Usage:** Defines strict validation rules for API inputs (`assignTaskSchema`, `postDealersSchema`) and outputs (`dailyVisitReportSchema`, `masonPCSideSchema`). These are used throughout the app to ensure data consistency and type safety.

### `src/lib/reports-transformer.ts`
* **Purpose:** Data transformation layer for Reports.
* **Logic:** Contains functions (e.g., `getFlattenedDealers`, `getFlattenedDailyVisitReports`) that fetch raw nested data from Prisma and "flatten" it into simple, single-level objects. This makes the data easy to render in tables and export to CSV/Excel without complex frontend processing.

### `src/lib/Reusable-constants.ts`
* **Purpose:** Stores static app-wide constants like `brands` list, `dealerTypes`, and `Zone` definitions, ensuring dropdowns across the app use the same data.

### `src/lib/pointsCalcLogic.ts`
* **Purpose:** Encapsulates the business rules for the Loyalty Program.
* **Logic:**
    * **`calculateJoiningBonusPoints`**: Checks date ranges to apply joining bonuses.
    * **`calculateBaseAndBonanzaPoints`**: Calculates points based on bag count, adding multipliers during specific "Bonanza" date ranges.
    * **`calculateExtraBonusPoints`**: Handles logic for slab-based milestones (e.g., extra points for every 250 bags).

---

## `src/hooks/`

This folder contains custom React hooks, which are reusable, stateful logic functions that can be shared across multiple components.

### `src/hooks/use-mobile.ts`

* **File:** `src/hooks/use-mobile.ts`
* **Purpose:** This is a client-side hook used to determine if the user's device is currently in a "mobile" viewport (i.e., has a small screen width). This is critical for making components responsive.
* **Logic:**
    1.  **State:** It defines a single piece of state using `useState`: `const [isMobile, setIsMobile] = useState(false);`.
    2.  **`useEffect` Hook:** The core logic is wrapped in a `useEffect` hook that runs *only once* when the component first mounts, thanks to the empty dependency array `[]`.
    3.  **Event Listener:**
        * Inside the `useEffect`, it defines a function `handleResize`. This function checks the window's width: `setIsMobile(window.innerWidth < 768);`. The `768px` threshold (corresponding to Tailwind's `md` breakpoint) is the hardcoded definition of "mobile" for this app.
        * It adds an event listener to the browser's `window` object: `window.addEventListener('resize', handleResize);`. This makes the `handleResize` function execute every time the user resizes their browser.
    4.  **Initial Check:** After adding the listener, it *immediately* calls `handleResize()` to set the initial state (mobile or desktop) when the component first loads.
    5.  **Cleanup Function:** The `useEffect` hook returns a cleanup function: `return () => window.removeEventListener('resize', handleResize);`. This is critical for performance. When the component unmounts, this function runs, removing the event listener so it doesn't continue to run in the background.
    6.  **Return Value:** The hook returns the `isMobile` boolean value.
* **Usage:** Components like `app-sidebar.tsx` use this hook: `const isMobile = useMobile();`. They can then use this boolean to conditionally render different JSX, for example:
    * **If `isMobile` is true:** Render the sidebar as a slide-out `<Sheet>`.
    * **If `isMobile` is false:** Render the sidebar as a permanent, visible `<div>` on the left.

---

## `src/proxy.ts`

* **File:** `src/proxy.ts`
* **Purpose:** This file is intended to set up a custom development proxy, but it is currently empty.
* **Logic:**
    * **As-is:** The file is empty. It performs no logic.
    * **Intended Purpose:** In a Next.js project, this file (often used with `next-http-proxy-middleware`) would be used to proxy API requests during development. For example, it could forward all requests from `/api/` to a separate, already running backend (e.g., `http://api.example.com`). In this project, the API routes are *part of* the Next.js app itself (in `src/app/api/`), so a custom proxy is not strictly necessary.