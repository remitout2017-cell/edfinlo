// src/components/modals/RegisterStudentsModal.jsx
import { useState, useRef } from 'react';
import { X, Upload, Plus, Trash2 } from 'lucide-react';
import { consultantAPI } from '../../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const RegisterStudentsModal = ({ isOpen, onClose, onSuccess }) => {
    const [students, setStudents] = useState([
        { name: '', email: '', password: '' }
    ]);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    const addStudent = () => {
        if (students.length < 20) {
            setStudents([...students, { name: '', email: '', password: '' }]);
        } else {
            toast.error('Maximum 20 students at once');
        }
    };

    const removeStudent = (index) => {
        if (students.length > 1) {
            setStudents(students.filter((_, i) => i !== index));
        }
    };

    const updateStudent = (index, field, value) => {
        const newStudents = [...students];
        newStudents[index][field] = value;
        setStudents(newStudents);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const workbook = XLSX.read(event.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet);

                if (data.length === 0) {
                    toast.error('No data found in the file');
                    return;
                }

                // Map the data to our student format
                const importedStudents = data.map(row => ({
                    name: row.Name || row.name || row['Name of the Student'] || '',
                    email: row.Email || row.email || '',
                    password: row.Password || row.password || ''
                })).filter(s => s.name || s.email);

                if (importedStudents.length === 0) {
                    toast.error('No valid student data found. Ensure columns: Name, Email, Password');
                    return;
                }

                setStudents(importedStudents.slice(0, 20)); // Limit to 20
                toast.success(`Imported ${Math.min(importedStudents.length, 20)} students`);
            } catch (error) {
                toast.error('Failed to parse Excel file');
                console.error(error);
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; // Reset input
    };

    const validateStudents = () => {
        const validStudents = students.filter(s => {
            const hasName = s.name.trim().length > 0;
            const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim());
            const hasPassword = s.password.trim().length >= 6;
            return hasName && hasEmail && hasPassword;
        });

        if (validStudents.length === 0) {
            toast.error('Please fill in at least one complete student entry (name, valid email, password min 6 chars)');
            return null;
        }

        return validStudents;
    };

    const handleSubmit = async () => {
        const validStudents = validateStudents();
        if (!validStudents) return;

        try {
            setLoading(true);
            const response = await consultantAPI.registerStudents({ students: validStudents });

            toast.success(`${response.data?.successCount || validStudents.length} student(s) registered successfully!`);
            setStudents([{ name: '', email: '', password: '' }]);
            onSuccess?.();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to register students');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStudents([{ name: '', email: '', password: '' }]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-orange-500">Register Students</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Student Entries - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {students.map((student, index) => (
                        <div key={index} className="space-y-3">
                            {/* Name Input */}
                            <input
                                type="text"
                                value={student.name}
                                onChange={(e) => updateStudent(index, 'name', e.target.value)}
                                placeholder="Name of the Student"
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-gray-700 placeholder-gray-400"
                            />

                            {/* Email Input */}
                            <input
                                type="email"
                                value={student.email}
                                onChange={(e) => updateStudent(index, 'email', e.target.value)}
                                placeholder="Email"
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-gray-700 placeholder-gray-400"
                            />

                            {/* Password Input */}
                            <input
                                type="password"
                                value={student.password}
                                onChange={(e) => updateStudent(index, 'password', e.target.value)}
                                placeholder="Password"
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-gray-700 placeholder-gray-400"
                            />

                            {/* Delete Button */}
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => removeStudent(index)}
                                    disabled={students.length === 1}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Delete
                                </button>
                            </div>

                            {/* Divider between entries */}
                            {index < students.length - 1 && (
                                <div className="border-t border-gray-100 pt-3" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    {/* Upload Excel Button */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <span>Upload xlsx</span>
                        <Upload className="h-4 w-4" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                    />

                    {/* Add Student & Save Buttons */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={addStudent}
                            disabled={students.length >= 20}
                            className="px-4 py-2.5 text-sm font-medium text-orange-600 bg-white border border-orange-300 rounded-lg hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Add Student
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-4 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            {loading ? 'Saving...' : 'Save Student details'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterStudentsModal;
