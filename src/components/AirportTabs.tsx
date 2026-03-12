'use client';

interface AirportTabsProps {
  selected: string;
  onChange: (origin: string) => void;
}

const tabs = [
  { code: 'TLV', label: 'TLV - Ben Gurion' },
  { code: 'TCP', label: 'TCP - Taba' },
];

export default function AirportTabs({ selected, onChange }: AirportTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-[#111] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.code}
          onClick={() => onChange(tab.code)}
          className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
            selected === tab.code
              ? 'tab-active'
              : 'tab-inactive'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
