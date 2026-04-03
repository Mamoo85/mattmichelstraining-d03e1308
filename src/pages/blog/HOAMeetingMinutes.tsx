import SEOHead from "@/components/layout/SEOHead";
import { ArrowRight, FileText } from "lucide-react";

const TOC = [
  { id: "what-must-be-included", label: "What Must Be Included" },
  { id: "common-mistakes", label: "Common Mistakes Boards Make" },
  { id: "format-step-by-step", label: "Format: Step by Step" },
  { id: "free-template", label: "Free Template Download" },
  { id: "should-you-automate", label: "Should You Automate?" },
];

const REQUIRED_ELEMENTS = [
  {
    title: "Meeting Type and Date",
    desc: "State whether it's a regular, special, or annual meeting — and include the full date, start time, and location or platform (in-person, Zoom, etc.). This establishes the legal record.",
  },
  {
    title: "Who Called the Meeting to Order",
    desc: "Name the presiding officer. If the president is absent and another board member opens the meeting, that person's name goes here.",
  },
  {
    title: "Attendance and Quorum Verification",
    desc: "List every board member present and absent by name. Then explicitly state whether quorum was achieved. Without quorum documented, any votes taken are potentially invalid.",
  },
  {
    title: "Approval of Previous Minutes",
    desc: "Note that prior minutes were presented, whether corrections were made, and that they were approved. This creates the official chain of record.",
  },
  {
    title: "Motions, Seconds, and Vote Outcomes",
    desc: "Every formal motion needs: who made it, who seconded it, what the exact motion text was, and the vote count (yes/no/abstain). Vague language like 'the board agreed' is not sufficient.",
  },
  {
    title: "Financial Report Summary",
    desc: "A brief summary of the treasurer's report — current account balances, major pending expenses, and any budget variances worth noting. The full report can be attached as an exhibit.",
  },
  {
    title: "Action Items with Assignments",
    desc: "Each task coming out of the meeting should be listed with the person responsible and an expected completion date. This is what separates minutes that actually drive follow-through from ones that sit in a folder.",
  },
  {
    title: "Adjournment",
    desc: "Note the time the meeting was adjourned. Some states require this. It also signals to readers that the document is complete.",
  },
];

const MISTAKES = [
  {
    title: "Recording motions without noting the second",
    desc: "A motion without a second is out of order and shouldn't proceed. If your minutes show a motion passing without a recorded second, you have a procedural gap that can be challenged.",
  },
  {
    title: "Counting absent members toward quorum",
    desc: "Quorum is based on board members present at the meeting — not total board size minus excused absences. Double-check your HOA's bylaws for the exact threshold and document it explicitly.",
  },
  {
    title: "No action items assigned to specific people",
    desc: "'The board will look into it' is not an action item. Name the person, name the task, give a deadline. Otherwise nothing happens and the same issue resurfaces three meetings later.",
  },
  {
    title: "Using informal language or opinions",
    desc: "Minutes are a legal record, not a meeting recap. Keep them factual and neutral. Skip commentary like 'the homeowner became frustrated' or 'everyone agreed this was a bad idea.'",
  },
  {
    title: "Distributing minutes late — or not at all",
    desc: "Most states require HOA meeting minutes to be made available to homeowners within 30 days. Sitting on them for months creates compliance exposure and erodes homeowner trust.",
  },
];

