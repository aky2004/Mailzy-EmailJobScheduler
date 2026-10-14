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
  badgeColor = 'bg-[#54C750]/15 text-[#54C750] border-[#54C750]/30',
  title,
  description,
  actionText,
  actionIcon,
  onAction,
  features,
}: RichEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 text-center max-w-3xl mx-auto my-auto animate-fadein">
      {/* Icon Badge with Ambient Glow */}
      <div className="relative mb-4 group">
        <div className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-[#54C750]/20 to-emerald-500/10 opacity-60 blur-xl group-hover:opacity-100 transition-opacity" />
        <div className="relative w-16 h-16 rounded-2xl bg-[#181818] border border-[#3E3F3E] flex items-center justify-center shadow-xl shadow-black/80">
          {icon}
        </div>
      </div>

      {/* Pill Badge */}
      <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold border mb-2.5 ${badgeColor}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-90 animate-pulse" />
        {badge}
      </span>

      {/* Title & Description */}
      <h3 className="text-lg sm:text-xl font-bold text-[#F0F2F0] mb-2 tracking-tight">{title}</h3>
      <p className="text-xs text-[#8E8E8E] max-w-md leading-relaxed mb-6 font-normal">
        {description}
      </p>

      {/* Action Button */}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 bg-[#54C750] hover:bg-[#46af42] text-[#060C06] font-bold px-5 py-2.5 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_14px_rgba(84,199,80,0.25)] transition-all cursor-pointer text-xs mb-8 hover:scale-[1.02] active:scale-[0.98]"
        >
          {actionIcon}
          {actionText}
        </button>
      )}

      {/* Feature Highlights Grid */}
      {features && features.length > 0 && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-[#2E2E2E] text-left">
          {features.map((f, i) => (
            <div key={i} className="bg-[#161616] border border-[#2E2E2E] hover:border-[#3E3F3E] rounded-xl p-4 transition-all hover:bg-[#1a1a1a]">
              <div className="text-base mb-1.5">{f.icon}</div>
              <h4 className="text-xs font-semibold text-[#F0F2F0] mb-1">{f.title}</h4>
              <p className="text-[11px] text-[#7E7E7E] leading-normal">{f.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
