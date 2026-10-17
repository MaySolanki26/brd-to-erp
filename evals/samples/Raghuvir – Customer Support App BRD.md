# Raghuvir – Customer Support App (Society Management) – BRD

Oct 17, 2026 · @MS

This BRD defines one web panel and one role-based mobile app that let Raghuvir and its residents record, check and close every society complaint and service across all projects.

| Field       | Value                                                |
| ----------- | ---------------------------------------------------- |
| Project     | Raghuvir – Customer Support App (Society Management) |
| Client      | Raghuvir (Real Estate Developer)                     |
| Prepared by | Sarvadhi – Business Analyst                          |
| Version     | 1.0 (Draft)                                          |
| Platforms   | Web Panel + Mobile App (Android, iOS)                |

## 1. Executive Summary

Raghuvir is a real estate developer with more than 10 housing projects. Each project has many buildings, its own amenities, and its own society committee: a President, a Secretary and the flat owners who live there.

After flats are handed over, Raghuvir still receives many complaints and requests from residents. Today these come through phone calls, WhatsApp and Excel sheets. Complaints get lost, nobody sees which project has the most problems, and staff and vendors are not held responsible for delays.

This project builds two connected systems. A **Web Panel** lets Raghuvir staff manage all projects, complaints and announcements in one place. One **Mobile App** serves Society Managers, Residents and Watchmen, and each user sees only their own project. Raghuvir creates the Society Manager; the Society Manager then approves residents and checks complaints before they move forward.

The need is urgent because the number of projects keeps growing and unresolved complaints hurt the Raghuvir brand, which affects sales of future projects.

**Expected result:** every complaint is recorded, checked, tracked and closed only when the resident agrees, with full visibility for Raghuvir across all projects.

## 2. Problem

**Current state:** Residents report problems by calling the builder office, sending WhatsApp messages or telling site staff. Staff note them in Excel or remember them, then call vendors. Owner details sit in scattered sheets, and announcements go through WhatsApp groups. Visitors are written in a paper register.

**Core problem:** There is no single place to record, check, assign and track complaints across projects, so complaints are lost, delayed or closed without the resident agreeing.

**Impact (estimated, to be confirmed with client):**

- Builder office spends 15–25 hours a week on calls and follow-ups.
- 20–30% of complaints are raised again because nobody tracks them.
- Non-genuine complaints and society-level work reach the builder and add cost.
- No data on which defects repeat across projects.

**Root cause:** Complaint handling depends on people and chat messages, not on one system with clear roles, steps and time limits.

## 3. Objectives

**Main objective:** To give Raghuvir and its residents one system to record, check and resolve society complaints and services, so every issue is tracked to closure and each project runs its own daily work.

| ID     | Objective                                                                             |
| ------ | ------------------------------------------------------------------------------------- |
| OBJ-01 | Bring every complaint into one recorded flow with a clear owner and status            |
| OBJ-02 | Move daily resident management to each project's Society Manager                      |
| OBJ-03 | Give Raghuvir one view of all projects, complaints and delays                         |
| OBJ-04 | Reach all flat owners through one announcement channel                                |
| OBJ-05 | Let residents and watchmen handle hall booking, facilities and visitors by themselves |

**Success criteria:**

- 100% of complaints raised through the app within 3 months of launch.
- Average complaint closure time down 40% within 6 months.
- 70% of flats have an approved user within 3 months of each project's launch.

## 4. Roles and Responsibilities

Five roles use the system. Raghuvir only creates Society Managers; Society Managers run their own project.

### 4.1 Roles

| Role            | Who                            | Platform   | Can see                                      | Main work                                                         | Est. users      | Use    |
| --------------- | ------------------------------ | ---------- | -------------------------------------------- | ----------------------------------------------------------------- | --------------- | ------ |
| Raghuvir Admin  | Head office staff              | Web Panel  | All projects, or only projects given to them | Project setup, Society Managers, complaint control, announcements | 5–15            | Daily  |
| Assigned Person | Raghuvir staff or service team | Web Panel  | Only complaints given to them                | Fix the complaint, mark it Fixed                                  | 20–50           | Daily  |
| Society Manager | Secretary or President         | Mobile App | Own project only                             | Approve residents, check complaints, documents, hall approvals    | 2–4 per project | Daily  |
| Resident        | Flat customer                  | Mobile App | Own flat + project's shared info             | Complaints, bookings, visitors                                    | 1 per flat      | Weekly |
| Watchman        | Gate security                  | Mobile App | Own project's visitors, today only           | Visitor list, walk-in entry, entry and exit time                  | 2–6 per project | Daily  |

### 4.2 Who Does What

| Work                                       | Raghuvir Admin | Society Manager           | Resident                      | Assigned Person | Watchman   |
| ------------------------------------------ | -------------- | ------------------------- | ----------------------------- | --------------- | ---------- |
| Create projects, buildings, flats          | Yes            | No                        | No                            | No              | No         |
| Create or replace a Society Manager        | Yes            | No                        | No                            | No              | No         |
| Create or remove a Watchman                | Yes            | Yes                       | No                            | No              | No         |
| Add or approve residents                   | View only      | Yes                       | No                            | No              | No         |
| Self-register                              | No             | No                        | Yes                           | No              | No         |
| Raise a complaint                          | No             | Yes (own flat)            | Yes (own flat)                | No              | No         |
| Check if a complaint is genuine            | No             | Yes                       | No                            | No              | No         |
| Assign builder-responsibility complaint    | Yes            | No                        | No                            | No              | No         |
| Assign society-responsibility complaint    | No             | Yes                       | No                            | No              | No         |
| Mark complaint Fixed                       | No             | Yes (for society vendors) | No                            | Yes             | No         |
| Approve closure or reopen                  | No             | No                        | Only the person who raised it | No              | No         |
| Announcement to all projects               | Yes            | No                        | No                            | No              | No         |
| Announcement to own project                | No             | Yes                       | No                            | No              | No         |
| Manage contact directory                   | Yes (common)   | Yes (own project)         | View                          | No              | No         |
| Manage society documents                   | View           | Yes                       | View                          | No              | No         |
| Book hall or facility                      | No             | Yes                       | Yes                           | No              | No         |
| Approve hall booking                       | No             | Yes                       | No                            | No              | No         |
| Add expected visitor                       | No             | Yes                       | Yes                           | No              | No         |
| Add walk-in visitor, record entry and exit | No             | No                        | No                            | No              | Yes        |
| View visitor record                        | View           | Yes                       | Own visitors                  | No              | Today only |
| Override a stuck approval or check         | Yes            | No                        | No                            | No              | No         |

### 4.3 Family Members and Notice Board – Who Does What

| Work                                 | Raghuvir Admin                | Society Manager        | Resident        | Watchman    |
| ------------------------------------ | ----------------------------- | ---------------------- | --------------- | ----------- |
| Add, edit, remove own family members | No                            | Yes (own flat)         | Yes (own flat)  | No          |
| See family and member counts         | All projects                  | Own project            | No              | No          |
| See family member list               | View only (by project access) | Own project, view only | Own family only | No          |
| Download member list                 | Yes (logged)                  | No                     | No              | No          |
| Set age group limits                 | Yes                           | No                     | No              | No          |
| Post on notice board                 | All or selected projects      | Own project            | No              | No          |
| Create event invite                  | All or selected projects      | Own project            | No              | No          |
| See notice board                     | All                           | Own project            | Own project     | Own project |
| Reply Going / Not Going to an event  | No                            | Yes                    | Yes             | No          |
| See event reply counts               | Own posts                     | Own project            | No              | No          |

### 4.4 Permissions, Owners and Tenants