export default function HOAMeetingMinutes() {
  return (
    <>
      <SEOHead
        title="How to Write HOA Meeting Minutes: Free Template + Guide"
        description="Complete guide to HOA meeting minutes: what to include, common mistakes, step-by-step format, and a free template download."
        path="/blog/hoa-meeting-minutes"
      />
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="flex flex-col lg:flex-row gap-12">

            {/* Sidebar TOC */}
            <aside className="lg:w-56 flex-shrink-0">
              <div className="lg:sticky lg:top-8">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">In This Guide</p>
                <nav className="space-y-1">
                  {TOC.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block text-sm text-muted-foreground hover:text-primary transition-colors py-1 border-l-2 border-border hover:border-primary pl-3"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
                <div className="mt-8 p-4 bg-card border border-primary/30 rounded-lg">
                  <p className="text-xs font-bold text-foreground mb-2">Free Template</p>
                  <p className="text-xs text-muted-foreground mb-3">Download the attorney-approved minutes template used by 200+ boards.</p>
                  <a
                    href="/hoa-minutes-template"
                    className="inline-flex items-center gap-1.5 bg-primary text-white px-3 py-2 text-xs font-bold rounded hover:opacity-90 transition-opacity w-full justify-center"
                  >
                    <FileText size={12} /> Download Free
                  </a>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <article className="flex-1 max-w-2xl">

              {/* Breadcrumb */}
              <p className="text-xs text-muted-foreground mb-6">
                <a href="/" className="hover:text-primary transition-colors">Home</a>
                {" / "}
                <a href="/hoa-secretary" className="hover:text-primary transition-colors">HOA Resources</a>
                {" / "}
                <span>HOA Meeting Minutes Guide</span>
              </p>

              <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-6">
                How to Write HOA Meeting Minutes<br />
                <span className="text-primary">(Free Template + Complete Guide)</span>
              </h1>

              {/* Intro */}
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                HOA meeting minutes are more than a summary of what was discussed. They are the legal record of your association's decisions — the document a homeowner's attorney will request when a dispute goes to court, and the evidence your state regulatory board may ask to review if a complaint is filed.
              </p>
              <p className="text-base text-muted-foreground leading-relaxed mb-4">
                Robert's Rules of Order, which most HOA bylaws require, specifies how motions must be documented. State disclosure laws in Michigan and most other states require minutes to be made available to homeowners within 30 days of the meeting. Miss those requirements and your board faces real exposure.
              </p>
              <p className="text-base text-muted-foreground leading-relaxed mb-10">
                This guide walks through exactly what belongs in HOA meeting minutes, the format to follow, the mistakes most boards make, and a free template you can start using at your next meeting.
              </p>

              {/* Section 1 */}
              <section id="what-must-be-included" className="mb-12">
                <h2 className="text-2xl font-black mb-6 pb-2 border-b border-border">
                  What Must Be Included in HOA Meeting Minutes
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  There are eight elements that every set of HOA meeting minutes should contain. Missing any of these creates gaps that can come back to haunt the board.
                </p>
                <div className="space-y-5">
                  {REQUIRED_ELEMENTS.map((el, i) => (
                    <div key={el.title} className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-sm mb-1">{el.title}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{el.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 2 */}
              <section id="common-mistakes" className="mb-12">
                <h2 className="text-2xl font-black mb-6 pb-2 border-b border-border">
                  Common Mistakes HOA Boards Make
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Most HOA boards aren't doing this intentionally wrong — they just weren't trained on it. Here are the five mistakes that show up most often, and what they actually cost you.
                </p>
                <div className="space-y-5">
                  {MISTAKES.map((m, i) => (
                    <div key={m.title} className="p-4 bg-card border border-border rounded-lg">
                      <p className="font-bold text-sm text-foreground mb-1">
                        <span className="text-primary mr-2">{i + 1}.</span>{m.title}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 3 */}
              <section id="format-step-by-step" className="mb-12">
                <h2 className="text-2xl font-black mb-6 pb-2 border-b border-border">
                  HOA Minutes Format: Step by Step
                </h2>
                <p className="text-sm text-muted-foreground mb-5">
                  A clean, consistent format is easier to write, easier to read, and easier to defend. Here's the order that works for most HOA boards:
                </p>
                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p><span className="font-bold text-foreground">Header block:</span> Association name, meeting type (regular/special/annual), date, start time, location. Keep this identical across every set of minutes so they're easy to file and search.</p>
                  <p><span className="font-bold text-foreground">Call to order:</span> Who opened the meeting and at what time. If a quorum statement is required by your bylaws before business can begin, document it here explicitly.</p>
                  <p><span className="font-bold text-foreground">Roll call / attendance:</span> List members present and absent. Note any homeowners or guests who attended as observers if relevant to a discussion item.</p>
                  <p><span className="font-bold text-foreground">Approval of prior minutes:</span> Were corrections needed? Were they approved as written or as corrected? Note the vote.</p>
                  <p><span className="font-bold text-foreground">Reports:</span> Treasurer's report summary, property manager update, committee reports. Keep these brief — attach full written reports as exhibits rather than transcribing them.</p>
                  <p><span className="font-bold text-foreground">Old business:</span> Ongoing items carried over from prior meetings. Reference the original motion date so there's a clear paper trail.</p>
                  <p><span className="font-bold text-foreground">New business:</span> Each agenda item addressed. For each: what was discussed (briefly), what motion was made, who seconded, vote outcome.</p>
                  <p><span className="font-bold text-foreground">Action items:</span> Pull every task out into a separate summary table — person responsible, task description, due date. This is the section that actually drives follow-through.</p>
                  <p><span className="font-bold text-foreground">Adjournment:</span> Time of adjournment. Secretary's signature line. Some associations also require a board president signature before filing.</p>
                </div>
              </section>

              {/* Section 4 — Template CTA */}
              <section id="free-template" className="mb-12">
                <h2 className="text-2xl font-black mb-4 pb-2 border-b border-border">
                  Free HOA Meeting Minutes Template
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Rather than building this format from scratch, download the template below. It covers every required element, follows Robert's Rules formatting, and has been reviewed for compliance with Michigan HOA disclosure requirements. The fill-in structure makes it possible to complete a full set of minutes in under 20 minutes.
                </p>
                <div className="bg-card border border-primary/40 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText size={20} className="text-primary" />
                  </div>
                  <p className="font-black text-lg mb-1">HOA Meeting Minutes Template</p>
                  <p className="text-sm text-muted-foreground mb-5">
                    Free download. Used by 200+ HOA boards. Attorney-reviewed format.
                  </p>
                  <a
                    href="/hoa-minutes-template"
                    className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3.5 font-bold text-sm uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
                  >
                    Download Free Template <ArrowRight size={14} />
                  </a>
                  <p className="text-xs text-muted-foreground mt-3">Instant delivery to your inbox. No credit card required.</p>
                </div>
              </section>

              {/* Section 5 */}
              <section id="should-you-automate" className="mb-12">
                <h2 className="text-2xl font-black mb-6 pb-2 border-b border-border">
                  Should You Automate Your HOA Minutes?
                </h2>
                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    For smaller HOAs — say, under 50 homes with quarterly meetings — the template above is probably all you need. The time investment is manageable and a diligent board member can keep up with it without much friction.
                  </p>
                  <p>
                    For larger associations, or any board where the secretary role turns over frequently, manual minutes create real risk. The formatting gets inconsistent, the distribution gets delayed, and action items fall through the cracks because no one is tracking them between meetings. This is where automation starts to make sense.
                  </p>
                  <p>
                    <a href="/hoa-secretary" className="text-primary font-bold hover:opacity-80 transition-opacity">HOA Secretary AI</a>{" "}
                    takes raw meeting notes — voice memo transcripts, rough bullets, anything — and returns a formatted, Robert's Rules-compliant set of minutes within 10 minutes. It also emails them to your homeowner list automatically and pulls out every action item into a tracked summary. It's not for every board, but for the ones spending 3–4 hours per meeting on paperwork, it pays for itself immediately.
                  </p>
                </div>
              </section>

              {/* Closing CTA */}
              <div className="border-t border-border pt-10 text-center">
                <p className="text-sm text-muted-foreground mb-5">
                  Ready to stop starting from a blank page every meeting?
                </p>
                <a
                  href="/hoa-minutes-template"
                  className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3.5 font-bold text-sm uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
                >
                  Download Free Template <ArrowRight size={14} />
                </a>
              </div>

            </article>
          </div>
        </div>
      </div>
    </>
  );
}
