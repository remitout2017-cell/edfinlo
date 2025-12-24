// src/pages/consultant/LoanAnalysis.jsx - Uses ConsultantDataContext
import { useState, useEffect } from 'react';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { useConsultantData } from '../../context/ConsultantDataContext';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  Award,
  DollarSign,
  Percent,
  Clock,
  BarChart3
} from 'lucide-react';

const ConsultantLoanAnalysis = () => {
  const { getLoanAnalysis, getDashboardStats } = useConsultantData();

  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchAnalysisData();
  }, []);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      const [analysisData, statsData] = await Promise.all([
        getLoanAnalysis(),
        getDashboardStats()
      ]);

      setAnalyses(analysisData?.analyses || []);
      setStats(statsData || {});
    } catch (error) {
      toast.error('Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  };

  const AnalysisCard = ({ analysis }) => (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50 hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white font-semibold">
            {analysis.studentName?.charAt(0)}
          </div>
          <div>
            <h4 className="font-bold text-gray-900">{analysis.studentName}</h4>
            <p className="text-sm text-gray-600">₹{analysis.loanAmount?.toLocaleString()}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${analysis.recommendation === 'APPROVED'
            ? 'bg-green-100 text-green-800'
            : analysis.recommendation === 'REJECTED'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
          {analysis.recommendation}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Percent className="h-4 w-4 text-gray-400" />
          <span>Interest: {analysis.interestRate}%</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-gray-400" />
          <span>Tenure: {analysis.loanTenure} months</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <div>EMI: ₹{analysis.monthlyEMI?.toLocaleString()}</div>
          <div>Total: ₹{analysis.totalPayable?.toLocaleString()}</div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-xs font-semibold">
          <TrendingUp className="h-4 w-4" />
          Score: {analysis.creditScore}/100
        </div>
      </div>
    </div>
  );

  return (
    <ConsultantLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Loan Analysis</h1>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-orange-100 text-orange-800 rounded-xl text-sm font-semibold">
              {stats.totalAnalysis || 0} analyses
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Loan Amount</p>
                <p className="text-2xl font-bold text-gray-900">₹{stats.totalLoanAmount?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl">
                <Award className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.approvedLoans || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Credit Score</p>
                <p className="text-2xl font-bold text-orange-600">{stats.avgCreditScore || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading analysis...</p>
              </div>
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-16 bg-white/70 backdrop-blur-xl rounded-2xl p-12 shadow-lg border border-white/50">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Analysis Available</h3>
              <p className="text-gray-600 mb-6">Run loan analysis for your students to see recommendations</p>
            </div>
          ) : (
            analyses.map((analysis) => (
              <AnalysisCard key={analysis._id} analysis={analysis} />
            ))
          )}
        </div>
      </div>
    </ConsultantLayout>
  );
};

export default ConsultantLoanAnalysis;
