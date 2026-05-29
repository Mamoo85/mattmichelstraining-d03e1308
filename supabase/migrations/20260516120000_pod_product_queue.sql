-- pod_product_queue: Lovable-editable table that drives printify-product-creator.
-- Add rows here (via Lovable or Supabase Studio) instead of editing code.
-- The printify-product-creator function reads from this table when it exists.

create table if not exists pod_product_queue (
  id            bigserial primary key,
  name          text        not null,
  product_type  text        not null check (product_type in ('tshirt','hoodie','mug','tote')),
  image_prompt  text        not null,
  description   text        not null,
  tags          text[]      not null default '{}',
  retail_price  int         not null, -- cents, e.g. 1899 = $18.99 (free shipping baked in)
  status        text        not null default 'pending'
                            check (status in ('pending','processing','published','error')),
  error_msg     text,
  printify_id   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_pod_product_queue_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger pod_product_queue_updated_at
  before update on pod_product_queue
  for each row execute function update_pod_product_queue_updated_at();

-- RLS: service role bypasses; anon can read (for Lovable preview); no public write
alter table pod_product_queue enable row level security;

create policy "service role full access"
  on pod_product_queue for all
  using (auth.role() = 'service_role');

create policy "anon read"
  on pod_product_queue for select
  using (true);

-- Seed the 20 Father's Day 2026 products so they are immediately visible in Lovable
insert into pod_product_queue (name, product_type, image_prompt, description, tags, retail_price) values

-- MUGS
('Dad Jokes: Undefeated – Father''s Day Mug', 'mug',
 'Bold vintage trophy badge with bold serif text ''Dad Jokes: Undefeated'' arching over top and ''Est. Father''s Day'' below, gold trophy icon centered, black and gold on pure white #FFFFFF background, rectangular print area, minimum 20% white border on all sides, nothing touching edges, print-ready',
 'The ultimate tribute to every dad who has groaned his family out of the room. This mug celebrates the dad joke as the art form it truly is.',
 array['dad jokes mug','funny dad mug','father''s day mug','dad humor gift','gift for dad','funny father mug'], 1899),

('Reel Cool Dad – Fishing Father''s Day Mug', 'mug',
 'Vintage fishing illustration with a leaping bass fish and crossed fishing rods, bold retro text ''Reel Cool Dad'' in rustic serif font, earthy brown and navy on pure white #FFFFFF background, rectangular print area, minimum 20% white border on all sides, nothing touching edges, print-ready',
 'For the dad who is happiest when his line is in the water. The perfect Father''s Day mug for every fishing dad.',
 array['fishing dad mug','reel cool dad gift','fisherman dad mug','fishing father gift','father''s day mug','fishing gift for dad'], 1899),

('The Man, The Myth, The Legend – Dad Mug', 'mug',
 'Bold three-line stacked typography: ''The Man'' in medium serif, ''The Myth'' in italic, ''The Legend'' in large bold serif, decorative crown icon above and thin line dividers between each line, black on pure white #FFFFFF background, rectangular print area, minimum 20% white border on all sides, nothing touching edges, print-ready',
 'He''s not just a dad — he''s a legend. This classic mug says what every kid already knows about their father.',
 array['the man the myth the legend mug','legend dad mug','funny dad mug','father''s day gift mug','best dad mug','dad legend gift'], 1899),

('Dog Dad Fueled by Coffee – Pet Dad Mug', 'mug',
 'Cute cartoon dog sitting next to a steaming coffee cup, bold handlettered text ''Dog Dad: Fueled by Coffee and Dog Hair'', small paw prints scattered around the text, black line art on pure white #FFFFFF background, rectangular print area, minimum 20% white border on all sides, nothing touching edges, print-ready',
 'Half dog dad, half coffee addict — all heart. The perfect mug for dads who consider their dog their firstborn.',
 array['dog dad mug','dog dad gift','pet dad mug','funny dog dad gift','father''s day dog dad','dog lover dad mug'], 1899),

('Golf Dad: Par-fectly Awesome – Golfing Mug', 'mug',
 'Retro golf badge with crossed golf clubs and golf ball icon, bold pun text ''Golf Dad: Par-fectly Awesome'' in vintage serif font with sunburst rays behind the badge, forest green and black on pure white #FFFFFF background, rectangular print area, minimum 20% white border on all sides, nothing touching edges, print-ready',
 'Par-fect for the dad who lives on the green. A hilarious Father''s Day mug for every golf-obsessed dad.',
 array['golf dad mug','golf gift for dad','golfer dad mug','funny golf mug','father''s day golf gift','golf dad father''s day'], 1899),

('I''m Not Sleeping, I''m Resting My Eyes – Dad Mug', 'mug',
 'Whimsical cartoon of a dad asleep in an armchair with ZZZ bubbles floating up, bold handlettered arc text ''I''m Not Sleeping'' above and ''I''m Resting My Eyes'' below the illustration, black line art on pure white #FFFFFF background, rectangular print area, minimum 20% white border on all sides, nothing touching edges, print-ready',
 'The official dad defense for napping at any time of day. A mug that gets funnier every time he falls asleep holding it.',
 array['funny dad mug','dad nap mug','relatable dad gift','humor mug for dad','father''s day funny mug','sleeping dad mug'], 1899),

('Grillin'' Chillin'' Refillin'' – BBQ Dad Mug', 'mug',
 'Bold retro typography in three stacked lines: ''Grillin'''' in large red text, ''Chillin'''' in navy text, ''Refillin'''' in large red text, small BBQ grill with flame icon between the lines, vintage summer style on pure white #FFFFFF background, rectangular print area, minimum 20% white border on all sides, nothing touching edges, print-ready',
 'The dad life trilogy: grill it, chill it, refill it. The essential mug for every BBQ-king dad who runs on meat and sunshine.',
 array['bbq dad mug','grill dad mug','funny dad mug','grilling gift dad','father''s day bbq mug','grill master mug'], 1899),

('World''s Okayest Dad – Funny Father''s Day Mug', 'mug',
 'Ironic award ribbon illustration with bold text ''World''s Okayest Dad'' in vintage trophy font inside the ribbon, self-deprecating humor design, blue ribbon with gold trim on pure white #FFFFFF background, rectangular print area, minimum 20% white border on all sides, nothing touching edges, print-ready',
 'Not the best dad. Not the worst dad. Solidly, consistently average — and he knows it. The funniest honest mug you can gift.',
 array['world''s okayest dad mug','funny dad mug','sarcastic dad gift','humorous dad mug','father''s day funny','okayest dad mug'], 1899),

-- TSHIRTS
('Grill Master: The Legend, The Man, The Dad – BBQ Tee', 'tshirt',
 'Bold circular badge design with crossed barbecue tongs and spatula, flames at the bottom, ''GRILL MASTER'' arching over the top in bold serif, ''The Legend. The Man. The Dad.'' centered inside, vintage distressed look, black and red on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'Crown him king of the backyard. This BBQ badge shirt is the ultimate Father''s Day tribute for the dad who takes grilling very seriously.',
 array['grill master shirt','bbq dad tshirt','funny dad shirt','grill dad tee','father''s day shirt','bbq gift shirt'], 2299),

('Hi Hungry, I''m Dad – Classic Dad Joke Tee', 'tshirt',
 'Clean bold sans-serif typography ''Hi Hungry, I''m Dad'' in large centered text with a simple grinning face icon above it, minimal and punchy single-color design, black on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'The dad joke that started them all. This shirt is both the setup and the punchline — worn by the man responsible for both.',
 array['hi hungry i''m dad shirt','dad joke tshirt','funny dad tee','classic dad joke shirt','father''s day funny shirt','dad humor tshirt'], 2299),

('Girl Dad – Proud Girl Dad Tee', 'tshirt',
 'Elegant bold serif text ''Girl Dad'' as the focal point with a small delicate heart accent below it, clean minimal two-word design, strong but warm typography, black on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'For the dad outnumbered by daughters who wouldn''t have it any other way. Simple, proud, and perfect for Father''s Day.',
 array['girl dad shirt','girl dad tshirt','father daughter tee','proud girl dad shirt','father''s day girl dad','dad of daughters shirt'], 2299),

('I Tell Dad Jokes Periodically – Science Pun Tee', 'tshirt',
 'Clever design with three periodic table element-style boxes arranged prominently spelling out key letters, clean science aesthetic, bold text below ''I Tell Dad Jokes Periodically'', black and white chemistry lab style on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'He doesn''t just tell dad jokes — he tells them periodically. For the dad who makes the science nerds and the pun lovers groan equally.',
 array['dad jokes periodically shirt','science dad tshirt','chemistry dad shirt','nerdy dad tee','periodic table dad shirt','funny science dad'], 2299),

('The Lawnfather – Lawn Care Dad Tee', 'tshirt',
 'Cinematic parody title treatment: ''THE LAWNFATHER'' in dramatic bold italic serif font with a silhouette of a man riding a lawn mower below, grass blades at the bottom edge, moody dramatic style, black on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'He''ll make you an offer you can''t refuse — mow the lawn or else. For the dad who treats his yard like his personal empire.',
 array['lawnfather shirt','lawn mowing dad tee','funny dad tshirt','lawn dad shirt','father''s day lawn gift','lawn care dad shirt'], 2299),

('I Paused My Game to Be Here – Gamer Dad Tee', 'tshirt',
 'Retro 8-bit pixel art game controller graphic centered above bold pixel-font text ''I Paused My Game to Be Here'' with smaller text below ''You''re Welcome'', black and white pixel design on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'The sacrifice was real. This shirt lets everyone know exactly what he gave up to attend this dinner, event, or Tuesday in general.',
 array['gamer dad shirt','i paused my game tshirt','gaming dad tee','funny gamer dad shirt','father''s day gamer gift','video game dad shirt'], 2299),

('Dad Bod: Father Figure – Humor Tee', 'tshirt',
 'Retro fitness magazine headline style: large bold distressed text ''DAD BOD'' as the main header with ''Father Figure'' as a bold italic subtitle below, small vintage barbell icon, self-deprecating humor aesthetic, black on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'It''s not a dad bod — it''s a Father Figure. For the dad who has fully embraced his physique and wants everyone to know it.',
 array['dad bod shirt','father figure tshirt','funny dad body tee','humor dad shirt','father''s day funny shirt','dad bod tshirt gift'], 2299),

('I Work Hard So My Dog Can Have a Better Life – Dog Dad Tee', 'tshirt',
 'Cute cartoon dog with sunglasses lounging in a hammock between two trees, bold handlettered text above ''I Work Hard So My Dog Can Have a Better Life'', playful black and white illustration on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'His dog has a better work-life balance than him, and he is completely fine with that. The truest shirt any dog dad will ever own.',
 array['dog dad shirt','dog dad tshirt','funny dog dad gift','dog lover dad tee','pet dad shirt','father''s day dog shirt'], 2299),

-- HOODIES
('Ain''t No Hood Like Fatherhood – Dad Hoodie', 'hoodie',
 'Bold graffiti-style lettering ''Ain''t No Hood Like Fatherhood'' with a small crown graphic above, urban street art aesthetic that is wholesome and funny, black on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'The streets were never this wholesome. A bold hoodie that lets the world know fatherhood is the realest hood there is.',
 array['ain''t no hood like fatherhood','funny dad hoodie','fatherhood sweatshirt','dad hoodie gift','father''s day hoodie','dad humor sweatshirt'], 3899),

('Dad Est. 2026 – New Dad Achievement Unlocked Hoodie', 'hoodie',
 'Vintage distressed circular badge design with ''DAD EST. 2026'' as the main large text, a small retro game achievement star icon, and ''Achievement Unlocked: Dad Mode'' as a subtitle in smaller text around the bottom arc, black and gold on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'For the brand new dad earning his stripes in 2026. The ultimate new dad hoodie celebrating the beginning of the greatest adventure.',
 array['new dad hoodie 2026','dad est 2026 sweatshirt','new dad gift','first father''s day hoodie','dad 2026 gift','new dad achievement hoodie'], 3899),

('Tired Dads Club – Dad Humor Hoodie', 'hoodie',
 'Vintage club membership badge with bold text ''TIRED DADS CLUB'' as the header, ''Est. Forever'' as subtitle, a coffee cup with steam as the club icon, distressed vintage badge style, black on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, DTG print-ready',
 'Membership is automatic. Benefits include zero sleep, endless love, and the right to fall asleep anywhere. For every dad who earned it.',
 array['tired dads club hoodie','tired dad sweatshirt','funny dad hoodie','dad humor hoodie','exhausted dad gift','father''s day hoodie funny'], 3899),

-- TOTE
('Reel Cool Dad – Fishing Dad Tote Bag', 'tote',
 'Bold vintage fishing illustration with a jumping bass fish above, crossed fishing rods below, bold retro text ''Reel Cool Dad'' in rustic weathered serif font, outdoor adventure badge aesthetic, black line art on pure white #FFFFFF background, full design centered with generous white padding on all sides, nothing touching frame edges, print-ready tote design',
 'The carry-all for the dad who has his tackle box packed and his excuses ready. A stylish tote for every fishing dad''s gear and adventures.',
 array['fishing dad tote','reel cool dad bag','fisherman tote bag','dad fishing tote','father''s day fishing bag','fishing dad gift bag'], 2099);

comment on table pod_product_queue is
  'Queue of POD products to publish. Edit via Lovable or Supabase Studio. '
  'printify-product-creator reads status=pending rows and processes them. '
  'Set status=pending to re-queue a failed product.';
