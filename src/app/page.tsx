import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Hero } from "@/components/marketing/Hero";
import { ProductCards, ProductsTable, Ticker } from "@/components/marketing/Products";
import {
  Faq,
  Features,
  FinalCta,
  HowItWorks,
  ReferralProgram,
  Testimonials,
} from "@/components/marketing/Programs";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { ButtonLink } from "@/components/ui/primitives";

function BottomCta() {
  return (
    <div className="sticky bottom-0 z-40 border-t border-electric/12 bg-navy-950/95 px-4 pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
      <div className="flex gap-2">
        <ButtonLink href="/register" variant="primary" size="md" className="flex-1">
          Get started
        </ButtonLink>
        <ButtonLink href="/#plans" variant="outline" size="md" className="flex-1">
          Plans
        </ButtonLink>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PhoneShell top={<SiteHeader />} bottom={<BottomCta />}>
      <main id="top">
        <Hero />
        <Ticker />
        <ProductCards />
        <ProductsTable />
        <HowItWorks />
        <ReferralProgram />
        <Features />
        <Testimonials />
        <Faq />
        <FinalCta />
        <SiteFooter />
      </main>
    </PhoneShell>
  );
}