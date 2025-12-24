// src/pages/consultant/Invite.jsx - Uses ConsultantDataContext
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { useConsultantData } from '../../context/ConsultantDataContext';
import toast from 'react-hot-toast';
import {
  Send,
  Plus,
  X,
  Mail,
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const ConsultantInvite = () => {
  const navigate = useNavigate();
  const { inviteMultipleStudents, loading } = useConsultantData();

  const [emails, setEmails] = useState(['']);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);

  const addEmailField = () => {
    setEmails([...emails, '']);
  };

  const removeEmailField = (index) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index, value) => {
    const updated = [...emails];
    updated[index] = value;
    setEmails(updated);
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Filter valid emails
    const validEmails = emails.filter(email => email.trim() && validateEmail(email.trim()));

    if (validEmails.length === 0) {
      toast.error('Please enter at least one valid email address');
      return;
    }

    try {
      setSending(true);
      const response = await inviteMultipleStudents(validEmails);

      setResults({
        success: response.data?.success || [],
        failed: response.data?.failed || []
      });

      toast.success(`Invitations sent to ${validEmails.length} email(s)`);

      // Reset form
      setEmails(['']);
    } catch (error) {
      console.error('Failed to send invitations:', error);
      toast.error(error.message || 'Failed to send invitations');
    } finally {
      setSending(false);
    }
  };

  return (
    <ConsultantLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invite Students</h1>
          <p className="text-gray-600 mt-1">
            Send invitation emails to students you want to onboard
          </p>
        </div>

        {/* Invite Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Student Email Addresses
              </label>

              {emails.map((email, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="student@example.com"
                      className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${email && !validateEmail(email) ? 'border-red-300' : 'border-gray-300'
                        }`}
                    />
                    {email && !validateEmail(email) && (
                      <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-red-500">
                        <AlertCircle className="h-5 w-5" />
                      </span>
                    )}
                  </div>
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailField(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addEmailField}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Add another email
              </button>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => navigate('/consultant/students')}
                className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl hover:from-green-700 hover:to-blue-700 transition shadow-lg disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Invitations
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invitation Results</h3>

            {results.success?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Successfully sent ({results.success.length})
                </p>
                <ul className="space-y-1">
                  {results.success.map((email, i) => (
                    <li key={i} className="text-sm text-gray-600 pl-6">{email}</li>
                  ))}
                </ul>
              </div>
            )}

            {results.failed?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Failed ({results.failed.length})
                </p>
                <ul className="space-y-1">
                  {results.failed.map((item, i) => (
                    <li key={i} className="text-sm text-gray-600 pl-6">
                      {item.email}: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
          <div className="flex items-start gap-4">
            <Users className="h-8 w-8 text-blue-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900">How invitations work</h3>
              <p className="text-sm text-blue-700 mt-1">
                Students will receive an email with a registration link. Once they complete
                registration, they will automatically be linked to your account and appear
                in your students list.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ConsultantLayout>
  );
};

export default ConsultantInvite;
