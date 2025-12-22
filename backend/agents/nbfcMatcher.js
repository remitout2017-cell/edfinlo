// agents/nbfcMatcher.js
const { createGroqLLM } = require("./groqSetup");
const { NBFC_MATCHING_PROMPT } = require("./prompts");
const { calculateMatchScore } = require("./scoringEngine");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

/**
 * Matches student against ONE NBFC using AI
 */
const matchStudentWithNBFC = async (studentProfile, nbfc) => {
  try {
    console.log(`🤖 Matching with ${nbfc.companyName}...`);

    // Prepare data
    const studentSummary = JSON.stringify(studentProfile, null, 2);
    const nbfcCriteria = JSON.stringify(nbfc.loanConfig, null, 2);

    // Create prompt
    const prompt = NBFC_MATCHING_PROMPT.replace(
      "{studentProfile}",
      studentSummary
    ).replace("{nbfcCriteria}", nbfcCriteria);

    // Call Groq AI
    const llm = createGroqLLM({ temperature: 0.1 });
    const messages = [
      new SystemMessage(
        "You are a precise loan eligibility analyst. Always return valid JSON."
      ),
      new HumanMessage(prompt),
    ];

    const response = await llm.invoke(messages);
    const content = response.content.trim();

    // Parse AI response
    let aiAnalysis;
    try {
      // Extract JSON if wrapped in markdown
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      aiAnalysis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.warn("⚠️ AI JSON parse failed, using fallback scoring");
      const fallback = calculateMatchScore(studentProfile, nbfc.loanConfig);
      aiAnalysis = {
        matchPercentage: fallback.totalScore,
        eligibilityStatus: fallback.eligibilityStatus,
        criteriaAnalysis: {},
        strengths: ["Fallback analysis used"],
        gaps: ["AI analysis unavailable"],
        recommendations: ["Manual review recommended"],
        estimatedROI: {
          min: nbfc.loanConfig.roi.minRate,
          max: nbfc.loanConfig.roi.maxRate,
        },
        confidence: 0.6,
      };
    }

    // Enrich with NBFC details
    return {
      nbfcId: nbfc._id,
      nbfcName: nbfc.companyName,
      nbfcEmail: nbfc.email,
      matchPercentage: aiAnalysis.matchPercentage || 0,
      eligibilityStatus: aiAnalysis.eligibilityStatus || "not_eligible",
      analysis: aiAnalysis,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error(`❌ Error matching with ${nbfc.companyName}:`, error.message);

    // Fallback on error
    const fallback = calculateMatchScore(studentProfile, nbfc.loanConfig);
    return {
      nbfcId: nbfc._id,
      nbfcName: nbfc.companyName,
      nbfcEmail: nbfc.email,
      matchPercentage: fallback.totalScore,
      eligibilityStatus: fallback.eligibilityStatus,
      analysis: {
        error: error.message,
        fallbackUsed: true,
        ...fallback,
      },
      timestamp: new Date(),
    };
  }
}; // ✅ FIXED: Added missing closing brace

/**
 * Matches student against ALL active NBFCs
 */
const matchStudentWithAllNBFCs = async (studentProfile, nbfcs) => {
  console.log(`🚀 Matching student against ${nbfcs.length} NBFCs...`);

  // Run matches in parallel (with concurrency limit)
  const BATCH_SIZE = 3; // Process 3 at a time to avoid rate limits
  const results = [];

  for (let i = 0; i < nbfcs.length; i += BATCH_SIZE) {
    const batch = nbfcs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((nbfc) => matchStudentWithNBFC(studentProfile, nbfc))
    );
    results.push(...batchResults);

    // Small delay between batches
    if (i + BATCH_SIZE < nbfcs.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } // ✅ FIXED: Added missing closing brace

  // Sort by match percentage
  results.sort((a, b) => b.matchPercentage - a.matchPercentage);

  // Categorize
  const eligible = results.filter((r) => r.eligibilityStatus === "eligible");
  const borderline = results.filter(
    (r) => r.eligibilityStatus === "borderline"
  );
  const notEligible = results.filter(
    (r) => r.eligibilityStatus === "not_eligible"
  );

  console.log(
    `✅ Matching complete: ${eligible.length} eligible, ${borderline.length} borderline, ${notEligible.length} not eligible`
  );

  return {
    eligible,
    borderline,
    notEligible,
    summary: {
      totalNBFCs: nbfcs.length,
      eligibleCount: eligible.length,
      borderlineCount: borderline.length,
      notEligibleCount: notEligible.length,
      topMatch: results[0] || null,
    },
  };
};

module.exports = { matchStudentWithNBFC, matchStudentWithAllNBFCs };