Society Manager work is given by permission, not by title, and every flat is marked as owner-living, tenant-living or vacant.

**Permissions:** Raghuvir Admin gives each committee member (President, Secretary or any other member) one or more of these permissions:

| Permission                | Allows                                                       |
| ------------------------- | ------------------------------------------------------------ |
| Approve residents         | Approve or reject owners and tenants; add residents manually |
| Check complaints          | Mark complaints genuine or not genuine                       |
| Assign society complaints | Assign and update society-responsibility complaints          |
| Manage documents          | Upload and delete society documents                          |
| Approve bookings          | Approve hall bookings; close facilities for maintenance      |
| Post notices              | Post on the project notice board                             |
| Manage watchmen           | Create or remove Watchman logins                             |
| View family data          | See family and member counts and list                        |

Every project must keep at least one person with **Approve residents** and **Check complaints**. The system blocks removing the last one.

**Owners and tenants:**

- A resident registers as **Owner** or **Tenant**.
- Each flat has one main user: the person who lives there (owner or tenant).
- A tenant also gives the owner's name and the rent agreement end date.
- 15 days before the agreement end date, the tenant and the Society Manager get a reminder. Tenant access ends only after a Society Manager confirms.
- Access for an owner who does not live in the rented flat: to be confirmed.

## 5. Platform Feature Map

The system has 59 features: 20 on the Web Panel and 39 in one Mobile App that shows a different home screen and menu for each role.

| Platform                     | Used by                            | Features |
| ---------------------------- | ---------------------------------- | -------- |
| Web Panel                    | Raghuvir Admin, Assigned Person    | 20       |
| Mobile App – Common          | All app users                      | 7        |
| Mobile App – Resident        | Owner or tenant living in the flat | 12       |
| Mobile App – Society Manager | Committee members with permissions | 14       |
| Mobile App – Watchman        | Gate security                      | 6        |
| **Total**                    |                                    | **59**   |

All platforms use one common backend. Every user sees only the data of their own project; this check runs on the server for every request.

### 5.1 Web Panel – 20 Features

| #   | Feature                              | Used by                | What it does                                                                                                                                              |
| --- | ------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Login                                | Admin, Assigned Person | Password + OTP                                                                                                                                            |
| W2  | Dashboard                            | Admin                  | Complaints by project, category, status; delays; approved residents vs total flats; family and member totals; owner vs tenant flats; live facility counts |
| W3  | Project, Building, Floor, Flat setup | Admin                  | Any number of projects, buildings, floors and flats                                                                                                       |
| W4  | Amenities setup                      | Admin                  | Add any amenity per project: Bookable (hall) or Shared (gym, pool), capacity, open hours, slot length, rules                                              |
| W5  | Admin staff and project access       | Admin                  | Create staff, give access to selected projects                                                                                                            |
| W6  | Society Manager and permissions      | Admin                  | Create, replace or deactivate committee members; give or remove permissions                                                                               |
| W7  | Resident list (view only)            | Admin                  | Owners and tenants across projects                                                                                                                        |
| W8  | Complaint category setup             | Admin                  | Category, builder or society responsibility, time limits, default Assigned Person, reminder days                                                          |
| W9  | Complaint management                 | Admin                  | View, assign, reassign and override complaints across projects                                                                                            |
| W10 | My Tasks                             | Assigned Person        | Own complaints only: Work Started, Fixed with photo                                                                                                       |
| W11 | Notice Board                         | Admin                  | Post announcements, celebrations and events to all or selected projects                                                                                   |
| W12 | Common contact directory             | Admin                  | Raghuvir-level service contacts                                                                                                                           |
| W13 | Visitor record (view only)           | Admin                  | Visitor entries per project                                                                                                                               |
| W14 | Society documents (view only)        | Admin                  | Documents per project                                                                                                                                     |
| W15 | Reports                              | Admin                  | Closure time, delays, reopen count, top problem categories                                                                                                |
| W16 | Activity log                         | Admin                  | Who did what and when                                                                                                                                     |
| W17 | Notifications                        | Admin, Assigned Person | New assignments, delays, escalations                                                                                                                      |
| W18 | Family and Member Dashboard          | Admin                  | Families, members by age group, owners vs tenants, per project, building and flat                                                                         |
| W19 | Age group setup                      | Admin                  | Name the age groups and set their age limits                                                                                                              |
| W20 | Watchman management                  | Admin                  | Create or remove Watchman logins for any project                                                                                                          |

### 5.2 Mobile App – Common (7)

| #   | Feature                                                         |
| --- | --------------------------------------------------------------- |
| C1  | OTP login                                                       |
| C2  | Switch between flats or roles                                   |
| C3  | Notifications                                                   |
| C4  | Notice Board (own project: announcements, celebrations, events) |
| C5  | Contact directory (tap to call)                                 |
| C6  | Profile                                                         |
| C7  | Language: English, Gujarati, Hindi                              |

### 5.3 Mobile App – Resident (12)

| #   | Feature                                                                |
| --- | ---------------------------------------------------------------------- |
| R1  | Self-registration as Owner or Tenant, and approval status              |
| R2  | Raise a complaint with photos (own flat only)                          |
| R3  | Track a complaint (status and timeline)                                |
| R4  | Approve or reopen a fixed complaint                                    |
| R5  | Book a bookable amenity (hall) and cancel                              |
| R6  | Book a slot for a shared facility (gym, pool) and check in / check out |
| R7  | Add an expected visitor                                                |
| R8  | Own visitor history                                                    |
| R9  | Society documents (view only)                                          |
| R10 | My Family: add, edit, remove family members                            |
| R11 | Neighbours on my floor: name and occupation only                       |
| R12 | Live count of people inside each shared facility                       |

### 5.4 Mobile App – Society Manager (14)

A Society Manager is also a resident and gets all Resident features too.

| #   | Feature                                                   | Needs permission          |
| --- | --------------------------------------------------------- | ------------------------- |
| S1  | Approve or reject owners and tenants                      | Approve residents         |
| S2  | Add a resident manually                                   | Approve residents         |
| S3  | Edit or deactivate a resident; confirm tenancy end        | Approve residents         |
| S4  | Check if a complaint is genuine                           | Check complaints          |
| S5  | Assign society-responsibility complaints                  | Assign society complaints |
| S6  | Update complaint status for society vendors               | Assign society complaints |
| S7  | Track all complaints in the project                       | Check complaints          |
| S8  | Manage society documents                                  | Manage documents          |
| S9  | Approve hall bookings; close a facility for maintenance   | Approve bookings          |
| S10 | Notice Board posts for own project                        | Post notices              |
| S11 | Project contact directory                                 | Post notices              |
| S12 | Create or remove a Watchman                               | Manage watchmen           |
| S13 | Visitor record and project summary                        | Any                       |
| S14 | Family and member summary, owners vs tenants, by building | View family data          |

### 5.5 Mobile App – Watchman (6)

| #   | Feature                                                |
| --- | ------------------------------------------------------ |
| G1  | Today's expected visitors                              |
| G2  | Search by name, mobile or pass code                    |
| G3  | Add a walk-in visitor; resident informed automatically |
| G4  | Tap to call the flat's resident if needed              |
| G5  | Record entry and exit time                             |
| G6  | Save entries without network, send later               |

## 6. Process Flows

A complaint closes only when the person who raised it approves; every other flow below feeds or supports that rule.

### 6.1 Complaint Life Cycle

&#91;embedded content: complaint life cycle · 2 checks, 1 reopen loop\]

The Society Manager filters out non-genuine complaints first; only the resident who raised a complaint can close it.

**Trigger:** a resident raises a complaint.

