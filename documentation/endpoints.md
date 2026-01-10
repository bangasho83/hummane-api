# Hummane API cURL Examples

## Setup
export BASE_URL="http://localhost:3000"
export TOKEN="YOUR_JWT"
export COMPANY_ID="YOUR_COMPANY_ID"

Most endpoints require a JWT:
-H "Authorization: Bearer $TOKEN"

All tenant-scoped payloads include companyId (the API also enforces it from the JWT).

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

## Companies
### POST /companies
curl -X POST "$BASE_URL/companies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Inc","industry":"Software","size":"11-50","currency":"USD","timezone":"America/New_York"}'

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
  -d '{"industry":"Fintech","currency":"USD","timezone":"America/Los_Angeles"}'

### DELETE /companies/:id
curl -X DELETE "$BASE_URL/companies/YOUR_COMPANY_ID" \
  -H "Authorization: Bearer $TOKEN"

## Employees
### POST /employees
curl -X POST "$BASE_URL/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP-001","companyId":"YOUR_COMPANY_ID","name":"Jane Doe","email":"jane@example.com","position":"Engineer","startDate":"2024-01-01","employmentType":"Full-time","gender":"Female"}'

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
  -d '{"position":"Senior Engineer","companyId":"YOUR_COMPANY_ID"}'

### DELETE /employees/:id
curl -X DELETE "$BASE_URL/employees/YOUR_EMPLOYEE_ID" \
  -H "Authorization: Bearer $TOKEN"

## Departments
### POST /departments
curl -X POST "$BASE_URL/departments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Engineering","desc":"Core product team","companyId":"YOUR_COMPANY_ID"}'

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
  -d '{"desc":"Platform and infrastructure","companyId":"YOUR_COMPANY_ID"}'

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
  -d '{"title":"Backend Engineer","status":"open","employmentType":"Full-time","companyId":"YOUR_COMPANY_ID"}'

### GET /jobs
curl -X GET "$BASE_URL/jobs" \
  -H "Authorization: Bearer $TOKEN"

### GET /jobs/:id
curl -X GET "$BASE_URL/jobs/YOUR_JOB_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /jobs/:id
curl -X PUT "$BASE_URL/jobs/YOUR_JOB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"closed","companyId":"YOUR_COMPANY_ID"}'

### DELETE /jobs/:id
curl -X DELETE "$BASE_URL/jobs/YOUR_JOB_ID" \
  -H "Authorization: Bearer $TOKEN"

## Applicants
### POST /applicants
curl -X POST "$BASE_URL/applicants" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Sam Applicant","email":"sam@example.com","status":"new","appliedDate":"2024-01-02","companyId":"YOUR_COMPANY_ID"}'

### GET /applicants
curl -X GET "$BASE_URL/applicants" \
  -H "Authorization: Bearer $TOKEN"

### GET /applicants/:id
curl -X GET "$BASE_URL/applicants/YOUR_APPLICANT_ID" \
  -H "Authorization: Bearer $TOKEN"

### PUT /applicants/:id
curl -X PUT "$BASE_URL/applicants/YOUR_APPLICANT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"interview","companyId":"YOUR_COMPANY_ID"}'

### DELETE /applicants/:id
curl -X DELETE "$BASE_URL/applicants/YOUR_APPLICANT_ID" \
  -H "Authorization: Bearer $TOKEN"

## Leave Types
### POST /leave-types
curl -X POST "$BASE_URL/leave-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Annual Leave","unit":"Day","quota":15,"companyId":"YOUR_COMPANY_ID"}'

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
  -d '{"quota":20,"companyId":"YOUR_COMPANY_ID"}'

### DELETE /leave-types/:id
curl -X DELETE "$BASE_URL/leave-types/YOUR_LEAVE_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN"

## Leave Records
### POST /leaves
curl -X POST "$BASE_URL/leaves" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP-001","date":"2024-01-10","type":"Annual Leave","unit":"Day","amount":1,"companyId":"YOUR_COMPANY_ID"}'

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
  -d '{"note":"Updated note","companyId":"YOUR_COMPANY_ID"}'

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
  -d '{"cardId":"YOUR_CARD_ID","subjectId":"YOUR_SUBJECT_ID","subjectName":"Jane Doe","answers":[{"questionId":"q1","answer":"Great"}],"companyId":"YOUR_COMPANY_ID"}'

### GET /feedback-entries
curl -X GET "$BASE_URL/feedback-entries" \
  -H "Authorization: Bearer $TOKEN"

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

## Debug
### GET /debug/users
curl -X GET "$BASE_URL/debug/users"

### GET /debug/env-check
curl -X GET "$BASE_URL/debug/env-check"

### GET /debug/parse-check
curl -X GET "$BASE_URL/debug/parse-check"

### GET /debug/auth-session
curl -X GET "$BASE_URL/debug/auth-session" \
  -H "Authorization: Bearer $TOKEN"
