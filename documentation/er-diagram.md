%% ER Diagram
%% NOTE: salary/leave amounts are stored as numbers but validated to 2 decimal places in the API.
erDiagram
    COMPANY ||--o{ USER : has
    USER ||--o{ COMPANY : owns

    COMPANY ||--o{ EMPLOYEE : employs
    ROLE ||--o{ EMPLOYEE : assigned
    EMPLOYEE ||--o{ EMPLOYEE_DOCUMENT : has
    COMPANY ||--o{ USER_INVITATION : invites
    USER ||--o{ USER_INVITATION : sends

    COMPANY ||--o{ DEPARTMENT : has
    DEPARTMENT ||--o{ EMPLOYEE : includes
    COMPANY ||--o{ ROLE : has
    COMPANY ||--o{ JOB : posts
    DEPARTMENT ||--o{ JOB : organizes
    JOB ||--o{ APPLICANT : attracts

    COMPANY ||--o{ LEAVE_TYPE : defines
    COMPANY ||--o{ LEAVE_RECORD : tracks
    COMPANY ||--o{ LEAVE_DAY : tracks
    LEAVE_TYPE ||--o{ LEAVE_RECORD : categorizes
    EMPLOYEE ||--o{ LEAVE_RECORD : requests
    LEAVE_RECORD ||--o{ LEAVE_DAY : expands

    COMPANY ||--o{ HOLIDAY : sets
    COMPANY ||--o{ FEEDBACK_CARD : templates
    COMPANY ||--o{ FEEDBACK_ENTRY : collects
    FEEDBACK_CARD ||--o{ FEEDBACK_ENTRY : uses
    FEEDBACK_ENTRY }o--|| EMPLOYEE : subjectEmployee
    FEEDBACK_ENTRY }o--|| APPLICANT : subjectApplicant

    COMPANY {
        uuid id
        uuid ownerId
        string name
        string currency
        string timezone
        json workingHours
        timestamp createdAt
        timestamp updatedAt
    }

    USER {
        uuid id
        email email
        uuid companyId
        timestamp createdAt
        timestamp updatedAt
    }

    USER_INVITATION {
        uuid id
        uuid companyId
        email email
        uuid invitedBy
        uuid employeeId
        string status
        string tokenHash
        timestamp expiresAt
        timestamp acceptedAt
        timestamp createdAt
        timestamp updatedAt
    }

    EMPLOYEE {
        uuid id
        string employeeId
        uuid companyId
        uuid userId
        uuid departmentId
        uuid roleId
        uuid reportingManagerId
        email email
        date startDate
        string employmentType
        string gender
        number salary
        timestamp createdAt
        timestamp updatedAt
    }

    EMPLOYEE_DOCUMENT {
        uuid id
        uuid companyId
        uuid employeeId
        string name
        string documentKind
        string dataUrl
        timestamp createdAt
        timestamp updatedAt
    }

    DEPARTMENT {
        uuid id
        uuid companyId
        string name
        string description
        timestamp createdAt
        timestamp updatedAt
    }

    ROLE {
        uuid id
        uuid companyId
        string title
        timestamp createdAt
        timestamp updatedAt
    }

    JOB {
        uuid id
        uuid companyId
        uuid roleId
        uuid departmentId
        string title
        string employmentType
        string employmentMode
        number salaryFrom
        number salaryTo
        string jobStatus
        timestamp createdAt
        timestamp updatedAt
    }

    APPLICANT {
        uuid id
        uuid companyId
        uuid jobId
        email email
        number yearsOfExperience
        number currentSalary
        number expectedSalary
        string applicantStatus
        date appliedDate
        json documents
        timestamp createdAt
        timestamp updatedAt
    }

    LEAVE_TYPE {
        uuid id
        uuid companyId
        string name
        string leaveUnit
        timestamp createdAt
        timestamp updatedAt
    }

    LEAVE_RECORD {
        uuid id
        uuid companyId
        uuid employeeId
        uuid leaveTypeId
        date startDate
        date endDate
        string leaveUnit
        number amount
        string note
        json documents
        timestamp createdAt
        timestamp updatedAt
    }

    LEAVE_DAY {
        uuid id
        uuid companyId
        uuid leaveRecordId
        uuid employeeId
        uuid leaveTypeId
        date date
        string leaveUnit
        number amount
        boolean isWorkingDay
        boolean isHoliday
        boolean isClosed
        boolean countsTowardQuota
        json workingHours
        timestamp createdAt
        timestamp updatedAt
    }

    HOLIDAY {
        uuid id
        uuid companyId
        date date
        string name
        timestamp createdAt
        timestamp updatedAt
    }

    FEEDBACK_CARD {
        uuid id
        uuid companyId
        string feedbackSubject
        string title
        timestamp createdAt
        timestamp updatedAt
    }

    FEEDBACK_ENTRY {
        uuid id
        uuid companyId
        uuid cardId
        string feedbackEntryType
        string subjectType
        uuid subjectId
        string subjectName
        timestamp createdAt
        timestamp updatedAt
    }
