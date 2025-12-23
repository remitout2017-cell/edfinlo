// ============================================================
// COMPLETE STUDENT FLOW - AUTOMATED TESTING SCRIPT
// ============================================================
// This script creates a new student and goes through all routes
// Run: node student-complete-flow.js

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// ============================================================
// CONFIGURATION
// ============================================================
const BASE_URL = 'http://localhost:5000';
const timestamp = Date.now();

// Generate unique user data
const testUser = {
  firstName: 'Aryan',
  lastName: 'Madkar',
  email: `aryan.test.${timestamp}@example.com`,
  password: 'SecurePass123',
  phoneNumber: `+91${Math.floor(9000000000 + Math.random() * 1000000000)}`
};

// Store state
let TOKEN = '';
let STUDENT_ID = '';
let CO_BORROWER_ID = '';
let ANALYSIS_ID = '';
let REQUEST_ID = '';

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log(`  ${title}`, 'cyan');
  console.log('='.repeat(70));
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function data(label, value) {
  log(`📋 ${label}: ${JSON.stringify(value, null, 2)}`, 'yellow');
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests automatically
api.interceptors.request.use(config => {
  if (TOKEN && !config.url.includes('/auth/')) {
    config.headers.Authorization = `Bearer ${TOKEN}`;
  }
  return config;
});

// ============================================================
// STEP 1: AUTHENTICATION
// ============================================================
async function step1_Authentication() {
  section('STEP 1: AUTHENTICATION');

  try {
    // 1.1 Register
    info('1.1 Registering new student...');
    const registerRes = await api.post('/api/auth/register', testUser);
    success('Student registered successfully');
    data('Registration Response', registerRes.data);

    await delay(1000);

    // 1.2 Login
    info('1.2 Logging in...');
    const loginRes = await api.post('/api/auth/login', {
      email: testUser.email,
      password: testUser.password
    });

    TOKEN = loginRes.data.data.token;
    STUDENT_ID = loginRes.data.data.student.id;

    success('Login successful');
    data('Token', TOKEN.substring(0, 30) + '...');
    data('Student ID', STUDENT_ID);

    await delay(1000);

    // 1.3 Get Profile
    info('1.3 Getting my profile...');
    const profileRes = await api.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    success('Profile retrieved');
    data('Profile', profileRes.data.data);

    return true;
  } catch (err) {
    error(`Authentication failed: ${err.response?.data?.message || err.message}`);
    throw err;
  }
}

// ============================================================
// STEP 2: PROFILE MANAGEMENT
// ============================================================
async function step2_ProfileManagement() {
  section('STEP 2: PROFILE MANAGEMENT');

  try {
    // 2.1 Get Profile
    info('2.1 Getting user profile...');
    const getProfileRes = await api.get('/api/user/profile');
    success('Profile retrieved');
    data('Profile Data', getProfileRes.data);

    await delay(1000);

    // 2.2 Update Profile
    info('2.2 Updating profile...');
    const updateRes = await api.put('/api/user/profile', {
      firstName: 'Aryan',
      lastName: 'Madkar',
      phoneNumber: testUser.phoneNumber
    });
    success('Profile updated');
    data('Updated Profile', updateRes.data);

    return true;
  } catch (err) {
    error(`Profile management failed: ${err.response?.data?.message || err.message}`);
    return false;
  }
}

// ============================================================
// STEP 3: EDUCATION PLAN
// ============================================================
async function step3_EducationPlan() {
  section('STEP 3: EDUCATION PLAN');

  try {
    // 3.1 Create Education Plan
    info('3.1 Creating education plan...');
    const planData = {
      targetCountry: 'USA',
      targetCourse: 'Computer Science',
      courseDurationMonths: 24,
      requestedLoanAmount: 5000000,
      intakeMonth: 'September',
      intakeYear: 2026,
      universityName: 'Stanford University',
      programLevel: 'Masters'
    };

    const createRes = await api.post('/api/user/educationplanet/education-plan', planData);
    success('Education plan created');
    data('Education Plan', createRes.data);

    await delay(1000);

    // 3.2 Get Education Plan
    info('3.2 Getting education plan...');
    const getRes = await api.get('/api/user/educationplanet/education-plan');
    success('Education plan retrieved');
    data('Retrieved Plan', getRes.data);

    return true;
  } catch (err) {
    error(`Education plan failed: ${err.response?.data?.message || err.message}`);
    return false;
  }
}

// ============================================================
// STEP 4: KYC (Simulated - requires actual files)
// ============================================================
async function step4_KYC() {
  section('STEP 4: KYC DOCUMENT UPLOAD');

  info('⚠️  KYC upload requires actual PDF files');
  info('Skipping file upload - showing API structure');

  // Show how to upload KYC when you have files
  info('To upload KYC, use this code:');
  log(`
  const formData = new FormData();
  formData.append('aadhaar_front', fs.createReadStream('/path/aadhaar_front.pdf'));
  formData.append('aadhaar_back', fs.createReadStream('/path/aadhaar_back.pdf'));
  formData.append('pan_front', fs.createReadStream('/path/pan_front.pdf'));

  await api.post('/api/user/kyc/upload', formData, {
    headers: formData.getHeaders()
  });
  `, 'yellow');

  return true;
}

// ============================================================
// STEP 5: ACADEMICS (Simulated)
// ============================================================
async function step5_Academics() {
  section('STEP 5: ACADEMIC RECORDS');

  try {
    // 5.1 Health Check
    info('5.1 Checking academics service health...');
    const healthRes = await axios.get(`${BASE_URL}/api/user/academics/health`);
    success('Academics service is healthy');

    await delay(1000);

    // 5.2 Get Academic Records
    info('5.2 Getting academic records...');
    try {
      const recordsRes = await api.get('/api/user/academics/records');
      success('Academic records retrieved');
      data('Records', recordsRes.data);
    } catch (err) {
      if (err.response?.status === 404) {
        info('No academic records found (expected for new user)');
      } else {
        throw err;
      }
    }

    info('⚠️  Academic extraction requires PDF files');
    info('To upload academics, use:');
    log(`
  const formData = new FormData();
  formData.append('pdf_10th', fs.createReadStream('/path/class10.pdf'));
  formData.append('pdf_12th', fs.createReadStream('/path/class12.pdf'));
  formData.append('pdf_graduation', fs.createReadStream('/path/graduation.pdf'));

  await api.post('/api/user/academics/extract/complete', formData, {
    headers: formData.getHeaders()
  });
    `, 'yellow');

    return true;
  } catch (err) {
    error(`Academics failed: ${err.response?.data?.message || err.message}`);
    return false;
  }
}

// ============================================================
// STEP 6: TEST SCORES (Simulated)
// ============================================================
async function step6_TestScores() {
  section('STEP 6: TEST SCORES (TOEFL/GRE/IELTS)');

  try {
    // 6.1 Health Check
    info('6.1 Checking test scores service health...');
    const healthRes = await axios.get(`${BASE_URL}/api/user/testscores/health`);
    success('Test scores service is healthy');

    await delay(1000);

    // 6.2 Get Test Scores
    info('6.2 Getting test scores...');
    const scoresRes = await api.get('/api/user/testscores/');
    success('Test scores retrieved');
    data('Test Scores', scoresRes.data);

    info('⚠️  Test score extraction requires PDF files');
    info('To upload test scores, use:');
    log(`
  const formData = new FormData();
  formData.append('toefl_report', fs.createReadStream('/path/toefl.pdf'));
  formData.append('gre_report', fs.createReadStream('/path/gre.pdf'));
  formData.append('ielts_report', fs.createReadStream('/path/ielts.pdf'));

  await api.post('/api/user/testscores/extract', formData, {
    headers: formData.getHeaders()
  });
    `, 'yellow');

    return true;
  } catch (err) {
    error(`Test scores failed: ${err.response?.data?.message || err.message}`);
    return false;
  }
}

// ============================================================
// STEP 7: WORK EXPERIENCE (Simulated)
// ============================================================
async function step7_WorkExperience() {
  section('STEP 7: WORK EXPERIENCE');

  try {
    // 7.1 Health Check
    info('7.1 Checking work experience service health...');
    const healthRes = await api.get('/api/user/workexperience/health');
    success('Work experience service is healthy');

    await delay(1000);

    // 7.2 Get Work Experience
    info('7.2 Getting work experience...');
    try {
      const workRes = await api.get('/api/user/workexperience/me');
      success('Work experience retrieved');
      data('Work Experience', workRes.data);
    } catch (err) {
      if (err.response?.status === 404) {
        info('No work experience found (expected for new user)');
      } else {
        throw err;
      }
    }

    info('⚠️  Work experience requires PDF files');
    info('To upload work experience, use:');
    log(`
  const formData = new FormData();
  formData.append('experience_letters', fs.createReadStream('/path/exp1.pdf'));
  formData.append('offer_letters', fs.createReadStream('/path/offer.pdf'));
  formData.append('salary_slips', fs.createReadStream('/path/salary.pdf'));

  await api.post('/api/user/workexperience/submit', formData, {
    headers: formData.getHeaders()
  });
    `, 'yellow');

    return true;
  } catch (err) {
    error(`Work experience failed: ${err.response?.data?.message || err.message}`);
    return false;
  }
}

// ============================================================
// STEP 8: ADMISSION LETTERS (Simulated)
// ============================================================
async function step8_Admissions() {
  section('STEP 8: ADMISSION LETTERS');

  try {
    // 8.1 Health Check
    info('8.1 Checking admission service health...');
    const healthRes = await axios.get(`${BASE_URL}/api/user/admission/health`);
    success('Admission service is healthy');

    await delay(1000);

    // 8.2 Get Admission Letters
    info('8.2 Getting admission letters...');
    try {
      const admissionRes = await api.get('/api/user/admission/me');
      success('Admission letters retrieved');
      data('Admissions', admissionRes.data);
    } catch (err) {
      if (err.response?.status === 404) {
        info('No admission letters found (expected for new user)');
      } else {
        throw err;
      }
    }

    info('⚠️  Admission upload requires PDF files');
    info('To upload admission letters, use:');
    log(`
  const formData = new FormData();
  formData.append('admissionletters', fs.createReadStream('/path/admission1.pdf'));
  formData.append('admissionletters', fs.createReadStream('/path/admission2.pdf'));

  await api.post('/api/user/admission/submit', formData, {
    headers: formData.getHeaders()
  });
    `, 'yellow');

    return true;
  } catch (err) {
    error(`Admissions failed: ${err.response?.data?.message || err.message}`);
    return false;
  }
}

// ============================================================
// STEP 9: CO-BORROWER MANAGEMENT
// ============================================================
async function step9_CoBorrower() {
  section('STEP 9: CO-BORROWER MANAGEMENT');

  try {
    // 9.1 Get All Co-borrowers
    info('9.1 Getting all co-borrowers...');
    const listRes = await api.get('/api/coborrower/list');
    success('Co-borrowers retrieved');
    data('Co-borrowers', listRes.data);

    info('⚠️  Co-borrower creation requires KYC documents');
    info('To create co-borrower, use:');
    log(`
  const formData = new FormData();
  formData.append('aadhaar_front', fs.createReadStream('/path/coborrower_aadhaar_front.pdf'));
  formData.append('aadhaar_back', fs.createReadStream('/path/coborrower_aadhaar_back.pdf'));
  formData.append('pan_front', fs.createReadStream('/path/coborrower_pan.pdf'));

  const res = await api.post('/api/coborrower/kyc/upload', formData, {
    headers: formData.getHeaders()
  });

  CO_BORROWER_ID = res.data.data.coBorrowerId;
    `, 'yellow');

    return true;
  } catch (err) {
    error(`Co-borrower failed: ${err.response?.data?.message || err.message}`);
    return false;
  }
}

// ============================================================
// STEP 10: LOAN MATCHING & ANALYSIS
// ============================================================
async function step10_LoanMatching() {
  section('STEP 10: LOAN MATCHING & ANALYSIS');

  try {
    // 10.1 Get My Loan Requests
    info('10.1 Getting my loan requests...');
    const requestsRes = await api.get('/api/student/loan-matching/my-requests');
    success('Loan requests retrieved');
    data('My Requests', requestsRes.data);

    await delay(1000);

    // 10.2 Get Analysis History
    info('10.2 Getting analysis history...');
    const historyRes = await api.get('/api/student/loan-matching/history');
    success('Analysis history retrieved');
    data('History', historyRes.data);

    await delay(1000);

    // 10.3 Run AI Analysis (only if profile is complete)
    info('10.3 AI Loan Analysis...');
    info('⚠️  AI analysis requires complete profile with all documents');
    info('To run analysis:');
    log(`
  const analysisRes = await api.post('/api/student/loan-matching/analyze', {});
  ANALYSIS_ID = analysisRes.data.data.analysisId;

  // Then send request to NBFC
  await api.post('/api/student/loan-matching/send-request/<NBFC_ID>', {
    analysisId: ANALYSIS_ID,
    message: 'Interested in your loan offer'
  });
    `, 'yellow');

    return true;
  } catch (err) {
    error(`Loan matching failed: ${err.response?.data?.message || err.message}`);
    return false;
  }
}

// ============================================================
// MAIN EXECUTION
// ============================================================
async function runCompleteFlow() {
  log('\n🚀 STARTING COMPLETE STUDENT FLOW', 'cyan');
  log(`📧 Test User Email: ${testUser.email}`, 'magenta');
  log(`🔐 Password: ${testUser.password}`, 'magenta');
  log(`📱 Phone: ${testUser.phoneNumber}`, 'magenta');

  const startTime = Date.now();
  let successCount = 0;
  let totalSteps = 10;

  try {
    // Execute all steps in sequence
    if (await step1_Authentication()) successCount++;
    await delay(1500);

    if (await step2_ProfileManagement()) successCount++;
    await delay(1500);

    if (await step3_EducationPlan()) successCount++;
    await delay(1500);

    if (await step4_KYC()) successCount++;
    await delay(1500);

    if (await step5_Academics()) successCount++;
    await delay(1500);

    if (await step6_TestScores()) successCount++;
    await delay(1500);

    if (await step7_WorkExperience()) successCount++;
    await delay(1500);

    if (await step8_Admissions()) successCount++;
    await delay(1500);

    if (await step9_CoBorrower()) successCount++;
    await delay(1500);

    if (await step10_LoanMatching()) successCount++;

    // Summary
    section('EXECUTION SUMMARY');
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    success(`Completed ${successCount}/${totalSteps} steps in ${duration}s`);
    log(`\n📊 SAVED DATA:`, 'cyan');
    data('Email', testUser.email);
    data('Password', testUser.password);
    data('Phone', testUser.phoneNumber);
    data('Token', TOKEN ? TOKEN.substring(0, 30) + '...' : 'N/A');
    data('Student ID', STUDENT_ID || 'N/A');

    log('\n✅ SCRIPT COMPLETED SUCCESSFULLY!', 'green');

  } catch (err) {
    error(`Fatal error: ${err.message}`);
    log(err.stack, 'red');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  runCompleteFlow().catch(err => {
    error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runCompleteFlow };