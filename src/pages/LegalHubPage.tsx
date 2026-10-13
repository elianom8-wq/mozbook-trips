import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  FileText, 
  Shield, 
  RefreshCw, 
  Building2, 
  AlertTriangle, 
  CheckCircle, 
  Printer, 
  ChevronRight,
  ExternalLink,
  Scale
} from 'lucide-react';
import { LegalDocumentType, LegalDocumentVersion } from '../types/legal';
import { LegalService } from '../services/legalService';
import { INITIAL_LEGAL_DOCUMENTS, LEGAL_CONFIG_WARNINGS } from '../data/legalDocuments';

export const LegalHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as LegalDocumentType) || 'terms_customer';

  const [activeDoc, setActiveDoc] = useState<LegalDocumentVersion>(INITIAL_LEGAL_DOCUMENTS[currentTab]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    LegalService.getPublishedDocument(currentTab).then(doc => {
      if (isMounted) {
        setActiveDoc(doc);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [currentTab]);

  const handleTabChange = (type: LegalDocumentType) => {
    setSearchParams({ tab: type });
  };

  const navItems: { type: LegalDocumentType; title: string; subtitle: string; icon: any }[] = [
    {
      type: 'terms_customer',
      title: 'Customer Terms & Conditions',
      subtitle: 'Guest bookings, checkout holds, single-payer rules',
      icon: FileText
    },
    {
      type: 'cancellation_refund_policy',
      title: 'Cancellation & Refund Policy',
      subtitle: 'PaySuite reconciliation, 15% platform split, inventory failure',
      icon: RefreshCw
    },
    {
      type: 'privacy_policy',
      title: 'Privacy & Data Protection',
      subtitle: 'Firebase storage, PaySuite data flow, KYC retention',
      icon: Shield
    },
    {
      type: 'partner_agreement',
      title: 'Partner & Operator Agreement',
      subtitle: 'Host standards, 85% payouts, inventory accountability',
      icon: Building2
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb / Top Bar */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link to="/" className="hover:text-gray-900">Home</Link>
          <ChevronRight size={14} />
          <span className="font-semibold text-gray-700">Legal & Regulatory Framework</span>
        </div>

        {/* Header Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-sm mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#009A60]/10 text-[#009A60] mb-3">
                <Scale size={14} />
                <span>Operating Framework & Statutory Disclosures</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                MozBook Legal & Contractual Center
              </h1>
              <p className="mt-2 text-sm text-gray-600 max-w-2xl leading-relaxed">
                Operated by <strong className="text-gray-900 font-semibold">Elvira da Gloria Consulting SU, Lda.</strong> in the Republic of Mozambique. Authoritative terms governing online bookings, PaySuite payment reconciliation, host listings, and customer protections.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
              >
                <Printer size={15} />
                <span>Print Document</span>
              </button>
            </div>
          </div>

          {/* Legal Counsel Review Banner */}
          <div className="mt-6 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-amber-950">Statutory Notice & Legal Review Status</span>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                These documents reflect the live technical workflows, booking algorithms, PaySuite financial reconciliations, and inventory controls implemented in MozBook. Under Prompt 28A governance, final statutory deed ratification is subject to formal review by qualified Mozambican legal counsel.
              </p>
            </div>
          </div>
        </div>

        {/* Main Grid: Nav + Document Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">
              Official Legal Documents
            </h3>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleTabChange(item.type)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                    isActive
                      ? 'bg-white border-[#009A60] shadow-md shadow-[#009A60]/5 ring-2 ring-[#009A60]/20'
                      : 'bg-white border-gray-200/80 hover:border-gray-300 hover:bg-gray-50/50'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    isActive ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}

            {/* Operating Entity Card */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200/80 mt-6 shadow-sm">
              <h4 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Building2 size={15} className="text-[#009A60]" />
                <span>Operating Entity Details</span>
              </h4>
              <dl className="text-xs space-y-1.5 text-gray-600">
                <div>
                  <dt className="text-gray-400 inline">Legal Name: </dt>
                  <dd className="font-semibold text-gray-900 inline">Elvira da Gloria Consulting SU, Lda.</dd>
                </div>
                <div>
                  <dt className="text-gray-400 inline">Platform: </dt>
                  <dd className="text-gray-900 inline">MozBook (Mozambique)</dd>
                </div>
                <div>
                  <dt className="text-gray-400 inline">Corporate NUIT: </dt>
                  <dd className="text-amber-700 italic inline">[Pending formal filing disclosure]</dd>
                </div>
                <div>
                  <dt className="text-gray-400 inline">Payment Partner: </dt>
                  <dd className="text-gray-900 inline">PaySuite (Bank of Mozambique Authorized)</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Document Content View */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-200/80 shadow-sm">
              {/* Document Metadata Header */}
              <div className="border-b border-gray-200 pb-6 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 mb-2">
                  <span className="font-semibold px-2.5 py-1 bg-gray-100 rounded-lg text-gray-700">
                    Version {activeDoc.version}
                  </span>
                  <span>Effective Date: <strong>{activeDoc.effectiveDate}</strong></span>
                  <span className="flex items-center gap-1.5 text-[#009A60] font-semibold">
                    <CheckCircle size={14} /> Published
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mt-1">
                  {activeDoc.title}
                </h2>
                {activeDoc.summaryOfChanges && (
                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <strong className="text-gray-700">Release Notes:</strong> {activeDoc.summaryOfChanges}
                  </p>
                )}
              </div>

              {/* Document Body */}
              {loading ? (
                <div className="py-20 text-center text-gray-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                  <p className="text-xs">Loading legal document text...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-4">
                  {activeDoc.body.split('\n\n').map((paragraph, idx) => {
                    if (paragraph.startsWith('### ')) {
                      return (
                        <h3 key={idx} className="text-base font-bold text-gray-900 pt-4 pb-1 border-b border-gray-100">
                          {paragraph.replace('### ', '')}
                        </h3>
                      );
                    }
                    if (paragraph.startsWith('# ')) {
                      return null; // Skip main title as shown in header
                    }
                    if (paragraph.startsWith('**Operating Entity**:')) {
                      return (
                        <div key={idx} className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600 mb-4 font-mono">
                          {paragraph}
                        </div>
                      );
                    }
                    if (paragraph.startsWith('- ')) {
                      const items = paragraph.split('\n').filter(Boolean);
                      return (
                        <ul key={idx} className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                          {items.map((item, i) => (
                            <li key={i}>{item.replace(/^- /, '')}</li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={idx} className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Bottom Footer Details */}
              <div className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-400 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span>Content Digest: {activeDoc.contentHash}</span>
                <span>© 2026 Elvira da Gloria Consulting SU, Lda.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
