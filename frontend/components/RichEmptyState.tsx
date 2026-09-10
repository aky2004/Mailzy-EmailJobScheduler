'use client';

import React from 'react';

export interface FeatureCard {
  icon: string | React.ReactNode;
  title: string;
  desc: string;
}

export interface RichEmptyStateProps {
  icon: React.ReactNode;
  badge: string;
  badgeColor?: string;
  title: string;
  description: string;
  actionText?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  features?: FeatureCard[];
}

export function RichEmptyState({
  icon,
  badge,
  badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200',
  title,
  description,
  actionText,
  actionIcon,
  onAction,
  features,
}: RichEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center max-w-2xl mx-auto my-auto animate-fadein">
      {/* Icon Badge */}
      <div className="relative mb-5 group">
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-emerald-100 to-teal-100 opacity-60 blur-lg group-hover:opacity-80 transition-opacity" />
        <div className="relative w-20 h-20 rounded-3xl bg-white border border-slate-200/80 flex items-center justify-center shadow-md shadow-slate-200/50">
          {icon}
        </div>
      </div>

      {/* Pill Badge */}
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${badgeColor}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse" />
        {badge}
      </span>

      {/* Title & Description */}
      <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 max-w-lg leading-relaxed mb-6">
        {description}
      </p>

      {/* Action Button */}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm shadow-emerald-500/25 transition-all cursor-pointer text-sm mb-8 hover:scale-[1.02] active:scale-[0.98]"
        >
          {actionIcon}
          {actionText}
        </button>
      )}

      {/* Feature Highlights Grid */}
      {features && features.length > 0 && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-100 text-left">
          {features.map((f, i) => (
            <div key={i} className="bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 hover:bg-slate-50 transition-colors">
              <div className="text-base mb-1.5">{f.icon}</div>
              <h4 className="text-xs font-bold text-slate-800 mb-0.5">{f.title}</h4>
              <p className="text-[11px] text-slate-400 leading-normal">{f.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
