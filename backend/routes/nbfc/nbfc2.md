{
  "_id": {
    "$oid": "6929d9cf50431ffa4e5779ff"
  },
  "role": "NBFC",
  "companyName": "Auxilo Finserve Pvt Ltd",
  "brandName": "Auxilo",
  "email": "auxilo@example.com",
  "password": "$2a$12$dc0vMjq44b5sJ9lRKjrpKuNv8Gnzi85P.ufcN2kNIxzig5ymq7s8i",
  "phoneNumber": "9876501234",
  "registrationNumber": "AUXILO-REG-001",
  "gstNumber": "27ABCDE1234F1Z5",
  "address": {
    "line1": "Auxilo Finserve Pvt Ltd",
    "line2": "Corporate Office",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "India"
  },
  "contactPerson": {
    "name": "Auxilo Credit Manager",
    "designation": "Credit Manager",
    "email": "credit.manager@auxilo.com",
    "phone": "9876501234"
  },
  "isEmailVerified": true,
  "isPhoneVerified": true,
  "isActive": true,
  "isApprovedByAdmin": true,
  "loanConfig": {
    "enabled": true,
    "cibil": {
      "minScore": 650,
      "allowOverdue": false,
      "checkBounceInOwnBank": false
    },
    "foir": {
      "maxPercentage": 75,
      "borderlineStart": 60,
      "actionWhenBorderline": "Clarification"
    },
    "incomeItr": {
      "itrRequired": true,
      "minAnnualIncome": 500000,
      "minMonthlySalary": 0,
      "itrYearsRequired": 2
    },
    "bankBalance": {
      "required": false,
      "minAvgBalance": 0,
      "statementMonthsRequired": 6
    },
    "academics": {
      "minPercentage10th": 55,
      "minPercentage12th": 55,
      "minPercentageGrad": 55,
      "maxGapYears": 2,
      "gapYearsAction": "Clarification"
    },
    "university": {
      "rankingRequired": false,
      "maxRankThreshold": null,
      "unrankedAction": "Rejected",
      "categorySystem": false
    },
    "loanToIncome": {
      "maxMultiple": 8,
      "unsecuredMinAmount": 0,
      "unsecuredMaxAmount": 0
    },
    "collateral": {
      "requiredAboveAmount": 0,
      "minCoverageMultiple": 1.2
    },
    "offerLetter": {
      "required": false,
      "canSanctionWithout": true
    },
    "tests": {
      "greMinScore": 0,
      "ieltsMinScore": 0,
      "toeflMinScore": 0,
      "othersOptional": true
    },
    "coBorrower": {
      "mandatory": true,
      "allowedRelations": [
        "father",
        "mother",
        "brother",
        "sister",
        "spouse",
        "uncle",
        "aunt",
        "guardian"
      ],
      "relationByUniversityTier": false
    },
    "roi": {
      "minRate": 9,
      "maxRate": 14,
      "currency": "INR"
    },
    "negativeCourses": []
  },
  "stats": {
    "totalApplications": 0,
    "approvedApplications": 0,
    "rejectedApplications": 0,
    "pendingApplications": 0
  },
  "emailVerificationToken": "5cfe07f8f1d2eea46d4412ee00239c4dde45c197658954a969430212d16956a6",
  "emailVerificationExpire": {
    "$date": "2025-11-28T17:30:15.309Z"
  },
  "createdAt": {
    "$date": "2025-11-28T17:20:15.311Z"
  },
  "updatedAt": {
    "$date": "2025-11-28T17:23:53.837Z"
  },
  "__v": 0,
  "lastLogin": {
    "$date": "2025-11-28T17:20:41.748Z"
  }
}