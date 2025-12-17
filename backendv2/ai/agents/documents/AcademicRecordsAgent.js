// Academic Records Agent using LangGraph
import { StateGraph, END } from '@langchain/langgraph';
import { BaseAgent } from '../../core/BaseAgent.js';
import { AI_MODELS } from '../../config/aiModels.js';

const ACADEMIC_STATE_SCHEMA = {
  images: [],
  educationType: '', // class10, class12, undergraduate, postgraduate
  academicData: null,
  extractionComplete: false,
  validationComplete: false,
  currentStep: '',
  errors: [],
  startTime: 0,
};

export class AcademicRecordsAgent {
  constructor() {
    this.extractionAgent = new BaseAgent(AI_MODELS.EXTRACTION_PRIMARY);
    this.extractionFallback = new BaseAgent(AI_MODELS.EXTRACTION_FALLBACK);
    this.verificationAgent = new BaseAgent(AI_MODELS.VERIFICATION_PRIMARY);
    
    this.graph = this.buildWorkflow();
    this.app = this.graph.compile();
    
    console.log('🎓 Academic Records Agent initialized');
  }

  buildWorkflow() {
    const workflow = new StateGraph({
      channels: ACADEMIC_STATE_SCHEMA,
    });

    workflow.addNode('extract_academics', (state) => this.extractAcademics(state));
    workflow.addNode('validate_scores', (state) => this.validateScores(state));
    workflow.addNode('verify_authenticity', (state) => this.verifyAuthenticity(state));
    workflow.addNode('assess_eligibility', (state) => this.assessEligibility(state));
    workflow.addNode('generate_report', (state) => this.generateReport(state));

    workflow.setEntryPoint('extract_academics');

    workflow.addConditionalEdges(
      'extract_academics',
      (state) => state.extractionComplete ? 'validate' : 'end',
      {
        validate: 'validate_scores',
        end: 'generate_report',
      }
    );

    workflow.addEdge('validate_scores', 'verify_authenticity');
    workflow.addEdge('verify_authenticity', 'assess_eligibility');
    workflow.addEdge('assess_eligibility', 'generate_report');
    workflow.addEdge('generate_report', END);

    return workflow;
  }

  async extractAcademics(state) {
    console.log(`🎓 Extracting ${state.educationType} academic records...`);
    
    const prompt = this.getExtractionPrompt(state.educationType);
    
    try {
      let response;
      try {
        response = await this.extractionAgent.invoke(prompt, state.images);
      } catch (error) {
        console.warn('⚠️ Primary extraction failed, using fallback...');
        response = await this.extractionFallback.invoke(prompt, state.images);
      }

      const academicData = this.extractionAgent.parseJSON(response.content);
      
      return {
        ...state,
        academicData,
        extractionComplete: true,
        currentStep: 'extraction_complete',
      };

    } catch (error) {
      console.error('❌ Academic extraction failed:', error.message);
      
      return {
        ...state,
        extractionComplete: false,
        errors: [...state.errors, { step: 'extraction', error: error.message }],
        currentStep: 'extraction_failed',
      };
    }
  }

  getExtractionPrompt(educationType) {
    const isSchool = educationType === 'class10' || educationType === 'class12';
    
    let basePrompt = `Extract ${educationType} academic details from marksheet/transcript. Return ONLY valid JSON:

{
  "institutionName": "string or null",
  "boardUniversity": "string or null",
  "studentName": "string or null",
  "rollNumber": "string or null",
  "yearOfPassing": number (4 digits),
  "percentage": number (0-100) or null,
  "cgpa": number (0-10) or null,
  "grade": "string or null",`;

    if (educationType === 'class12') {
      basePrompt += `
  "stream": "Science|Commerce|Arts",`;
    }

    if (!isSchool) {
      basePrompt += `
  "courseName": "string",
  "specialization": "string or null",
  "duration": "string (e.g., 3 years, 4 years)",
  "semester": number or null,
  "division": "First Class|Second Class|Distinction|null",`;
    }

    basePrompt += `
  "subjects": [
    {
      "name": "string",
      "marksObtained": number,
      "maxMarks": number
    }
  ],
  "confidence": number (0-100)
}

RULES:
1. Extract exact institution name from document
2. For Class 10/12: Board name is mandatory (CBSE, ICSE, State Board)
3. Extract percentage OR CGPA (whichever is present)
4. Grade format: A+, A, B+, etc. or First Class, Second Class
5. Year must be between 1990-${new Date().getFullYear()}
6. List all subjects with marks if visible`;

    return basePrompt;
  }

