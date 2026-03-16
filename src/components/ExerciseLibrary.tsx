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

  // FIX IT / REHAB — ATHLETE INJURIES
  {
    id: "banded-tke",
    name: "Banded Terminal Knee Extension",
    sports: ["hockey", "soccer", "basketball", "football", "lacrosse", "baseball", "parents"],
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
    sports: ["hockey", "baseball", "golf", "lacrosse", "football", "basketball", "soccer", "parents"],
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
    sports: ["soccer", "basketball", "lacrosse", "hockey", "football", "baseball", "parents"],
    category: "fixit",
    why: "Achilles tendinopathy responds to eccentric loading better than anything else — the research is clear and I've seen it work for 20 years. Slow lowering under load reorganizes the collagen fibers in the tendon. It's not glamorous, but it works when nothing else does.",
    targetMuscles: "Calves (gastrocnemius/soleus), Achilles tendon",
    setsReps: "3×15 each leg | 3-sec lowering phase",
    commonMistakes: "Going too fast. Not going through full range. Using both legs on the eccentric (use both up, single leg down).",
    coachingCue: "\"Both feet to push up. Shift to one leg. Lower for a full 3 seconds. All the way down past the step. That slow lowering is where the healing happens.\"",
    bestFor: "Achilles tendinopathy, calf strains, ankle rehab, runners.",
  },

  // FIX IT — LOW BACK PAIN
  {
    id: "mcgill-curl-up",
    name: "McGill Curl-Up",
    sports: ["hockey", "baseball", "golf", "football", "parents"],
    category: "fixit",
    why: "Dr. Stuart McGill proved that crunches destroy spinal discs over time. The curl-up trains the anterior core without flexing the lumbar spine. One hand under the lower back to monitor — if the back flattens, you're doing it wrong. I've used the McGill Big 3 to get hundreds of people out of back pain.",
    targetMuscles: "Rectus abdominis (without spinal flexion)",
    setsReps: "3×8 | Hold top for 8 sec",
    commonMistakes: "Curling too high — this is NOT a sit-up. Tucking the chin. Flattening the lower back into the floor.",
    coachingCue: "\"Hand under your low back — that curve stays there the whole time. Lift just the head and shoulders. Lock your rib cage, not your neck. Hold it.\"",
    bestFor: "Low back pain, disc issues, anyone who sits all day. The foundation of back rehab.",
  },
  {
    id: "side-plank",
    name: "Side Plank (McGill)",
    sports: ["hockey", "baseball", "golf", "football", "soccer", "parents"],
    category: "fixit",
    why: "Part two of the McGill Big 3. The quadratus lumborum — the deep lateral stabilizer of the spine — is the most undertrained muscle in the body. When it's weak, the spine buckles under lateral forces. Side planks fix that. I've seen this single exercise eliminate years of chronic back pain.",
    targetMuscles: "Quadratus lumborum, obliques, glute medius",
    setsReps: "3×20-30 sec each side | Build to 45 sec",
    commonMistakes: "Hips sagging. Stacking from the feet instead of the knees (for beginners). Holding breath.",
    coachingCue: "\"Elbow under the shoulder. Hips up. Body is a straight line from head to knees. Breathe. If your hips drop, you're done — quality over time.\"",
    bestFor: "Low back pain, SI joint dysfunction, hip drop during running. Essential for every parent with a desk job.",
  },
  {
    id: "bird-dog-fixit",
    name: "Bird Dog (McGill Big 3)",
    sports: ["hockey", "baseball", "golf", "football", "soccer", "basketball", "parents", "youth"],
    category: "fixit",
    why: "The third piece of McGill's Big 3. This trains the posterior chain extensors while keeping the spine completely neutral. It also builds contralateral coordination — opposite arm and leg, which is how walking and running actually work. If someone has back pain, I start here.",
    targetMuscles: "Erectors, glutes, deep core (anti-rotation/extension)",
    setsReps: "3×6 each side | Hold top 10 sec, sweep the floor on return",
    commonMistakes: "Rotating the hips when the leg extends. Moving too fast. Not bracing before movement.",
    coachingCue: "\"Brace like someone's going to punch you in the gut. Reach long — fingertips and heel as far apart as possible. Sweep the floor with your hand and knee on the way back. No rotation.\"",
    bestFor: "Back pain, post-disc injury, morning stiffness. The #1 exercise I give to every parent who calls me with back pain.",
  },
  {
    id: "hip-flexor-release",
    name: "Half-Kneeling Hip Flexor Stretch",
    sports: ["hockey", "baseball", "golf", "football", "soccer", "basketball", "lacrosse", "parents"],
    category: "fixit",
    why: "You sit 8-12 hours a day. Your hip flexors are shortened and pulling your pelvis into anterior tilt — that's what causes 70% of the low back pain I see in parents. This stretch targets the psoas and rectus femoris. Do it every single day and your back will feel different in a week.",
    targetMuscles: "Psoas, iliacus, rectus femoris",
    setsReps: "2×30 sec each side | Squeeze the glute, don't lean forward",
    commonMistakes: "Arching the lower back (defeats the purpose). Leaning forward instead of driving the hip forward. Not squeezing the glute.",
    coachingCue: "\"Back knee down, squeeze that glute HARD, then shift forward. You should feel the stretch deep in the front of the hip — not the lower back. If you feel your back, you're arching.\"",
    bestFor: "Low back pain, hip tightness, anyone who sits for a living. This is your daily medicine.",
  },
  {
    id: "couch-stretch",
    name: "Couch Stretch",
    sports: ["hockey", "football", "soccer", "parents"],
    category: "fixit",
    why: "The couch stretch is the advanced version of the hip flexor stretch — it adds a quad and rectus femoris component by putting the back foot up on a wall or couch. If you've been sitting for 20 years, this is the unlock. It's uncomfortable. That's how you know it's working.",
    targetMuscles: "Hip flexors, quads, rectus femoris",
    setsReps: "2×45 sec each side | Breathe through it",
    commonMistakes: "Starting too aggressive — back off if it's too intense. Arching the lower back. Not engaging the glute.",
    coachingCue: "\"Back foot on the wall, front foot flat. Squeeze the glute and drive tall. If you can't breathe, you're too deep — back off and breathe into the stretch. This one's a grind. Do it anyway.\"",
    bestFor: "Chronic hip tightness, desk warriors, anyone whose back hurts after sitting. Brutal but effective.",
  },

  // FIX IT — SHOULDER
  {
    id: "sleeper-stretch",
    name: "Sleeper Stretch",
    sports: ["baseball", "hockey", "lacrosse", "golf", "parents"],
    category: "fixit",
    why: "Internal rotation deficit is the #1 predictor of shoulder injury in throwing athletes. The sleeper stretch targets the posterior capsule of the shoulder. For parents, years of carrying kids and hunching over phones tighten the same structures. This is specific, targeted, and research-backed.",
    targetMuscles: "Posterior shoulder capsule, infraspinatus",
    setsReps: "3×30 sec each side | Gentle pressure, never force",
    commonMistakes: "Pressing too hard. Rolling the body forward. Shrugging the shoulder up.",
    coachingCue: "\"Lie on the shoulder, elbow at 90°, gently press the hand toward the floor. The second you feel a stretch, STOP and breathe. This is not a 'push harder' stretch — it's a capsule, not a muscle.\"",
    bestFor: "Throwing athletes, shoulder stiffness, post-surgery recovery, parents with shoulder pain from carrying kids.",
  },
  {
    id: "prone-ytw",
    name: "Prone Y-T-W Raise",
    sports: ["baseball", "hockey", "golf", "lacrosse", "football", "parents"],
    category: "fixit",
    why: "The lower traps and rotator cuff are the most neglected muscles in the body, and they're the reason shoulders break down. The Y-T-W hits lower traps (Y), mid traps (T), and external rotators (W) in three positions. No equipment needed. I program these for every single throwing athlete and every parent with desk posture.",
    targetMuscles: "Lower traps, mid traps, external rotators, rhomboids",
    setsReps: "2×8 each position | Bodyweight, hold top 2 sec",
    commonMistakes: "Using momentum. Shrugging the shoulders. Not holding at the top — the hold is where the work happens.",
    coachingCue: "\"Face down, arms hanging. Y — thumbs up, reach long overhead. T — arms out to the side, squeeze the shoulder blades. W — elbows bent, rotate hands up like you're showing the ceiling your palms. Hold each one. Feel the muscles between your shoulder blades burn.\"",
    bestFor: "Shoulder impingement, rounded posture, throwing arm maintenance. Every desk worker needs these.",
  },
  {
    id: "band-external-rotation",
    name: "Banded External Rotation",
    sports: ["baseball", "hockey", "lacrosse", "golf", "football", "parents"],
    category: "fixit",
    why: "The rotator cuff is four small muscles that keep the ball of the shoulder centered in the socket. When they're weak, the bigger muscles (pecs, delts) take over and impingement follows. External rotation is the most commonly weak pattern. This fixes it. 5 minutes a day, every day.",
    targetMuscles: "Infraspinatus, teres minor (external rotators)",
    setsReps: "3×15 each arm | Light band, slow and controlled",
    commonMistakes: "Elbow drifting away from the body. Using too heavy a band. Rushing the reps.",
    coachingCue: "\"Towel roll between elbow and ribs — keeps the elbow pinned. Rotate out slowly, pause at the end, return slowly. If you're using momentum, the band is too heavy.\"",
    bestFor: "Rotator cuff strengthening, shoulder impingement prevention, throwing athletes, parents who reach overhead.",
  },

  // FIX IT — GROIN / ADDUCTOR
  {
    id: "copenhagen-adductor",
    name: "Copenhagen Adductor Exercise",
    sports: ["hockey", "soccer", "lacrosse", "football", "basketball"],
    category: "fixit",
    why: "Groin injuries in hockey and soccer are preventable — the research on the Copenhagen protocol is overwhelming. It strengthens the adductors at length under eccentric load, which is exactly the position where they tear during skating and cutting. If you play a lateral sport, this is non-negotiable.",
    targetMuscles: "Adductors (eccentric emphasis)",
    setsReps: "3×6 each side | Slow 3-sec lowering",
    commonMistakes: "Top leg too far forward on the bench. Hips rotating. Dropping too fast — the eccentric is the medicine.",
    coachingCue: "\"Top leg on the bench, bottom leg hanging. Lower the bottom leg slowly for 3 seconds, then squeeze it back up. If the hips rotate, you're cheating. Own every inch of the movement.\"",
    bestFor: "Groin strain prevention, adductor rehab, hockey players, soccer players.",
  },
  {
    id: "side-lying-adduction",
    name: "Side-Lying Adduction",
    sports: ["hockey", "soccer", "lacrosse", "parents"],
    category: "fixit",
    why: "Before athletes are ready for Copenhagen, they start here. Side-lying adduction is a gentle way to load the adductor without body weight. For parents with groin tightness from sitting, this wakes up muscles that have been dormant for years. Zero equipment, zero excuses.",
    targetMuscles: "Adductors (inner thigh)",
    setsReps: "3×12 each side | Hold top 2 sec",
    commonMistakes: "Rolling the hips backward. Not lifting high enough. Moving from the knee instead of the hip.",
    coachingCue: "\"Bottom leg lifts. Top leg stays still. Squeeze the inner thigh at the top and hold. It doesn't need to be high — 6 inches with control beats 12 inches with sloppy form.\"",
    bestFor: "Groin rehab, adductor activation, beginners, parents with inner thigh pain.",
  },

  // FIX IT — HAMSTRING
  {
    id: "nordic-curl",
    name: "Nordic Hamstring Curl",
    sports: ["soccer", "football", "hockey", "lacrosse", "baseball", "basketball"],
    category: "fixit",
    why: "Hamstring tears are the #1 non-contact soft tissue injury in sport. The Nordic curl is the most researched exercise for hamstring injury prevention — it builds eccentric strength at long muscle lengths, which is exactly where hamstrings tear during sprinting. FIFA, the NFL, and every major sports organization recommends this. There's no excuse not to do it.",
    targetMuscles: "Hamstrings (eccentric emphasis at long lengths)",
    setsReps: "3×4-6 | Slow lowering, push up from floor to reset",
    commonMistakes: "Bending at the hips instead of staying tall. Not controlling the lowering. Trying to pull yourself back up (use hands to push off floor).",
    coachingCue: "\"Lock the hips — straight line from knees to shoulders. Lower yourself as slowly as possible. When you can't hold anymore, catch yourself and push back up. The goal is a 4-second descent.\"",
    bestFor: "Hamstring injury prevention, sprint speed, every field and ice sport athlete.",
  },
  {
    id: "sl-rdl-eccentric",
    name: "Single-Leg RDL (Eccentric Focus)",
    sports: ["hockey", "soccer", "football", "lacrosse", "baseball", "basketball", "parents"],
    category: "fixit",
    why: "This is the rehab version of the RDL — single leg, slow eccentric, light load. It retrains the hamstring to handle length under tension while building balance and hip stability. For parents, this is the exercise that fixes that nagging hamstring tightness that never goes away with stretching alone. Tightness is weakness — this makes the hamstring strong at length.",
    targetMuscles: "Hamstrings, glutes, hip stabilizers",
    setsReps: "3×8 each leg | 3-sec lowering, light weight or bodyweight",
    commonMistakes: "Rounding the back. Not hinging at the hip. Knee bending too much. Reaching for the floor instead of pushing the hips back.",
    coachingCue: "\"Push the hip back, not the chest down. Slow on the way down — 3 full seconds. Feel the hamstring load. If it doesn't burn on rep 6, you're not going slow enough.\"",
    bestFor: "Hamstring rehab, chronic hamstring tightness, balance work, parents who 'always pull their hamstring.'",
  },

  // FIX IT — SHIN SPLINTS
  {
    id: "tibialis-raise",
    name: "Tibialis Anterior Raise",
    sports: ["soccer", "basketball", "lacrosse", "football", "parents"],
    category: "fixit",
    why: "Shin splints are not a bone problem — they're a muscle problem. The tibialis anterior (front of the shin) is weak and overworked from absorbing impact without enough strength. This exercise builds the muscle directly. I've cleared shin splints in 3 weeks with this alone.",
    targetMuscles: "Tibialis anterior (front of shin)",
    setsReps: "3×20 | Back against wall, heels 12 inches out",
    commonMistakes: "Not going through full range. Heels too close to the wall. Going too fast.",
    coachingCue: "\"Back on the wall, heels about a foot out. Pull your toes up as high as possible, hold 1 second, lower slowly. You'll feel the front of your shins burn. That's the fix. Do these every day until the pain is gone.\"",
    bestFor: "Shin splints, runners, young athletes starting a new season, parents who started running again.",
  },
  {
    id: "toe-walks",
    name: "Toe Walks & Heel Walks",
    sports: ["soccer", "basketball", "football", "parents", "youth"],
    category: "fixit",
    why: "Before I program anything for shin splints, I test toe walks and heel walks. They tell me if the calves and tibialis anterior can handle basic load. If they can't walk 20 yards on their heels without the shins burning, that's the answer. Simple, zero equipment, and incredibly diagnostic.",
    targetMuscles: "Calves (toe walks), tibialis anterior (heel walks)",
    setsReps: "2×20 yards each | Daily until shin pain resolves",
    commonMistakes: "Walking too fast. Not maintaining full dorsiflexion on heel walks. Quitting when it burns.",
    coachingCue: "\"Toe walks first — as tall as you can. Then heel walks — toes pulled up, shins burning. 20 yards each. If the heel walks are brutal, that's the problem. Do them every day until they're easy.\"",
    bestFor: "Shin splints, ankle rehab, calf strengthening, warm-up for parents getting back to activity.",
  },

  // FIX IT — ANKLE
  {
    id: "single-leg-balance",
    name: "Single-Leg Balance (Eyes Closed)",
    sports: ["hockey", "soccer", "basketball", "lacrosse", "football", "parents", "youth"],
    category: "fixit",
    why: "After an ankle sprain, the ligaments heal but the proprioceptors (position sensors) in the joint don't retrain automatically. That's why people keep re-spraining. Single-leg balance with eyes closed forces the ankle stabilizers to work overtime. It's boring, but it prevents the next sprain.",
    targetMuscles: "Ankle stabilizers, peroneals, foot intrinsics",
    setsReps: "3×30 sec each foot | Progress to eyes closed",
    commonMistakes: "Looking at the floor (that's using vision, not proprioception). Not progressing to eyes closed. Standing on a flat surface forever — add a pillow.",
    coachingCue: "\"Barefoot. One foot. Eyes open first — build to 30 seconds. Then close your eyes. If you wobble, FIGHT for balance. That wobble is the ankle learning. When 30 seconds eyes closed is easy, stand on a pillow.\"",
    bestFor: "Post-ankle sprain, ankle instability, ACL prevention, parents who 'always roll their ankle.'",
  },
  {
    id: "banded-ankle-dorsiflexion",
    name: "Banded Ankle Dorsiflexion",
    sports: ["hockey", "soccer", "basketball", "lacrosse", "football", "baseball", "parents"],
    category: "fixit",
    why: "If the ankle can't dorsiflex (bend) properly, the knee caves in during squats and landings — that's how ACLs tear. Limited ankle mobility is the hidden cause of knee pain, shin splints, and poor squat form. The band pulls the talus backward to create the space the joint needs. I test this on day one.",
    targetMuscles: "Ankle joint (talocrural), calf complex",
    setsReps: "2×15 each ankle | Band anchored low, knee drives over toe",
    commonMistakes: "Band too high — it goes just below the ankle bone. Not driving the knee far enough over the toe. Heel coming off the ground.",
    coachingCue: "\"Band around the front of the ankle, pull coming from behind you. Drive the knee over the second toe. Heel stays DOWN. The band does the joint work — you drive the range. Go as far as you can and pulse.\"",
    bestFor: "Squat depth, knee pain, post-ankle sprain, shin splints, parents with stiff ankles.",
  },

  // FIX IT — IT BAND / LATERAL KNEE
  {
    id: "clamshell",
    name: "Clamshell",
    sports: ["hockey", "soccer", "lacrosse", "basketball", "football", "parents"],
    category: "fixit",
    why: "IT band pain is not an IT band problem — it's a glute medius problem. When the glute med is weak, the IT band takes over to stabilize the hip, and it gets overloaded. The clamshell isolates glute med without loading the knee. I start every lateral knee pain case here.",
    targetMuscles: "Glute medius (hip abduction + external rotation)",
    setsReps: "3×15 each side | Light band above knees, slow and controlled",
    commonMistakes: "Rolling the hips backward. Opening too wide. Going too fast — this is a precision exercise.",
    coachingCue: "\"Feet together. Rotate the knee open like a clamshell. Feel it in the upper glute — not the front of the hip, not the lower back. If you feel it anywhere else, reset your position. Slow and intentional.\"",
    bestFor: "IT band syndrome, lateral knee pain, runner's knee, hip weakness, parents with 'tight IT bands.'",
  },
  {
    id: "lateral-band-walk",
    name: "Lateral Band Walk",
    sports: ["hockey", "soccer", "lacrosse", "basketball", "football", "parents"],
    category: "fixit",
    why: "Once the clamshell wakes up the glute med, the band walk loads it functionally — in a standing position, which is how the hip actually works. This is the bridge between rehab and sport. If an athlete has knee valgus (knee caving) during squats or landing, this is the fix.",
    targetMuscles: "Glute medius, glute minimus, hip external rotators",
    setsReps: "3×12 steps each direction | Band above knees, stay low",
    commonMistakes: "Standing too tall. Taking steps that are too big. Letting the trailing leg snap back (control it).",
    coachingCue: "\"Quarter squat position. Band above the knees. Push the knees OUT against the band with every step. Small, controlled steps. Fight the band — don't let it win. You should be burning by step 8.\"",
    bestFor: "IT band rehab, knee valgus correction, ACL prevention, warm-up for any leg session.",
  },

  // FIX IT — ELBOW (YOUTH THROWING)
  {
    id: "wrist-flexor-ext",
    name: "Wrist Flexor & Extensor Curls",
    sports: ["baseball", "golf", "hockey", "lacrosse", "parents"],
    category: "fixit",
    why: "Little League elbow, golfer's elbow, tennis elbow — all the same root cause: the forearm muscles can't handle the repetitive stress. Wrist curls (palm up) strengthen the flexors. Reverse wrist curls (palm down) strengthen the extensors. Simple, boring, and the only thing that works long-term.",
    targetMuscles: "Forearm flexors (medial), forearm extensors (lateral)",
    setsReps: "3×15 each direction | 2-5 lb dumbbell or can of soup",
    commonMistakes: "Using too much weight. Moving the forearm instead of just the wrist. Not going through full range.",
    coachingCue: "\"Edge of the table. Wrist hangs off. Palm up — curl the weight up and lower slowly. Palm down — same thing. Light weight, high reps. This is rehab, not strength training. A can of soup works fine.\"",
    bestFor: "Elbow pain, throwing athletes, golfers, parents with tennis/golfer's elbow from typing or carrying kids.",
  },
  {
    id: "forearm-pronation-supination",
    name: "Forearm Pronation / Supination",
    sports: ["baseball", "golf", "hockey", "lacrosse", "parents"],
    category: "fixit",
    why: "The rotation of the forearm (turning a doorknob motion) is where the UCL and common flexor/extensor origins take the most stress. Strengthening pronation and supination builds the muscular support around the elbow joint. I've kept youth pitchers healthy for entire seasons with just this and the wrist curls.",
    targetMuscles: "Pronator teres, supinator, forearm rotators",
    setsReps: "3×12 each direction | Light hammer or weighted stick",
    commonMistakes: "Moving the whole arm instead of just rotating. Going too fast. Using too much weight.",
    coachingCue: "\"Elbow pinned to your side. Hold a hammer by the end. Rotate the hand palm down (pronation), then palm up (supination). Just the forearm rotates — nothing else moves. Slow and controlled.\"",
    bestFor: "Elbow rehab, throwing arm maintenance, youth pitchers, parents with wrist/elbow pain.",
  },

  // FIX IT — PARENT-SPECIFIC
  {
    id: "thoracic-extension",
    name: "Thoracic Extension Over Foam Roller",
    sports: ["hockey", "baseball", "golf", "parents"],
    category: "fixit",
    why: "Your upper back (thoracic spine) is supposed to extend and rotate — that's how you reach overhead, rotate in a golf swing, and breathe properly. After years of sitting and phone use, it locks up. When the thoracic spine doesn't move, the lower back and shoulders pay the price. This is the reset button.",
    targetMuscles: "Thoracic spine (extension mobilization)",
    setsReps: "2×10 extensions at 3 different positions along upper back",
    commonMistakes: "Rolling on the lower back (never foam roll the lumbar spine). Going too fast. Not supporting the head.",
    coachingCue: "\"Foam roller across your upper back. Hands behind your head. Extend over the roller — let your upper back bend backward. Move the roller up an inch. Repeat. Three positions, 10 reps each. You'll hear cracks. That's your thoracic spine waking up.\"",
    bestFor: "Desk posture, upper back stiffness, shoulder pain, breathing issues. Every parent who works at a computer needs this daily.",
  },
  {
    id: "glute-bridge",
    name: "Glute Bridge",
    sports: ["hockey", "soccer", "football", "basketball", "parents", "youth"],
    category: "fixit",
    why: "Sitting shuts off the glutes. Dead glutes mean the lower back does all the work — that's pain. The glute bridge is the simplest way to wake them up. No equipment, no gym, no excuses. I give this to every parent who tells me their back hurts. It works because the problem isn't the back — it's the glutes.",
    targetMuscles: "Glutes, hamstrings",
    setsReps: "3×15 | Hold top 3 sec, squeeze hard",
    commonMistakes: "Pushing through the toes instead of the heels. Hyperextending the lower back at the top. Not squeezing at the top.",
    coachingCue: "\"Feet flat, heels close to your butt. Drive through the heels. Squeeze the glutes at the top like you're cracking a walnut. Hold 3 seconds. If you feel this in your lower back, you're going too high.\"",
    bestFor: "Glute activation, low back pain, desk workers, parents who haven't worked out in years. Start here.",
  },
  {
    id: "doorway-chest-stretch",
    name: "Doorway Pec Stretch",
    sports: ["hockey", "baseball", "football", "parents"],
    category: "fixit",
    why: "Tight pecs pull the shoulders forward into internal rotation — that's the rounded posture you see in every parent who drives, types, and carries kids. Stretching the pec minor and major in a doorway opens the chest and takes pressure off the rotator cuff. 30 seconds, twice a day, in any doorway in your house.",
    targetMuscles: "Pec major, pec minor",
    setsReps: "2×30 sec each side at 3 angles (low, mid, high arm)",
    commonMistakes: "Leaning too aggressively. Not changing the arm angle. Shrugging the shoulder.",
    coachingCue: "\"Forearm on the doorframe. Step through until you feel the chest stretch. Three positions: arm low (stretches upper pec), arm at 90° (mid pec), arm high (lower pec/pec minor). Hold each for 30 seconds. Breathe.\"",
    bestFor: "Rounded shoulders, chest tightness, shoulder impingement, posture reset for desk workers.",
  },
  {
    id: "cat-cow",
    name: "Cat-Cow",
    sports: ["hockey", "golf", "parents", "youth"],
    category: "fixit",
    why: "The simplest spinal mobility drill that exists. Cat-cow moves the entire spine through flexion and extension, lubricates the discs with synovial fluid, and teaches body awareness. I use this as a diagnostic and a warmup. If someone is stiff in cat-cow, I know exactly where their movement restrictions are.",
    targetMuscles: "Entire spinal column, deep core",
    setsReps: "2×10 slow cycles | Match movement to breath",
    commonMistakes: "Moving too fast. Only moving the lower back (the thoracic spine should move too). Not breathing with the movement.",
    coachingCue: "\"Inhale — drop the belly, lift the chest, look forward. Exhale — round the back, tuck the chin, push the floor away. SLOW. Feel every vertebra move. If you find a sticky spot, spend extra time there.\"",
    bestFor: "Morning stiffness, warm-up, back pain, stress relief. Do this every morning before your feet hit the floor.",
  },
  {
    id: "dead-hang",
    name: "Dead Hang",
    sports: ["baseball", "hockey", "football", "parents"],
    category: "fixit",
    why: "Gravity is free decompression. Hanging from a bar opens up the shoulder joint, stretches the lats, decompresses the spine, and builds grip strength. For parents with compressed discs, shoulder stiffness, or just years of sitting — this is the simplest fix that nobody does. 30 seconds a day changes everything.",
    targetMuscles: "Shoulders (passive stretch), lats, spine (decompression), grip",
    setsReps: "3×20-30 sec | Build to 60 sec over time",
    commonMistakes: "Gripping too tight and shrugging. Not relaxing the shoulders. Swinging.",
    coachingCue: "\"Grab the bar, let everything hang. Relax the shoulders — let them stretch up toward your ears. Breathe. Don't swing. Just hang. Feel the spine decompress. If you can only do 10 seconds, start there. Every day, add 5 seconds.\"",
    bestFor: "Shoulder stiffness, spinal decompression, grip strength, parents with back/shoulder pain. Your daily reset.",
  },
  {
    id: "wall-angel",
    name: "Wall Angel",
    sports: ["baseball", "hockey", "golf", "parents"],
    category: "fixit",
    why: "Wall angels are the overhead mobility test and fix in one exercise. Back flat to the wall, arms sliding up — if you can't keep contact with the wall the whole time, you have a mobility deficit that's causing compensation. Most parents fail this test. That's not a diagnosis — it's a starting point.",
    targetMuscles: "Lower traps, serratus anterior, thoracic extensors",
    setsReps: "3×10 | Back and arms on wall entire time",
    commonMistakes: "Lower back arching off the wall. Elbows and wrists losing wall contact. Shrugging at the top.",
    coachingCue: "\"Flat back. Flatten the low back — tuck the pelvis under. Arms on the wall. Slide up and down. If you lose contact, STOP — that's your current range. Work there until it opens up. Don't force it.\"",
    bestFor: "Shoulder mobility, overhead restriction, posture correction, desk posture reversal.",
  },

  // FIX IT — ACL PREVENTION PROTOCOL
  {
    id: "acl-single-leg-squat",
    name: "Single-Leg Squat to Box",
    sports: ["soccer", "basketball", "lacrosse", "hockey", "football", "parents"],
    category: "fixit",
    why: "ACL tears happen when the knee collapses inward during deceleration or landing. The single-leg squat to a box exposes that pattern in a controlled environment. If the knee dives inward, we have a problem — and now we know about it BEFORE it becomes a season-ending injury. This is screening and strengthening in one exercise.",
    targetMuscles: "Quads, glute medius, VMO, hip stabilizers",
    setsReps: "3×8 each leg | Slow descent, touch box, stand up",
    commonMistakes: "Knee caving inward (valgus) — THE thing we're looking for. Falling onto the box instead of controlling the descent. Leaning forward excessively.",
    coachingCue: "\"Stand on one leg, box behind you. Sit back slow — 3 seconds down. Watch your knee. If it dives inside your big toe, STOP and reset. The knee tracks over the second toe. Touch the box, don't sit. Stand back up. Own it.\"",
    bestFor: "ACL prevention, knee stability, return-to-sport testing, female athletes (4-8x higher ACL risk).",
  },
  {
    id: "acl-drop-landing",
    name: "Drop Landing (Stick)",
    sports: ["soccer", "basketball", "lacrosse", "football", "hockey"],
    category: "fixit",
    why: "70% of ACL tears are non-contact — they happen during landing and cutting. If an athlete can't land from a 12-inch box and stick the landing with knees out, soft feet, and no wobble, they're at risk. I test this on day one. The landing is more important than the jump.",
    targetMuscles: "Quads, glutes, calves (eccentric absorption), hip stabilizers",
    setsReps: "3×5 | Step off 12-18 inch box, stick 3 sec",
    commonMistakes: "Landing stiff-legged. Knees caving inward. Landing loud (loud = high ground reaction force). Not sticking the landing.",
    coachingCue: "\"Step off the box — don't jump. Land soft. Quiet feet. Knees OUT, not in. Stick it for 3 full seconds. If your knees touch, you failed. Reset. A quiet landing is a safe landing.\"",
    bestFor: "ACL prevention, landing mechanics, jump preparation, female athletes, return-to-sport protocol.",
  },
  {
    id: "acl-lateral-bound",
    name: "Lateral Bound (Stick)",
    sports: ["hockey", "soccer", "basketball", "lacrosse", "football"],
    category: "fixit",
    why: "ACL tears don't happen going straight — they happen going sideways. The lateral bound trains single-leg deceleration in the frontal plane, which is exactly the movement pattern that tears ACLs. Bound laterally, stick the landing on one leg, knee out. If they can't control this, they're not ready for sport.",
    targetMuscles: "Glute medius, quads, ankle stabilizers (lateral deceleration)",
    setsReps: "3×5 each side | Stick each landing 3 sec",
    commonMistakes: "Knee collapsing on landing. Not sticking — bouncing to the next rep. Jumping too far before mastering the landing.",
    coachingCue: "\"Bound sideways — one leg to one leg. Stick it. Knee over the toe, not inside it. Hold 3 seconds. No wobble. If you can't stick it, make the distance shorter. The landing is the exercise, not the jump.\"",
    bestFor: "ACL prevention for cutting sports, change-of-direction training, hockey stride mechanics.",
  },
  {
    id: "acl-hamstring-bridge-march",
    name: "Single-Leg Bridge March",
    sports: ["soccer", "basketball", "lacrosse", "football", "hockey", "parents"],
    category: "fixit",
    why: "The hamstrings are the ACL's best friend — they pull the tibia backward and prevent the anterior shear that tears the ACL. Most athletes are quad-dominant, meaning the hamstrings can't keep up. Bridge marching builds single-leg hamstring and glute strength in the exact pattern that protects the knee.",
    targetMuscles: "Hamstrings, glutes (single-leg stability)",
    setsReps: "3×8 each leg | Bridge up, march one leg at a time, hold 2 sec",
    commonMistakes: "Hips dropping when one leg lifts — stay level. Pushing through toes instead of heels. Rushing.",
    coachingCue: "\"Bridge up. Hips level. Now march — lift one knee toward the chest without the hips dropping an inch. Hold 2 seconds. Put it down. Other side. If the hips drop, the glute on the standing leg is weak. That's what we're fixing.\"",
    bestFor: "ACL prevention, hamstring activation, glute strengthening, post-knee injury return.",
  },
  {
    id: "acl-decel-drill",
    name: "Deceleration Drill (Sprint to Stop)",
    sports: ["soccer", "football", "lacrosse", "basketball", "hockey", "baseball"],
    category: "fixit",
    why: "Nobody teaches athletes how to STOP. They train acceleration, speed, agility — but deceleration is where ACLs tear. This drill teaches athletes to brake with proper mechanics: hips back, knees out, weight distributed. I run this drill every week with every team I work with.",
    targetMuscles: "Quads (eccentric), glutes, hip stabilizers, core",
    setsReps: "5×20 yards | Sprint to full stop in 2 steps",
    commonMistakes: "Stopping upright. Knees caving. Taking too many steps to stop. Not loading the hips.",
    coachingCue: "\"Sprint 75%. On my whistle, STOP in 2 steps. Hips back, knees out, chest up. Freeze. If your knees are inside your toes, you just tore your ACL in a game. Fix it here where it's safe.\"",
    bestFor: "ACL prevention, change-of-direction safety, team sports, any sport with cutting and stopping.",
  },

  // FIX IT — ROTATOR CUFF PROTOCOL
  {
    id: "rc-sidelying-er",
    name: "Side-Lying External Rotation",
    sports: ["baseball", "hockey", "lacrosse", "golf", "football", "parents"],
    category: "fixit",
    why: "The side-lying position isolates the infraspinatus and teres minor — the two external rotators that decelerate the arm during throwing. When these are weak, the labrum, bicep tendon, and UCL take the force instead. This is the foundational rotator cuff exercise. Simple, effective, and I've used it for 20+ years.",
    targetMuscles: "Infraspinatus, teres minor (external rotators)",
    setsReps: "3×15 each arm | 2-5 lb max, slow and controlled",
    commonMistakes: "Using too much weight (this is rehab, not strength). Elbow drifting away from the body. Rolling the body backward to cheat.",
    coachingCue: "\"Lie on your side, working arm on top. Towel roll between elbow and ribs. Rotate the hand toward the ceiling — slow up, slow down. If you need more than 5 lbs, you're doing it wrong. The rotator cuff is small. Train it that way.\"",
    bestFor: "Rotator cuff strengthening, throwing arm maintenance, shoulder impingement, post-surgery protocol.",
  },
  {
    id: "rc-ir-strength",
    name: "Cable/Band Internal Rotation",
    sports: ["baseball", "hockey", "lacrosse", "golf", "football", "parents"],
    category: "fixit",
    why: "Internal rotation strength matters as much as external rotation, but it's trained differently. The subscapularis is the most commonly torn rotator cuff muscle — and it's the internal rotator. Band internal rotation at the side builds the subscap in isolation without the bigger muscles taking over.",
    targetMuscles: "Subscapularis (internal rotator)",
    setsReps: "3×15 each arm | Light band, elbow pinned to side",
    commonMistakes: "Elbow moving away from the body. Using momentum. Band too heavy — compensating with pecs.",
    coachingCue: "\"Elbow glued to your side. Pull the band across your body. Slow on the way out — that's the eccentric, and it's where the work happens. Don't let the band snap back.\"",
    bestFor: "Rotator cuff balance, subscap strengthening, throwing athletes, shoulder stability.",
  },
  {
    id: "rc-empty-can",
    name: "Full Can Raise (Scaption)",
    sports: ["baseball", "hockey", "lacrosse", "golf", "football", "parents"],
    category: "fixit",
    why: "The supraspinatus initiates every overhead movement — it's the starter motor of the shoulder. When it's weak or inflamed, reaching overhead hurts. The full can raise (thumbs UP, not the old 'empty can' with thumbs down) strengthens it without impinging the tendon under the acromion. The research changed this one — thumbs up is the way.",
    targetMuscles: "Supraspinatus (primary), deltoid",
    setsReps: "3×12 each arm | 2-5 lb, 30° in front of shoulder line",
    commonMistakes: "Thumbs down (the old 'empty can' — impinges the tendon). Going above 90° (not needed for isolation). Using too much weight.",
    coachingCue: "\"Thumbs UP — like you're pouring a drink for someone. Raise the arm 30° in front of your body, not straight to the side. Stop at shoulder height. Slow up, slow down. This is precision work.\"",
    bestFor: "Supraspinatus tendinitis, shoulder impingement, overhead athletes, post-injection recovery.",
  },
  {
    id: "rc-prone-er-90",
    name: "Prone External Rotation at 90° Abduction",
    sports: ["baseball", "hockey", "lacrosse", "football"],
    category: "fixit",
    why: "This is the advanced rotator cuff position — arm at 90° abduction, mimicking the throwing/serving position. The external rotators have to fire in the exact position where they work during sport. Once the basic side-lying ER is strong, this is the progression that bridges rehab to performance.",
    targetMuscles: "Infraspinatus, teres minor (at sport-specific angle)",
    setsReps: "3×10 each arm | 2-3 lb, face down on bench or floor",
    commonMistakes: "Upper arm dropping below 90°. Using momentum. Going too heavy — this is about position, not load.",
    coachingCue: "\"Face down, arm hanging off the edge at 90°. Elbow bent 90°. Rotate the hand up toward the ceiling without lifting the elbow. Hold the top 2 seconds. This is the throwing position — own it under control before you ever throw at full speed.\"",
    bestFor: "Throwing athletes, overhead sport shoulder maintenance, post-impingement return-to-throw.",
  },
  {
    id: "rc-lower-trap-raise",
    name: "Prone Lower Trap Raise (Y-Raise)",
    sports: ["baseball", "hockey", "lacrosse", "golf", "football", "parents"],
    category: "fixit",
    why: "The lower trapezius is the forgotten shoulder muscle. It anchors the shoulder blade down and back during overhead movement. When it's weak, the upper traps take over — that's the shrug you see in athletes with impingement. This exercise isolates the lower trap and teaches the shoulder blade to move correctly.",
    targetMuscles: "Lower trapezius, serratus anterior",
    setsReps: "3×10 | Bodyweight or 1-2 lb, hold top 3 sec",
    commonMistakes: "Shrugging (upper trap dominance). Not reaching long enough. Lifting too high.",
    coachingCue: "\"Face down, arms in a Y overhead. Thumbs up. Lift the arms just off the floor — you don't need to go high. Reach LONG. Feel the muscles between your shoulder blades and your lower back light up. Hold 3 seconds. That burn is the lower trap finally doing its job.\"",
    bestFor: "Shoulder impingement, scapular dyskinesis, overhead athletes, posture correction.",
  },
  {
    id: "rc-rhythmic-stabilization",
    name: "Rhythmic Stabilization (Ball on Wall)",
    sports: ["baseball", "hockey", "lacrosse", "football", "basketball", "parents"],
    category: "fixit",
    why: "The rotator cuff doesn't just move the shoulder — it stabilizes it. Rhythmic stabilization trains the cuff to fire reactively by pressing a ball into the wall and creating small perturbations. This builds the dynamic stability that protects the shoulder during unpredictable sport movements like checking, tackling, and fall bracing.",
    targetMuscles: "All four rotator cuff muscles (reactive stabilization)",
    setsReps: "3×30 sec each arm | Small circles and perturbations",
    commonMistakes: "Pressing too hard. Moving from the shoulder instead of the hand. Not varying the direction of perturbation.",
    coachingCue: "\"Hand on ball, ball on wall, arm at 90°. Press lightly. Now make small circles — the ball moves, your shoulder stabilizes. Faster circles = harder. Alphabet letters with the ball for an extra challenge. This trains the cuff to react, not just move.\"",
    bestFor: "Post-surgery rehab, shoulder instability, collision sport athletes, return-to-contact clearance.",
  },

  // FIX IT — POST-CONCUSSION RETURN-TO-PLAY
  {
    id: "concussion-walk",
    name: "Light Walking (Stage 1 – Symptom-Limited)",
    sports: ["hockey", "football", "soccer", "lacrosse", "basketball", "baseball"],
    category: "fixit",
    why: "Concussion recovery starts with light aerobic activity BELOW the symptom threshold. The old 'sit in a dark room' approach is outdated — current research shows controlled sub-symptom exercise speeds recovery by increasing blood flow to the brain. But the key word is SUB-SYMPTOM. If symptoms increase, stop immediately.",
    targetMuscles: "Cardiovascular system (light aerobic demand)",
    setsReps: "10-15 min walk | Heart rate stays below symptom threshold",
    commonMistakes: "Going too hard too soon. Ignoring headache or dizziness that increases. Not tracking symptoms with a checklist before and after.",
    coachingCue: "\"Walk at a pace where you can hold a conversation. If your headache increases, you feel dizzy, or anything gets worse — STOP. Write down your symptoms before and after. We need to find the level you can tolerate, and then stay just below it. This is not training. This is recovery.\"",
    bestFor: "Post-concussion Stage 1. Must be cleared by a physician before beginning. No exceptions.",
  },
  {
    id: "concussion-bike",
    name: "Stationary Bike (Stage 2 – Light Aerobic)",
    sports: ["hockey", "football", "soccer", "lacrosse", "basketball", "baseball"],
    category: "fixit",
    why: "Once walking is tolerated without symptom increase for 2+ days, we progress to light stationary cycling. The bike is ideal because there's no head impact risk, the intensity is easily controlled, and we can monitor heart rate precisely. The Buffalo Concussion Protocol uses this exact progression.",
    targetMuscles: "Cardiovascular system (moderate aerobic demand)",
    setsReps: "15-20 min | 60-70% max heart rate, no resistance changes",
    commonMistakes: "Increasing intensity too quickly. Competing with themselves. Not monitoring symptoms continuously during the ride.",
    coachingCue: "\"Easy spin. Heart rate monitor on. Stay in the green zone. If symptoms increase AT ALL, drop the intensity or stop. No standing on pedals. No intervals. This is a controlled test, not a workout. Two symptom-free days here before we move on.\"",
    bestFor: "Post-concussion Stage 2. Requires symptom-free completion of Stage 1 for minimum 48 hours.",
  },
  {
    id: "concussion-sport-specific",
    name: "Sport-Specific Drill (Stage 3 – No Contact)",
    sports: ["hockey", "football", "soccer", "lacrosse", "basketball", "baseball"],
    category: "fixit",
    why: "Stage 3 introduces sport-specific movement patterns WITHOUT contact. Skating without checking, shooting without heading, fielding without sliding. This tests the vestibular system (balance), visual tracking, and cognitive processing under sport-like demands. The brain needs to prove it can handle complexity before contact is allowed.",
    targetMuscles: "Sport-specific movement patterns, vestibular system, visual processing",
    setsReps: "20-30 min | Sport drills at 70-80% effort, no contact, no heading",
    commonMistakes: "Adding contact too soon. Going full speed. Ignoring subtle symptoms like 'feeling off' or difficulty concentrating.",
    coachingCue: "\"Run your sport drills. Skating, stick handling, shooting. Footwork, catching, fielding. But NO contact, NO heading, and NO full-speed cuts. If you feel 'foggy' or 'off,' that counts as a symptom. Two clean days here before we add complexity.\"",
    bestFor: "Post-concussion Stage 3. Must complete Stage 2 symptom-free for 48 hours minimum.",
  },
  {
    id: "concussion-non-contact-practice",
    name: "Full Non-Contact Practice (Stage 4)",
    sports: ["hockey", "football", "soccer", "lacrosse", "basketball", "baseball"],
    category: "fixit",
    why: "Stage 4 is a full practice with the team — full speed, full cognitive demand — but zero contact. This tests the brain under game-like stress: reading plays, making decisions, reacting to teammates, managing fatigue. If symptoms return here, we go back to Stage 3. No shortcuts.",
    targetMuscles: "Full sport demands minus contact — conditioning, agility, decision-making",
    setsReps: "Full practice duration | Full speed, zero contact",
    commonMistakes: "Coach allowing 'light' contact. Athlete hiding symptoms to get back faster. Not having a baseline symptom checklist to compare against.",
    coachingCue: "\"Full practice. Full speed. Full effort. But if anyone touches you, you're out. I need your brain to handle everything except impact. After practice, fill out the symptom checklist. If everything is clean for 48 hours, we see the doctor for clearance.\"",
    bestFor: "Post-concussion Stage 4. Must complete Stage 3 symptom-free for 48 hours.",
  },
  {
    id: "concussion-medical-clearance",
    name: "Medical Clearance & Full Contact (Stage 5)",
    sports: ["hockey", "football", "soccer", "lacrosse", "basketball", "baseball"],
    category: "fixit",
    why: "ONLY a licensed physician clears an athlete for contact after concussion. Not the coach. Not the parent. Not the trainer. The physician reviews the symptom progression, performs neurocognitive testing, and makes the final call. I include this in the library because parents need to understand: this step is non-negotiable. No clearance, no contact. Period.",
    targetMuscles: "N/A — this is a medical clearance step, not an exercise",
    setsReps: "Physician evaluation required before ANY contact",
    commonMistakes: "Skipping the doctor. Self-clearing. Coach clearing without medical sign-off. Rushing back for a big game.",
    coachingCue: "\"You don't play until the doctor says you play. I don't care if it's the championship. I don't care if you 'feel fine.' The brain doesn't always tell you the truth after a concussion. Get cleared. Then play. No exceptions. I've pulled my own athletes from games for this.\"",
    bestFor: "Post-concussion Stage 5. The final gate before return to full sport. Non-negotiable.",
  },

  // FIX IT — VESTIBULAR / BALANCE (POST-CONCUSSION SUPPORT)
  {
    id: "concussion-gaze-stabilization",
    name: "Gaze Stabilization Exercise",
    sports: ["hockey", "football", "soccer", "lacrosse", "basketball", "baseball"],
    category: "fixit",
    why: "Post-concussion, the vestibulo-ocular reflex (VOR) — the system that keeps your vision stable while your head moves — often gets disrupted. That's why athletes get dizzy turning their heads. Gaze stabilization retrains the VOR by focusing on a fixed point while moving the head. It's uncomfortable at first. That's the point — you're retraining the system.",
    targetMuscles: "Vestibulo-ocular reflex (VOR), cervical proprioceptors",
    setsReps: "3×30 sec | Eyes on target, head moves side to side, then up/down",
    commonMistakes: "Moving the head too fast. Losing focus on the target. Doing this when actively symptomatic (do it at sub-symptom threshold).",
    coachingCue: "\"Hold a card with a letter at arm's length. Focus on the letter. Slowly turn your head left and right — the letter should stay clear. If it blurs, slow down. Speed up gradually over days. This retrains the connection between your eyes and inner ear.\"",
    bestFor: "Post-concussion dizziness, vestibular rehab, balance issues after head injury.",
  },
  {
    id: "concussion-tandem-walk",
    name: "Tandem Walk (Heel-to-Toe)",
    sports: ["hockey", "football", "soccer", "lacrosse", "basketball", "baseball"],
    category: "fixit",
    why: "Balance testing is part of every concussion protocol (SCAT5). The tandem walk exposes vestibular and cerebellar deficits that aren't obvious during normal walking. If an athlete can't heel-to-toe walk a straight line without wobbling, the brain is still recovering — regardless of what they say about symptoms.",
    targetMuscles: "Vestibular system, proprioception, core stabilization",
    setsReps: "3×20 steps | Heel-to-toe, eyes forward, arms at sides",
    commonMistakes: "Looking at the feet (tests vision, not vestibular). Arms out for balance (standardize with arms at sides). Going too fast.",
    coachingCue: "\"Heel-to-toe. Straight line. Eyes forward — don't look down. Arms at your sides. If you step off the line or wobble, that tells us something. We progress when this is easy with eyes open, then we try it eyes closed. No rushing recovery.\"",
    bestFor: "Post-concussion balance assessment, vestibular screening, return-to-sport readiness testing.",
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
  { key: "parents", label: "Parents" },
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

const FIXIT_SUB_TABS = [
  { key: "all", label: "All Fix It" },
  { key: "knee", label: "Knee" },
  { key: "back", label: "Back Pain" },
  { key: "shoulder", label: "Shoulder" },
  { key: "rotator-cuff", label: "Rotator Cuff" },
  { key: "groin", label: "Groin" },
  { key: "hamstring", label: "Hamstring" },
  { key: "shin", label: "Shin Splints" },
  { key: "ankle", label: "Ankle" },
  { key: "it-band", label: "IT Band" },
  { key: "elbow", label: "Elbow" },
  { key: "acl", label: "ACL Prevention" },
  { key: "concussion", label: "Concussion" },
  { key: "posture", label: "Posture / Desk" },
];

// Derive sub-category from exercise id for fixit exercises
const getFixitSubCategory = (id: string): string => {
  if (id.startsWith("acl-")) return "acl";
  if (id.startsWith("rc-")) return "rotator-cuff";
  if (id.startsWith("concussion-")) return "concussion";
  if (id === "banded-tke") return "knee";
  if (id === "nordic-curl" || id === "sl-rdl-eccentric") return "hamstring";
  if (id === "copenhagen-adductor" || id === "side-lying-adduction") return "groin";
  if (id === "tibialis-raise" || id === "toe-walks") return "shin";
  if (id === "single-leg-balance" || id === "banded-ankle-dorsiflexion") return "ankle";
  if (id === "clamshell" || id === "lateral-band-walk") return "it-band";
  if (id === "wrist-flexor-ext" || id === "forearm-pronation-supination") return "elbow";
  if (id === "mcgill-curl-up" || id === "side-plank" || id === "bird-dog-fixit" || id === "hip-flexor-release" || id === "couch-stretch") return "back";
  if (id === "wall-slide" || id === "sleeper-stretch" || id === "prone-ytw" || id === "band-external-rotation") return "shoulder";
  if (id === "eccentric-calf-raise") return "ankle";
  if (id === "thoracic-extension" || id === "doorway-chest-stretch" || id === "cat-cow" || id === "wall-angel") return "posture";
  if (id === "glute-bridge") return "back";
  if (id === "dead-hang") return "posture";
  return "all";
};

const ExerciseLibrary = () => {
  const [sport, setSport] = useState("all");
  const [category, setCategory] = useState("all");
  const [fixitSub, setFixitSub] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = EXERCISES.filter((ex) => {
    const matchesSport = sport === "all" || ex.sports.includes(sport);
    const matchesCategory = category === "all" || ex.category === category;
    const matchesFixitSub = category !== "fixit" || fixitSub === "all" || getFixitSubCategory(ex.id) === fixitSub;
    const matchesSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase()) || ex.why.toLowerCase().includes(search.toLowerCase());
    return matchesSport && matchesCategory && matchesFixitSub && matchesSearch;
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
              onClick={() => { setCategory(t.key); setFixitSub("all"); }}
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

      {/* Fix It sub-filter */}
      {category === "fixit" && (
        <div className="mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">By Body Part / Protocol</span>
          <div className="flex gap-1 flex-wrap">
            {FIXIT_SUB_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setFixitSub(t.key)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                  fixitSub === t.key
                    ? "bg-primary/80 text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
