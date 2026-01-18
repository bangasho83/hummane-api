# Hummane API cURL Examples

## Setup
export BASE_URL="http://localhost:3000"
export TOKEN="YOUR_JWT"
export COMPANY_ID="YOUR_COMPANY_ID"

Most endpoints require a JWT:
-H "Authorization: Bearer $TOKEN"

All tenant-scoped payloads include companyId (the API also enforces it from the JWT).
List endpoints accept `?limit=` (default 50, max 100).

## Auth
### POST /auth/login
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"firebaseToken":"YOUR_FIREBASE_ID_TOKEN"}'

## Users
### POST /users
curl -X POST "$BASE_URL/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex Doe","email":"alex@example.com","companyId":"YOUR_COMPANY_ID"}'

### GET /users
curl -X GET "$BASE_URL/users" \
  -H "Authorization: Bearer $TOKEN"

### GET /users/me
curl -X GET "$BASE_URL/users/me" \
  -H "Authorization: Bearer $TOKEN"

### GET /users/:id
curl -X GET "$BASE_URL/users/YOUR_USER_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /users/:id
curl -X PUT "$BASE_URL/users/YOUR_USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex Updated","companyId":"YOUR_COMPANY_ID"}'

### DELETE /users/:id
curl -X DELETE "$BASE_URL/users/YOUR_USER_ID" \
  -H "Authorization: Bearer $TOKEN"

Invite flow (single-company users):
1) Create an employee record with the user's email.
2) Create an invite via `POST /invitations` (stores the invite + sends invite link).
3) When the user accepts and logs in, link `employees.userId` and let them complete their profile.

## Invitations
### POST /invitations
curl -X POST "$BASE_URL/invitations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","employeeId":"YOUR_EMPLOYEE_ID","expiresAt":"2024-12-31T23:59:59Z","companyId":"YOUR_COMPANY_ID"}'

Response includes `inviteToken` for your email flow.

### GET /invitations
curl -X GET "$BASE_URL/invitations" \
  -H "Authorization: Bearer $TOKEN"

### GET /invitations/:id
curl -X GET "$BASE_URL/invitations/YOUR_INVITATION_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /invitations/:id
curl -X PUT "$BASE_URL/invitations/YOUR_INVITATION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"revoked","companyId":"YOUR_COMPANY_ID"}'

### DELETE /invitations/:id
curl -X DELETE "$BASE_URL/invitations/YOUR_INVITATION_ID" \
  -H "Authorization: Bearer $TOKEN"

## Companies
### POST /companies
curl -X POST "$BASE_URL/companies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Inc","industry":"Software","size":"11-50","currency":"USD","timezone":"America/New_York","workingHours":{"monday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"tuesday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"wednesday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"thursday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"friday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"saturday":{"open":false,"start":"09:00 AM","end":"05:00 PM"},"sunday":{"open":false,"start":"09:00 AM","end":"05:00 PM"}}}'

### GET /companies
curl -X GET "$BASE_URL/companies" \
  -H "Authorization: Bearer $TOKEN"

### GET /companies/:id
curl -X GET "$BASE_URL/companies/YOUR_COMPANY_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /companies/:id
curl -X PUT "$BASE_URL/companies/YOUR_COMPANY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"industry":"Fintech","currency":"USD","timezone":"America/Los_Angeles","workingHours":{"monday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"tuesday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"wednesday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"thursday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"friday":{"open":true,"start":"09:00 AM","end":"05:00 PM"},"saturday":{"open":false,"start":"09:00 AM","end":"05:00 PM"},"sunday":{"open":false,"start":"09:00 AM","end":"05:00 PM"}}}'

### DELETE /companies/:id
curl -X DELETE "$BASE_URL/companies/YOUR_COMPANY_ID" \
  -H "Authorization: Bearer $TOKEN"

## Employees
### POST /employees
curl -X POST "$BASE_URL/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP-001","companyId":"YOUR_COMPANY_ID","userId":"YOUR_USER_ID","departmentId":"YOUR_DEPARTMENT_ID","reportingManagerId":"YOUR_MANAGER_EMPLOYEE_ID","name":"Jane Doe","email":"jane@example.com","startDate":"2024-01-01","employmentType":"Full-time","employmentMode":"Onsite","gender":"Female","photoUrl":"https://example.com/jane-doe.jpg","dob":"1990-01-01","personalDetails":{"personalInfo":{"email":"jane.personal@example.com","number":"+1234567890"},"nationalId":"NIC-12345","address":{"permanentAddress":"123 Main St, City","temporaryAddress":"456 Temp St, City"},"emergencyContact":{"relation":"Spouse","name":"John Doe","number":"+0987654321"},"bloodGroup":"O+","bankAccount":{"title":"Jane Doe","bankName":"Global Bank","accountNumber":"GB123456789"}}}'

