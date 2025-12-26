{
  "_id": {
    "$oid": "6929d8a750431ffa4e5779f2"
  },
  "role": "NBFC",
  "companyName": "IDFC FIRST Bank",
  "brandName": "IDFC FIRST",
  "email": "idfc.first@example.com",
  "password": "$2a$12$kdjrc9LSRjnB3/IL/ZrCN.AM2tOq0Awf0/EfNg3lJU.1GpD3PHVbm",
  "phoneNumber": "9876543210",
  "registrationNumber": "IDFC-REG-001",
  "gstNumber": "27ABCDE1234F1Z5",
  "address": {
    "line1": "IDFC FIRST Bank Ltd",
    "line2": "Corporate Office",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "India"
  },
  "contactPerson": {
    "name": "IDFC Credit Manager",
    "designation": "Credit Manager",
    "email": "credit.manager@idfcfirst.com",
    "phone": "9876543210"
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
      "itrYearsRequired": 2
    },
    "bankBalance": {
      "required": false,
      "minAvgBalance": 10000,
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
      "unrankedAction": "Rejected",
      "categorySystem": false
    },
    "loanToIncome": {
      "maxMultiple": 8
    },
    "collateral": {
      "minCoverageMultiple": 1.2
    },
    "offerLetter": {
      "required": true,
      "canSanctionWithout": false
    },
    "tests": {
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
  "emailVerificationToken": "c07a0e5d091b5cdb4c5386912e6679a622121868f567205d358706d5bc8d4fdb",
  "emailVerificationExpire": {
    "$date": "2025-11-28T17:25:19.502Z"
  },
  "createdAt": {
    "$date": "2025-11-28T17:15:19.512Z"
  },
  "updatedAt": {
    "$date": "2025-11-28T17:17:58.709Z"
  },
  "__v": 0,
  "lastLogin": {
    "$date": "2025-11-28T17:16:48.982Z"
  }
}