// src/pages/consultant/Invite.jsx - COMPLETE VERSION
import { useState } from 'react';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { consultantAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { UserPlus, Mail, Plus, X, Send, CheckCircle } from 'lucide-react';

const ConsultantInvite = () => {
  const [emails, setEmails] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  const addEmailField = () => {
    if (emails.length < 10) {
      setEmails([...emails, '']);
    } else {
      toast.error('Maximum 10 invites at once');
    }
  };

  const removeEmailField = (index) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index, value) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const validateEmails = () => {
    const validEmails = emails.filter(email => {
      const trimmed = email.trim();
      return trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    });

    if (validEmails.length === 0) {
      toast.error('Please enter at least one valid email');
      return false;
    }

    return validEmails;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validEmails = validateEmails();
    if (!validEmails) return;

    try {
      setLoading(true);
      const response = await consultantAPI.inviteStudents({ emails: validEmails });
      
      setSuccessCount(response.data.successCount || validEmails.length);
      toast.success(`${response.data.successCount} invitation(s) sent successfully!`);
      
      // Reset form
      setEmails(['']);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send invitations');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConsultantLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl mb-4">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Invite Students</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Send invitation emails to students. They'll receive a link to register and will be automatically linked to your consultant account.
          </p>
        </div>

        {/* Success Message */}
        {successCount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Invitations Sent Successfully!</p>
                <p className="text-sm text-green-700 mt-1">
                  {successCount} student(s) will receive invitation emails shortly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Invitation Form */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-4">
                Student Email Addresses
              </label>
              <div className="space-y-3">
                {emails.map((email, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        placeholder={`student${index + 1}@example.com`}
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        required
                      />
                    </div>
                    {emails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailField(index)}
                        className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add More Button */}
            {emails.length < 10 && (
              <button
                type="button"
                onClick={addEmailField}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium"
              >
                <Plus className="h-5 w-5" />
                Add Another Email
              </button>
            )}

            {/* Submit Button */}
            <div className="flex items-center gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-blue-700 focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Sending Invitations...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send {emails.filter(e => e.trim()).length} Invitation{emails.filter(e => e.trim()).length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Students will receive an invitation email with a registration link</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>When they register, they'll automatically be linked to your consultant account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>You can track their progress and manage their loan applications</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Invitations expire after 7 days but can be resent</span>
            </li>
          </ul>
        </div>
      </div>
    </ConsultantLayout>
  );
};

export default ConsultantInvite;
