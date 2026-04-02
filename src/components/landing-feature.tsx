'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LandingFeatureProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
  videoSrc?: string;
}

export function LandingFeature({ 
  title, 
  description, 
  imageSrc, 
  imageAlt, 
  reverse = false,
  videoSrc 
}: LandingFeatureProps) {
  return (
    <section className="py-12 md:py-24 border-b-8 border-[#232323] bg-black text-white overflow-hidden">
      <div className={cn(
        "max-w-7xl mx-auto px-4 md:px-12 flex flex-col md:flex-row items-center gap-12",
        reverse ? "md:flex-row-reverse" : "md:flex-row"
      )}>
        {/* Text Content */}
        <div className="flex-1 text-center md:text-left space-y-4 md:space-y-6">
          <h2 className="text-[2rem] sm:text-[3rem] md:text-[3.5rem] font-bold leading-tight">
            {title}
          </h2>
          <p className="text-lg sm:text-2xl font-normal text-white/90">
            {description}
          </p>
        </div>

        {/* Media Content */}
        <div className="flex-1 relative w-full h-[300px] sm:h-[400px] md:h-[450px]">
          <div className="relative w-full h-full">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              className="object-contain z-10"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
            {videoSrc && (
              <div className={cn(
                "absolute inset-0 z-0 flex items-center justify-center overflow-hidden",
                // Specific positioning for the TV video to fit inside the frame
                title.toLowerCase().includes('tv') 
                  ? "top-[20%] left-[13%] w-[73%] h-[55%] sm:top-[21%] sm:left-[13%] sm:w-[73%] sm:h-[54%]" 
                  : "top-[34%] left-[18%] w-[63%] h-[47%]" // Mobile/Tablet positioning
              )}>
                <video
                  autoPlay
                  playsInline
                  muted
                  loop
                  className="w-full h-full object-cover"
                >
                  <source src={videoSrc} type="video/mp4" />
                </video>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
