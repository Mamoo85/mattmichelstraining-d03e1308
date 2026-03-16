import { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import SectionHeader from "./SectionHeader";

interface Exercise {
  id: string;
  name: string;
  sports: string[];
  category: string;
  why: string;
  targetMuscles: string;
  setsReps: string;
  commonMistakes: string;
  coachingCue: string;
  bestFor: string;
}

const EXERCISES: Exercise[] = [
  // LOWER BODY
  {
    id: "rfess",
    name: "Rear-Foot Elevated Split Squat",
    sports: ["hockey", "baseball", "soccer", "lacrosse", "football", "basketball", "golf"],
    category: "lower",
    why: "Single-leg strength is how athletes actually move — cutting, sprinting, skating. Bilateral squats build a base, but this is where real sport transfer happens. It also exposes hip imbalances before they become injuries.",
    targetMuscles: "Quads, glutes, hip flexors (stretch on rear leg)",
    setsReps: "3×8 each side | RPE 7–8",
    commonMistakes: "Front knee caving in. Rushing the descent. Rear foot too high — shoe laces down on a bench, not toes.",
    coachingCue: "\"Slow down on the way down. Own every inch.\"",
    bestFor: "Every athlete. Non-negotiable in my programs.",
  },
  {
    id: "trap-bar-dl",
    name: "Trap Bar Deadlift",
    sports: ["hockey", "football", "baseball", "lacrosse", "basketball"],
    category: "lower",
    why: "It's the safest way to teach a young athlete to pick heavy things up. The handles are beside you, not in front — so the spine stays neutral. This builds total body strength with less technical demand than a straight bar.",
    targetMuscles: "Glutes, hamstrings, quads, traps, grip",
    setsReps: "4×5 | RPE 8",
    commonMistakes: "Hips shooting up first (it becomes a stiff-leg pull). Not pushing the floor away with the legs.",
    coachingCue: "\"Push the floor away from you. Don't pull the bar — drive through your feet.\"",
    bestFor: "Football, hockey, any athlete who needs raw strength.",
  },
  {
    id: "goblet-squat",
    name: "Goblet Squat",
    sports: ["hockey", "baseball", "soccer", "lacrosse", "football", "basketball", "golf", "youth"],
    category: "lower",
    why: "The counterbalance of the weight in front forces upright posture and teaches squat mechanics better than any cue I can give. Every athlete starts here. If you can't goblet squat well, you have no business under a barbell.",
    targetMuscles: "Quads, glutes, core, upper back (anti-flexion)",
    setsReps: "3×10 | RPE 6–7",
    commonMistakes: "Heels coming up. Elbows dropping. Not sitting between the hips.",
    coachingCue: "\"Elbows between the knees at the bottom. Sit between your hips, not on top of them.\"",
    bestFor: "Youth athletes, beginners, warm-up for experienced athletes.",
  },
  {
    id: "rdl",
    name: "Romanian Deadlift (RDL)",
    sports: ["hockey", "baseball", "soccer", "lacrosse", "football", "basketball", "golf"],
    category: "lower",
    why: "Hamstring injuries are the most common non-contact injury in sport. The RDL loads the hamstring at length under control — exactly the position where they tear during sprinting. This exercise is injury insurance.",
    targetMuscles: "Hamstrings, glutes, erectors",
    setsReps: "3×8 | RPE 7",
    commonMistakes: "Rounding the lower back. Bending the knees too much (it becomes a squat). Looking up and hyperextending the neck.",
    coachingCue: "\"Push your hips back like you're closing a car door with your butt. Feel the hamstrings load.\"",
    bestFor: "Every athlete, especially sprinters and field sport players.",
  },
  {
    id: "lateral-lunge",
    name: "Lateral Lunge",
    sports: ["hockey", "soccer", "lacrosse", "basketball", "football"],
    category: "lower",
    why: "Athletes don't just move forward and back. Hockey players skate laterally. Soccer players cut. If you never train the frontal plane, the groin and adductors are a ticking time bomb. This opens the hips and strengthens them in the position where injuries happen.",
    targetMuscles: "Adductors, glutes, quads (lateral loading)",
    setsReps: "3×6 each side | RPE 6–7",
    commonMistakes: "Knee caving on the working leg. Not sitting deep enough. Rushing through the bottom.",
    coachingCue: "\"Sit into the hip like you're sitting on a stool to the side. Push the ground away to come back.\"",
    bestFor: "Hockey and soccer athletes especially. Any multi-directional sport.",
  },
  {
    id: "hip-thrust",
    name: "Barbell Hip Thrust",
    sports: ["hockey", "football", "baseball", "soccer", "basketball", "lacrosse", "golf"],
    category: "lower",
    why: "The glutes are the most powerful muscle in the body and they're responsible for sprint speed, jump height, and rotational power. Most athletes are glute-weak because they sit all day. This targets peak glute contraction better than any squat variation.",
    targetMuscles: "Glutes (primary), hamstrings",
    setsReps: "3×10 | RPE 7–8",
    commonMistakes: "Hyperextending the lower back at the top. Not tucking the chin (looking at the ceiling). Feet too far out.",
    coachingCue: "\"Squeeze your glutes at the top like you're cracking a walnut. Chin tucked, ribs down.\"",
    bestFor: "Every athlete. Especially important for speed and jump performance.",
  },
  {
    id: "step-up",
    name: "Step-Up (High Box)",
    sports: ["hockey", "soccer", "basketball", "lacrosse", "baseball"],
    category: "lower",
    why: "True single-leg strength with zero momentum. The step-up forces the working leg to do everything — no push-off from the back leg. It also builds the VMO (inner quad), which is critical for knee stability.",
    targetMuscles: "Quads (VMO), glutes, hip stabilizers",
    setsReps: "3×6 each side | RPE 7",
    commonMistakes: "Pushing off the back foot. Leaning forward. Box too low — thigh should be at or slightly above parallel.",
    coachingCue: "\"Drive through the heel of the top foot. The back leg is dead weight — pretend it doesn't exist.\"",
    bestFor: "Knee rehab, single-leg strength, jump prep.",
  },

  // UPPER BODY
  {
    id: "db-bench",
    name: "Dumbbell Bench Press",
    sports: ["hockey", "football", "baseball", "lacrosse", "basketball"],
    category: "upper",
    why: "Dumbbells force each arm to work independently — you can't hide a weak side. They also allow natural rotation of the shoulder, which is safer than a barbell for overhead sport athletes. I use these more than barbell bench for 90% of my athletes.",
    targetMuscles: "Chest, anterior delts, triceps",
    setsReps: "3×10 | RPE 7",
    commonMistakes: "Flaring elbows to 90°. Not controlling the eccentric. Feet not planted.",
    coachingCue: "\"Elbows at 45°. Slow on the way down, press with intent on the way up.\"",
    bestFor: "Upper body foundation for any pressing athlete.",
  },
  {
    id: "chin-up",
    name: "Chin-Up / Pull-Up",
    sports: ["hockey", "football", "baseball", "lacrosse", "basketball", "soccer"],
    category: "upper",
    why: "If you can't move your own bodyweight, we have a problem. Chin-ups build relative strength, shoulder health, and grip — and they expose weak links immediately. I test these on day one with every athlete.",
    targetMuscles: "Lats, biceps, forearms, core (anti-extension)",
    setsReps: "3× max reps or 3×5 weighted | RPE 8–9",
    commonMistakes: "Kipping. Not going to full extension at the bottom. Chin not clearing the bar.",
    coachingCue: "\"Dead hang at the bottom. Drive elbows to your hips. Full range or it doesn't count.\"",
    bestFor: "Every athlete. A non-negotiable movement pattern.",
  },
  {
    id: "db-row",
    name: "Single-Arm Dumbbell Row",
    sports: ["hockey", "baseball", "golf", "lacrosse", "football", "basketball", "soccer"],
    category: "upper",
    why: "Athletes need to pull more than they push. Rowing builds the upper back thickness that protects the shoulders and creates posture. Single-arm version adds anti-rotation — the core works overtime to stop you from twisting.",
    targetMuscles: "Lats, rhomboids, rear delts, biceps, core (anti-rotation)",
    setsReps: "3×10 each side | RPE 7",
    commonMistakes: "Rowing to the hip instead of the rib cage. Rotating the torso to cheat the weight up. Shrugging the shoulder.",
    coachingCue: "\"Pull to your lower rib. Keep your shoulders square to the floor. Don't shrug — pull with the back.\"",
    bestFor: "Posture correction, shoulder health, rotational sport athletes.",
  },
  {
    id: "push-up",
    name: "Push-Up (Strict)",
    sports: ["hockey", "baseball", "soccer", "lacrosse", "football", "basketball", "golf", "youth"],
    category: "upper",
    why: "Before any athlete touches a bench press, they need to own the push-up. It's a moving plank — core, shoulders, chest, triceps all working together. If the hips sag or the elbows flare, we're not ready for load.",
    targetMuscles: "Chest, triceps, anterior delts, core (anti-extension)",
    setsReps: "3×15–20 | Perfect form",
    commonMistakes: "Hips sagging. Elbows flaring to 90°. Head dropping. Not locking out at the top.",
    coachingCue: "\"Body is a steel beam from head to heel. Elbows at 45°. Touch the chest to the floor, lock out at the top.\"",
    bestFor: "Youth athletes, warm-ups, movement quality assessment.",
  },
  {
    id: "landmine-press",
    name: "Landmine Press",
    sports: ["hockey", "baseball", "lacrosse", "football", "golf"],
    category: "upper",
    why: "The arc of the landmine follows a natural pressing path that's easier on the shoulder than a straight overhead press. For overhead sport athletes with cranky shoulders, this is my go-to. It also builds anti-rotation when done single-arm.",
    targetMuscles: "Shoulders, upper chest, triceps, core",
    setsReps: "3×8 each side | RPE 7",
    commonMistakes: "Leaning back to press (makes it a chest press). Standing too close to the bar.",
    coachingCue: "\"Tall posture. Press up and out — follow the arc of the bar. Don't lean back.\"",
    bestFor: "Throwing athletes, overhead sport athletes, shoulder-friendly pressing.",
  },
  {
    id: "face-pull",
    name: "Face Pull",
    sports: ["hockey", "baseball", "soccer", "lacrosse", "football", "basketball", "golf", "youth"],
    category: "upper",
    why: "Every athlete who sits in school, drives a car, or scrolls a phone has internally rotated shoulders. The face pull is the antidote. It trains external rotation and rear delts — the muscles that keep shoulders healthy and posture upright.",
    targetMuscles: "Rear delts, external rotators, lower traps",
    setsReps: "3×15 | RPE 6",
    commonMistakes: "Using too much weight and turning it into a row. Not externally rotating at the end. Shrugging.",
    coachingCue: "\"Pull to your forehead, then rotate hands out like you're showing your armpits. Light weight, high reps, every session.\"",
    bestFor: "Every single athlete. I program these in every workout.",
  },

  // CORE
  {
    id: "pallof-press",
    name: "Pallof Press",
    sports: ["hockey", "baseball", "golf", "lacrosse", "football", "soccer", "basketball"],
    category: "core",
    why: "The core's real job is to resist movement, not create it. The Pallof press trains anti-rotation — the ability to stay stable while forces try to twist you. That's exactly what happens when you throw, swing, or take a hit.",
    targetMuscles: "Obliques, transverse abdominis (anti-rotation)",
    setsReps: "3×10 each side | RPE 7",
    commonMistakes: "Standing too close to the cable. Letting the band pull the hands off-center. Rushing.",
    coachingCue: "\"Press straight out from your chest. Fight the pull. Don't let it win. Slow and controlled.\"",
    bestFor: "Rotational sport athletes — baseball, hockey, golf, lacrosse.",
  },
  {
    id: "dead-bug",
    name: "Dead Bug",
    sports: ["hockey", "baseball", "soccer", "lacrosse", "football", "basketball", "golf", "youth"],
    category: "core",
    why: "This is how I teach every athlete to brace. It looks easy until you do it right — lower back pinned to the floor, breathing controlled, opposite arm and leg moving without the spine moving at all. If you can't do this, your squat and deadlift are built on sand.",
    targetMuscles: "Deep core (transverse abdominis), hip flexors, coordination",
    setsReps: "3×8 each side | Slow and controlled",
    commonMistakes: "Lower back arching off the floor. Moving too fast. Holding breath instead of breathing through the brace.",
    coachingCue: "\"Flatten your back to the floor — I should not be able to slide a piece of paper under your lower back. Breathe out as you extend.\"",
    bestFor: "Everyone. My #1 core warm-up exercise.",
  },
  {
    id: "farmers-carry",
    name: "Farmer's Carry",
    sports: ["hockey", "football", "lacrosse", "baseball", "basketball", "soccer", "golf"],
    category: "core",
    why: "Grip, core, posture, and mental toughness all in one exercise. Walk with heavy things. Don't put them down. The core has to stabilize the entire spine under load while you move — that's as functional as it gets.",
    targetMuscles: "Grip, traps, core (anti-lateral flexion), everything",
    setsReps: "3×40 yards | Heavy as possible with good posture",
    commonMistakes: "Leaning to one side. Short choppy steps. Shrugging the shoulders up.",
    coachingCue: "\"Tall posture, shoulders packed down, long strides. Don't look down. Own the weight.\"",
    bestFor: "Football linemen, hockey players, any athlete needing grip and trunk stability.",
  },
  {
    id: "bird-dog",
    name: "Bird Dog",
    sports: ["hockey", "baseball", "soccer", "lacrosse", "football", "basketball", "golf", "youth"],
    category: "core",
    why: "Another anti-rotation exercise, but on all fours. This teaches contralateral coordination — opposite arm and leg working together, which is exactly how running and skating work. It also lights up the deep stabilizers around the spine.",
    targetMuscles: "Erectors, glutes, deep core (anti-rotation/extension)",
    setsReps: "3×8 each side | Hold top for 2 sec",
    commonMistakes: "Rotating the hips when extending the leg. Rushing. Not holding the top position.",
    coachingCue: "\"Imagine a glass of water on your lower back. Don't spill it. Reach long, hold, and return.\"",
    bestFor: "Warm-ups, back pain rehab, youth athletes learning body control.",
  },

  // POWER / EXPLOSIVE
  {
    id: "box-jump",
    name: "Box Jump",
    sports: ["hockey", "basketball", "football", "soccer", "lacrosse", "baseball"],
    category: "power",
    why: "Power is force times velocity — how fast you can apply strength. The box jump teaches explosive hip extension and fast-twitch recruitment. But the real value is the landing: learning to absorb force quietly saves ACLs.",
    targetMuscles: "Glutes, quads, calves (concentric power + landing mechanics)",
    setsReps: "4×3 | Full reset between reps",
    commonMistakes: "Using a box that's too high and landing in a deep squat (that's hip flexor flexibility, not jumping). Bouncing reps. Not stepping down.",
    coachingCue: "\"Jump UP, not just tuck your knees. Land soft — quiet feet. Step down. Reset. Next rep.\"",
    bestFor: "Basketball, volleyball, football — any athlete who needs to jump or be explosive.",
  },
  {
    id: "med-ball-slam",
    name: "Medicine Ball Slam",
    sports: ["hockey", "baseball", "golf", "lacrosse", "football", "soccer"],
    category: "power",
    why: "Pure aggression with a purpose. The slam trains the entire posterior chain to fire explosively through triple extension. It also lets athletes express power without technical complexity — there's no barbell to worry about. Great for young athletes learning to be explosive.",
    targetMuscles: "Full body — lats, core, hips, shoulders",
    setsReps: "3×6 | Max intent each rep",
    commonMistakes: "Using a ball that bounces (use a dead ball). Bending at the waist instead of using the hips. Going through the motions.",
    coachingCue: "\"Get on your toes, reach the ball overhead, then slam it through the floor like you hate it. Full intent every single rep.\"",
    bestFor: "Rotational sport athletes, warm-up power work, young athletes.",
  },
  {
    id: "broad-jump",
    name: "Standing Broad Jump",
    sports: ["football", "hockey", "soccer", "lacrosse", "basketball", "baseball"],
    category: "power",
    why: "Horizontal power — the ability to project your body forward. This is sprint speed in a single rep. It tests and trains hip extension power, arm drive coordination, and landing mechanics. I test this on day one with every athlete.",
    targetMuscles: "Glutes, quads, calves, core (horizontal force production)",
    setsReps: "4×3 | Full reset, measure if testing",
    commonMistakes: "Not using the arms. Landing stiff-legged. Not loading into the hips before jumping.",
    coachingCue: "\"Load into the hips, swing the arms back, then explode forward. Stick the landing — freeze. That's the test.\"",
    bestFor: "Speed athletes, football combines, any sport requiring acceleration.",
  },

  // MOBILITY / PREHAB
  {
    id: "90-90-hip",
    name: "90/90 Hip Switch",
    sports: ["hockey", "baseball", "golf", "soccer", "lacrosse", "football", "basketball", "youth"],
    category: "mobility",
    why: "Hip internal and external rotation is the most commonly restricted range of motion I see in athletes. Limited hip rotation leads to compensations at the knee and lower back — those are the injuries. This opens the hips safely and shows me exactly where they're restricted.",
    targetMuscles: "Hip internal/external rotators, glutes",
    setsReps: "2×8 switches | Hold each side 5 sec",
    commonMistakes: "Leaning back. Not keeping the chest tall. Forcing the range instead of breathing into it.",
    coachingCue: "\"Sit tall. Rotate from the hips, not the back. If it's tight, breathe into it — don't force it.\"",
    bestFor: "Every athlete. I start every warm-up with hip work.",
  },
  {
    id: "band-pull-apart",
    name: "Band Pull-Apart",
    sports: ["hockey", "baseball", "soccer", "lacrosse", "football", "basketball", "golf", "youth"],
    category: "mobility",
    why: "Simple, effective, and done every single session. This trains the rear delts and external rotators that keep shoulders healthy. I've seen this single exercise reduce shoulder complaints in throwing athletes by 50% when done consistently.",
    targetMuscles: "Rear delts, rhomboids, external rotators",
    setsReps: "3×20 | Light band, every session",
    commonMistakes: "Using a band that's too heavy. Shrugging the shoulders. Not squeezing at the end range.",
    coachingCue: "\"Arms straight, pull to a T, squeeze the shoulder blades together like you're holding a pencil between them. Light band, lots of reps.\"",
    bestFor: "Throwing athletes, swimmers, anyone who sits at a desk. Do these every single day.",
  },
  {
    id: "world-greatest-stretch",
    name: "World's Greatest Stretch",
    sports: ["hockey", "baseball", "soccer", "lacrosse", "football", "basketball", "golf", "youth"],
    category: "mobility",
    why: "It earned the name. One movement hits hip flexors, thoracic rotation, hamstrings, adductors, and ankle mobility. If I could only pick one warm-up movement for the rest of my career, this is it.",
    targetMuscles: "Hip flexors, T-spine, hamstrings, adductors, ankles",
    setsReps: "2×5 each side | Slow and intentional",
    commonMistakes: "Rushing through it. Not rotating the thoracic spine enough. Back knee dropping to the floor.",
    coachingCue: "\"Lunge, elbow to instep, rotate and reach to the sky. Slow. Feel every position. This is your diagnostic — where it's tight tells you what needs work.\"",
    bestFor: "Every athlete, every warm-up, every session. Non-negotiable.",
  },

  // FIX IT / REHAB
  {
    id: "banded-tke",
    name: "Banded Terminal Knee Extension",
    sports: ["hockey", "soccer", "basketball", "football", "lacrosse", "baseball"],
    category: "fixit",
    why: "Patellar tendon pain is epidemic in young athletes. The TKE isolates the last 20° of knee extension where the VMO (inner quad) is most active — that's the muscle that tracks the kneecap properly. When the VMO is strong, knee pain goes away. I've fixed hundreds of knees with this one exercise.",
    targetMuscles: "VMO (vastus medialis oblique), quad",
    setsReps: "3×15 each leg | Light band, slow lockout",
    commonMistakes: "Band not high enough behind the knee. Not fully locking out. Going too fast.",
    coachingCue: "\"Band behind the knee. Lock it out hard and squeeze the inner quad at the top for 2 seconds. This is medicine — do it right.\"",
    bestFor: "Knee pain, patellar tendonitis, post-ACL rehab, jumper's knee.",
  },
  {
    id: "wall-slide",
    name: "Wall Slide",
    sports: ["hockey", "baseball", "golf", "lacrosse", "football", "basketball", "soccer"],
    category: "fixit",
    why: "If an athlete can't get their arms overhead without arching the lower back, their shoulders are compensating. Wall slides teach overhead range of motion with a braced core — the way the shoulder is supposed to work. I use these to diagnose and fix simultaneously.",
    targetMuscles: "Lower traps, serratus anterior, rotator cuff",
    setsReps: "3×10 | Slow, controlled, back flat to wall",
    commonMistakes: "Lower back arching off the wall. Elbows coming off the wall. Shrugging at the top.",
    coachingCue: "\"Entire spine on the wall. Elbows and wrists on the wall the whole time. If they come off, you went too high — that's your current range. Work within it.\"",
    bestFor: "Shoulder impingement, overhead athletes, posture correction.",
  },
  {
    id: "eccentric-calf-raise",
    name: "Eccentric Calf Raise",
    sports: ["soccer", "basketball", "lacrosse", "hockey", "football", "baseball"],
    category: "fixit",
    why: "Achilles tendinopathy responds to eccentric loading better than anything else — the research is clear and I've seen it work for 20 years. Slow lowering under load reorganizes the collagen fibers in the tendon. It's not glamorous, but it works when nothing else does.",
    targetMuscles: "Calves (gastrocnemius/soleus), Achilles tendon",
    setsReps: "3×15 each leg | 3-sec lowering phase",
    commonMistakes: "Going too fast. Not going through full range. Using both legs on the eccentric (use both up, single leg down).",
    coachingCue: "\"Both feet to push up. Shift to one leg. Lower for a full 3 seconds. All the way down past the step. That slow lowering is where the healing happens.\"",
    bestFor: "Achilles tendinopathy, calf strains, ankle rehab, runners.",
  },
];

const SPORT_TABS = [
  { key: "all", label: "All" },
  { key: "hockey", label: "Hockey" },
  { key: "baseball", label: "Baseball" },
  { key: "golf", label: "Golf" },
  { key: "football", label: "Football" },
  { key: "basketball", label: "Basketball" },
  { key: "soccer", label: "Soccer" },
  { key: "lacrosse", label: "Lacrosse" },
  { key: "youth", label: "Youth" },
];

const CATEGORY_TABS = [
  { key: "all", label: "All" },
  { key: "lower", label: "Lower Body" },
  { key: "upper", label: "Upper Body" },
  { key: "core", label: "Core" },
  { key: "power", label: "Power" },
  { key: "mobility", label: "Mobility" },
  { key: "fixit", label: "Fix It" },
];

const ExerciseLibrary = () => {
  const [sport, setSport] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = EXERCISES.filter((ex) => {
    const matchesSport = sport === "all" || ex.sports.includes(sport);
    const matchesCategory = category === "all" || ex.category === category;
    const matchesSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase()) || ex.why.toLowerCase().includes(search.toLowerCase());
    return matchesSport && matchesCategory && matchesSearch;
  });

  return (
    <div>
      <SectionHeader title="Exercise Library" timestamp={`${EXERCISES.length} exercises · Written by Matt`} />

      <div className="bg-primary/10 border border-primary/20 shadow-m2 p-4 mb-6">
        <p className="text-sm text-foreground text-balance leading-relaxed">
          Every exercise includes the <span className="text-primary font-bold">WHY</span> — the Kinesiology and Physics
          behind the movement. When athletes understand why they're doing something, they do it better. 100% of the time.
        </p>
        <span className="text-[10px] font-mono text-primary mt-2 block">— Matt Michels, M² Training</span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="w-full bg-background border border-border pl-9 pr-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      {/* Sport tabs */}
      <div className="mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">By Sport</span>
        <div className="flex gap-1 flex-wrap">
          {SPORT_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSport(t.key)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                sport === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">By Type</span>
        <div className="flex gap-1 flex-wrap">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setCategory(t.key)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                category === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-[10px] font-mono text-muted-foreground mb-3">
        {filtered.length} exercise{filtered.length !== 1 ? "s" : ""} found
      </p>

      {/* Exercise list */}
      <div className="space-y-2">
        {filtered.map((ex) => {
          const isExpanded = expandedId === ex.id;
          return (
            <div
              key={ex.id}
              className="bg-card shadow-m2 hover:bg-m2-surface-hover transition-m2 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : ex.id)}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {ex.category === "fixit" ? "Fix It" : ex.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {ex.sports.length === SPORT_TABS.length - 1 ? "All Sports" : ex.sports.slice(0, 3).join(", ") + (ex.sports.length > 3 ? ` +${ex.sports.length - 3}` : "")}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{ex.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{ex.targetMuscles}</p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />}
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">The WHY</span>
                    <p className="text-xs text-foreground leading-relaxed">{ex.why}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Sets & Reps</span>
                      <p className="text-xs text-foreground font-mono">{ex.setsReps}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Best For</span>
                      <p className="text-xs text-foreground">{ex.bestFor}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Common Mistakes</span>
                    <p className="text-xs text-foreground leading-relaxed">{ex.commonMistakes}</p>
                  </div>

                  <div className="bg-primary/10 border border-primary/20 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">Matt's Coaching Cue</span>
                    <p className="text-xs text-foreground italic leading-relaxed">{ex.coachingCue}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-card shadow-m2 p-8 text-center">
            <p className="text-sm text-muted-foreground">No exercises match your filters.</p>
            <button
              onClick={() => { setSport("all"); setCategory("all"); setSearch(""); }}
              className="text-xs text-primary font-bold mt-2 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseLibrary;