### GET /employees
curl -X GET "$BASE_URL/employees" \
  -H "Authorization: Bearer $TOKEN"

### GET /employees/:id
curl -X GET "$BASE_URL/employees/YOUR_EMPLOYEE_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /employees/:id
curl -X PUT "$BASE_URL/employees/YOUR_EMPLOYEE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyId":"YOUR_COMPANY_ID","userId":"YOUR_USER_ID","departmentId":"YOUR_DEPARTMENT_ID","employmentType":"Full-time","employmentMode":"Hybrid","photoUrl":"https://example.com/jane-updated.jpg","dob":"1990-01-01"}'

### DELETE /employees/:id
curl -X DELETE "$BASE_URL/employees/YOUR_EMPLOYEE_ID" \
  -H "Authorization: Bearer $TOKEN"

Employee responses include `departmentName` and `roleName` when those IDs are set.

## Departments
### POST /departments
curl -X POST "$BASE_URL/departments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Engineering","description":"Core product team","companyId":"YOUR_COMPANY_ID"}'

### GET /departments
curl -X GET "$BASE_URL/departments" \
  -H "Authorization: Bearer $TOKEN"

### GET /departments/:id
curl -X GET "$BASE_URL/departments/YOUR_DEPARTMENT_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /departments/:id
curl -X PUT "$BASE_URL/departments/YOUR_DEPARTMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"Platform and infrastructure","companyId":"YOUR_COMPANY_ID"}'

### DELETE /departments/:id
curl -X DELETE "$BASE_URL/departments/YOUR_DEPARTMENT_ID" \
  -H "Authorization: Bearer $TOKEN"

## Roles
### POST /roles
curl -X POST "$BASE_URL/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Engineering Manager","description":"Leads a team","companyId":"YOUR_COMPANY_ID"}'

### GET /roles
curl -X GET "$BASE_URL/roles" \
  -H "Authorization: Bearer $TOKEN"

### GET /roles/:id
curl -X GET "$BASE_URL/roles/YOUR_ROLE_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /roles/:id
curl -X PUT "$BASE_URL/roles/YOUR_ROLE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"Leads multiple teams","companyId":"YOUR_COMPANY_ID"}'

### DELETE /roles/:id
curl -X DELETE "$BASE_URL/roles/YOUR_ROLE_ID" \
  -H "Authorization: Bearer $TOKEN"

## Jobs
### POST /jobs
curl -X POST "$BASE_URL/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Backend Engineer","departmentId":"YOUR_DEPARTMENT_ID","status":"open","employmentType":"Full-time","employmentMode":"Remote","salaryFrom":60000,"salaryTo":85000,"companyId":"YOUR_COMPANY_ID"}'

### GET /jobs
curl -X GET "$BASE_URL/jobs" \
  -H "Authorization: Bearer $TOKEN"

Example response:
```json
[
  {
    "id": "...",
    "title": "Backend Engineer",
    "applicantCount": 5,
    ...
  }
]
```

### GET /jobs/:id
curl -X GET "$BASE_URL/jobs/YOUR_JOB_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /jobs/:id
curl -X PUT "$BASE_URL/jobs/YOUR_JOB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"closed","departmentId":"YOUR_DEPARTMENT_ID","employmentMode":"Hybrid","salaryTo":90000,"companyId":"YOUR_COMPANY_ID"}'

### DELETE /jobs/:id
curl -X DELETE "$BASE_URL/jobs/YOUR_JOB_ID" \
  -H "Authorization: Bearer $TOKEN"

