{
"\_id": {
"$oid": "6929da7450431ffa4e577a07"
  },
  "role": "NBFC",
  "companyName": "Credila Financial Services Pvt Ltd",
  "brandName": "Credila",
  "email": "credila@example.com",
  "password": "$2a$12$yPZanJPMOQmqizgfZpQoC.Y7uaSTp0rn9MvQIDvL9fsxgVMWsw3J2",
"phoneNumber": "9876512345",
"registrationNumber": "CREDILA-REG-001",
"gstNumber": "27ABCDE1234F1Z5",
"address": {
"line1": "Credila Financial Services Pvt Ltd",
"line2": "Corporate Office",
"city": "Mumbai",
"state": "Maharashtra",
"pincode": "400001",
"country": "India"
},
"contactPerson": {
"name": "Credila Credit Manager",
"designation": "Credit Manager",
"email": "credit.manager@credila.com",
"phone": "9876512345"
},
"isEmailVerified": true,
"isPhoneVerified": true,
"isActive": false,
"isApprovedByAdmin": true,
"loanConfig": {
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
"enabled": true,
"negativeCourses": []
},
"stats": {
"totalApplications": 0,
"approvedApplications": 0,
"rejectedApplications": 0,
"pendingApplications": 0
},
"emailVerificationToken": "651676a95a22162a59444e08e1d80b81ce9903132911368218f51269a0e606ff",
"emailVerificationExpire": {
"$date": "2025-11-28T17:33:00.287Z"
  },
  "createdAt": {
    "$date": "2025-11-28T17:23:00.289Z"
},
"updatedAt": {
"$date": "2025-12-12T06:19:29.590Z"
  },
  "__v": 0,
  "lastLogin": {
    "$date": "2025-11-28T17:23:12.678Z"
}
}