1. Resident picks a category, writes the issue, adds photos (optional).
2. System creates a complaint number. Status: **Waiting for Check**.
3. Society Manager checks it.
   - Not genuine → **Rejected** with reason, resident notified, end.
   - Genuine → step 4.
4. System routes by category:
   - **Builder responsibility** → Raghuvir Admin assigns an Assigned Person.
   - **Society responsibility** → Society Manager assigns a society vendor.
5. Status: **Assigned** → **Work Started**.
6. Assigned Person marks **Fixed** with remark and photo.
7. Status: **Waiting for Resident Approval**. Resident notified.
8. Resident approves → **Closed**, removed from the resident's list. Resident reopens with a reason → back to **Work Started**.

**Exceptions:**

- E1: Not checked within 24 hours → escalated to Raghuvir Admin.
- E2: Not fixed within the category time limit → senior or Raghuvir Admin alerted.
- E3: Resident does not respond after Fixed → reminders on set days (for example day 2 and day 5, set by Raghuvir Admin); after the last reminder the Society Manager is alerted. No auto-close: the complaint closes only when the resident approves.
- E4: Reopened more than 2 times → goes to Raghuvir Admin.
- E5: Society Manager's own complaint → checked by another member with Check complaints permission, or Raghuvir Admin.

### 6.2 Resident Registration

1. Resident enters mobile number and OTP.
2. Resident selects Project, Building, Flat and enters name.
3. System checks if the flat already has an active customer. If yes → flagged **Flat Already Taken** for the Society Manager.
4. Request goes only to that project's Society Manager.
5. Approve → full access + notification. Reject → reason shown, resident can apply again.

**Exceptions:**

- E1: No Society Manager in the project → request waits, Raghuvir Admin alerted.
- E2: Pending more than 3 days → reminder to Society Manager; 7 days → Raghuvir Admin alerted.
- E3: Mobile number already registered → new flat linked to the same account.

**Tenant registration:** same steps; the tenant picks **Tenant**, and adds the owner's name and rent agreement end date. Approval is done by any member with the **Approve residents** permission.

### 6.3 Society Manager Setup and Change

1. Raghuvir Admin creates or replaces the Society Manager (name, mobile, project).
2. Old Society Manager loses access at once.
3. Pending approvals and complaint checks move to the new Society Manager.
4. All history stays with the project, not the person.

### 6.4 Bookable Amenity (e.g. Hall)

1. Resident picks hall, date and time slot.
2. System checks the slot. Booked → shown unavailable.
3. Request goes to the Society Manager.
4. Approved → booking confirmed, slot blocked.
5. Resident can cancel before the cut-off time.

**Exception:** two requests for one slot → first approved wins, other auto-rejected.

### 6.5 Visitor Entry

The two flows are independent; advance entry is optional.

**Flow A – Expected visitor**

1. Resident adds visitor name, mobile, date, purpose.
2. Visitor appears in the Watchman's **Today's Visitors** list.
3. Watchman finds the visitor by name, mobile or pass code and taps **Allow Entry**. Entry time saved.
4. On leaving, Watchman taps **Exit**. Exit time saved.

**Flow B – Walk-in visitor**

1. Watchman adds name, mobile, flat, purpose, photo (optional).
2. Entry is saved at once; no resident approval is needed. The resident gets an information notification.
3. Entry and exit times saved.

**Exceptions:**

- E1: Watchman wants to confirm with the resident → taps to call from the app.
- E2: Expected visitor comes on the wrong date → handled as walk-in.
- E3: Flat number wrong or no approved resident → entry blocked, Society Manager alerted.
- E4: Exit not recorded → marked **Exit Not Recorded** at midnight.
- E5: Weak network → saved on the phone, sent when network returns.

### 6.6 Family Members

**Trigger:** a resident is approved, or a family change happens.

1. On approval, the system adds the customer as the first member (relation: Self).
2. Resident opens **My Family** and adds each member: name, relation, birth year (gender and mobile optional).
3. System places each member in an age group from the birth year: **Kids (0–17)**, **Adults (18–59)**, **Seniors (60+)**. Limits can be changed by Raghuvir Admin.
4. Counts update at once on the Society Manager summary and the Raghuvir dashboard.
5. Every year on 1 January, the system moves members into their new age group automatically.

**Exceptions:**

- E1: Birth year not given → member counted under **Age Not Given**.
- E2: Same name and birth year already in another flat of the project → warning shown; resident confirms or corrects.
- E3: Flat deactivated (owner change) → its members are removed from all counts; history kept.
- E4: More than 15 members in one flat → blocked with a message to contact the Society Manager.

### 6.7 Notice Board and Event Invite

**Trigger:** Raghuvir Admin or a Society Manager has news, a celebration or an event.

1. Poster picks the type: **Announcement**, **Celebration**, **Event** or **Urgent**.
2. Poster adds title, message, image (optional), show-from and show-until dates.
3. Poster picks who sees it:
   - Raghuvir Admin → all projects, selected projects or selected buildings.
   - Society Manager (with Post notices permission) → own project or selected buildings in it.
4. For an **Event**: date, time, venue, and optional invited age group (for example Kids or Seniors).
5. On publish, the post shows only on the selected projects' notice boards and a notification goes to those users. With an invited age group, the notification goes only to families with members in that group; the post stays visible to the whole project.
6. The board is for reading only: no replies and no comments.
7. After the show-until date, the post moves to **Past**.

**Exceptions:**

- E1: Post edited after publish → marked Updated, target users notified again.
- E2: Event cancelled → marked Cancelled, target users notified.
- E3: Publish set for a later time → post appears and notifies at that time.

### 6.8 Shared Facility (Gym, Pool) and Live Count

**Trigger:** a resident wants to use a shared facility.

1. Resident opens **Facilities** and sees each facility with its live count, for example "12 inside / 30 capacity", and free slots.
2. Resident picks a date and slot (when the facility needs booking). Booked if the slot has space.
3. On arrival, resident taps **Check In** and adds how many family members came along.
4. Live count goes up for everyone in the project.
5. On leaving, resident taps **Check Out**. Live count goes down.

**Exceptions:**

- E1: Slot full → next free slots shown.
- E2: Facility at capacity → check-in blocked with a message.
- E3: Forgot to check out → automatic check-out at slot end (or closing time).
- E4: Booked but did not come → slot freed after a set number of minutes (set by Raghuvir Admin).
- E5: Facility closed for maintenance → member with Approve bookings marks it closed; booked users notified.

### 6.9 Neighbours on My Floor

1. Resident opens **Neighbours**.
2. System shows only flats on the **same floor of the same building**: flat number, main person's name, occupation.
3. Phone, email, family, owner or tenant status are never shown.

**Exceptions:**

- E1: Flat vacant or not registered → not shown.
- E2: Main person turned off "Show me to neighbours" → shown as flat number only.
- E3: Main person changes (owner change or new tenant) → list updates at once.

## 7. Personas

| Persona                                              | Goal                                               | Frustration today                                       | How they work                                       | Success looks like                                  |
| ---------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| Nilesh, Raghuvir Customer Care Head (Raghuvir Admin) | See and control all complaints across 10+ projects | Calls and WhatsApp from every project, no record        | Desktop, full day, comfortable with technology      | Knows every complaint's status without a phone call |
| Ramesh, Maintenance Supervisor (Assigned Person)     | Know clearly which work to do and where            | Gets work by phone with missing details                 | Moves between sites, basic technology comfort       | Sees his task list and closes work with a photo     |
| Mr. Shah, Society Secretary (Society Manager)        | Run the society smoothly with little effort        | Residents call anytime; documents kept with one person  | Mobile only, part-time, medium comfort              | Approves and checks requests in a few taps          |
| Mrs. Patel, Flat Owner (Resident)                    | Get her problem fixed without following up         | Doesn't know whom to call or if anyone is working on it | Mobile, occasional use, may prefer Gujarati         | Raises a complaint once and sees it closed          |
| Bhimsinh, Gate Security (Watchman)                   | Let the right visitors in fast and keep a record   | Paper register, calling flats one by one                | Mobile only, low comfort, prefers Gujarati or Hindi | Checks or adds a visitor in under 30 seconds        |