## Applicants
### POST /applicants
curl -X POST "$BASE_URL/applicants" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Sam Applicant","email":"sam@example.com","status":"new","appliedDate":"2024-01-02","jobId":"YOUR_JOB_ID","yearsOfExperience":4.5,"currentSalary":65000,"expectedSalary":72000,"companyId":"YOUR_COMPANY_ID","documents":{"files":["https://example.com/sam-resume.pdf","https://example.com/sam-cover-letter.docx"]}}'

### GET /applicants
curl -X GET "$BASE_URL/applicants" \
  -H "Authorization: Bearer $TOKEN"

### GET /applicants (Filtered by Job)
curl -X GET "$BASE_URL/applicants?jobId=YOUR_JOB_ID" \
  -H "Authorization: Bearer $TOKEN"

### GET /applicants/:id
curl -X GET "$BASE_URL/applicants/YOUR_APPLICANT_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /applicants/:id
curl -X PUT "$BASE_URL/applicants/YOUR_APPLICANT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"interview","yearsOfExperience":5.0,"expectedSalary":75000,"companyId":"YOUR_COMPANY_ID","documents":{"files":["https://example.com/sam-resume.pdf"]}}'

### DELETE /applicants/:id
curl -X DELETE "$BASE_URL/applicants/YOUR_APPLICANT_ID" \
  -H "Authorization: Bearer $TOKEN"

## Leave Types
### POST /leave-types
curl -X POST "$BASE_URL/leave-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Annual Leave","unit":"Day","quota":15,"color":"#e51451","companyId":"YOUR_COMPANY_ID"}'

### GET /leave-types
curl -X GET "$BASE_URL/leave-types" \
  -H "Authorization: Bearer $TOKEN"

### GET /leave-types/:id
curl -X GET "$BASE_URL/leave-types/YOUR_LEAVE_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /leave-types/:id
curl -X PUT "$BASE_URL/leave-types/YOUR_LEAVE_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quota":20,"color":"#e51451","companyId":"YOUR_COMPANY_ID"}'

### DELETE /leave-types/:id
curl -X DELETE "$BASE_URL/leave-types/YOUR_LEAVE_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN"

## Leave Records
### POST /leaves
curl -X POST "$BASE_URL/leaves" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP-001","leaveTypeId":"YOUR_LEAVE_TYPE_ID","startDate":"2024-01-16","endDate":"2024-01-18","unit":"Day","amount":1,"note":"Family event","documents":{"files":["https://example.com/leave-approval.docx"]},"companyId":"YOUR_COMPANY_ID"}'

### GET /leaves
curl -X GET "$BASE_URL/leaves" \
  -H "Authorization: Bearer $TOKEN"

#### Response Structure (item)
```json
{
  "id": "...",
  "leaveTypeName": "Annual Leave",
  "leaveTypeColor": "#e51451",
  "startDate": "2024-01-16",
  "endDate": "2024-01-18",
  "amount": 3,
  "leaveDays": [
    {
      "date": "2024-01-16",
      "leaveTypeColor": "#e51451",
      "isWorkingDay": true
    }
  ]
}
```

Leave days are expanded per calendar date; non-working days/holidays are flagged and do not count toward quota.
Hourly leave must use the same start/end date and `amount` is hours.
If `employeeId`, `companyId`, or `leaveTypeId` does not exist, the API returns 400 with a descriptive message.
Responses include `leaveDays` for each leave record (explicit per-date entries).
`leaveDays` only contains per-date fields (no duplicate company/employee/leaveType data).
`leaveDays` excludes `amount` to avoid confusion; use the parent record for totals.
For `Day` unit, the API computes `amount` as the total number of working days in the range.

### GET /leaves
curl -X GET "$BASE_URL/leaves" \
  -H "Authorization: Bearer $TOKEN"

### GET /leaves/:id
curl -X GET "$BASE_URL/leaves/YOUR_LEAVE_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /leaves/:id
curl -X PUT "$BASE_URL/leaves/YOUR_LEAVE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"Updated note","documents":{"files":["https://example.com/updated-approval.docx"]},"companyId":"YOUR_COMPANY_ID"}'

### DELETE /leaves/:id
curl -X DELETE "$BASE_URL/leaves/YOUR_LEAVE_ID" \
  -H "Authorization: Bearer $TOKEN"

