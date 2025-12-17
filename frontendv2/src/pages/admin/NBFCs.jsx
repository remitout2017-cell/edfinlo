// src/pages/admin/NBFCs.jsx
import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import AdminLayout from '../../components/layouts/AdminLayout';
import toast from 'react-hot-toast';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Building2,
  Eye,
  Power,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  Calendar
} from 'lucide-react';

const AdminNBFCs = () => {
  const [nbfcs, setNbfcs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '', 'approved', 'pending'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedNBFC, setSelectedNBFC] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchNBFCs();
  }, [page, searchTerm, statusFilter]);

  const fetchNBFCs = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.listNBFCs(page, 10, statusFilter, searchTerm);
      setNbfcs(response.data.nbfcs || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      toast.error('Failed to fetch NBFCs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleApprove = async (id, approved) => {
    try {
      await adminAPI.approveNBFC(id, approved);
      toast.success(`NBFC ${approved ? 'approved' : 'rejected'} successfully`);
      fetchNBFCs();
    } catch (error) {
      toast.error(`Failed to ${approved ? 'approve' : 'reject'} NBFC`);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await adminAPI.toggleNBFCStatus(id);
      toast.success('NBFC status updated successfully');
      fetchNBFCs();
    } catch (error) {
      toast.error('Failed to update NBFC status');
    }
  };

  const openDetailsModal = (nbfc) => {
    setSelectedNBFC(nbfc);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setSelectedNBFC(null);
    setShowDetailsModal(false);
  };

  const getStatusBadge = (nbfc) => {
    if (nbfc.isApprovedByAdmin) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3" />
          Approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
        <AlertCircle className="h-3 w-3" />
        Pending
      </span>
    );
  };

  const getActiveBadge = (isActive) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
          <Power className="h-3 w-3" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
        <Power className="h-3 w-3" />
          Inactive
        </span>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">NBFCs Management</h1>
            <p className="text-gray-600 mt-1">Approve and manage NBFC partners</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by company name or email..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending Approval</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total NBFCs</p>
                <p className="text-2xl font-bold text-gray-900">{nbfcs.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {nbfcs.filter(n => n.isApprovedByAdmin).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {nbfcs.filter(n => !n.isApprovedByAdmin).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* NBFCs Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : nbfcs.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No NBFCs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Active
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {nbfcs.map((nbfc) => (
                      <tr key={nbfc._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {nbfc.companyName}
                            </div>
                            {nbfc.brandName && (
                              <div className="text-sm text-gray-500">
                                {nbfc.brandName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="text-gray-900">{nbfc.email}</div>
                            {nbfc.phoneNumber && (
                              <div className="text-gray-500">{nbfc.phoneNumber}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(nbfc)}
                        </td>
                        <td className="px-6 py-4">
                          {getActiveBadge(nbfc.isActive)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(nbfc.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openDetailsModal(nbfc)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="View Details"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            
                            {!nbfc.isApprovedByAdmin && (
                              <>
                                <button
                                  onClick={() => handleApprove(nbfc._id, true)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleApprove(nbfc._id, false)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="Reject"
                                >
                                  <XCircle className="h-5 w-5" />
                                </button>
                              </>
                            )}
                            
                            <button
                              onClick={() => handleToggleStatus(nbfc._id)}
                              className={`p-2 rounded-lg transition ${
                                nbfc.isActive
                                  ? 'text-gray-600 hover:bg-gray-50'
                                  : 'text-blue-600 hover:bg-blue-50'
                              }`}
                              title={nbfc.isActive ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div>
                  <p className="text-sm text-gray-700">
                    Page <span className="font-medium">{page}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedNBFC && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">NBFC Details</h2>
                <button
                  onClick={closeDetailsModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Company Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Company Name</p>
                      <p className="font-medium text-gray-900">{selectedNBFC.companyName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Brand Name</p>
                      <p className="font-medium text-gray-900">{selectedNBFC.brandName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Registration Number</p>
                      <p className="font-medium text-gray-900">{selectedNBFC.registrationNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">GST Number</p>
                      <p className="font-medium text-gray-900">{selectedNBFC.gstNumber || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <span className="text-gray-900">{selectedNBFC.email}</span>
                      {selectedNBFC.isEmailVerified && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    {selectedNBFC.phoneNumber && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-900">{selectedNBFC.phoneNumber}</span>
                        {selectedNBFC.isPhoneVerified && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    )}
                    {selectedNBFC.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-gray-400 mt-1" />
                        <div className="text-gray-900">
                          {selectedNBFC.address.line1 && <div>{selectedNBFC.address.line1}</div>}
                          {selectedNBFC.address.line2 && <div>{selectedNBFC.address.line2}</div>}
                          {selectedNBFC.address.city && selectedNBFC.address.state && (
                            <div>{selectedNBFC.address.city}, {selectedNBFC.address.state}</div>
                          )}
                          {selectedNBFC.address.pincode && (
                            <div>{selectedNBFC.address.pincode}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Person */}
                {selectedNBFC.contactPerson && selectedNBFC.contactPerson.name && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Person</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-medium text-gray-900">{selectedNBFC.contactPerson.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Designation</p>
                        <p className="font-medium text-gray-900">{selectedNBFC.contactPerson.designation || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium text-gray-900">{selectedNBFC.contactPerson.email || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="font-medium text-gray-900">{selectedNBFC.contactPerson.phone || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
                  <div className="flex gap-4">
                    {getStatusBadge(selectedNBFC)}
                    {getActiveBadge(selectedNBFC.isActive)}
                  </div>
                </div>

                {/* Dates */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Registered:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(selectedNBFC.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    {selectedNBFC.lastLogin && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Last Login:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(selectedNBFC.lastLogin).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  {!selectedNBFC.isApprovedByAdmin && (
                    <>
                      <button
                        onClick={() => {
                          handleApprove(selectedNBFC._id, true);
                          closeDetailsModal();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        <CheckCircle className="h-5 w-5" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          handleApprove(selectedNBFC._id, false);
                          closeDetailsModal();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        <XCircle className="h-5 w-5" />
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      handleToggleStatus(selectedNBFC._id);
                      closeDetailsModal();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    <Power className="h-5 w-5" />
                    {selectedNBFC.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminNBFCs;