## 8. Current State → Future State

| Area                | Today                              | With the new system                                              |
| ------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Raising a complaint | Call or WhatsApp to the office     | Resident raises it in the app with photos                        |
| Recording           | Staff write it down or remember it | Complaint number created automatically                           |
| Genuineness         | No check                           | Society Manager checks first                                     |
| Assignment          | Staff call vendors manually        | Assigned by category and responsibility                          |
| Closure             | Closed when staff say it's done    | Closed only when the resident approves                           |
| Visibility          | No reports                         | All projects' complaints in one dashboard                        |
| Resident data       | Excel kept by builder staff        | Self-registration + Society Manager approval                     |
| Owner change        | Missed                             | Old user deactivated, new one approved                           |
| Announcements       | WhatsApp groups                    | Project notice board; Raghuvir posts to all or selected projects |
| Visitors            | Paper register                     | Today's list + walk-in entry with entry and exit time            |
| Hall booking        | Register or phone                  | In-app booking with clash check                                  |

Also new: family and member counts by age group (Kids, Adults, Seniors) for every project, which today nobody has; and event invites with reply counts instead of guessing attendance.

**Improvement:** no lost complaints, a clear owner at every step, and the resident's agreement before closure.

## 9. Scope

Phase 1 covers the 57 features in Section 5; billing, accounting and payments stay out.

**In scope:**

- Web Panel: project, building and flat setup; Society Manager creation; complaint control; family and member dashboard; notice board and event invites; contact directory; reports; activity log.
- Mobile App (one app, role-based): OTP login, self-registration with approval, complaints, contact directory, society documents, hall booking, facility use, visitors, Watchman view, My Family, notice board and event replies.
- Access based on role and project, using one common backend for all projects.

**Out of scope:**

| Item                                     | Reason                      |
| ---------------------------------------- | --------------------------- |
| Maintenance bill collection and payments | Not in current requirement  |
| Society accounting                       | Handled outside this system |

**Phase 2 (later):**

| Item                                                      | Why later                           |
| --------------------------------------------------------- | ----------------------------------- |
| Online payment for hall booking                           | Depends on decision on paid booking |
| WhatsApp notifications                                    | Needs WhatsApp Business setup       |
| Long-term passes for daily staff (maid, milkman, courier) | Needs Watchman flow live first      |
| Resident rating after closure                             | Nice to have                        |
| Referral program for new Raghuvir projects                | Business add-on                     |

**System boundaries:**

- Connects with: SMS provider (OTP), push notification service, file storage for photos and documents.
- Does not touch: Raghuvir's sales, booking or accounting systems.

## 10. User Journeys

Each role reaches its main result in a few steps; the failure path for each is listed under it.

### Resident – raise and close a complaint

| Step       | Action                      | System response                                    | Feeling   |
| ---------- | --------------------------- | -------------------------------------------------- | --------- |
| 1. Raise   | Fills complaint, adds photo | Creates complaint number, notifies Society Manager | Relieved  |
| 2. Track   | Opens complaint             | Shows status and timeline                          | Confident |
| 3. Fixed   | Gets notification           | Shows fix remark and photo                         | Hopeful   |
| 4. Approve | Taps Approve                | Closes complaint, removes it from her list         | Satisfied |

Failure: not satisfied → Reopen with reason. Rejected as not genuine → sees the reason.

### Society Manager – approve resident and check complaint

| Step | Action                  | System response                                   |
| ---- | ----------------------- | ------------------------------------------------- |
| 1    | Opens pending list      | Shows requests and complaints of own project only |
| 2    | Approves resident       | Resident gets access and notification             |
| 3    | Marks complaint genuine | Complaint routed by category                      |

Failure: no action in time → reminder, then escalation to Raghuvir Admin.

### Raghuvir Admin – control complaints

| Step | Action                    | System response                         |
| ---- | ------------------------- | --------------------------------------- |
| 1    | Opens dashboard           | Complaints by project, category, status |
| 2    | Assigns builder complaint | Assigned Person notified                |
| 3    | Opens delayed list        | Complaints past their time limit        |

### Assigned Person – fix a complaint

| Step | Action                                    | System response                |
| ---- | ----------------------------------------- | ------------------------------ |
| 1    | Opens My Tasks                            | Only own complaints            |
| 2    | Marks Work Started, then Fixed with photo | Resident notified for approval |

Failure: time limit crossed → senior alerted.

### Watchman – let a visitor in

| Step | Action                             | System response                                        |
| ---- | ---------------------------------- | ------------------------------------------------------ |
| 1    | Opens Today's Visitors             | Today's expected visitors of own project               |
| 2    | Searches visitor, taps Allow Entry | Entry time saved                                       |
| 3    | Walk-in: adds details              | Saved and resident informed (or asked to Allow / Deny) |
| 4    | Taps Exit                          | Exit time saved                                        |

Failure: no network → saved on phone, sent later. Resident doesn't answer → call or deny.

## 11. Functional Requirements

Each requirement lists its platform, priority and a test condition written as GIVEN – WHEN – THEN.

### 11.1 Login and Registration

| ID        | Requirement                    | Platform | Priority | Test condition                                                                                             |
| --------- | ------------------------------ | -------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| FR-USR-01 | OTP login                      | Mobile   | Must     | GIVEN a registered number, WHEN the correct OTP is entered, THEN the user logs in with their role          |
| FR-USR-02 | Wrong OTP limit                | Mobile   | Must     | GIVEN 5 wrong attempts, WHEN another is tried, THEN the number is blocked for 30 minutes                   |
| FR-USR-03 | Admin login                    | Web      | Must     | GIVEN admin staff, WHEN they log in, THEN password and OTP are both required                               |
| FR-USR-04 | Self-registration              | Mobile   | Must     | GIVEN a new user, WHEN details are submitted, THEN the request goes only to that project's Society Manager |
| FR-USR-05 | Pending screen                 | Mobile   | Must     | GIVEN a pending request, WHEN the app opens, THEN only the status screen shows                             |
| FR-USR-06 | Many flats or roles, one login | Mobile   | Must     | GIVEN a user with 2 flats, WHEN they log in, THEN they can switch flats                                    |
| FR-USR-07 | Instant access removal         | Both     | Must     | GIVEN a deactivated user, WHEN they next use the app, THEN they are logged out                             |

### 11.2 Project Setup (Web)

| ID        | Requirement                    | Priority | Test condition                                                                       |
| --------- | ------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| FR-PRJ-01 | Create project, building, flat | Must     | GIVEN a new project, WHEN saved, THEN it is available for Society Manager assignment |
| FR-PRJ-02 | Amenities per project          | Must     | GIVEN a hall added, WHEN saved, THEN residents of that project can book it           |
| FR-PRJ-03 | Admin staff access by project  | Must     | GIVEN staff given Project A only, WHEN they log in, THEN they see Project A only     |

### 11.3 Customer Management

