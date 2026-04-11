"use client";

import { useState } from "react";
import { Check, X, Search, Star } from "lucide-react";
import { US_STATES, TEXAS_PEER_STATES, PEER_GROUP_LABELS } from "@/lib/constants";

interface StateSelectorProps {
  selectedStates: string[];
  onSelectionChange: (states: string[]) => void;
  anchorState?: string;
  maxSelections?: number;
}

export default function StateSelector({
  selectedStates,
  onSelectionChange,
  anchorState = "TX",
  maxSelections = 6,
}: StateSelectorProps) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredStates = Object.entries(US_STATES).filter(
    ([code, data]) =>
      code !== anchorState &&
      (code.toLowerCase().includes(search.toLowerCase()) ||
        data.name.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleState = (code: string) => {
    if (selectedStates.includes(code)) {
      onSelectionChange(selectedStates.filter((s) => s !== code));
    } else if (selectedStates.length < maxSelections) {
      onSelectionChange([...selectedStates, code]);
    }
  };

  const applyPreset = (preset: string[]) => {
    onSelectionChange(preset.slice(0, maxSelections));
    setShowDropdown(false);
  };

  const getExpansionBadge = (status: string) => {
    switch (status) {
      case "expanded":
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/30 text-emerald-400 rounded-full">
            Expanded
          </span>
        );
      case "not_expanded":
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded-full">
            Not Expanded
          </span>
        );
      case "partial":
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded-full">
            Partial
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#111827] rounded-xl border border-[#1E293B] p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#F1F5F9]">Compare States</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Selected states appear in the Enrollment chart above and Benchmarking table below.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#7C2D12] text-[#F97316] rounded-full text-xs font-semibold">
          <Star className="w-3 h-3 fill-[#F97316]" />
          TX
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => applyPreset(TEXAS_PEER_STATES.scaleStates)}
          className="text-xs px-2.5 py-1 bg-[#1E293B] hover:bg-[#2A3547] text-[#94A3B8] rounded-full transition-colors"
          title={PEER_GROUP_LABELS.scaleStates.description}
        >
          {PEER_GROUP_LABELS.scaleStates.label}
        </button>
        <button
          onClick={() => applyPreset(TEXAS_PEER_STATES.nonExpansionPeers)}
          className="text-xs px-2.5 py-1 bg-[#1E293B] hover:bg-[#2A3547] text-[#94A3B8] rounded-full transition-colors"
          title={PEER_GROUP_LABELS.nonExpansionPeers.description}
        >
          {PEER_GROUP_LABELS.nonExpansionPeers.label}
        </button>
        <button
          onClick={() => applyPreset(TEXAS_PEER_STATES.sunBeltPeers)}
          className="text-xs px-2.5 py-1 bg-[#1E293B] hover:bg-[#2A3547] text-[#94A3B8] rounded-full transition-colors"
          title={PEER_GROUP_LABELS.sunBeltPeers.description}
        >
          {PEER_GROUP_LABELS.sunBeltPeers.label}
        </button>
        <button
          onClick={() => applyPreset(TEXAS_PEER_STATES.managedCarePeers)}
          className="text-xs px-2.5 py-1 bg-[#1E293B] hover:bg-[#2A3547] text-[#94A3B8] rounded-full transition-colors"
          title={PEER_GROUP_LABELS.managedCarePeers.description}
        >
          {PEER_GROUP_LABELS.managedCarePeers.label}
        </button>
        <button
          onClick={() => applyPreset(TEXAS_PEER_STATES.pursuitStates)}
          className="text-xs px-2.5 py-1 bg-[#1E293B] hover:bg-[#2A3547] text-[#94A3B8] rounded-full transition-colors"
          title={PEER_GROUP_LABELS.pursuitStates.description}
        >
          {PEER_GROUP_LABELS.pursuitStates.label}
        </button>
      </div>

      {/* Selected states chips */}
      <div className="flex flex-wrap gap-1.5 mb-4 min-h-[32px]">
        {selectedStates.map((code) => (
          <span
            key={code}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#1E3A5F] text-[#60A5FA] rounded-full text-xs font-medium"
          >
            {US_STATES[code]?.name || code}
            <button
              onClick={() => toggleState(code)}
              className="hover:text-[#93C5FD]"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {selectedStates.length === 0 && (
          <span className="text-xs text-[#475569] py-1">
            Select states to compare...
          </span>
        )}
      </div>

      {/* Search and dropdown */}
      <div className="relative">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
          <input
            type="text"
            placeholder="Search states..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            className="w-full pl-9 pr-3 py-2 border border-[#2A3547] rounded-lg text-sm bg-[#0B1120] text-[#F1F5F9] placeholder:text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
          />
        </div>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute z-20 w-full mt-1 bg-[#111827] border border-[#2A3547] rounded-lg shadow-2xl max-h-48 overflow-y-auto">
              {filteredStates.map(([code, data]) => (
                <button
                  key={code}
                  onClick={() => toggleState(code)}
                  disabled={
                    !selectedStates.includes(code) &&
                    selectedStates.length >= maxSelections
                  }
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#1E293B] text-left text-sm disabled:opacity-40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#F1F5F9]">{code}</span>
                    <span className="text-[#94A3B8]">{data.name}</span>
                    {getExpansionBadge(data.expansionStatus)}
                  </div>
                  {selectedStates.includes(code) && (
                    <Check className="w-4 h-4 text-[#3B82F6]" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
