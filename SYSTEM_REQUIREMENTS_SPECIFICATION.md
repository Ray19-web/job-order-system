# System Requirements Specification (SRS)

## 1. Document information

| Item | Details |
| --- | --- |
| System name | Easy-Ink Job Order System |
| Version | 1.0 |
| Purpose | Manage print-shop job orders, production status, staff access, approvals, payments, and warnings. |
| Intended users | Shop owners, administrators, attendants, and OJT staff. |

## 2. System purpose

Easy-Ink provides a centralized system for recording and monitoring print-shop job orders. It replaces manual tracking with a role-based web interface where staff can create orders, update permitted information, and monitor production. Administrators can approve orders, confirm completed work, manage staff accounts, and control permissions.

## 3. Scope

The system covers the following business areas:

- Job-order creation and tracking.
- Order status, payment, warning, and note management.
- Deadline monitoring and notification display.
- Administrator approvals and completion confirmation.
- Staff account, role, branch, and permission management.
- Search, filtering, sorting, and pagination of operational records.

The current version is designed for two branches: **Branch 1** and **Branch 2**.

## 4. User roles

| Role | Description | Main access |
| --- | --- | --- |
| Admin | System owner or manager. | Full system access, approval, final confirmation, user management, and account controls. |
| Attendant | Print-shop staff member. | Access is controlled by assigned permissions. |
| OJT | On-the-job trainee. | View-only by default; an administrator can enable specific permissions. |

## 5. Functional requirements

### 5.1 Authentication and account access

| ID | Requirement |
| --- | --- |
| FR-01 | The system shall allow registered users to sign in using a username and password. |
| FR-02 | The system shall prevent inactive staff accounts from accessing the application. |
| FR-03 | The system shall allow a user to sign out. |
| FR-04 | The system shall display the current user's profile information. |
| FR-05 | The system shall allow an administrator to reset a staff member's password. |

### 5.2 Job-order management

| ID | Requirement |
| --- | --- |
| FR-06 | Authorized users shall be able to create a new job order. |
| FR-07 | A job order shall record a job number, customer name and contact, branch, item type, quantity, print details, deadline, payment information, status, notes, warnings, creator, and timestamps. |
| FR-08 | The system shall convert submitted user-entered text to uppercase where applicable before saving. |
| FR-09 | The system shall display active orders as cards. |
| FR-10 | The system shall display a card ribbon that identifies the current order status. |
| FR-11 | Authorized users shall be able to open an order and update permitted information. |
| FR-12 | Authorized users shall be able to add notes to an order. |
| FR-13 | Authorized users shall be able to flag or clear an order warning. |
| FR-14 | Authorized users shall be able to update payment status. |
| FR-15 | The system shall retain job orders; deletion shall not be available. Administrators shall be able to archive an unfinished order without marking it completed. |

### 5.3 Order workflow

| ID | Requirement |
| --- | --- |
| FR-16 | New attendant job orders shall enter **Pending Approval** status. |
| FR-17 | An administrator shall be able to approve an order and move it to **Pending**. |
| FR-18 | Staff with status-update permission shall be able to move an order through allowed production statuses. |
| FR-19 | An order ready for final sign-off shall enter **For Admin Confirmation** status. |
| FR-20 | An administrator shall be able to confirm the order as completed. |
| FR-21 | Completed orders shall be retained in the Archive page. |
| FR-22 | The system shall show confirmation prompts for consequential status changes. |

### 5.4 Supported job statuses

| Status | Meaning |
| --- | --- |
| Pending Approval | Newly submitted order awaiting administrator approval. |
| Pending | Approved order waiting to begin production. |
| In Production | Order is currently being produced. |
| Ready for Release | Order is ready for customer release. |
| For Admin Confirmation | Staff submitted the completed work for final administrator confirmation. |
| Completed | Work has been confirmed and archived. |
| Archived | Order was removed from the active workflow without being marked completed. |

### 5.5 Payments and deadlines

| ID | Requirement |
| --- | --- |
| FR-23 | The system shall support Unpaid, Down Payment, and Paid payment states. |
| FR-24 | The system shall identify orders as overdue, due today, due tomorrow, upcoming, or completed. |
| FR-25 | The Active Orders page shall show summary counts for overdue/today, due tomorrow, in production, and warnings. |
| FR-26 | The system shall visually emphasize overdue and warning-flagged orders. |

### 5.6 Search, filter, sort, and pagination