| ID        | Requirement                       | Platform | Priority | Test condition                                                                                                                    |
| --------- | --------------------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| FR-CUS-01 | Create or replace Society Manager | Web      | Must     | GIVEN a replacement, WHEN saved, THEN the old member loses access and pending items move to members with the same permission      |
| FR-CUS-02 | Permissions per member            | Web      | Must     | GIVEN Raghuvir Admin gives a member Approve residents, THEN that member sees the approval list                                    |
| FR-CUS-03 | Last-holder protection            | Web      | Must     | GIVEN only one member has Approve residents or Check complaints, WHEN it is removed, THEN the system blocks it                    |
| FR-CUS-04 | Approve or reject resident        | Mobile   | Must     | GIVEN a rejection, WHEN saved, THEN a reason is required and the resident is notified                                             |
| FR-CUS-05 | Add resident manually             | Mobile   | Must     | GIVEN valid details, WHEN saved, THEN the resident gets access without approval                                                   |
| FR-CUS-06 | Owner or Tenant                   | Mobile   | Must     | GIVEN registration, THEN the user picks Owner or Tenant; a tenant also gives owner name and agreement end date                    |
| FR-CUS-07 | One main user per flat            | Both     | Must     | GIVEN a flat with an active main user, WHEN a new request comes, THEN it is flagged Flat Already Taken                            |
| FR-CUS-08 | Occupancy status                  | Both     | Must     | GIVEN any flat, THEN it shows Owner living, Tenant living or Vacant                                                               |
| FR-CUS-09 | Tenancy end                       | Both     | Must     | GIVEN 15 days to agreement end, THEN tenant and Society Manager get a reminder; access ends only after a Society Manager confirms |
| FR-CUS-10 | Owner or tenant change            | Mobile   | Must     | GIVEN the old main user deactivated, WHEN a new one is approved, THEN complaint history stays with the flat                       |
| FR-CUS-11 | Resident list view                | Web      | Should   | GIVEN Raghuvir Admin, WHEN opening residents, THEN the list is view only, filterable by owner or tenant                           |

### 11.4 Complaints

| ID        | Requirement                | Platform | Priority | Test condition                                                                                                                                                 |
| --------- | -------------------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-CMP-01 | Raise complaint            | Mobile   | Must     | GIVEN category, description and up to 5 photos for own flat, WHEN submitted, THEN a unique complaint number is created                                         |
| FR-CMP-02 | Genuineness check          | Mobile   | Must     | GIVEN a new complaint, WHEN marked Not Genuine, THEN a reason is required and the resident notified                                                            |
| FR-CMP-03 | Category setup             | Web      | Must     | GIVEN a category, WHEN saved, THEN it holds responsibility tag, time limits and default Assigned Person                                                        |
| FR-CMP-04 | Route by responsibility    | Both     | Must     | GIVEN a genuine builder complaint, THEN it goes to Raghuvir Admin; GIVEN a society complaint, THEN it stays with the Society Manager                           |
| FR-CMP-05 | Assign complaint           | Both     | Must     | GIVEN a default Assigned Person, THEN assignment is automatic and can be changed by hand                                                                       |
| FR-CMP-06 | My Tasks                   | Web      | Must     | GIVEN an Assigned Person, WHEN they log in, THEN only their complaints show                                                                                    |
| FR-CMP-07 | Status timeline            | Both     | Must     | GIVEN any status change, THEN who, when and remark are saved and a notification sent                                                                           |
| FR-CMP-08 | Closure by complainer only | Mobile   | Must     | GIVEN a Fixed complaint, WHEN the complainer approves, THEN it is Closed and hidden from their list; others cannot approve                                     |
| FR-CMP-09 | Reopen                     | Mobile   | Must     | GIVEN a Fixed complaint, WHEN reopened, THEN a reason is required; after 2 reopens it goes to Raghuvir Admin                                                   |
| FR-CMP-10 | Time limits and escalation | Both     | Must     | GIVEN a crossed check or fix time limit, THEN the next level is alerted                                                                                        |
| FR-CMP-11 | Reminders, no auto-close   | Both     | Must     | GIVEN no resident response after Fixed, THEN reminders go on the set days; after the last one the Society Manager is alerted; it never closes without approval |
| FR-CMP-12 | Manager's own complaint    | Mobile   | Must     | GIVEN a complaint by a Society Manager, THEN the other committee member or Raghuvir Admin checks it                                                            |

### 11.5 Contacts and Documents

| ID        | Requirement         | Platform | Priority | Test condition                                                                                       |
| --------- | ------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------- |
| FR-DIR-01 | Contact directory   | Both     | Must     | GIVEN a contact added, THEN residents see it and can tap to call                                     |
| FR-DOC-01 | Society documents   | Mobile   | Must     | GIVEN a PDF or image up to 10 MB, WHEN uploaded by the Society Manager, THEN residents can view only |
| FR-DOC-02 | Document delete log | Both     | Must     | GIVEN a delete, THEN it is removed from residents and saved in the activity log                      |

Announcements are now part of the Notice Board (11.10).

### 11.6 Amenities (Halls and Shared Facilities)

| ID        | Requirement                 | Platform | Priority | Test condition                                                                                                                   |
| --------- | --------------------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| FR-AMN-01 | Add any amenity per project | Web      | Must     | GIVEN name, type (Bookable or Shared), capacity, open hours, slot length, rules, WHEN saved, THEN it shows in that project's app |
| FR-AMN-02 | Book a bookable amenity     | Mobile   | Must     | GIVEN a booked slot, WHEN selected, THEN it shows unavailable                                                                    |
| FR-AMN-03 | Approve booking             | Mobile   | Must     | GIVEN two requests for one slot, WHEN one is approved, THEN the other is auto-rejected                                           |
| FR-AMN-04 | Cancel booking              | Mobile   | Should   | GIVEN time before cut-off, WHEN cancelled, THEN the slot is free again                                                           |
| FR-AMN-05 | Book a shared facility slot | Mobile   | Must     | GIVEN a date and slot with space, WHEN booked, THEN the slot count goes up by the members booked                                 |
| FR-AMN-06 | Check in and check out      | Mobile   | Must     | GIVEN a resident taps Check In with 2 members, THEN the live count goes up by 3                                                  |
| FR-AMN-07 | Live count for everyone     | Mobile   | Must     | GIVEN any resident of the project, THEN each shared facility shows people inside / capacity                                      |
| FR-AMN-08 | Capacity limit              | Mobile   | Must     | GIVEN capacity reached, WHEN someone checks in, THEN it is blocked with a message                                                |
| FR-AMN-09 | Automatic check-out         | Both     | Must     | GIVEN no check-out by slot end or closing time, THEN the user is checked out                                                     |
| FR-AMN-10 | No-show release             | Both     | Should   | GIVEN no check-in within the set minutes, THEN the slot is freed                                                                 |
| FR-AMN-11 | Close for maintenance       | Mobile   | Must     | GIVEN a facility marked closed, THEN booking stops and booked users are notified                                                 |

### 11.7 Visitors (Mobile)

| ID        | Requirement                | Priority | Test condition                                                                                                                                              |
| --------- | -------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-VIS-01 | Add expected visitor       | Must     | GIVEN a visitor for today, THEN they appear in the Watchman's list with a pass code                                                                         |
| FR-VIS-02 | Today's list               | Must     | GIVEN a Watchman login, THEN only today's visitors of own project show, searchable by name, mobile, pass code                                               |
| FR-VIS-03 | Walk-in entry, record only | Must     | GIVEN no advance entry, WHEN the Watchman adds details, THEN the visit is saved at once with no approval, and the resident gets an information notification |
| FR-VIS-04 | Call resident              | Should   | GIVEN a walk-in, WHEN the Watchman taps Call, THEN the flat's main user is called                                                                           |
| FR-VIS-05 | Entry and exit time        | Must     | GIVEN no exit by midnight, THEN visit is marked Exit Not Recorded                                                                                           |
| FR-VIS-06 | Weak network support       | Should   | GIVEN no network, THEN up to 50 entries are saved on the phone and sent later                                                                               |
| FR-VIS-07 | Simple Watchman screen     | Must     | GIVEN any entry, THEN it takes 3 taps or fewer                                                                                                              |
| FR-VIS-08 | Watchman login management  | Both     | Must                                                                                                                                                        |

