import React from 'react';
import { useProject } from '@/lib/ProjectContext';
import { recommendPlans } from '@/lib/optimizationComparison';
export default function Recommendation() {
  const { plans } = useProject();
  if (!plans) return null;
  const message = recommendPlans(plans.most_efficient,plans.fastest);
  return <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5"><h3 className="font-display font-bold text-[#123D26] mb-2">Which Cutting Strategy Should You Choose?</h3><p className="text-sm text-[#475569]">{message}</p></div>;
}
