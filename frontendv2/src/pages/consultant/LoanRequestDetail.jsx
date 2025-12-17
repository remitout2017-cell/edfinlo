// src/pages/consultant/LoanRequestDetail.jsx - DETAILED VIEW
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { consultantAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  User, 
  DollarSign, 
  Percent, 
  Calendar, 
  FileText, 
  ShieldCheck,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  Download
} from 'lucide-react';

const ConsultantLoanRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    fetchRequestDetails();
  }, [id]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const [requestRes, analysisRes] = await Promise.all([
        consultantAPI.getLoanRequestById(id),
        consultantAPI.getStudentLoanRequests(id)
      ]);
      
      setRequest(requestRes.data.loanRequest);
      setAnalysis(analysisRes.data.analysis);
    } catch (error) {
      toast.error('Failed to load loan request details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
      approved: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
      processing: { bg: 'bg-blue-100', text: 'text-blue-800', icon: TrendingUp }
    };
    
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold ${badge.bg} ${badge.text}`}>
        <Icon className="h-4 w-4" />
        {status?.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <ConsultantLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading loan details...</p>
          </div>
        </div>
      </ConsultantLayout>
    );
  }

  if (!request) {
    return (
      <ConsultantLayout>
        <div className="text-center py-16">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loan Request Not Found</h3>
          <Link
            to="/consultant/loan-requests"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
          >
            Back to Requests
          </Link>
        </div>
      </ConsultantLayout>
    );
  }

  return (
    <ConsultantLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/consultant/loan-requests')}
            className="p-2 -ml-2 rounded-2xl hover:bg-gray-100 transition"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Loan Request #{request._id?.slice(-6).toUpperCase()}
            </h1>
            <p className="text-gray-600 mt-1">{request.student?.firstName} {request.student?.lastName}</p>
          </div>
        </div>

        {/* Main Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Loan Summary */}
          <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
                  ₹
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    {formatCurrency(request.loanAmount)}
                  </h2>
                  <p className="text-gray-600">{request.loanTenure} months tenure</p>
                </div>
              </div>
              {getStatusBadge(request.status)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Student Info */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Student Details
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                      {request.student?.firstName?.charAt(0)}{request.student?.lastName?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">
                        {request.student?.firstName} {request.student?.lastName}
                      </p>
                      <p className="text-sm text-gray-600">{request.student?.email}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">KYC Status:</span>
                      <div className="mt-1 font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full inline-flex items-center gap-1 text-xs">
                        <ShieldCheck className="h-3 w-3" />
                        {request.student?.kycStatus || 'Pending'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Course:</span>
                      <p className="mt-1 font-semibold">{request.courseName}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Loan Details */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Loan Details
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-2xl">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-gray-600">Monthly EMI</span>
                      <span className="text-2xl font-bold text-blue-700">
                        {formatCurrency(request.monthlyEMI)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 block">Interest Rate</span>
                      <span className="font-bold text-lg text-purple-600">{request.interestRate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Processing Fee</span>
                      <span className="font-bold">{formatCurrency(request.processingFee)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Total Payable</span>
                      <span className="font-bold text-orange-600">{formatCurrency(request.totalPayable)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Applied Date</span>
                      <span className="text-sm">
                        {new Date(request.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Sidebar */}
          <div className="space-y-6">
            {/* Credit Score */}
            <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-3xl p-6 shadow-lg">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                Credit Analysis
              </h3>
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl">
                  <div className="text-2xl font-bold">{analysis?.creditScore || 0}</div>
                  <div className="text-xs uppercase tracking-wide">/100</div>
                </div>
                <div className={`inline-flex items-center gap-1 px-4 py-2 rounded-2xl text-sm font-bold ${
                  analysis?.recommendation === 'APPROVED' 
                    ? 'bg-green-100 text-green-800' 
                    : analysis?.recommendation === 'REJECTED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {analysis?.recommendation || 'PENDING'}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/50">
              <h4 className="font-bold text-gray-900 mb-4">Quick Actions</h4>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition shadow-md">
                  <CheckCircle className="h-4 w-4" />
                  Approve Request
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition shadow-md">
                  <XCircle className="h-4 w-4" />
                  Reject Request
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition shadow-md">
                  <Download className="h-4 w-4" />
                  Download Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Supporting Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {request.documents && request.documents.length > 0 ? (
              request.documents.map((doc, index) => (
                <div key={index} className="group bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-dashed border-gray-300 rounded-2xl p-6 hover:border-blue-400 transition">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4 group-hover:text-blue-500 transition" />
                  <h4 className="font-semibold text-gray-900 mb-2 text-center">{doc.type}</h4>
                  <p className="text-sm text-gray-600 text-center mb-4">{doc.fileName}</p>
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
                    Download
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-16">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No documents uploaded yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ConsultantLayout>
  );
};

export default ConsultantLoanRequestDetail;
