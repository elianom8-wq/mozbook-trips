import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  History, 
  ExternalLink, 
  Check, 
  RefreshCw,
  Plus,
  Scale
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { LegalDocumentType, LegalDocumentVersion, LegalConfigWarning } from '../../types/legal';
import { INITIAL_LEGAL_DOCUMENTS, LEGAL_CONFIG_WARNINGS } from '../../data/legalDocuments';
import { LegalService } from '../../services/legalService';

export const AdminLegalManagement: React.FC = () => {
  const [documents, setDocuments] = useState<Record<LegalDocumentType, LegalDocumentVersion>>(INITIAL_LEGAL_DOCUMENTS);
  const [selectedType, setSelectedType] = useState<LegalDocumentType>('terms_customer');
  const [warnings] = useState<LegalConfigWarning[]>(LEGAL_CONFIG_WARNINGS);
  const [recentAcceptances, setRecentAcceptances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    LegalService.getAllPublishedDocuments().then(docs => {
      if (isMounted) {
        setDocuments(docs);
        setLoading(false);
      }
    });

    // Fetch sample or live acceptance audit logs from server
    fetch('/api/legal/acceptances')
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success && Array.isArray(data.acceptances)) {
          setRecentAcceptances(data.acceptances);
        }
      })
      .catch(() => {
        // Safe fallback if server endpoint empty
      });

    return () => { isMounted = false; };
  }, []);

  const activeDoc = documents[selectedType];

  return (
    <AdminLayout>
      <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 mb-2">
              <Scale size={14} />
              <span>Prompt 28A Legal & Regulatory Administration</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Legal Documents & Statutory Compliance
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage operating company deeds, published terms, PaySuite refund reconciliation agreements, and authoritative acceptance audit logs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`/legal?tab=${selectedType}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
            >
              <span>View Public Version</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Operating Entity & Mozambican Counsel Warning Alert */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 p-5 rounded-2xl bg-slate-800/80 border border-slate-700">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Operating Entity
            </h3>
            <p className="text-base font-bold text-white">
              Elvira da Gloria Consulting SU, Lda.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Registered platform entity for MozBook in Mozambique.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-700/60 text-xs text-slate-300 space-y-1">
              <div>Commission: <span className="text-emerald-400 font-bold">15% platform / 85% operator</span></div>
              <div>Payment Gateway: <span className="text-emerald-400 font-bold">PaySuite (M-Pesa, e-Mola, Cards)</span></div>
            </div>
          </div>

          <div className="md:col-span-2 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-bold text-amber-200">
                  Mozambican Legal Counsel Ratification Checklist
                </h3>
                <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">
                  As mandated by Prompt 28A, technical workflows are deployed but formal statutory deeds require independent review by qualified Mozambican legal counsel before serving as commercial guarantees.
                </p>
                <div className="mt-3 space-y-2">
                  {warnings.map((w, i) => (
                    <div key={i} className="text-xs bg-slate-900/60 p-2.5 rounded-xl border border-amber-500/20 text-slate-300 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      <div>
                        <strong className="text-amber-300">{w.field}:</strong> {w.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Document Tabs & Editor/Viewer */}
        <div className="bg-slate-800/60 rounded-3xl border border-slate-700/80 p-6 lg:p-8 space-y-6">
          <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-4">
            {(Object.keys(documents) as LegalDocumentType[]).map((type) => {
              const doc = documents[type];
              const isSelected = selectedType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {doc.title} (v{doc.version})
                </button>
              );
            })}
          </div>

          {/* Active Document Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Document ID: <strong className="text-white font-mono">{activeDoc.id}</strong></span>
                <span>Effective Date: <strong className="text-emerald-400">{activeDoc.effectiveDate}</strong></span>
                <span>Status: <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold uppercase">{activeDoc.status}</span></span>
              </div>

              <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700/80 max-h-[500px] overflow-y-auto text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                {activeDoc.body}
              </div>
            </div>

            {/* Document Version Metadata */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Version Metadata
                </h4>
                <div className="text-xs space-y-2 text-slate-400">
                  <div>Version: <span className="text-white font-bold">{activeDoc.version}</span></div>
                  <div>Content Digest: <span className="text-slate-300 font-mono text-[10px] break-all">{activeDoc.contentHash}</span></div>
                  <div>Legal Counsel Approved: <span className={activeDoc.legalCounselApproved ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{activeDoc.legalCounselApproved ? 'Approved' : 'Pending Formal Opinion'}</span></div>
                  <div>Requires Counsel Review: <span className="text-white font-bold">{activeDoc.requiresLegalReview ? 'Yes' : 'No'}</span></div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Reacceptance Rules
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  When a material version update is published (e.g. v2.0.0), MozBook flags existing customer and partner accounts for mandatory re-acceptance on their subsequent checkout or listing modification.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Authoritative User Acceptance Records Audit Trail */}
        <div className="bg-slate-800/60 rounded-3xl border border-slate-700/80 p-6 lg:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-emerald-400" size={18} />
                <span>Authoritative Acceptance Records (Audit Log)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Timestamped records stored immutably via server backend.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Live collection: legal_acceptances
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">Acceptance ID</th>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Context</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {recentAcceptances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500 italic">
                      No customer acceptance records recorded yet or running in initial test mode.
                    </td>
                  </tr>
                ) : (
                  recentAcceptances.map((rec, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-slate-400">{rec.id}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{rec.userId}</td>
                      <td className="px-4 py-3 font-semibold text-white">{rec.documentType}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400">v{rec.documentVersion}</td>
                      <td className="px-4 py-3 capitalize">{rec.context}</td>
                      <td className="px-4 py-3 text-slate-400">{rec.acceptedAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
