'use client';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-store'
import { useSignupStore } from '@/hooks/use-signup'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronRight } from 'lucide-react'
import Image from "next/image"
import Link from "next/link"
import { LandingBackground } from "@/components/landing-background"
import { getTrending } from "@/lib/tmdb"
import { Content } from "@/lib/types"
import { MovieRow } from "@/components/movie-row"
import { LandingFeature } from "@/components/landing-feature"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export function LandingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [trending, setTrending] = useState<Content[]>([])
  const [email, setEmail] = useState('')
  
  useEffect(() => {
    async function fetchTrending() {
      try {
        const data = await getTrending('all')
        setTrending(data.slice(0, 10))
      } catch (error) {
        console.error("Failed to fetch trending:", error)
      }
    }
    fetchTrending()
  }, [])

  const setEmailState = useSignupStore((state) => state.setEmail);

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault()
    if (user) {
      router.push('/browse')
    } else {
      setEmailState(email);
      router.push(`/signup/registration`)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white font-body selection:bg-primary selection:text-white flex flex-col overflow-x-hidden">
      
      {/* 1. HERO SECTION */}
      <div className="relative min-h-[70vh] sm:min-h-screen flex flex-col">
        <LandingBackground />
        
        {/* Header */}
        <header className="relative z-40 w-full px-4 sm:px-8 md:px-12 lg:px-44 py-6 flex items-center justify-between">
           <Link href="/" className="relative flex items-center h-8 sm:h-10 transition-transform active:scale-95 duration-200">
          <Image
            src="/netflix-logo.png"
            alt="Netflix"
            width={120}
            height={32}
            className="h-full w-auto object-contain brightness-110"
            priority
          />
        </Link>
           <Link href={user ? "/browse" : "/auth"}>
             <Button className="bg-[#E50914] hover:bg-[#C11119] text-white font-medium rounded text-sm h-8 px-4">
                  {user ? 'Browse' : 'Sign In'}
             </Button>
           </Link>
        </header>

        {/* Hero Central Content */}
        <div className="relative z-30 flex-1 flex flex-col items-center justify-center px-4 py-20">
          <div className="text-center max-w-[60rem] mx-auto space-y-6">
            <h1 className="text-[2rem] sm:text-[3rem] md:text-[4rem] font-black leading-[1.1] tracking-tight drop-shadow-2xl">
              Unlimited movies, TV shows, and more
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl font-medium text-white/90 drop-shadow-md">
              Starts at Ksh 200. Cancel anytime.
            </p>
            <div className="pt-4 space-y-4">
              <h3 className="text-base sm:text-xl font-normal text-white px-4">
                Ready to watch? Enter your email to create or restart your membership.
              </h3>
              <form 
                className="flex flex-col sm:flex-row gap-2 w-full max-w-[36rem] mx-auto px-4" 
                onSubmit={handleGetStarted}
              >
                <Input 
                  type="email" 
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 sm:h-14 bg-black/40 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-1 focus-visible:ring-white rounded-md text-base backdrop-blur-sm"
                  required
                />
                <Button type="submit" className="h-12 sm:h-14 bg-[#E50914] hover:bg-[#C11119] text-white text-xl sm:text-2xl font-bold px-8 rounded-md flex items-center justify-center gap-2 shrink-0 transition-all active:scale-95 group">
                  Get Started
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Curved Divider at the very bottom of Hero */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] transform translate-y-[2px] z-40">
          <div className="relative h-[40px] sm:h-[80px] md:h-[100px]">
            <div className="absolute inset-x-[-10%] bottom-0 h-full bg-black rounded-[100%_100%_0_0] border-t-4 border-[#e50914]/40 shadow-[0_-4px_30px_rgba(229,9,20,0.4)]" />
          </div>
        </div>
      </div>

      {/* 2. TRENDING NOW SECTION */}
      <div className="relative z-40 bg-black py-16 sm:py-24 px-4 sm:px-8 md:px-12 lg:px-44">
        {trending.length > 0 && (
          <div className="max-w-[120rem] mx-auto overflow-visible">
            <MovieRow 
              title="Trending Now" 
              items={trending} 
              showNumbers={true} 
              aspectRatio="portrait"
              onPlay={(item) => router.push(user ? `/browse?watch=${item.id}` : '/auth')}
            />
          </div>
        )}
      </div>

      {/* 3. MARKETING FEATURES SECTION */}
      <div className="w-full">
        <LandingFeature 
          title="Enjoy on your TV"
          description="Watch on Smart TVs, Playstation, Xbox, Chromecast, Apple TV, Blu-ray players, and more."
          imageSrc="https://assets.nflxext.com/ffe/siteui/acquisition/ourStory/fuji/desktop/tv.png"
          imageAlt="TV"
          videoSrc="https://assets.nflxext.com/ffe/siteui/acquisition/ourStory/fuji/desktop/video-tv-0819.m4v"
        />
        <LandingFeature 
          title="Download your shows to watch offline"
          description="Save your favorites easily and always have something to watch."
          imageSrc="https://assets.nflxext.com/ffe/siteui/acquisition/ourStory/fuji/desktop/mobile-0819.jpg"
          imageAlt="Mobile"
          reverse={true}
        />
        <LandingFeature 
          title="Watch everywhere"
          description="Stream unlimited movies and TV shows on your phone, tablet, laptop, and TV."
          imageSrc="https://assets.nflxext.com/ffe/siteui/acquisition/ourStory/fuji/desktop/device-pile.png"
          imageAlt="Devices"
          videoSrc="https://assets.nflxext.com/ffe/siteui/acquisition/ourStory/fuji/desktop/video-devices.m4v"
        />
        <LandingFeature 
          title="Create profiles for kids"
          description="Send kids on adventures with their favorite characters in a space made just for them—free with your membership."
          imageSrc="https://occ-0-2851-38.1.nflxso.net/dnm/api/v6/19OhWN2dO19C9txONY6hCYWt7HU/AAAABejKYuj5VnubeP7D685Q8O5Oqi6D79X6i9Z6m8dSlc0x0fUqT3W2rAhvjDqT90r70J9X4T_v1L5S_Uu.png"
          imageAlt="Kids"
          reverse={true}
        />
      </div>

      {/* 4. FAQ SECTION */}
      <section className="py-16 sm:py-24 border-b-8 border-[#232323] bg-black">
        <div className="max-w-4xl mx-auto px-4 md:px-12">
          <h2 className="text-[2rem] sm:text-[3rem] font-black text-center mb-10">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {[
              { q: "What is Netflix?", a: "Netflix is a streaming service that offers a wide variety of award-winning TV shows, movies, anime, documentaries, and more on thousands of internet-connected devices.\n\nYou can watch as much as you want, whenever you want without a single commercial – all for one low monthly price." },
              { q: "How much does Netflix cost?", a: "Watch Netflix on your smartphone, tablet, Smart TV, laptop, or streaming device, all for one fixed monthly fee. Plans range from Ksh 200 to Ksh 1,100 a month. No extra costs, no contracts." },
              { q: "Where can I watch?", a: "Watch anywhere, anytime. Sign in with your Netflix account to watch instantly on the web at netflix.com from your personal computer or on any internet-connected device that offers the Netflix app, including smart TVs, smartphones, tablets, streaming media players and game consoles." },
              { q: "How do I cancel?", a: "Netflix is flexible. There are no pesky contracts and no commitments. You can easily cancel your account online in two clicks. There are no cancellation fees – start or stop your account anytime." },
              { q: "What can I watch on Netflix?", a: "Netflix has an extensive library of feature films, documentaries, TV shows, anime, award-winning Netflix originals, and more. Watch as much as you want, anytime you want." },
              { q: "Is Netflix good for kids?", a: "The Netflix Kids experience is included in your membership to give parents control while kids enjoy family-friendly TV shows and movies in their own space." }
            ].map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-[#232323] border-none px-6 sm:px-8">
                <AccordionTrigger className="text-lg sm:text-2xl font-normal py-5 sm:py-6 hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-lg sm:text-2xl font-normal border-t border-black/50 pt-5 pb-7 leading-relaxed whitespace-pre-line text-white/90">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-16 text-center space-y-4">
            <h3 className="text-lg sm:text-xl font-normal">Ready to watch? Enter your email to create or restart your membership.</h3>
            <form 
                className="flex flex-col sm:flex-row gap-2 w-full max-w-[45rem] mx-auto" 
                onSubmit={handleGetStarted}
              >
                <Input 
                  type="email" 
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 sm:h-14 bg-black/50 border-white/30 text-white text-base px-5"
                  required
                />
                <Button type="submit" className="h-12 sm:h-14 bg-[#E50914] hover:bg-[#C11119] text-white text-xl sm:text-2xl font-bold px-10 shrink-0 transition-all group">
                  Get Started
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" />
                </Button>
            </form>
          </div>
        </div>
      </section>

      {/* 5. LANDING FOOTER */}
      <footer className="py-16 sm:py-24 bg-black text-[#b3b3b3] px-4 sm:px-8 md:px-12 lg:px-44">
        <div className="max-w-5xl mx-auto space-y-8">
          <p className="hover:underline cursor-pointer">Questions? Contact us.</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              "FAQ", "Help Center", "Account", "Media Center",
              "Investor Relations", "Jobs", "Ways to Watch", "Terms of Use",
              "Privacy", "Cookie Preferences", "Corporate Information", "Contact Us",
              "Speed Test", "Legal Notices", "Only on Netflix"
            ].map(link => (
              <span key={link} className="hover:underline cursor-pointer transition-colors hover:text-white">
                {link}
              </span>
            ))}
          </div>

          <div className="pt-8 space-y-6">
             <Button variant="outline" className="border-white/20 text-white/80 bg-transparent rounded h-10 px-8 hover:bg-white/10">
                English
             </Button>
             <p className="text-sm tracking-tight font-medium">Netflix Kenya</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