## Holidays
### POST /holidays
curl -X POST "$BASE_URL/holidays" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-12-25","name":"Christmas Day","companyId":"YOUR_COMPANY_ID"}'

### GET /holidays
curl -X GET "$BASE_URL/holidays" \
  -H "Authorization: Bearer $TOKEN"

### GET /holidays/:id
curl -X GET "$BASE_URL/holidays/YOUR_HOLIDAY_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /holidays/:id
curl -X PUT "$BASE_URL/holidays/YOUR_HOLIDAY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Holiday","companyId":"YOUR_COMPANY_ID"}'

### DELETE /holidays/:id
curl -X DELETE "$BASE_URL/holidays/YOUR_HOLIDAY_ID" \
  -H "Authorization: Bearer $TOKEN"

## Feedback Cards
### POST /feedback-cards
curl -X POST "$BASE_URL/feedback-cards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Quarterly Review","subject":"Team Member","questions":[{"prompt":"How did it go?","type":"text"}],"companyId":"YOUR_COMPANY_ID"}'

### GET /feedback-cards
curl -X GET "$BASE_URL/feedback-cards" \
  -H "Authorization: Bearer $TOKEN"

### GET /feedback-cards/:id
curl -X GET "$BASE_URL/feedback-cards/YOUR_CARD_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /feedback-cards/:id
curl -X PUT "$BASE_URL/feedback-cards/YOUR_CARD_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Review Title","companyId":"YOUR_COMPANY_ID"}'

### DELETE /feedback-cards/:id
curl -X DELETE "$BASE_URL/feedback-cards/YOUR_CARD_ID" \
  -H "Authorization: Bearer $TOKEN"

## Feedback Entries
### POST /feedback-entries
curl -X POST "$BASE_URL/feedback-entries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cardId":"YOUR_CARD_ID",
    "type":"performance",
    "subjectType":"Employee",
    "subjectId":"YOUR_EMPLOYEE_ID",
    "subjectName":"Jane Doe",
    "authorId":"YOUR_AUTHOR_EMPLOYEE_UUID",
    "answers":[{"questionId":"q1","answer":"Great"}]
  }'

> [!NOTE]
> `authorId` is optional in the request. If omitted, the API will automatically populate it with the Employee record UUID of the authenticated user. redundant fields like `authorName` and `authorEmployeeId` are no longer stored but are returned in GET responses for convenience.

### GET /feedback-entries
curl -X GET "$BASE_URL/feedback-entries" \
  -H "Authorization: Bearer $TOKEN"

#### Response Structure
```json
{
  "id": "...",
  "cardId": "...",
  "answers": [
    {
      "questionId": "q1",
      "answer": "Consistently delivers...",
      "question": {
        "id": "q1",
        "questionId": "q1",
        "prompt": "How is their technical performance?",
        "kind": "text",
        "weight": 1.0
      }
    }
  ],
  "card": {
    "id": "...",
    "title": "Quarterly Review",
    "questions": [...] 
  }
}
```

### GET /feedback-entries/:id
curl -X GET "$BASE_URL/feedback-entries/YOUR_ENTRY_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /feedback-entries/:id
curl -X PUT "$BASE_URL/feedback-entries/YOUR_ENTRY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"answers":[{"questionId":"q1","answer":"Updated answer"}],"companyId":"YOUR_COMPANY_ID"}'

### DELETE /feedback-entries/:id
curl -X DELETE "$BASE_URL/feedback-entries/YOUR_ENTRY_ID" \
  -H "Authorization: Bearer $TOKEN"

## Documents
### POST /documents
curl -X POST "$BASE_URL/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP-001","name":"Passport","type":"Government ID","dataUrl":"https://example.com/passport.pdf","companyId":"YOUR_COMPANY_ID"}'

### GET /documents
curl -X GET "$BASE_URL/documents" \
  -H "Authorization: Bearer $TOKEN"

### GET /documents?employeeId=EMP-001
curl -X GET "$BASE_URL/documents?employeeId=EMP-001" \
  -H "Authorization: Bearer $TOKEN"

### GET /documents/:id
curl -X GET "$BASE_URL/documents/YOUR_DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN"

### DELETE /documents/:id
curl -X DELETE "$BASE_URL/documents/YOUR_DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN"
