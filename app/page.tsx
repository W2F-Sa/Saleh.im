import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { About } from "@/components/about";
import { Skills } from "@/components/skills";
import { Electronics } from "@/components/electronics";
import { Certificates } from "@/components/certificates";
import { Experience } from "@/components/experience";
import { Projects } from "@/components/projects";
import { Terminal } from "@/components/terminal";
import { Contact } from "@/components/contact";
import { Footer } from "@/components/footer";
import { ScrollProgress } from "@/components/scroll-progress";
import { CursorGlow } from "@/components/cursor-glow";
import { ScrollTop } from "@/components/scroll-top";

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <CursorGlow />
      <Navbar />
      <main>
        <Hero />
        <About />
        <Skills />
        <Electronics />
        <Certificates />
        <Experience />
        <Projects />
        <Terminal />
        <Contact />
      </main>
      <Footer />
      <ScrollTop />
    </>
  );
}
