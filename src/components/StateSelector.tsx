"use client";

import { useState } from "react";
import { Check, X, Search, Star } from "lucide-react";
import { US_STATES, TEXAS_PEER_STATES } from "@/lib/constants";

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
          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
            Expanded
          </span>
        );
      case "not_expanded":
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full">
            Not Expanded
          </span>
        );
      case "partial":
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full">
            Partial
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Compare States</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Texas (anchor) vs. up to {maxSelections} comparison states
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-800 rounded-full text-xs font-semibold">
          <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
          TX
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => applyPreset(TEXAS_PEER_STATES.byPopulation)}
          className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
        >
          Large States
        </button>
        <button
          onClick={() => applyPreset(TEXAS_PEER_STATES.byRegion)}
          className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
        >
          Southern / Neighbors
        </button>
        <button
          onClick={() => applyPreset(TEXAS_PEER_STATES.byExpansion)}
          className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
        >
          Non-Expansion Peers
        </button>
      </div>

      {/* Selected states chips */}
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
        {selectedStates.map((code) => (
          <span
            key={code}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
          >
            {US_STATES[code]?.name || code}
            <button
              onClick={() => toggleState(code)}
              className="hover:text-blue-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {selectedStates.length === 0 && (
          <span className="text-xs text-slate-400 py-1">
            Select states to compare...
          </span>
        )}
      </div>

      {/* Search and dropdown */}
      <div className="relative">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search states..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredStates.map(([code, data]) => (
                <button
                  key={code}
                  onClick={() => toggleState(code)}
                  disabled={
                    !selectedStates.includes(code) &&
                    selectedStates.length >= maxSelections
                  }
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left text-sm disabled:opacity-40"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">{code}</span>
                    <span className="text-slate-500">{data.name}</span>
                    {getExpansionBadge(data.expansionStatus)}
                  </div>
                  {selectedStates.includes(code) && (
                    <Check className="w-4 h-4 text-blue-600" />
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
