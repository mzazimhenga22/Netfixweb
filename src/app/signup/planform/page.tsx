'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignupStore } from '@/hooks/use-signup';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type PlanType = 'Basic' | 'Standard' | 'Premium';

export default function PlanFormPage() {
  const router = useRouter();
  const { setPlan } = useSignupStore();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('Standard');

  const handleNext = () => {
    setPlan(selectedPlan);
    router.push('/signup/paymentPicker');
  };

  const plans = [
    { id: 'Basic', resolution: '720p', price: 'Ksh 200' },
    { id: 'Standard', resolution: '1080p', price: 'Ksh 700' },
    { id: 'Premium', resolution: '4K + HDR', price: 'Ksh 1,100' },
  ] as const;

  return (
    <div className="max-w-[1000px] mx-auto mt-8 sm:mt-16 px-4">
      <div className="mb-8 space-y-2">
        <span className="text-[13px] font-medium uppercase tracking-tight">Step 2 of 3</span>
        <h1 className="text-[32px] font-bold leading-tight text-[#333]">Choose the plan that's right for you</h1>
        <ul className="space-y-4 pt-4">
          {['Watch all you want. Ad-free.', 'Recommendations just for you.', 'Change or cancel your plan anytime.'].map((text, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="w-6 h-6 text-[#e50914] flex-shrink-0" strokeWidth={3} />
              <span className="text-[18px] text-[#333] font-medium">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-10">
        {plans.map((p) => (
          <div 
            key={p.id}
            onClick={() => setSelectedPlan(p.id)}
            className={cn(
              "cursor-pointer border rounded-xl p-4 md:p-6 transition-all relative overflow-hidden",
              selectedPlan === p.id 
                ? "border-[#e50914] shadow-[0_0_0_1px_#e50914]" 
                : "border-[#ccc] hover:border-[#808080]"
            )}
          >
            {/* Header / Banner */}
            <div className={cn(
              "absolute top-0 left-0 right-0 h-2 bg-[#e50914] transition-opacity",
              selectedPlan === p.id ? "opacity-100" : "opacity-0"
            )} />
            
            <h3 className={cn(
              "text-lg md:text-2xl font-bold mt-2",
              selectedPlan === p.id ? "text-[#e50914]" : "text-[#333]"
            )}>{p.id}</h3>
            
            <p className="text-[15px] text-[#737373] mt-1 font-medium">{p.resolution}</p>
            <div className={cn(
              "text-sm font-bold mt-6",
              selectedPlan === p.id ? "text-[#e50914]" : "text-[#333]"
            )}>{p.price}</div>
            
            {selectedPlan === p.id && (
              <div className="absolute bottom-4 right-4 bg-[#e50914] rounded-full p-1">
                 <Check className="w-4 h-4 text-white" strokeWidth={4} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="max-w-[440px] mx-auto">
        <p className="text-[13px] text-[#737373] mb-6">
          HD (720p), Full HD (1080p), Ultra HD (4K) and HDR availability subject to your internet service and device capabilities. Not all content is available in all resolutions. See our Terms of Use for more details.
        </p>
        <Button 
          onClick={handleNext}
          className="w-full h-[64px] bg-[#e50914] hover:bg-[#f6121d] text-white text-2xl font-medium rounded-[4px]"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