### 11.8 Reports and Activity Log

| ID        | Requirement             | Platform | Priority | Test condition                                                                                                  |
| --------- | ----------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| FR-RPT-01 | Admin dashboard         | Web      | Must     | GIVEN Raghuvir Admin, THEN complaints by project, category, status, delays and approved residents vs flats show |
| FR-RPT-02 | Reports                 | Web      | Must     | GIVEN a date range, THEN closure time, delays, reopen count and top categories show                             |
| FR-RPT-03 | Society Manager summary | Mobile   | Should   | GIVEN a Society Manager, THEN only own project summary shows                                                    |
| FR-AUD-01 | Activity log            | Web      | Must     | GIVEN any approval, rejection, status or role change, or delete, THEN user and time are saved                   |

### 11.9 Family and Members

| ID        | Requirement               | Platform | Priority | Test condition                                                                                                                                                                                            |
| --------- | ------------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-FAM-01 | Auto-add head of family   | Mobile   | Must     | GIVEN a resident (owner or tenant) is approved, THEN they are added as member 1 with relation Self                                                                                                        |
| FR-FAM-02 | Add, edit, remove member  | Mobile   | Must     | GIVEN name, relation and birth year, WHEN the resident saves, THEN the member shows in My Family and counts update; only the resident can edit                                                            |
| FR-FAM-03 | Age group from birth year | Both     | Must     | GIVEN a birth year, THEN the member is placed in the matching age group                                                                                                                                   |
| FR-FAM-04 | Yearly age group update   | Both     | Must     | GIVEN 1 January, THEN members move to their new age group automatically                                                                                                                                   |
| FR-FAM-05 | Age group setup           | Web      | Must     | GIVEN Raghuvir Admin sets group names and limits (default Kids 0–17, Adults 18–59, Seniors 60+), THEN all counts recalculate                                                                              |
| FR-FAM-06 | Age not given             | Both     | Must     | GIVEN no birth year, THEN the member is counted under Age Not Given                                                                                                                                       |
| FR-FAM-07 | Duplicate warning         | Mobile   | Should   | GIVEN same name and birth year in another flat of the project, THEN a warning shows                                                                                                                       |
| FR-FAM-08 | Member limit              | Mobile   | Must     | GIVEN 15 members in a flat, WHEN adding another, THEN it is blocked with a message                                                                                                                        |
| FR-FAM-09 | Owner or tenant change    | Both     | Must     | GIVEN a main user deactivated, THEN that family leaves all counts and history is kept                                                                                                                     |
| FR-FAM-10 | Raghuvir family dashboard | Web      | Must     | GIVEN Raghuvir Admin, THEN per project: families, total members, each age group, Age Not Given, owner-living and tenant-living families, vacant flats, average members per family, with a grand total row |
| FR-FAM-11 | Drill-down                | Web      | Must     | GIVEN a project row clicked, THEN the same counts show by building, then by flat                                                                                                                          |
| FR-FAM-12 | Filters                   | Web      | Must     | GIVEN filters for project, building, age group, owner or tenant, THEN counts and list update                                                                                                              |
| FR-FAM-13 | Download member list      | Web      | Should   | GIVEN Raghuvir Admin downloads, THEN an Excel file is created and the download is saved in the activity log                                                                                               |
| FR-FAM-14 | Society Manager summary   | Mobile   | Must     | GIVEN View family data permission, THEN own project counts by building show, including owners vs tenants, plus the member list (view only)                                                                |
| FR-FAM-15 | Privacy                   | Both     | Must     | GIVEN a Resident or Watchman, THEN no other family's details or counts are visible                                                                                                                        |

**Definitions:** Family = one approved flat. Member = a person added under that flat. A person belongs to one flat only.

### 11.10 Notice Board and Events

| ID       | Requirement                        | Platform | Priority | Test condition                                                                                                           |
| -------- | ---------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| FR-NB-01 | Post types                         | Both     | Must     | GIVEN a new post, THEN type is one of Announcement, Celebration, Event, Urgent                                           |
| FR-NB-02 | Raghuvir post to selected projects | Web      | Must     | GIVEN Projects A and C selected, WHEN published, THEN only A and C users see it                                          |
| FR-NB-03 | Society Manager post               | Mobile   | Must     | GIVEN Post notices permission, THEN only own project (or selected buildings) sees the post                               |
| FR-NB-04 | Show-from and show-until dates     | Both     | Must     | GIVEN show-until passed, THEN the post moves to Past                                                                     |
| FR-NB-05 | Schedule publish                   | Both     | Should   | GIVEN a future publish time, THEN the post appears and notifies at that time                                             |
| FR-NB-06 | Pin to top                         | Both     | Should   | GIVEN a pinned post, THEN it stays first on the board                                                                    |
| FR-NB-07 | Notification on publish            | Both     | Must     | GIVEN a published post, THEN target users get a notification that opens the post                                         |
| FR-NB-08 | Event details                      | Both     | Must     | GIVEN type Event, THEN date, time and venue are required                                                                 |
| FR-NB-09 | Notify by age group                | Both     | Should   | GIVEN invited group Kids, THEN notification goes only to families with kids; post still visible to all in the project    |
| FR-NB-10 | Edit or cancel                     | Both     | Must     | GIVEN an edit or cancel after publish, THEN the post is marked Updated or Cancelled and target users are notified        |
| FR-NB-11 | Read only board                    | Mobile   | Must     | GIVEN any app user, THEN only own project's current posts show, pinned and newest first, with no reply or comment option |

### 11.11 Neighbours

| ID        | Requirement           | Platform | Priority | Test condition                                                                                                                      |
| --------- | --------------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| FR-NBR-01 | Same floor only       | Mobile   | Must     | GIVEN a resident on floor 4 of Building B, THEN only other registered flats on floor 4 of Building B show                           |
| FR-NBR-02 | Limited details       | Mobile   | Must     | GIVEN a neighbour, THEN only flat number, main person's name and occupation show; never phone, email, family or owner/tenant status |
| FR-NBR-03 | Occupation field      | Mobile   | Must     | GIVEN registration or profile, THEN occupation can be entered (optional)                                                            |
| FR-NBR-04 | Show me to neighbours | Mobile   | Must     | GIVEN the setting turned off, THEN neighbours see the flat number only                                                              |
| FR-NBR-05 | Live update           | Mobile   | Must     | GIVEN a main user change, THEN the neighbour list updates at once                                                                   |

## 12. User Stories

