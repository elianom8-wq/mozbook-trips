import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Home, 
  Palmtree, 
  Compass, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  DollarSign, 
  Calendar, 
  Users, 
  Anchor, 
  Car, 
  Camera,
  CheckCircle2,
  Building2,
  MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MozBookLogo from '../components/MozBookLogo';

export default function HostHub() {
  const { user, login } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 pb-28 pt-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header Banner */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e6f7f0] text-[#009A60] text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>MozBook Host Portal</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-gray-950 tracking-tight">
            What would you like to host today?
          </h1>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed">
            MozBook provides dedicated management workflows for property accommodations and travel experiences across Mozambique. Choose your hosting category below.
          </p>
        </div>

        {/* Stage 3D-A Unified Partner Onboarding Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-5 md:p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-800/30">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">
                New Partner Flow
              </span>
              <span className="text-xs text-slate-300">Multi-Service Supplier Onboarding</span>
            </div>
            <h2 className="text-base md:text-lg font-bold text-white">
              Offering multiple services or operating as a tourism business?
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Select across Accommodation, Activities & Experiences, Trips & Tours, Transport, and Travel / DMC in one unified step.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2 flex-wrap">
            <Link
              to="/partner/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-colors"
            >
              <Building2 size={14} />
              <span>Partner Dashboard</span>
            </Link>
            <Link
              to="/partner"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <span>Onboard New Category</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Two Separate Host Paths */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
          
          {/* OPTION 1: HOST A PROPERTY */}
          <div className="bg-white rounded-3xl border-2 border-gray-200 hover:border-[#009A60] shadow-sm hover:shadow-xl transition-all duration-300 p-6 md:p-8 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-0 opacity-60 group-hover:scale-110 transition-transform" />
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-[#e6f7f0] text-[#009A60] flex items-center justify-center shadow-xs group-hover:bg-[#009A60] group-hover:text-white transition-colors">
                  <Home size={28} />
                </div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-3 py-1 rounded-full">
                  Accommodation
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 group-hover:text-[#009A60] transition-colors">
                  Host a Property
                </h2>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                  List your home, holiday apartment, beachfront villa, lodge rooms & chalets, or safari camp. Manage check-ins, guest capacity, and nightly rates.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-gray-100 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#009A60] shrink-0" />
                  <span>Entire homes, apartments, city residences & villas</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#009A60] shrink-0" />
                  <span><strong>Lodge accommodation units:</strong> Standard rooms, chalets & suites</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#009A60] shrink-0" />
                  <span>Special offers, seasonal pricing & GPS pinpointing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#009A60] shrink-0" />
                  <span>Host document verification & verified host badges</span>
                </div>
              </div>
            </div>

            <div className="pt-8 relative z-10">
              <Link
                to="/host/create"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-900 hover:bg-[#009A60] text-white font-bold rounded-2xl transition-all shadow-md group-hover:shadow-lg"
              >
                <span>Continue to Property Hosting</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {/* OPTION 2: HOST ACTIVITIES & TRIPS */}
          <div className="bg-white rounded-3xl border-2 border-emerald-500 hover:border-[#008250] shadow-md hover:shadow-xl transition-all duration-300 p-6 md:p-8 flex flex-col justify-between group relative overflow-hidden bg-gradient-to-br from-white via-white to-emerald-50/30">
            <div className="absolute top-0 right-0 w-36 h-36 bg-[#009A60]/10 rounded-bl-full -z-0 group-hover:scale-110 transition-transform" />
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-[#009A60] text-white flex items-center justify-center shadow-md">
                  <Palmtree size={28} />
                </div>
                <span className="text-xs font-bold text-[#009A60] uppercase tracking-wider bg-[#e6f7f0] px-3 py-1 rounded-full border border-emerald-200">
                  New Dedicated Hub
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 group-hover:text-[#009A60] transition-colors">
                  Host Activities & Trips
                </h2>
                <p className="text-emerald-900/80 font-medium text-sm mt-1">
                  Offer activities, experiences and trips to travelers.
                </p>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                  Dedicated area for ocean excursions, dive operators, dhow sailing skippers, safari guides, and cultural hosts. Manage trips, schedules, passenger capacities, and booking revenue.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-emerald-100 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#009A60] shrink-0" />
                  <span><strong>Activities:</strong> Snorkeling, Scuba, Boat trips, Quad biking & more</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#009A60] shrink-0" />
                  <span><strong>Trips & Tours:</strong> Island excursions, Multi-day safaris & 4x4 treks</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#009A60] shrink-0" />
                  <span>Meeting points, optional pickup services & schedule slots</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#009A60] shrink-0" />
                  <span>Per-person or group pricing with automatic capacity safety</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#009A60] shrink-0" />
                  <span>Dedicated bookings inbox & MZN earnings tracker</span>
                </div>
              </div>
            </div>

            <div className="pt-8 relative z-10 flex flex-col sm:flex-row gap-3">
              <Link
                to="/host/activities"
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#009A60] hover:bg-[#008250] text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg"
              >
                <span>Activities & Trips Dashboard</span>
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/host/activities/create"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-100/70 hover:bg-emerald-200 text-[#009A60] font-bold rounded-2xl transition-colors border border-emerald-300"
              >
                <span>+ Create</span>
              </Link>
            </div>
          </div>

        </div>

        {/* Feature Highlights Grid */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 mt-4 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <ShieldCheck className="text-[#009A60]" size={20} />
            <span>Why Host with MozBook in Mozambique?</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-800 flex items-center justify-center">
                <DollarSign size={20} className="text-[#009A60]" />
              </div>
              <h4 className="font-bold text-sm text-gray-900">Direct MZN Payouts</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Receive earnings in Mozambican Meticais via M-Pesa, E-Mola, or local bank transfers without expensive conversion fees.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-800 flex items-center justify-center">
                <Users size={20} className="text-[#009A60]" />
              </div>
              <h4 className="font-bold text-sm text-gray-900">Reach Global Travelers</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Get discovered by domestic vacationers and international tourists visiting Ponta do Ouro, Tofo, Vilankulo, and Gorongosa.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-800 flex items-center justify-center">
                <Calendar size={20} className="text-[#009A60]" />
              </div>
              <h4 className="font-bold text-sm text-gray-900">Intelligent Capacity</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Automated guest capacity tracking prevents overbooking on boat launches, safari vehicles, and lodge rooms.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-800 flex items-center justify-center">
                <ShieldCheck size={20} className="text-[#009A60]" />
              </div>
              <h4 className="font-bold text-sm text-gray-900">MozBook AirCover</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Comprehensive host protection, verified customer profiles, and 24/7 Mozambique emergency dispatch support.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