| ID | Requirement |
| --- | --- |
| FR-27 | The Active Orders, Approvals, and Archive pages shall provide job-order search. |
| FR-28 | Job-order pages shall provide branch, payment, warning, and relevant status filtering. Archive shall support All Archive Orders, Completed, and Archived status filters. |
| FR-29 | Job-order pages shall provide icon-based sorting for newest, deadline, and customer name. |
| FR-30 | The Staff Access page shall provide staff-name and username search. |
| FR-31 | The Staff Access page shall allow filtering by Active, Inactive, and All staff; Active is the default filter. |
| FR-32 | The Staff Access page shall provide icon-based sorting for name, role, and branch. |
| FR-33 | Job orders and staff accounts shall use pagination when there are more records than fit on one page. |

### 5.7 Notifications

| ID | Requirement |
| --- | --- |
| FR-34 | The system shall generate notifications for relevant order deadlines, overdue orders, and warnings. |
| FR-35 | The newest notifications shall appear first. |
| FR-36 | Unread notifications shall be shown before read notifications. |
| FR-37 | Users shall be able to mark individual notifications or all notifications as read. |
| FR-38 | The notification area shall provide access to the related job order. |

### 5.8 Staff management

| ID | Requirement |
| --- | --- |
| FR-39 | Administrators shall be able to add a staff account through a modal form. |
| FR-40 | The add-staff form shall require full name, username, password, role, and branch. |
| FR-41 | Usernames shall be unique. |
| FR-42 | Administrators shall be able to view a staff member's role, branch, permissions, and account state. |
| FR-43 | Administrators shall be able to change a staff member's role, branch, and permissions. |
| FR-44 | Permission changes shall not be saved until the administrator selects **Save changes** and confirms the action. |
| FR-45 | Administrators shall be able to deactivate or reactivate an account, except their own account. |
| FR-46 | The staff list shall show the member name, username, active state, role, branch, permission summary, and actions. |

### 5.9 Staff permissions

The system shall support the following assignable permissions:

- Add Walk-in Orders
- Update Status
- Update Payment
- Add Notes
- Flag Warnings
- Submit Done
- Approve Orders
- Finalize Orders
- Manage Users

## 6. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | The application shall be accessible through a modern desktop or mobile web browser. |
| NFR-02 | The interface shall adapt to desktop and smaller screen widths without unintended horizontal page scrolling. |
| NFR-03 | Buttons, icon-only controls, and profile actions shall expose accessible labels or tooltips. |
| NFR-04 | The interface shall use confirmation dialogs before destructive or important operations. |
| NFR-05 | The server shall validate required fields, valid workflow transitions, permissions, and password requirements. |
| NFR-06 | Passwords shall be stored as password hashes, not plain text. |
| NFR-07 | The user interface shall provide clear empty states and error feedback when no records match or an operation fails. |
| NFR-08 | The project shall pass TypeScript type checking before release. |

## 7. Data requirements

### 7.1 User account data

- Unique identifier
- Username
- Password hash
- Full name
- Role
- Assigned branch
- Permission configuration
- Active/inactive state
- Creation timestamp

### 7.2 Job-order data

- Unique identifier and human-readable job number
- Customer information
- Branch
- Product or item type, quantity, and print details
- Deadline
- Workflow status
- Payment status and payment note
- Warning state and warning summary
- Notes with author and timestamp
- Creator, approver, and completion information
- Creation and update timestamps

## 8. Technical requirements

| Area | Requirement |
| --- | --- |
| Client | React with TypeScript and Vite. |
| Styling | Tailwind CSS utilities and component-level styles. |
| Server | Node.js with Express. |
| Data storage | Local JSON data file for the current development version. |
| API | REST-style `/api` endpoints for authentication, job orders, notes, and users. |
| Runtime | Node.js 20 or newer. |
| Default port | `3000`. |
| Development reload | `npm run dev` shall automatically reload the local development server after source changes. |

## 9. Assumptions and constraints

- The current release is intended for local development and evaluation.
- The local JSON store is not intended as the final multi-user production database.
- A future production release should replace the data adapter with a managed database while retaining the existing API contract.
- Only administrators can manage staff accounts and complete approval-only workflow steps.

## 10. Acceptance criteria

The system is ready for acceptance when the following are demonstrated:

1. A staff member can sign in and see only the actions permitted to their role.
2. An authorized user can create, find, filter, sort, and open a job order.
3. An attendant order can be approved by an administrator and completed through the defined workflow.
4. Payment, note, warning, and deadline information are visible and update correctly for permitted users.
5. Notifications are ordered with unread and newest items first.
6. An administrator can add, view, configure, save, reset, deactivate, and reactivate staff accounts.
7. Staff and order lists remain readable and usable with at least 20 records.
8. `npm run lint` and `npm run build` finish successfully.

## 11. Documentation maintenance

- The project documentation shall be updated whenever a feature, workflow, role, permission, data field, interface behavior, or technical requirement changes.
- Each change shall keep this SRS and the project overview document aligned with the implemented system.