| ID    | As a            | I want to                                 | So that                                             | Linked to     |
| ----- | --------------- | ----------------------------------------- | --------------------------------------------------- | ------------- |
| US-01 | Resident        | Register myself with my flat              | I can use the app without visiting the office       | FR-USR-04     |
| US-02 | Resident        | Raise a complaint with photos             | My issue is recorded once and not lost              | FR-CMP-01     |
| US-03 | Resident        | Approve or reopen a fixed complaint       | It closes only when the work is really done         | FR-CMP-08, 09 |
| US-04 | Resident        | Book the hall                             | I avoid clashes and paperwork                       | FR-HAL-01     |
| US-05 | Resident        | Add an expected visitor                   | My guests enter without trouble                     | FR-VIS-01     |
| US-06 | Society Manager | Approve residents of my project           | Only real residents get access                      | FR-CUS-02     |
| US-07 | Society Manager | Check complaints before they move forward | Raghuvir doesn't waste effort on non-genuine issues | FR-CMP-02     |
| US-08 | Society Manager | Upload society documents                  | Documents aren't lost when the committee changes    | FR-DOC-01     |
| US-09 | Raghuvir Admin  | See all projects' complaints in one place | I act on delays without phone calls                 | FR-RPT-01     |
| US-10 | Raghuvir Admin  | Replace a Society Manager                 | Work continues without a break                      | FR-CUS-01     |
| US-11 | Raghuvir Admin  | Send one message to all owners            | Everyone gets the same information on time          | FR-ANN-01     |
| US-12 | Assigned Person | See only my tasks                         | I know exactly what to fix and where                | FR-CMP-06     |
| US-13 | Watchman        | See today's visitors                      | I let guests in fast without calling flats          | FR-VIS-02     |
| US-14 | Watchman        | Add a walk-in visitor                     | Every entry is recorded even without advance entry  | FR-VIS-03     |

| ID    | As a            | I want to                                                   | So that                                                     | Linked to |
| ----- | --------------- | ----------------------------------------------------------- | ----------------------------------------------------------- | --------- |
| US-15 | Resident        | Add my family members once                                  | The society knows who lives in my flat                      | FR-FAM-02 |
| US-16 | Raghuvir Admin  | See families by age group and owners vs tenants per project | I plan events, facilities and senior care with real numbers | FR-FAM-10 |
| US-17 | Society Manager | See member counts by building                               | I plan society events and needs for my project              | FR-FAM-14 |
| US-18 | Raghuvir Admin  | Post an event to selected projects only                     | Only the right projects see it                              | FR-NB-02  |
| US-19 | Society Manager | Post celebrations on my project's notice board              | Everyone in the project gets the news in one place          | FR-NB-03  |
| US-20 | Tenant          | Register and use the app like an owner                      | I can raise complaints and book facilities where I live     | FR-CUS-06 |
| US-21 | Resident        | See how many people are in the gym or pool now              | I go when it is less crowded                                | FR-AMN-07 |
| US-22 | Resident        | See my same-floor neighbours' names                         | I know who lives next to me without sharing phone numbers   | FR-NBR-01 |
| US-23 | Raghuvir Admin  | Give approval rights to any committee member                | Work continues even if the Secretary is busy                | FR-CUS-02 |

## 13. Non-Functional Requirements

Every quality requirement below has a number the team can test before release.

| ID     | Area            | Requirement                         | Measure                                                           |
| ------ | --------------- | ----------------------------------- | ----------------------------------------------------------------- |
| NFR-01 | Speed           | Screen load                         | Under 3 seconds on 4G                                             |
| NFR-02 | Speed           | OTP delivery                        | Within 30 seconds                                                 |
| NFR-03 | Speed           | Visitor search                      | Result in under 2 seconds                                         |
| NFR-04 | Uptime          | System available                    | 99.5% per month                                                   |
| NFR-05 | Growth          | Handles more projects and users     | 50+ projects, 25,000 users, 1,000 at the same time                |
| NFR-06 | Data separation | No user sees another project's data | Checked on the server for every request; tested every release     |
| NFR-07 | Security        | Admin login                         | Password + OTP on Web Panel                                       |
| NFR-08 | Security        | Data protection                     | Encrypted in transfer and in storage                              |
| NFR-09 | Security        | Session                             | Mobile logout after 30 days unused; Web after 30 minutes unused   |
| NFR-10 | Backup          | Recovery                            | Daily backup; restore within 4 hours; at most 1 hour of data lost |
| NFR-11 | Devices         | Supported                           | Android 9+, iOS 14+, Chrome, Edge, Safari                         |
| NFR-12 | Language        | App languages                       | English, Gujarati and Hindi                                       |
| NFR-13 | Weak network    | Offline visitor entry               | Up to 50 entries saved on phone, sent when network returns        |
| NFR-14 | Files           | Photo size                          | Auto-compressed; max 5 MB per photo, 10 MB per document           |
| NFR-15 | Records         | Activity log kept                   | At least 3 years                                                  |
| NFR-16 | Records         | Complaint history kept              | At least the 5-year defect responsibility period                  |

NFR-06, 08, 15 and 16 link to the compliance rules in Section 19.

**Added:** NFR-17 live facility count refreshes within 30 seconds. NFR-18 the number of projects, buildings, floors, flats and amenities is not fixed; Raghuvir Admin adds them as needed with no code change.

## 14. UI/UX Requirements

The design must be modern, neat, clean, minimal and compact, so every user finishes their main task in 3 taps or fewer.

### 14.1 Design Direction

- Follow current design standards: Material 3 for Android, Apple design guidelines for iOS.
- One design system for Web and Mobile: same colours, fonts, spacing, icons and buttons.
- Plenty of white space; no crowded screens; no extra decoration.
- Light mode required; dark mode is Should Have.

### 14.2 Effort Targets (must meet)

| Task                      | User            | Maximum effort                                     |
| ------------------------- | --------------- | -------------------------------------------------- |
| Log in                    | All             | Mobile number + OTP, read automatically on Android |
| Raise a complaint         | Resident        | 3 taps, under 60 seconds                           |
| Approve a fixed complaint | Resident        | 2 taps, straight from the notification             |
| Approve a resident        | Society Manager | 2 taps                                             |
| Check a complaint         | Society Manager | 2 taps                                             |
| Book the hall             | Resident        | 4 taps                                             |
| Visitor entry             | Watchman        | 3 taps, under 30 seconds                           |
| Assign a complaint        | Raghuvir Admin  | 2 clicks                                           |
| Learn the app             | Any new user    | Under 5 minutes, no training                       |

Added targets: add a family member in 3 taps; check in to a facility in 1 tap; post a notice in under 1 minute. The family dashboard shows counts as number cards on top and a bar per project split by age group, with the table below.

### 14.3 Mobile App Rules

- **Home by role:** each user sees only what they need; the most-used action sits at the top.
- **Bottom menu:** 4–5 items at most per role.
- **One main button per screen**, clearly visible.
- **Touch targets** at least 48 × 48 px for easy thumb use.
- **Notifications open the exact screen**, not the home screen.
- **Forms:** auto-fill known details (flat, name); required fields only; camera button for photos.
- **Loading:** placeholder blocks, not blank screens or spinners.
- **Empty screens:** a simple message and one action ("No complaints. Raise one").
- **Errors:** plain words that say what to do next; never technical messages.
- **Watchman screen:** extra-large buttons and text, Gujarati and Hindi, usable with one hand.
- **Movement:** short, subtle animations of 150–250 ms only.

### 14.4 Web Panel Rules

- Left side menu, clean top bar, project selector.
- Tables with search, filters (project, status, category, date), sorting and saved filters.
- Status shown as colour labels that also carry text.
- Details open in a side panel so the user keeps their place in the list.
- Bulk actions where useful, such as assigning many complaints at once.
- Works well on screens 1280 px and wider; tablet is Should Have.

### 14.5 Accessibility and Language

- Text contrast meets WCAG 2.1 AA.
- Supports the phone's large-text setting without breaking layout.
- Every screen fully in one language (English, Gujarati or Hindi), never mixed.
- Icons always carry a text label.

### 14.6 Design Deliverables

| Deliverable                                | When                        |
| ------------------------------------------ | --------------------------- |
| Clickable design of all key flows (Figma)  | Before development          |
| Client review and approval of design       | Required before development |
| Design system (colours, fonts, components) | Shared with developers      |

## 15. Assumptions and Dependencies

**Assumptions:**

