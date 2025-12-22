// src/pages/consultant/Support.jsx
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { Headphones, Mail, Phone, MessageCircle, ExternalLink } from 'lucide-react';

const ConsultantSupport = () => {
    return (
        <ConsultantLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-gray-900">Support</h1>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    {/* Support Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-orange-100 mb-4">
                            <Headphones className="h-8 w-8 text-orange-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">How can we help you?</h2>
                        <p className="text-gray-500 mt-2">Get in touch with our support team</p>
                    </div>

                    {/* Contact Options */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <a
                            href="mailto:support@edfinlo.com"
                            className="flex flex-col items-center p-6 bg-gray-50 rounded-xl hover:bg-orange-50 hover:border-orange-200 border-2 border-transparent transition-colors"
                        >
                            <Mail className="h-8 w-8 text-orange-500 mb-3" />
                            <h3 className="font-semibold text-gray-900">Email</h3>
                            <p className="text-sm text-gray-500 mt-1">support@edfinlo.com</p>
                        </a>

                        <a
                            href="tel:+919876543210"
                            className="flex flex-col items-center p-6 bg-gray-50 rounded-xl hover:bg-orange-50 hover:border-orange-200 border-2 border-transparent transition-colors"
                        >
                            <Phone className="h-8 w-8 text-orange-500 mb-3" />
                            <h3 className="font-semibold text-gray-900">Phone</h3>
                            <p className="text-sm text-gray-500 mt-1">+91 98765 43210</p>
                        </a>

                        <a
                            href="#"
                            className="flex flex-col items-center p-6 bg-gray-50 rounded-xl hover:bg-orange-50 hover:border-orange-200 border-2 border-transparent transition-colors"
                        >
                            <MessageCircle className="h-8 w-8 text-orange-500 mb-3" />
                            <h3 className="font-semibold text-gray-900">Live Chat</h3>
                            <p className="text-sm text-gray-500 mt-1">Available 9am - 6pm</p>
                        </a>
                    </div>

                    {/* FAQ Section */}
                    <div className="mt-8 pt-8 border-t border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <h4 className="font-medium text-gray-900">How do I invite a new student?</h4>
                                <p className="text-sm text-gray-500 mt-1">Go to Dashboard and click "Start New Registration" to send an invite.</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <h4 className="font-medium text-gray-900">How do I track my commission?</h4>
                                <p className="text-sm text-gray-500 mt-1">Click on "Track Commission" button on the dashboard.</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <h4 className="font-medium text-gray-900">How do I view student application status?</h4>
                                <p className="text-sm text-gray-500 mt-1">Navigate to "Student Applications Status" from the sidebar menu.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ConsultantLayout>
    );
};

export default ConsultantSupport;