  async validateScores(state) {
    console.log('📊 Validating academic scores...');
    
    const { academicData, educationType } = state;
    
    const validations = {
      valid: true,
      issues: [],
    };

    // Validate year of passing
    const currentYear = new Date().getFullYear();
    if (academicData.yearOfPassing < 1990 || academicData.yearOfPassing > currentYear) {
      validations.valid = false;
      validations.issues.push(`Invalid year of passing: ${academicData.yearOfPassing}`);
    }

    // Validate percentage
    if (academicData.percentage !== null) {
      if (academicData.percentage < 0 || academicData.percentage > 100) {
        validations.valid = false;
        validations.issues.push(`Invalid percentage: ${academicData.percentage}`);
      }
    }

    // Validate CGPA
    if (academicData.cgpa !== null) {
      if (academicData.cgpa < 0 || academicData.cgpa > 10) {
        validations.valid = false;
        validations.issues.push(`Invalid CGPA: ${academicData.cgpa}`);
      }
    }

    // Validate subjects marks
    if (academicData.subjects && Array.isArray(academicData.subjects)) {
      academicData.subjects.forEach((subject, index) => {
        if (subject.marksObtained > subject.maxMarks) {
          validations.valid = false;
          validations.issues.push(`Subject ${index + 1}: Marks obtained exceed max marks`);
        }
      });
    }

    // Check minimum required fields
    if (!academicData.institutionName && !academicData.boardUniversity) {
      validations.issues.push('Missing institution/board information');
    }

    if (!academicData.percentage && !academicData.cgpa && !academicData.grade) {
      validations.valid = false;
      validations.issues.push('No scoring information found (percentage/CGPA/grade)');
    }

    return {
      ...state,
      academicData: {
        ...academicData,
        validation: validations,
      },
      validationComplete: true,
      currentStep: 'validation_complete',
    };
  }

  async verifyAuthenticity(state) {
    console.log('🔍 Verifying academic document authenticity...');
    
    const { academicData, educationType } = state;
    
    const prompt = `Verify academic document authenticity. Return ONLY valid JSON:

{
  "authentic": true|false,
  "confidence": number (0-100),
  "documentQuality": "excellent|good|fair|poor",
  "redFlags": ["array of concerns"],
  "positiveIndicators": ["array of positive signs"],
  "recommendation": "approve|review|reject"
}

Education Type: ${educationType}
Academic Data:
${JSON.stringify(academicData, null, 2)}

Check:
1. Board/University name is recognized
2. Scoring system is valid for Indian education
3. Document appears authentic (not digitally manipulated)
4. Year of passing is realistic
5. Marks/grades are consistent
6. All mandatory fields present`;

    try {
      const response = await this.verificationAgent.invoke(prompt);
      const verification = this.verificationAgent.parseJSON(response.content);
      
      return {
        ...state,
        academicData: {
          ...academicData,
          verification,
        },
        currentStep: 'verification_complete',
      };

    } catch (error) {
      console.error('❌ Verification failed:', error.message);
      
      return {
        ...state,
        errors: [...state.errors, { step: 'verification', error: error.message }],
        currentStep: 'verification_failed',
      };
    }
  }

  async assessEligibility(state) {
    console.log('📋 Assessing loan eligibility based on academics...');
    
    const { academicData, educationType } = state;
    
    // Calculate eligibility score
    let eligibilityScore = 0;
    let eligibilityFactors = [];

    // Score based on percentage/CGPA
    if (academicData.percentage) {
      if (academicData.percentage >= 60) {
        eligibilityScore += 40;
        eligibilityFactors.push('Good academic performance (60%+)');
      } else if (academicData.percentage >= 50) {
        eligibilityScore += 25;
        eligibilityFactors.push('Acceptable academic performance (50%+)');
      } else {
        eligibilityScore += 10;
        eligibilityFactors.push('Below average academic performance');
      }
    } else if (academicData.cgpa) {
      if (academicData.cgpa >= 7.0) {
        eligibilityScore += 40;
        eligibilityFactors.push('Strong CGPA (7.0+)');
      } else if (academicData.cgpa >= 6.0) {
        eligibilityScore += 25;
        eligibilityFactors.push('Acceptable CGPA (6.0+)');
      } else {
        eligibilityScore += 10;
        eligibilityFactors.push('Below average CGPA');
      }
    }

    // Score based on institution
    if (academicData.boardUniversity) {
      const recognizedBoards = ['CBSE', 'ICSE', 'IB', 'STATE BOARD'];
      const boardUpper = academicData.boardUniversity.toUpperCase();
      if (recognizedBoards.some(board => boardUpper.includes(board))) {
        eligibilityScore += 30;
        eligibilityFactors.push('Recognized board/university');
      } else {
        eligibilityScore += 15;
      }
    }

    // Score based on verification
    if (academicData.verification?.authentic) {
      eligibilityScore += 30;
      eligibilityFactors.push('Document verified as authentic');
    }

    const assessment = {
      eligibilityScore: Math.min(eligibilityScore, 100),
      eligibilityLevel: eligibilityScore >= 70 ? 'high' : eligibilityScore >= 50 ? 'medium' : 'low',
      eligibilityFactors,
      eligible: eligibilityScore >= 50 && academicData.verification?.authentic !== false,
    };

    return {
      ...state,
      academicData: {
        ...academicData,
        eligibilityAssessment: assessment,
      },
      currentStep: 'eligibility_assessed',
    };
  }

  async generateReport(state) {
    console.log('📄 Generating academic report...');
    
    const processingTime = Date.now() - state.startTime;
    
    return {
      ...state,
      currentStep: 'complete',
      metadata: {
        processingTime,
        educationType: state.educationType,
        extractionComplete: state.extractionComplete,
        validationComplete: state.validationComplete,
      },
    };
  }

  async processAcademicRecords(images, educationType, options = {}) {
    const initialState = {
      ...ACADEMIC_STATE_SCHEMA,
      images,
      educationType,
      startTime: Date.now(),
    };

    try {
      const result = await this.app.invoke(initialState);
      
      return {
        success: result.extractionComplete,
        academicData: result.academicData,
        metadata: result.metadata,
      };

    } catch (error) {
      console.error('❌ Academic records workflow failed:', error);
      throw error;
    }
  }
}