| #   | We assume                                                                  | If wrong                                     |
| --- | -------------------------------------------------------------------------- | -------------------------------------------- |
| A1  | Check-in at a shared facility is a tap in the app (no QR or gate device)   | QR at the facility entrance needs extra work |
| A2  | One main user per flat: the owner or tenant who lives there                | Extra users per flat need more access rules  |
| A3  | Assigned People for builder complaints use the Web Panel                   | A mobile screen for them needed              |
| A4  | A member with Assign society complaints updates status for society vendors | Vendor login needed; scope change            |
| A5  | Closed complaints are fully hidden from residents                          | A small history screen needed                |
| A6  | Hall and facility booking is free                                          | Payment needed (Phase 2)                     |
| A7  | Watchmen share the same mobile app                                         | A separate gate app needed                   |

**Dependencies:**

| #   | Who provides what                                                | If late                    |
| --- | ---------------------------------------------------------------- | -------------------------- |
| D1  | Raghuvir: project, building and flat list                        | Project cannot go live     |
| D2  | Raghuvir: complaint categories, responsibility tags, time limits | Routing cannot be finished |
| D3  | SMS provider: OTP sender ID and template approval                | Login will not work        |
| D4  | Raghuvir: Apple and Google developer accounts in its name        | App store release delayed  |

## 16. Constraints

| ID     | Type           | Constraint                                                            | Effect                                                     |
| ------ | -------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| CON-01 | Legal          | OTP SMS templates must be registered under TRAI DLT rules             | 1–2 weeks lead time before launch                          |
| CON-02 | Technical      | One common backend for all projects                                   | Project check needed on every request                      |
| CON-03 | Legal          | Personal data must follow the DPDP Act, 2023                          | Consent screen, data deletion and breach handling required |
| CON-04 | Organizational | Raghuvir only creates Society Managers; it does not approve residents | All approvals depend on an active Society Manager          |

## 17. Risks

| ID     | Risk                                         | Chance | Impact | Prevention                                                  | Backup plan                                | Owner            |
| ------ | -------------------------------------------- | ------ | ------ | ----------------------------------------------------------- | ------------------------------------------ | ---------------- |
| RSK-01 | Residents, mainly elderly, don't use the app | Medium | High   | Simple screens, Gujarati, onboarding led by Society Manager | Society Manager raises complaints for them | Raghuvir Admin   |
| RSK-02 | Inactive Society Manager blocks approvals    | High   | High   | Reminders and auto-escalation                               | Raghuvir Admin overrides                   | Raghuvir Admin   |
| RSK-03 | One project's data shown in another          | Low    | High   | Server-side project check, tested each release              | Immediate fix, inform affected users       | Tech Lead        |
| RSK-04 | Dispute on builder vs society responsibility | Medium | Medium | Category list agreed with Raghuvir                          | Raghuvir Admin decides                     | Raghuvir Admin   |
| RSK-05 | New feature asks during the project          | High   | Medium | Fixed Phase 1 scope, change approval                        | Move to Phase 2 list                       | Business Analyst |
| RSK-06 | Fake registrations                           | Medium | Medium | Society Manager approval + one-flat check                   | Deactivate and log                         | Society Manager  |
| RSK-07 | Watchman finds the app hard                  | Medium | Medium | Large buttons, 3 taps, local language                       | On-site training by Society Manager        | Society Manager  |

## 18. Success Metrics

| ID     | Metric                              | Objective | Today                       | Target    | By when  | Owner           |
| ------ | ----------------------------------- | --------- | --------------------------- | --------- | -------- | --------------- |
| MET-01 | Complaints raised through the app   | OBJ-01    | TBD                         | 100%      | 3 months | Raghuvir Admin  |
| MET-02 | Average closure time                | OBJ-01    | TBD (measure before launch) | 40% lower | 6 months | Raghuvir Admin  |
| MET-03 | Approved residents vs total flats   | OBJ-02    | 0%                          | 70%       | 3 months | Society Manager |
| MET-04 | Complaints past their time limit    | OBJ-03    | TBD                         | Under 10% | 6 months | Raghuvir Admin  |
| MET-05 | Announcements delivered             | OBJ-04    | TBD                         | 90%       | 3 months | Raghuvir Admin  |
| MET-06 | Hall bookings made in the app       | OBJ-05    | 0%                          | 80%       | 3 months | Society Manager |
| MET-07 | Visitor entries recorded in the app | OBJ-05    | 0%                          | 90%       | 3 months | Society Manager |

## 19. Compliance and Legal

Three Indian rules apply; the DPDP Act shapes the most screens.

| Rule                                       | Why it applies                                                                              | What the system must do                                                                                                                                                                              | Risk if missed                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Digital Personal Data Protection Act, 2023 | Stores names, mobile numbers, flat and visitor details                                      | Consent screen and privacy notice at registration; collect only needed data; let users ask for deletion; inform users and authority of a breach; delete visitor data after 90 days (to be confirmed) | Heavy penalties and brand damage   |
| RERA – defect responsibility period        | Builder must fix construction defects for a set period after possession (generally 5 years) | Builder Responsibility tag; full complaint record with photos kept at least 5 years as proof of action                                                                                               | Legal disputes without proof       |
| TRAI commercial SMS rules (DLT)            | OTP is sent by SMS                                                                          | Register sender ID and SMS templates before launch                                                                                                                                                   | OTP SMS blocked; nobody can log in |

**Family member data and the DPDP Act:** the app stores members' names and age, including children. To keep this safe: store birth year only, not full birth date; collect consent from the head of family when adding members; show children's details only to the Society Manager and Raghuvir Admin; log every download of the member list; remove members' data when a family leaves (after the retention period).

**Neighbours list and the DPDP Act:** showing a name and occupation to neighbours needs the person's consent. Ask at registration with a clear "Show me to neighbours" choice; let them change it anytime in Profile.

## 20. Open Questions and Simple Terms

Most questions are now answered by Raghuvir; the decisions are below, followed by the few still open.

| Question                      | Decision                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Walk-in visitor               | Record only; resident informed, no approval                                    |
| Who creates the Watchman      | Both Raghuvir Admin and Society Manager (with permission)                      |
| Facility access               | Book by date and slot in the app; everyone sees live count inside gym and pool |
| Complaints scope              | Own flat only                                                                  |
| Tenants                       | Allowed                                                                        |
| Who approves                  | Anyone given the permission by Raghuvir Admin                                  |
| Auto-close                    | No auto-close; reminders instead                                               |
| Hindi                         | Yes                                                                            |
| Number of flats and amenities | Not fixed; set up by Raghuvir Admin                                            |
| Age groups                    | Set by Raghuvir Admin                                                          |
| Who edits family list         | Only the resident                                                              |
| Tenant families               | Counted; dashboard shows owner vs tenant                                       |
| Event replies                 | None; notice board is for reading only                                         |
| Comments on notices           | No                                                                             |

**Still open:**

- [ ] Owner who rents out the flat: no access, or limited access (notice board, documents)?
- [ ] Facility check-in: app tap only, or QR code at the entrance?
- [ ] Should a tenant upload the rent agreement during registration?
- [ ] Can a resident hide their name from neighbours, or is it always shown?

**Simple terms:**

| Term                   | Meaning                                                  |
| ---------------------- | -------------------------------------------------------- |
| OTP                    | One-time code sent by SMS for login                      |
| Society Manager        | Secretary or President of a project                      |
| Assigned Person        | The person who fixes a complaint                         |
| Watchman               | Gate security who records visitors                       |
| Time limit             | Maximum time allowed for a complaint step                |
| Escalation             | Automatic alert to a senior when a time limit is crossed |
| Builder responsibility | Defect Raghuvir must fix                                 |
| Society responsibility | Work the society handles itself                          |
