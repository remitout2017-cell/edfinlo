"""
university_scorer.py
Comprehensive university scoring system for admission letters
"""

import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
import re

logger = logging.getLogger(__name__)


class UniversityScorer:
    """Score universities based on rankings, reputation, and admission letter quality"""

    # Weight distribution for scoring
    WEIGHTS = {
        'ranking': 0.40,
        'reputation': 0.25,
        'admission_quality': 0.20,
        'country_factor': 0.15,
    }

    # Country tiers for scoring
    COUNTRY_TIERS = {
        'tier_1': ['usa', 'united states', 'united kingdom', 'uk', 'canada', 'australia', 'germany',
                   'france', 'switzerland', 'netherlands', 'sweden', 'denmark', 'norway', 'finland'],
        'tier_2': ['ireland', 'singapore', 'hong kong', 'austria', 'belgium', 'new zealand',
                   'japan', 'south korea', 'italy', 'spain'],
        'tier_3': ['portugal', 'malaysia', 'china', 'india', 'russia', 'brazil',
                   'south africa', 'mexico', 'turkey', 'poland'],
        'tier_4': ['other', 'unknown', 'bangladesh', 'pakistan', 'indonesia', 'thailand', 'vietnam'],
    }

    # Ranking score mapping
    RANKING_SCORES = [
        (1, 50, 100),
        (51, 100, 95),
        (101, 200, 85),
        (201, 300, 75),
        (301, 500, 65),
        (501, 800, 55),
        (801, 1000, 45),
        (1001, 1500, 35),
        (1501, 2000, 25),
        (2001, 99999, 15)
    ]

    def __init__(self):
        """Initialize the scorer"""
        self.scoring_log = []
        print("✅ University Scorer initialized")

    def calculate_university_score(self,
                                   admission_data: Dict[str, Any],
                                   ranking_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculate comprehensive university score (0-100)

        Returns:
            Dictionary with score breakdown
        """
        print("\n🎯 CALCULATING UNIVERSITY SCORE")
        print("-" * 40)

        scores = {
            'overall_score': 0.0,
            'ranking_score': 0.0,
            'reputation_score': 0.0,
            'admission_quality_score': 0.0,
            'country_score': 0.0,
            'risk_level': 'medium',
            'strengths': [],
            'issues': [],
            'score_breakdown': {},
            'scoring_summary': ""
        }

        try:
            # Log the input data
            self.scoring_log.append(
                f"Processing university: {admission_data.get('university_name', 'Unknown')}")

            # 1. Calculate ranking score
            scores['ranking_score'] = self._calculate_ranking_score(
                ranking_data)

            # 2. Calculate reputation score
            scores['reputation_score'] = self._calculate_reputation_score(
                ranking_data)

            # 3. Calculate admission quality score
            scores['admission_quality_score'] = self._calculate_admission_quality_score(
                admission_data)

            # 4. Calculate country factor score
            scores['country_score'] = self._calculate_country_score(
                admission_data.get('country', ''))

            # 5. Calculate weighted overall score
            weights = self.WEIGHTS
            overall = (
                scores['ranking_score'] * weights['ranking'] +
                scores['reputation_score'] * weights['reputation'] +
                scores['admission_quality_score'] * weights['admission_quality'] +
                scores['country_score'] * weights['country_factor']
            )

            # Ensure score is between 0-100
            scores['overall_score'] = max(0.0, min(100.0, round(overall, 2)))

            # 6. Determine risk level
            scores['risk_level'] = self._determine_risk_level(
                scores['overall_score'])

            # 7. Identify strengths and issues
            scores['strengths'] = self._identify_strengths(
                scores, admission_data, ranking_data)
            scores['issues'] = self._identify_issues(
                scores, admission_data, ranking_data)

            # 8. Create score breakdown
            scores['score_breakdown'] = {
                'ranking': round(scores['ranking_score'], 1),
                'reputation': round(scores['reputation_score'], 1),
                'admission_quality': round(scores['admission_quality_score'], 1),
                'country_factor': round(scores['country_score'], 1),
                'weights': weights
            }

            # 9. Generate scoring summary
            scores['scoring_summary'] = self._generate_scoring_summary(
                scores, admission_data, ranking_data)

            # Print results
            self._print_score_results(scores, admission_data)

            return scores

        except Exception as e:
            logger.error(f"Error calculating university score: {e}")
            import traceback
            traceback.print_exc()
            return scores

    def _calculate_ranking_score(self, ranking_data: Optional[Dict[str, Any]]) -> float:
        """Calculate score based on university rankings"""
        if not ranking_data:
            print("  ⚠️ No ranking data available, using default score: 50.0")
            return 50.0

        best_score = 0.0

        # Check each ranking system
        for ranking_type in ['qs_world_ranking', 'times_world_ranking', 'us_news_ranking']:
            ranking = ranking_data.get(ranking_type)
            if ranking and isinstance(ranking, (int, float)):
                # Find which range the ranking falls into
                for min_rank, max_rank, score in self.RANKING_SCORES:
                    if min_rank <= ranking <= max_rank:
                        if score > best_score:
                            best_score = score
                        break

        # If we found at least one ranking, use it
        if best_score > 0:
            print(f"  ✅ Best ranking score: {best_score}")
            return float(best_score)

        # No valid rankings found
        print("  ⚠️ No valid rankings found, using default: 30.0")
        return 30.0

    def _calculate_reputation_score(self, ranking_data: Optional[Dict[str, Any]]) -> float:
        """Calculate reputation score based on ranking consistency"""
        if not ranking_data:
            print("  ⚠️ No ranking data for reputation, using default: 40.0")
            return 40.0

        rankings = []
        ranking_names = []

        # Collect all valid rankings
        if ranking_data.get('qs_world_ranking'):
            rankings.append(ranking_data['qs_world_ranking'])
            ranking_names.append('QS')
        if ranking_data.get('times_world_ranking'):
            rankings.append(ranking_data['times_world_ranking'])
            ranking_names.append('THE')
        if ranking_data.get('us_news_ranking'):
            rankings.append(ranking_data['us_news_ranking'])
            ranking_names.append('US News')

        if not rankings:
            print("  ⚠️ No valid rankings for reputation calculation")
            return 40.0

        # Calculate average ranking
        avg_rank = sum(rankings) / len(rankings)

        # Consistency check
        if len(rankings) >= 2:
            variance = sum((r - avg_rank) **
                           2 for r in rankings) / len(rankings)

            if variance < 100:  # Very consistent
                reputation_score = min(100, (1000 / avg_rank) * 0.7 + 60)
                print(
                    f"  ✅ Consistent rankings ({', '.join(ranking_names)}), variance: {variance:.1f}")
            elif variance < 500:
                reputation_score = min(90, (1000 / avg_rank) * 0.6 + 50)
                print(f"  ⚠️ Moderate ranking variance: {variance:.1f}")
            else:
                reputation_score = min(80, (1000 / avg_rank) * 0.5 + 40)
                print(f"  ⚠️ High ranking variance: {variance:.1f}")
        else:
            # Single ranking
            reputation_score = min(100, (1000 / rankings[0]) * 0.5 + 50)
            print(f"  ✅ Single ranking ({ranking_names[0]})")

        return round(reputation_score, 2)

    def _calculate_admission_quality_score(self, admission_data: Dict[str, Any]) -> float:
        """Score based on admission letter quality and completeness"""
        score = 50.0  # Base score

        # Check each quality factor
        quality_factors = []

        # University name
        if admission_data.get('university_name'):
            score += 15
            quality_factors.append("✓ University name present")
        else:
            quality_factors.append("✗ Missing university name")

        # Program name
        if admission_data.get('program_name'):
            score += 15
            quality_factors.append("✓ Program name present")
        else:
            quality_factors.append("✗ Missing program name")

        # Intake date
        if admission_data.get('intake_year'):
            score += 10
            quality_factors.append("✓ Intake year specified")

        # Tuition information
        if admission_data.get('tuition_fee'):
            score += 10
            tuition = admission_data['tuition_fee']
            if 1000 <= tuition <= 100000:
                quality_factors.append("✓ Realistic tuition fee")
            else:
                score -= 5
                quality_factors.append("⚠️ Unusual tuition fee")

        # Deadlines
        has_deadlines = any([
            admission_data.get('acceptance_deadline'),
            admission_data.get('enrollment_deadline'),
            admission_data.get('fee_payment_deadline')
        ])
        if has_deadlines:
            score += 10
            quality_factors.append("✓ Deadlines specified")

        # Student/Application ID
        if admission_data.get('student_id') or admission_data.get('application_id'):
            score += 5
            quality_factors.append("✓ Student/Application ID present")

        # Document quality
        extraction_confidence = admission_data.get('extraction_confidence', 0)
        if extraction_confidence >= 0.8:
            score += 10
            quality_factors.append(
                f"✓ High extraction confidence ({extraction_confidence:.2f})")
        elif extraction_confidence >= 0.5:
            score += 5
            quality_factors.append(
                f"⚠️ Moderate extraction confidence ({extraction_confidence:.2f})")
        else:
            quality_factors.append(
                f"✗ Low extraction confidence ({extraction_confidence:.2f})")

        # Conditional admission penalty
        if admission_data.get('conditional_admission'):
            score -= 5
            quality_factors.append("⚠️ Conditional admission")

        # Cap score at 100
        final_score = max(0, min(100, score))

        # Print quality factors
        for factor in quality_factors:
            print(f"    {factor}")

        return round(final_score, 2)

    def _calculate_country_score(self, country: str) -> float:
        """Score based on country's education reputation"""
        if not country:
            print("  ⚠️ No country specified, using default: 50.0")
            return 50.0

        country_lower = country.lower().strip()

        # Check country tiers
        for tier_name, tier_countries in self.COUNTRY_TIERS.items():
            for tier_country in tier_countries:
                if tier_country in country_lower or country_lower in tier_country:
                    if tier_name == 'tier_1':
                        print(f"  ✅ Tier 1 country: {country}")
                        return 90.0
                    elif tier_name == 'tier_2':
                        print(f"  ✅ Tier 2 country: {country}")
                        return 75.0
                    elif tier_name == 'tier_3':
                        print(f"  ✅ Tier 3 country: {country}")
                        return 60.0
                    elif tier_name == 'tier_4':
                        print(f"  ⚠️ Tier 4 country: {country}")
                        return 45.0

        # Country not in predefined tiers
        print(f"  ⚠️ Country not in predefined tiers: {country}")
        return 40.0

    def _determine_risk_level(self, score: float) -> str:
        """Determine risk level based on score"""
        if score >= 80:
            return 'low'
        elif score >= 70:
            return 'medium_low'
        elif score >= 60:
            return 'medium'
        elif score >= 50:
            return 'medium_high'
        else:
            return 'high'

    def _identify_strengths(self, scores: Dict[str, Any],
                            admission_data: Dict[str, Any],
                            ranking_data: Optional[Dict[str, Any]]) -> List[str]:
        """Identify university strengths"""
        strengths = []

        # Overall score strengths
        if scores['overall_score'] >= 80:
            strengths.append("Excellent overall score")
        elif scores['overall_score'] >= 70:
            strengths.append("Good overall score")

        # Ranking strengths
        if scores['ranking_score'] >= 80:
            strengths.append("Top-tier university ranking")
        elif scores['ranking_score'] >= 70:
            strengths.append("Strong university ranking")

        # Country strengths
        if scores['country_score'] >= 80:
            strengths.append("Prestigious study destination")
        elif scores['country_score'] >= 70:
            strengths.append("Reputable study destination")

        # Admission quality strengths
        if admission_data.get('university_name') and admission_data.get('program_name'):
            strengths.append("Clear university and program information")

        if admission_data.get('tuition_fee'):
            strengths.append("Transparent tuition information")

        if admission_data.get('scholarship_mentioned'):
            strengths.append("Scholarship opportunities available")

        if not admission_data.get('conditional_admission'):
            strengths.append("Unconditional admission offer")

        if admission_data.get('extraction_confidence', 0) >= 0.8:
            strengths.append("High-quality admission document")

        # Ranking data specifics
        if ranking_data:
            if ranking_data.get('qs_world_ranking') and ranking_data['qs_world_ranking'] <= 100:
                strengths.append(
                    f"QS Top 100 University (#{ranking_data['qs_world_ranking']})")
            if ranking_data.get('times_world_ranking') and ranking_data['times_world_ranking'] <= 100:
                strengths.append(
                    f"THE Top 100 University (#{ranking_data['times_world_ranking']})")

        return strengths[:5]

    def _identify_issues(self, scores: Dict[str, Any],
                         admission_data: Dict[str, Any],
                         ranking_data: Optional[Dict[str, Any]]) -> List[str]:
        """Identify potential issues or red flags"""
        issues = []

        # Overall score issues
        if scores['overall_score'] < 50:
            issues.append("Overall score below acceptable threshold")

        # Ranking issues
        if scores['ranking_score'] < 40:
            issues.append("University ranking below average")

        # Country issues
        if scores['country_score'] < 40:
            issues.append("Less recognized study destination")

        # Admission document issues
        if not admission_data.get('university_name'):
            issues.append("University name not clearly stated in document")

        if not admission_data.get('program_name'):
            issues.append("Program name not clearly stated")

        if admission_data.get('extraction_confidence', 0) < 0.5:
            issues.append("Poor document quality affecting data extraction")

        if admission_data.get('conditional_admission'):
            issues.append(
                "Conditional admission requires additional verification")

        # Missing financial info
        if not admission_data.get('tuition_fee'):
            issues.append("Tuition fee information missing")

        # Check for unrealistic tuition
        if admission_data.get('tuition_fee'):
            tuition = admission_data['tuition_fee']
            if tuition < 1000:
                issues.append(f"Unusually low tuition fee (${tuition})")
            elif tuition > 100000:
                issues.append(f"Unusually high tuition fee (${tuition})")

        # Missing deadlines
        if not any([
            admission_data.get('acceptance_deadline'),
            admission_data.get('enrollment_deadline'),
            admission_data.get('fee_payment_deadline')
        ]):
            issues.append("No admission deadlines specified")

        return issues[:5]

    def _generate_scoring_summary(self, scores: Dict[str, Any],
                                  admission_data: Dict[str, Any],
                                  ranking_data: Optional[Dict[str, Any]]) -> str:
        """Generate detailed scoring summary"""
        summary = []
        summary.append("UNIVERSITY SCORE ANALYSIS")
        summary.append("=" * 60)

        # Overall assessment
        overall = scores['overall_score']
        risk = scores['risk_level'].upper().replace('_', ' ')

        if overall >= 80:
            assessment = "EXCELLENT"
            emoji = "🟢"
        elif overall >= 70:
            assessment = "GOOD"
            emoji = "🟡"
        elif overall >= 60:
            assessment = "AVERAGE"
            emoji = "🟠"
        else:
            assessment = "BELOW AVERAGE"
            emoji = "🔴"

        summary.append(f"{emoji} OVERALL RATING: {assessment}")
        summary.append(f"   • Score: {overall:.1f}/100")
        summary.append(f"   • Risk Level: {risk}")
        summary.append("")

        # Score breakdown
        summary.append("SCORE BREAKDOWN:")
        summary.append(f"   • Ranking: {scores['ranking_score']:.1f}/100")
        summary.append(
            f"   • Reputation: {scores['reputation_score']:.1f}/100")
        summary.append(
            f"   • Admission Quality: {scores['admission_quality_score']:.1f}/100")
        summary.append(
            f"   • Country Factor: {scores['country_score']:.1f}/100")
        summary.append("")

        # University info
        summary.append("UNIVERSITY INFORMATION:")
        summary.append(
            f"   • Name: {admission_data.get('university_name', 'Not specified')}")
        summary.append(
            f"   • Program: {admission_data.get('program_name', 'Not specified')}")
        summary.append(
            f"   • Country: {admission_data.get('country', 'Not specified')}")
        summary.append("")

        # Rankings
        if ranking_data:
            summary.append("RANKINGS:")
            if ranking_data.get('qs_world_ranking'):
                summary.append(
                    f"   • QS World Ranking: #{ranking_data['qs_world_ranking']}")
            if ranking_data.get('times_world_ranking'):
                summary.append(
                    f"   • THE World Ranking: #{ranking_data['times_world_ranking']}")
            if ranking_data.get('us_news_ranking'):
                summary.append(
                    f"   • US News Ranking: #{ranking_data['us_news_ranking']}")
            summary.append("")

        # Strengths
        if scores['strengths']:
            summary.append("STRENGTHS:")
            for strength in scores['strengths']:
                summary.append(f"   • {strength}")
            summary.append("")

        # Issues
        if scores['issues']:
            summary.append("ISSUES TO VERIFY:")
            for issue in scores['issues']:
                summary.append(f"   • {issue}")
            summary.append("")

        # Recommendations
        summary.append("RECOMMENDATIONS:")
        if overall >= 75:
            summary.append("   ✅ University meets all quality standards")
            summary.append("   ✅ Proceed with loan application")
            summary.append("   ✅ Consider for priority processing")
        elif overall >= 60:
            summary.append("   ⚠️ University meets most quality standards")
            summary.append(
                "   ⚠️ Additional document verification recommended")
            summary.append("   ✅ Good candidate for loan approval")
        elif overall >= 50:
            summary.append("   ⚠️ Additional verification required")
            summary.append("   ⚠️ Request additional supporting documents")
            summary.append("   ⚠️ Evaluate alternative funding options")
        else:
            summary.append("   ❌ Comprehensive verification required")
            summary.append("   ❌ Consider alternative universities")
            summary.append("   ❌ High-risk application, manual review needed")

        return "\n".join(summary)

    def _print_score_results(self, scores: Dict[str, Any], admission_data: Dict[str, Any]):
        """Print scoring results to console"""
        print(f"\n📊 SCORING RESULTS")
        print("-" * 40)
        print(
            f"🏛️  University: {admission_data.get('university_name', 'Unknown')}")
        print(f"🎯 Overall Score: {scores['overall_score']:.1f}/100")
        print(f"⚠️  Risk Level: {scores['risk_level'].upper()}")
        print(f"📈 Score Breakdown:")
        print(f"   • Ranking: {scores['ranking_score']:.1f}")
        print(f"   • Reputation: {scores['reputation_score']:.1f}")
        print(
            f"   • Admission Quality: {scores['admission_quality_score']:.1f}")
        print(f"   • Country Factor: {scores['country_score']:.1f}")

        if scores['strengths']:
            print(f"💪 Strengths: {', '.join(scores['strengths'][:3])}")

        if scores['issues']:
            print(f"🚨 Issues: {', '.join(scores['issues'][:3])}")

        print("-" * 40)
